"""
AI Insights Services — Anomaly Detection, Forecasting, Natural Language Queries
"""
from django.utils import timezone
from django.db.models import Avg, StdDev, Sum, Count
from decimal import Decimal
from datetime import timedelta
import json
import math

import logging
import re

from .models import AIInsight, AnomalyDetection, Forecast, NLQuery
from apps.finance.exceptions import ValidationError

logger = logging.getLogger(__name__)


class InsightService:
    """Generate and manage AI insights."""

    @staticmethod
    def list_insights(company, module=None, unread_only=False):
        qs = AIInsight.objects.filter(company=company, is_dismissed=False)
        if module:
            qs = qs.filter(module=module)
        if unread_only:
            qs = qs.filter(is_read=False)
        return qs

    @staticmethod
    def mark_read(company, insight_id):
        insight = AIInsight.objects.get(pk=insight_id, company=company)
        insight.is_read = True
        insight.save(update_fields=['is_read'])
        return insight

    @staticmethod
    def dismiss(company, insight_id):
        insight = AIInsight.objects.get(pk=insight_id, company=company)
        insight.is_dismissed = True
        insight.save(update_fields=['is_dismissed'])
        return insight

    @staticmethod
    def summary(company):
        qs = AIInsight.objects.filter(company=company, is_dismissed=False)
        return {
            'total': qs.count(),
            'unread': qs.filter(is_read=False).count(),
            'critical': qs.filter(severity='critical').count(),
            'by_type': list(qs.values('insight_type').annotate(count=Count('id')).order_by('-count')),
        }


class AnomalyService:
    """Detect anomalies using statistical methods (Z-score)."""

    Z_SCORE_THRESHOLD = 2.0  # Standard deviations from mean

    @staticmethod
    def detect_finance_anomalies(company):
        """Detect anomalies in invoice totals."""
        from apps.finance.models import Invoice
        invoices = Invoice.objects.filter(company=company)
        if invoices.count() < 10:
            return []

        stats = invoices.aggregate(avg=Avg('total'), std=StdDev('total'))
        avg = float(stats['avg'] or 0)
        std = float(stats['std'] or 1)
        if std == 0:
            std = 1

        recent = invoices.order_by('-date')[:20]
        anomalies = []
        for inv in recent:
            if inv.total and float(inv.total) > 0:
                z = (float(inv.total) - avg) / std
                if abs(z) > AnomalyService.Z_SCORE_THRESHOLD:
                    severity = 'critical' if abs(z) > 3 else 'high' if abs(z) > 2.5 else 'medium'
                    existing = AnomalyDetection.objects.filter(
                        company=company, module='finance',
                        metric_name=f'Invoice {inv.number}',
                        is_resolved=False
                    ).exists()
                    if not existing:
                        anomaly = AnomalyDetection.objects.create(
                            company=company,
                            module='finance',
                            metric_name=f'Invoice {inv.number}',
                            expected_value=Decimal(str(round(avg, 2))),
                            actual_value=Decimal(str(inv.total)),
                            deviation_pct=Decimal(str(round(z * 100, 2))),
                            severity=severity,
                            description=f'Invoice {inv.number} total ({inv.total}) deviates {abs(round(z, 2))}σ from mean ({round(avg, 2)})',
                        )
                        anomalies.append(anomaly)
        return anomalies

    @staticmethod
    def detect_sales_anomalies(company):
        """Detect anomalies in sales order totals."""
        from apps.sales.models import SalesOrder
        orders = SalesOrder.objects.filter(company=company)
        if orders.count() < 10:
            return []

        stats = orders.aggregate(avg=Avg('total'), std=StdDev('total'))
        avg = float(stats['avg'] or 0)
        std = float(stats['std'] or 1)
        if std == 0:
            std = 1

        recent = orders.order_by('-order_date')[:20]
        anomalies = []
        for order in recent:
            if order.total and float(order.total) > 0:
                z = (float(order.total) - avg) / std
                if abs(z) > AnomalyService.Z_SCORE_THRESHOLD:
                    severity = 'critical' if abs(z) > 3 else 'high' if abs(z) > 2.5 else 'medium'
                    existing = AnomalyDetection.objects.filter(
                        company=company, module='sales',
                        metric_name=f'Order {order.order_number}',
                        is_resolved=False
                    ).exists()
                    if not existing:
                        anomaly = AnomalyDetection.objects.create(
                            company=company,
                            module='sales',
                            metric_name=f'Order {order.order_number}',
                            expected_value=Decimal(str(round(avg, 2))),
                            actual_value=Decimal(str(order.total)),
                            deviation_pct=Decimal(str(round(z * 100, 2))),
                            severity=severity,
                            description=f'Order {order.order_number} total ({order.total}) deviates {abs(round(z, 2))}σ from mean ({round(avg, 2)})',
                        )
                        anomalies.append(anomaly)
        return anomalies

    @staticmethod
    def list_anomalies(company, module=None, severity=None, resolved=False):
        qs = AnomalyDetection.objects.filter(company=company)
        if module:
            qs = qs.filter(module=module)
        if severity:
            qs = qs.filter(severity=severity)
        if not resolved:
            qs = qs.filter(is_resolved=False)
        return qs

    @staticmethod
    def resolve(company, anomaly_id):
        anomaly = AnomalyDetection.objects.get(pk=anomaly_id, company=company)
        anomaly.is_resolved = True
        anomaly.save(update_fields=['is_resolved'])
        return anomaly

    @staticmethod
    def summary(company):
        qs = AnomalyDetection.objects.filter(company=company, is_resolved=False)
        return {
            'total': qs.count(),
            'critical': qs.filter(severity='critical').count(),
            'high': qs.filter(severity='high').count(),
            'medium': qs.filter(severity='medium').count(),
            'low': qs.filter(severity='low').count(),
            'by_module': list(qs.values('module').annotate(count=Count('id')).order_by('-count')),
        }


class ForecastService:
    """Generate forecasts using simple linear regression."""

    @staticmethod
    def generate_linear_forecast(company, module, metric_name, periods=30):
        """Generate a linear forecast based on historical data."""
        # Fetch historical data points
        data_points = ForecastService._get_historical_data(company, module, metric_name)
        if len(data_points) < 5:
            return None

        # Simple linear regression: y = mx + b
        n = len(data_points)
        x_vals = list(range(n))
        y_vals = [float(d['value']) for d in data_points]

        x_mean = sum(x_vals) / n
        y_mean = sum(y_vals) / n

        numerator = sum((x_vals[i] - x_mean) * (y_vals[i] - y_mean) for i in range(n))
        denominator = sum((x_vals[i] - x_mean) ** 2 for i in range(n))

        if denominator == 0:
            slope = 0
        else:
            slope = numerator / denominator
        intercept = y_mean - slope * x_mean

        # Calculate residuals for confidence intervals
        residuals = [y_vals[i] - (slope * x_vals[i] + intercept) for i in range(n)]
        rmse = math.sqrt(sum(r ** 2 for r in residuals) / n)

        # Generate forecast
        forecast_data = []
        today = timezone.now().date()
        for i in range(1, periods + 1):
            x = n + i - 1
            predicted = slope * x + intercept
            forecast_data.append({
                'date': (today + timedelta(days=i)).isoformat(),
                'value': round(predicted, 2),
                'lower_bound': round(predicted - 1.96 * rmse, 2),
                'upper_bound': round(predicted + 1.96 * rmse, 2),
            })

        # R-squared
        ss_res = sum(r ** 2 for r in residuals)
        ss_tot = sum((y_vals[i] - y_mean) ** 2 for i in range(n))
        accuracy = round((1 - ss_res / ss_tot) * 100, 2) if ss_tot > 0 else 0

        forecast = Forecast.objects.create(
            company=company,
            module=module,
            metric_name=metric_name,
            forecast_period=f'{periods}d',
            forecast_data=forecast_data,
            accuracy_score=Decimal(str(min(max(accuracy, 0), 100))),
            model_used='linear_regression',
        )
        return forecast

    @staticmethod
    def _get_historical_data(company, module, metric_name):
        """Fetch historical data points for forecasting."""
        if module == 'finance' and metric_name == 'revenue':
            from apps.finance.models import Invoice
            from django.db.models.functions import TruncMonth
            data = (Invoice.objects.filter(company=company)
                    .annotate(month=TruncMonth('date'))
                    .values('month')
                    .annotate(total=Sum('total'))
                    .order_by('month'))
            return [{'date': d['month'].isoformat(), 'value': float(d['total'] or 0)} for d in data]

        elif module == 'sales' and metric_name == 'orders':
            from apps.sales.models import SalesOrder
            from django.db.models.functions import TruncMonth
            data = (SalesOrder.objects.filter(company=company)
                    .annotate(month=TruncMonth('order_date'))
                    .values('month')
                    .annotate(count=Count('id'))
                    .order_by('month'))
            return [{'date': d['month'].isoformat(), 'value': float(d['count'])} for d in data]

        elif module == 'sales' and metric_name == 'revenue':
            from apps.sales.models import SalesOrder
            from django.db.models.functions import TruncMonth
            data = (SalesOrder.objects.filter(company=company)
                    .annotate(month=TruncMonth('order_date'))
                    .values('month')
                    .annotate(total=Sum('total'))
                    .order_by('month'))
            return [{'date': d['month'].isoformat(), 'value': float(d['total'] or 0)} for d in data]

        return []

    @staticmethod
    def list_forecasts(company, module=None):
        qs = Forecast.objects.filter(company=company)
        if module:
            qs = qs.filter(module=module)
        return qs

    @staticmethod
    def get_forecast(company, forecast_id):
        return Forecast.objects.get(pk=forecast_id, company=company)


class NLQueryService:
    """Process natural language queries and translate to data.

    Phase 19: When an active LLM provider is configured, queries are sent to the
    LLM which returns structured JSON results. Falls back to keyword-based
    detection when no LLM is available.
    """

    # Simple keyword-to-module mapping (fallback when no LLM)
    MODULE_KEYWORDS = {
        'finance': ['invoice', 'revenue', 'payment', 'account', 'cheque', 'receipt', 'financial'],
        'sales': ['order', 'quotation', 'sale', 'customer', 'return', 'sales'],
        'inventory': ['stock', 'warehouse', 'inventory', 'movement', 'reservation'],
        'manufacturing': ['production', 'bom', 'work center', 'routing', 'manufacturing'],
        'hr': ['employee', 'attendance', 'leave', 'payroll', 'department', 'evaluation'],
        'crm': ['lead', 'opportunity', 'campaign', 'crm', 'activity'],
        'service_management': ['service', 'request', 'work order', 'technician', 'sla', 'warranty', 'contract', 'maintenance'],
        'trading': ['import', 'export', 'shipment', 'container', 'customs', 'trading'],
    }

    # System prompt for LLM-powered queries
    LLM_SYSTEM_PROMPT = """You are Nexivo AI, an ERP data analyst. You convert natural language questions about business data into structured JSON results.

The company has these modules:
- finance: invoices (number, date, total, status, type)
- sales: orders (order_number, order_date, total, status)
- inventory: stock movements
- manufacturing: production orders
- hr: employees
- service_management: service requests
- trading: import/export orders
- crm: leads, opportunities

When given a question, respond with ONLY a JSON object in this exact format:
{"module": "<detected_module>", "summary": "<one-line summary>", "headers": ["<col1>", "<col2>"], "rows": [["<val1>", <number>], ...], "sql": "<approximate SQL that would answer the question>"}

Rules:
- module must be one of: finance, sales, inventory, manufacturing, hr, service_management, trading, crm
- headers should be descriptive column names
- rows should contain the actual data (numbers as numbers, not strings)
- sql should be a valid PostgreSQL SELECT statement for the detected module
- Keep answers concise (max 20 rows)
- If the question is ambiguous, make reasonable assumptions"""

    @staticmethod
    def process_query(company, query_text, user=None):
        """Process a natural language query and return results."""
        nl_query = NLQuery.objects.create(
            company=company,
            query_text=query_text,
            status='executing',
            created_by=user,
        )

        try:
            start_time = timezone.now()

            # Try LLM-powered query first (Phase 19)
            llm_result = NLQueryService._try_llm_query(company, query_text)
            if llm_result:
                nl_query.generated_sql = llm_result.get('sql', '')
                result = {
                    'headers': llm_result.get('headers', ['Message']),
                    'rows': llm_result.get('rows', []),
                    'summary': llm_result.get('summary', ''),
                    'source': 'llm',
                }
            else:
                # Fallback to keyword-based detection
                module = NLQueryService._detect_module(query_text)
                result = NLQueryService._execute_query(company, module, query_text)
                result['source'] = 'keyword'

            elapsed = int((timezone.now() - start_time).total_seconds() * 1000)

            nl_query.result_data = result
            nl_query.execution_time_ms = elapsed
            nl_query.status = 'completed'
            nl_query.save()
        except Exception as e:
            nl_query.status = 'failed'
            nl_query.error_message = str(e)
            nl_query.save()

        return nl_query

    @staticmethod
    def _try_llm_query(company, query_text):
        """Attempt to process query via LLM gateway. Returns None if no LLM available."""
        try:
            from apps.llm.models import LLMProvider
            provider = LLMProvider.objects.filter(company=company, is_active=True).first()
            if not provider:
                return None

            from apps.llm.service import chat_completion
            messages = [
                {'role': 'system', 'content': NLQueryService.LLM_SYSTEM_PROMPT},
                {'role': 'user', 'content': query_text},
            ]
            result = chat_completion(company, messages, feature='text_to_sql')
            content = result.get('content', '')

            # Parse JSON from LLM response
            # Try to extract JSON from markdown code blocks first
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))

            # Try direct JSON parse
            return json.loads(content)
        except Exception as e:
            logger.warning("LLM query failed for company %s: %s", company.id, e)
            return None

    @staticmethod
    def _detect_module(query_text):
        """Detect which module the query is about."""
        lower = query_text.lower()
        for module, keywords in NLQueryService.MODULE_KEYWORDS.items():
            for kw in keywords:
                if kw in lower:
                    return module
        return 'finance'  # Default

    @staticmethod
    def _execute_query(company, module, query_text):
        """Execute query and return formatted results."""
        lower = query_text.lower()

        if module == 'finance':
            from apps.finance.models import Invoice
            qs = Invoice.objects.filter(company=company)
            if 'total' in lower or 'sum' in lower:
                total = qs.aggregate(s=Sum('total'))['s'] or 0
                return {'headers': ['Metric', 'Value'], 'rows': [['Total Invoices', qs.count()], ['Total Amount', float(total)]]}
            return {'headers': ['Metric', 'Value'], 'rows': [['Total Invoices', qs.count()]]}

        elif module == 'sales':
            from apps.sales.models import SalesOrder
            qs = SalesOrder.objects.filter(company=company)
            return {'headers': ['Metric', 'Value'], 'rows': [['Total Orders', qs.count()], ['Revenue', float(qs.aggregate(s=Sum('total'))['s'] or 0)]]}

        elif module == 'manufacturing':
            from apps.manufacturing.models import ProductionOrder
            qs = ProductionOrder.objects.filter(company=company)
            return {'headers': ['Metric', 'Value'], 'rows': [['Production Orders', qs.count()], ['Total Cost', float(qs.aggregate(s=Sum('total_cost'))['s'] or 0)]]}

        elif module == 'service_management':
            from apps.service_management.models import ServiceRequest
            qs = ServiceRequest.objects.filter(company=company)
            return {'headers': ['Metric', 'Value'], 'rows': [['Service Requests', qs.count()], ['Open', qs.exclude(status__in=['completed', 'closed', 'cancelled']).count()]]}

        elif module == 'hr':
            from apps.hr.models import Employee
            qs = Employee.objects.filter(company=company)
            return {'headers': ['Metric', 'Value'], 'rows': [['Employees', qs.count()], ['Active', qs.filter(status='active').count()]]}

        return {'headers': ['Message'], 'rows': [['Query processed. No specific data found.']]}

    @staticmethod
    def list_queries(company, limit=20):
        return NLQuery.objects.filter(company=company)[:limit]
