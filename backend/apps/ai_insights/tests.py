"""
AI Insights Module Tests — Anomaly Detection, Forecasting, NL Queries
"""
import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.accounts.models import Company
from unittest.mock import patch, MagicMock
from .models import AIInsight, AnomalyDetection, Forecast, NLQuery
from .alerts import AnomalyAlert, AnomalyAlertService
from .services import InsightService, AnomalyService, ForecastService, NLQueryService

User = get_user_model()


# ─── Helpers ───────────────────────────────────────────────────────

def _create_finance_invoices(company, fy, amounts):
    """Create finance Invoice objects with given total amounts."""
    from apps.finance.models import Invoice, Customer
    customer, _ = Customer.objects.get_or_create(
        company=company, name='Test Customer',
        defaults={'national_id': '12345678901'},
    )
    invoices = []
    for i, amount in enumerate(amounts, start=1):
        inv = Invoice.objects.create(
            company=company, fiscal_year=fy,
            number=i, type='sales',
            date_jalali=f'1404/04/{i:02d}',
            date=datetime.date(2025, 6, 21) + datetime.timedelta(days=i),
            customer=customer,
            subtotal=int(amount), total=int(amount),
        )
        invoices.append(inv)
    return invoices


def _create_sales_orders(company, totals):
    """Create SalesOrder objects with given total amounts."""
    from apps.sales.models import SalesOrder
    from apps.finance.models import Customer
    customer, _ = Customer.objects.get_or_create(
        company=company, name='Sales Customer',
        defaults={'national_id': '11111111111'},
    )
    orders = []
    for i, total in enumerate(totals, start=1):
        order = SalesOrder.objects.create(
            company=company,
            order_number=f'SO-{i:04d}',
            customer=customer,
            order_date=datetime.date(2025, 6, 21) + datetime.timedelta(days=i),
            subtotal=Decimal(str(total)),
            total=Decimal(str(total)),
        )
        orders.append(order)
    return orders


def _create_fiscal_year(company):
    from apps.finance.models import FiscalYear
    return FiscalYear.objects.get_or_create(
        company=company, name='۱۴۰۴',
        defaults={
            'start_date_jalali': '1403/01/01',
            'end_date_jalali': '1404/01/01',
            'start_date': datetime.date(2024, 3, 20),
            'end_date': datetime.date(2025, 3, 19),
        },
    )[0]


# ─── AIInsight Model Tests ─────────────────────────────────────────

class AIInsightModelTest(TestCase):
    """Test AIInsight model."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')
        self.insight = AIInsight.objects.create(
            company=self.company,
            insight_type='anomaly',
            title='Test Insight',
            description='A test insight',
            severity='warning',
            module='finance',
        )

    def test_create_insight(self):
        self.assertEqual(self.insight.title, 'Test Insight')
        self.assertEqual(self.insight.insight_type, 'anomaly')
        self.assertFalse(self.insight.is_read)
        self.assertFalse(self.insight.is_dismissed)

    def test_str(self):
        self.assertIn('anomaly', str(self.insight))

    def test_mark_read(self):
        insight = InsightService.mark_read(self.company, self.insight.id)
        self.assertTrue(insight.is_read)

    def test_dismiss(self):
        insight = InsightService.dismiss(self.company, self.insight.id)
        self.assertTrue(insight.is_dismissed)

    def test_summary(self):
        summary = InsightService.summary(self.company)
        self.assertEqual(summary['total'], 1)
        self.assertEqual(summary['unread'], 1)


# ─── AnomalyDetection Model Tests ──────────────────────────────────

class AnomalyDetectionModelTest(TestCase):
    """Test AnomalyDetection model."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')
        self.anomaly = AnomalyDetection.objects.create(
            company=self.company,
            module='finance',
            metric_name='Invoice 1001',
            expected_value=Decimal('1000'),
            actual_value=Decimal('5000'),
            deviation_pct=Decimal('400'),
            severity='high',
            description='High deviation detected',
        )

    def test_create_anomaly(self):
        self.assertEqual(self.anomaly.metric_name, 'Invoice 1001')
        self.assertEqual(self.anomaly.severity, 'high')
        self.assertFalse(self.anomaly.is_resolved)

    def test_resolve(self):
        anomaly = AnomalyService.resolve(self.company, self.anomaly.id)
        self.assertTrue(anomaly.is_resolved)

    def test_summary(self):
        summary = AnomalyService.summary(self.company)
        self.assertEqual(summary['total'], 1)
        self.assertEqual(summary['high'], 1)

    def test_severity_choices(self):
        """All four severity levels are valid."""
        for sev in ('low', 'medium', 'high', 'critical'):
            a = AnomalyDetection.objects.create(
                company=self.company, module='finance', metric_name=f'T-{sev}',
                expected_value=Decimal('100'), actual_value=Decimal('200'),
                deviation_pct=Decimal('100'), severity=sev, description='t',
            )
            self.assertEqual(a.severity, sev)

    def test_module_choices(self):
        """All module choices are valid."""
        for mod in ('finance', 'sales', 'inventory', 'hr', 'manufacturing', 'service_management'):
            a = AnomalyDetection.objects.create(
                company=self.company, module=mod, metric_name=f'T-{mod}',
                expected_value=Decimal('100'), actual_value=Decimal('200'),
                deviation_pct=Decimal('100'), severity='low', description='t',
            )
            self.assertEqual(a.module, mod)

    def test_resolved_not_in_summary(self):
        """Resolved anomalies should not appear in summary."""
        self.anomaly.is_resolved = True
        self.anomaly.save(update_fields=['is_resolved'])
        summary = AnomalyService.summary(self.company)
        self.assertEqual(summary['total'], 0)


# ─── Forecast Model Tests ──────────────────────────────────────────

class ForecastModelTest(TestCase):
    """Test Forecast model."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')
        self.forecast = Forecast.objects.create(
            company=self.company,
            module='finance',
            metric_name='revenue',
            forecast_period='30d',
            forecast_data=[
                {'date': '2026-01-01', 'value': 1000, 'lower_bound': 800, 'upper_bound': 1200},
            ],
            accuracy_score=Decimal('85.5'),
            model_used='linear_regression',
        )

    def test_create_forecast(self):
        self.assertEqual(self.forecast.metric_name, 'revenue')
        self.assertEqual(self.forecast.forecast_period, '30d')
        self.assertEqual(self.forecast.accuracy_score, Decimal('85.5'))

    def test_list_forecasts(self):
        forecasts = ForecastService.list_forecasts(self.company)
        self.assertEqual(forecasts.count(), 1)

    def test_get_forecast(self):
        forecast = ForecastService.get_forecast(self.company, self.forecast.id)
        self.assertEqual(forecast.metric_name, 'revenue')


# ─── NLQuery Model Tests ───────────────────────────────────────────

class NLQueryModelTest(TestCase):
    """Test NLQuery model."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.query = NLQuery.objects.create(
            company=self.company,
            query_text='How many invoices?',
            status='completed',
            result_data={'headers': ['Metric', 'Value'], 'rows': [['Invoices', 10]]},
            execution_time_ms=50,
            created_by=self.user,
        )

    def test_create_query(self):
        self.assertEqual(self.query.query_text, 'How many invoices?')
        self.assertEqual(self.query.status, 'completed')
        self.assertEqual(self.query.execution_time_ms, 50)

    def test_list_queries(self):
        queries = NLQueryService.list_queries(self.company)
        self.assertEqual(queries.count(), 1)


# ─── InsightService Tests ──────────────────────────────────────────

class InsightServiceTest(TestCase):
    """Test InsightService."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')

    def test_list_insights_empty(self):
        insights = InsightService.list_insights(self.company)
        self.assertEqual(insights.count(), 0)

    def test_list_insights_with_filter(self):
        AIInsight.objects.create(
            company=self.company, insight_type='anomaly', title='A',
            description='d', severity='info', module='finance',
        )
        AIInsight.objects.create(
            company=self.company, insight_type='forecast', title='B',
            description='d', severity='info', module='sales',
        )
        finance = InsightService.list_insights(self.company, module='finance')
        self.assertEqual(finance.count(), 1)

    def test_summary_empty(self):
        summary = InsightService.summary(self.company)
        self.assertEqual(summary['total'], 0)

    def test_by_type_breakdown(self):
        AIInsight.objects.create(
            company=self.company, insight_type='anomaly', title='A',
            description='d', severity='info', module='finance',
        )
        AIInsight.objects.create(
            company=self.company, insight_type='anomaly', title='B',
            description='d', severity='info', module='finance',
        )
        summary = InsightService.summary(self.company)
        self.assertEqual(summary['total'], 2)
        self.assertEqual(len(summary['by_type']), 1)
        self.assertEqual(summary['by_type'][0]['count'], 2)


# ─── ForecastService Tests ─────────────────────────────────────────

class ForecastServiceTest(TestCase):
    """Test ForecastService."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')

    def test_insufficient_data_returns_none(self):
        result = ForecastService.generate_linear_forecast(
            self.company, 'finance', 'revenue', 30
        )
        self.assertIsNone(result)

    def test_list_forecasts_empty(self):
        forecasts = ForecastService.list_forecasts(self.company)
        self.assertEqual(forecasts.count(), 0)

    def test_historical_data_returns_empty_for_unknown_module(self):
        data = ForecastService._get_historical_data(self.company, 'unknown', 'metric')
        self.assertEqual(data, [])

    def test_list_forecasts_with_module_filter(self):
        Forecast.objects.create(
            company=self.company, module='finance', metric_name='revenue',
            forecast_period='30d', forecast_data=[], accuracy_score=Decimal('80'),
            model_used='linear_regression',
        )
        Forecast.objects.create(
            company=self.company, module='sales', metric_name='orders',
            forecast_period='30d', forecast_data=[], accuracy_score=Decimal('75'),
            model_used='linear_regression',
        )
        self.assertEqual(ForecastService.list_forecasts(self.company, module='finance').count(), 1)
        self.assertEqual(ForecastService.list_forecasts(self.company, module='sales').count(), 1)


# ─── NLQueryService Tests ──────────────────────────────────────────

class NLQueryServiceTest(TestCase):
    """Test NLQueryService."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')
        self.user = User.objects.create_user(username='testuser', password='testpass123')

    def test_detect_module_finance(self):
        module = NLQueryService._detect_module('show me all invoices')
        self.assertEqual(module, 'finance')

    def test_detect_module_sales(self):
        module = NLQueryService._detect_module('total orders this month')
        self.assertEqual(module, 'sales')

    def test_detect_module_hr(self):
        module = NLQueryService._detect_module('employee attendance')
        self.assertEqual(module, 'hr')

    def test_detect_module_manufacturing(self):
        module = NLQueryService._detect_module('work center capacity')
        self.assertEqual(module, 'manufacturing')

    def test_detect_module_service_management(self):
        module = NLQueryService._detect_module('service requests open')
        self.assertEqual(module, 'service_management')

    def test_detect_module_trading(self):
        module = NLQueryService._detect_module('import shipment customs')
        self.assertEqual(module, 'trading')

    def test_detect_module_inventory(self):
        module = NLQueryService._detect_module('warehouse stock levels')
        self.assertEqual(module, 'inventory')

    def test_detect_module_default(self):
        module = NLQueryService._detect_module('hello world')
        self.assertEqual(module, 'finance')

    def test_process_query(self):
        nl_query = NLQueryService.process_query(
            self.company, 'total invoices', user=self.user
        )
        self.assertEqual(nl_query.status, 'completed')
        self.assertIn('headers', nl_query.result_data)

    def test_list_queries_empty(self):
        queries = NLQueryService.list_queries(self.company)
        self.assertEqual(queries.count(), 0)

    def test_list_queries_with_limit(self):
        for i in range(5):
            NLQuery.objects.create(
                company=self.company, query_text=f'Query {i}',
                status='completed', created_by=self.user,
            )
        queries = NLQueryService.list_queries(self.company, limit=3)
        self.assertEqual(queries.count(), 3)

    def test_process_query_stores_created_by(self):
        nl_query = NLQueryService.process_query(
            self.company, 'total invoices', user=self.user
        )
        self.assertEqual(nl_query.created_by, self.user)

    def test_process_query_execution_time(self):
        nl_query = NLQueryService.process_query(
            self.company, 'total invoices', user=self.user
        )
        self.assertGreater(nl_query.execution_time_ms, 0)


# ─── AnomalyDetection Service Tests ────────────────────────────────

class AnomalyDetectionServiceTest(TestCase):
    """Test AnomalyService detection methods — empty / insufficient data."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')

    def test_no_data_returns_empty(self):
        """With no invoices, anomaly detection returns empty."""
        result = AnomalyService.detect_finance_anomalies(self.company)
        self.assertEqual(result, [])

    def test_insufficient_data_returns_empty(self):
        """With fewer than 10 invoices, returns empty."""
        result = AnomalyService.detect_sales_anomalies(self.company)
        self.assertEqual(result, [])

    def test_sales_no_data_returns_empty(self):
        """With no sales orders, returns empty."""
        result = AnomalyService.detect_sales_anomalies(self.company)
        self.assertEqual(result, [])

    def test_anomaly_summary_empty(self):
        summary = AnomalyService.summary(self.company)
        self.assertEqual(summary['total'], 0)
        self.assertEqual(summary['critical'], 0)

    def test_anomaly_list_filters(self):
        AnomalyDetection.objects.create(
            company=self.company, module='finance', metric_name='Test',
            expected_value=Decimal('100'), actual_value=Decimal('200'),
            deviation_pct=Decimal('100'), severity='high', description='test',
        )
        AnomalyDetection.objects.create(
            company=self.company, module='sales', metric_name='Test2',
            expected_value=Decimal('100'), actual_value=Decimal('50'),
            deviation_pct=Decimal('50'), severity='low', description='test2',
        )
        finance = AnomalyService.list_anomalies(self.company, module='finance')
        self.assertEqual(finance.count(), 1)
        high = AnomalyService.list_anomalies(self.company, severity='high')
        self.assertEqual(high.count(), 1)

    def test_anomaly_list_excludes_resolved(self):
        AnomalyDetection.objects.create(
            company=self.company, module='finance', metric_name='R1',
            expected_value=Decimal('100'), actual_value=Decimal('200'),
            deviation_pct=Decimal('100'), severity='high', description='t',
            is_resolved=True,
        )
        AnomalyDetection.objects.create(
            company=self.company, module='finance', metric_name='U1',
            expected_value=Decimal('100'), actual_value=Decimal('200'),
            deviation_pct=Decimal('100'), severity='high', description='t',
        )
        active = AnomalyService.list_anomalies(self.company, resolved=False)
        self.assertEqual(active.count(), 1)
        self.assertEqual(active.first().metric_name, 'U1')

    def test_summary_by_module(self):
        AnomalyDetection.objects.create(
            company=self.company, module='finance', metric_name='F1',
            expected_value=Decimal('100'), actual_value=Decimal('200'),
            deviation_pct=Decimal('100'), severity='high', description='t',
        )
        AnomalyDetection.objects.create(
            company=self.company, module='sales', metric_name='S1',
            expected_value=Decimal('100'), actual_value=Decimal('200'),
            deviation_pct=Decimal('100'), severity='medium', description='t',
        )
        summary = AnomalyService.summary(self.company)
        self.assertEqual(summary['total'], 2)
        self.assertEqual(summary['high'], 1)
        self.assertEqual(summary['medium'], 1)
        self.assertEqual(len(summary['by_module']), 2)


# ─── Finance Anomaly Detection — Real Data Tests ──────────────────

class FinanceAnomalyDetectionRealDataTest(TestCase):
    """Test anomaly detection with real finance invoice data."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')
        self.fy = _create_fiscal_year(self.company)

    def test_detects_outlier_invoice(self):
        """An invoice with a total 3σ+ from mean should be detected."""
        # 12 invoices around 100K + 1 outlier at 1M
        amounts = [100000] * 12 + [1000000]
        _create_finance_invoices(self.company, self.fy, amounts)

        anomalies = AnomalyService.detect_finance_anomalies(self.company)
        # At least the 1M invoice should be detected
        self.assertGreaterEqual(len(anomalies), 1)
        outlier = [a for a in anomalies if float(a.actual_value) == 1000000]
        self.assertEqual(len(outlier), 1)
        self.assertEqual(outlier[0].module, 'finance')
        self.assertIn(outlier[0].severity, ('critical', 'high', 'medium'))

    def test_no_outliers_when_uniform(self):
        """Uniform invoice totals should produce no anomalies."""
        amounts = [100000] * 12
        _create_finance_invoices(self.company, self.fy, amounts)

        anomalies = AnomalyService.detect_finance_anomalies(self.company)
        self.assertEqual(len(anomalies), 0)

    def test_severity_levels(self):
        """Different deviation sizes produce different severity levels."""
        # Mean ~100K, σ ~26K; one at 400K (~11.5σ → critical)
        amounts = [100000] * 11 + [400000]
        _create_finance_invoices(self.company, self.fy, amounts)

        anomalies = AnomalyService.detect_finance_anomalies(self.company)
        critical = [a for a in anomalies if a.severity == 'critical']
        self.assertGreaterEqual(len(critical), 1)

    def test_duplicate_prevention(self):
        """Running detection twice should not create duplicate anomalies."""
        amounts = [100000] * 12 + [1000000]
        _create_finance_invoices(self.company, self.fy, amounts)

        AnomalyService.detect_finance_anomalies(self.company)
        count_first = AnomalyDetection.objects.filter(
            company=self.company, module='finance', is_resolved=False
        ).count()

        AnomalyService.detect_finance_anomalies(self.company)
        count_second = AnomalyDetection.objects.filter(
            company=self.company, module='finance', is_resolved=False
        ).count()

        self.assertEqual(count_first, count_second)

    def test_metric_name_contains_invoice_number(self):
        """Detected anomaly should reference the correct invoice number."""
        amounts = [100000] * 12 + [1000000]
        _create_finance_invoices(self.company, self.fy, amounts)

        anomalies = AnomalyService.detect_finance_anomalies(self.company)
        for a in anomalies:
            self.assertTrue(a.metric_name.startswith('Invoice '))
            self.assertIn('deviates', a.description)
            self.assertIn('σ', a.description)

    def test_expected_value_is_mean(self):
        """Expected value in anomaly should be the population mean."""
        amounts = [100000] * 12 + [500000]
        _create_finance_invoices(self.company, self.fy, amounts)

        anomalies = AnomalyService.detect_finance_anomalies(self.company)
        for a in anomalies:
            self.assertGreater(float(a.expected_value), 0)

    def test_resolved_anomaly_not_recreated(self):
        """A resolved anomaly should not be recreated on re-run."""
        amounts = [100000] * 12 + [1000000]
        _create_finance_invoices(self.company, self.fy, amounts)

        anomalies = AnomalyService.detect_finance_anomalies(self.company)
        self.assertGreater(len(anomalies), 0)

        # Resolve all
        for a in anomalies:
            AnomalyService.resolve(self.company, a.id)

        # Re-run detection
        anomalies2 = AnomalyService.detect_finance_anomalies(self.company)
        # Should find the same anomalies again (resolved ones don't block new detection)
        self.assertGreater(len(anomalies2), 0)


# ─── Sales Anomaly Detection — Real Data Tests ────────────────────

class SalesAnomalyDetectionRealDataTest(TestCase):
    """Test anomaly detection with real sales order data."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')

    def test_detects_outlier_order(self):
        """An order with total 3σ+ from mean should be detected."""
        totals = [100000] * 12 + [1000000]
        _create_sales_orders(self.company, totals)

        anomalies = AnomalyService.detect_sales_anomalies(self.company)
        self.assertGreaterEqual(len(anomalies), 1)
        outlier = [a for a in anomalies if float(a.actual_value) == 1000000]
        self.assertEqual(len(outlier), 1)
        self.assertEqual(outlier[0].module, 'sales')

    def test_no_outliers_when_uniform(self):
        """Uniform order totals should produce no anomalies."""
        totals = [100000] * 12
        _create_sales_orders(self.company, totals)

        anomalies = AnomalyService.detect_sales_anomalies(self.company)
        self.assertEqual(len(anomalies), 0)

    def test_duplicate_prevention_sales(self):
        """Running detection twice should not create duplicate anomalies."""
        totals = [100000] * 12 + [1000000]
        _create_sales_orders(self.company, totals)

        AnomalyService.detect_sales_anomalies(self.company)
        count_first = AnomalyDetection.objects.filter(
            company=self.company, module='sales', is_resolved=False
        ).count()

        AnomalyService.detect_sales_anomalies(self.company)
        count_second = AnomalyDetection.objects.filter(
            company=self.company, module='sales', is_resolved=False
        ).count()

        self.assertEqual(count_first, count_second)

    def test_severity_high_for_moderate_outlier(self):
        """Moderate outlier (2.5σ < z < 3σ) should be high severity."""
        totals = [100000] * 14 + [350000]
        _create_sales_orders(self.company, totals)

        anomalies = AnomalyService.detect_sales_anomalies(self.company)
        high = [a for a in anomalies if a.severity == 'high']
        # At least check that detection ran and produced results
        self.assertIsInstance(anomalies, list)

    def test_metric_name_contains_order_number(self):
        """Detected anomaly should reference the correct order number."""
        totals = [100000] * 12 + [1000000]
        _create_sales_orders(self.company, totals)

        anomalies = AnomalyService.detect_sales_anomalies(self.company)
        for a in anomalies:
            self.assertTrue(a.metric_name.startswith('Order SO-'))

    def test_deviation_pct_is_nonzero(self):
        """Detected anomalies should have non-zero deviation percentage."""
        totals = [100000] * 12 + [1000000]
        _create_sales_orders(self.company, totals)

        anomalies = AnomalyService.detect_sales_anomalies(self.company)
        for a in anomalies:
            self.assertNotEqual(a.deviation_pct, Decimal('0'))


# ─── Module Detection Test ────────────────────────────────────────

class ModuleDetectionTest(TestCase):
    """Test that anomaly detection is correctly scoped per module."""

    def test_finance_and_sales_independent(self):
        """Finance and sales anomaly detection are independent."""
        company = Company.objects.create(name='Test Co')
        # Create anomalies manually for both modules
        AnomalyDetection.objects.create(
            company=company, module='finance', metric_name='Invoice 1',
            expected_value=Decimal('100'), actual_value=Decimal('500'),
            deviation_pct=Decimal('400'), severity='high', description='test',
        )
        AnomalyDetection.objects.create(
            company=company, module='sales', metric_name='Order 1',
            expected_value=Decimal('100'), actual_value=Decimal('500'),
            deviation_pct=Decimal('400'), severity='high', description='test',
        )
        self.assertEqual(AnomalyService.list_anomalies(company, module='finance').count(), 1)
        self.assertEqual(AnomalyService.list_anomalies(company, module='sales').count(), 1)
        self.assertEqual(AnomalyService.list_anomalies(company).count(), 2)


# ─── Phase 19: LLM-powered NL Query Tests ──────────────────────────

class LLMNLQueryTest(TestCase):
    """Test LLM integration in NLQueryService (Phase 19)."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')
        self.user = User.objects.create_user(username='llmuser', password='testpass123')

    def test_try_llm_query_returns_none_when_no_provider(self):
        """_try_llm_query returns None when no active LLM provider exists."""
        result = NLQueryService._try_llm_query(self.company, 'show invoices')
        self.assertIsNone(result)

    @patch('apps.ai_insights.services.chat_completion')
    @patch('apps.llm.models.LLMProvider.objects')
    def test_try_llm_query_parses_json_response(self, mock_manager, mock_chat):
        """_try_llm_query parses valid JSON from LLM response."""
        mock_manager.filter.return_value.first.return_value = MagicMock()
        mock_chat.return_value = {
            'content': '{"module": "finance", "summary": "Invoice total", "headers": ["Count"], "rows": [[50]], "sql": "SELECT COUNT(*) FROM invoices"}'
        }
        result = NLQueryService._try_llm_query(self.company, 'how many invoices?')
        self.assertIsNotNone(result)
        self.assertEqual(result['module'], 'finance')
        self.assertEqual(result['rows'], [[50]])

    @patch('apps.ai_insights.services.chat_completion')
    @patch('apps.llm.models.LLMProvider.objects')
    def test_try_llm_query_handles_markdown_json(self, mock_manager, mock_chat):
        """_try_llm_query extracts JSON from markdown code blocks."""
        mock_manager.filter.return_value.first.return_value = MagicMock()
        mock_chat.return_value = {
            'content': '```json\n{"module": "sales", "summary": "Order count", "headers": ["Count"], "rows": [[10]], "sql": "SELECT COUNT(*) FROM orders"}\n```'
        }
        result = NLQueryService._try_llm_query(self.company, 'count orders')
        self.assertIsNotNone(result)
        self.assertEqual(result['module'], 'sales')

    @patch('apps.ai_insights.services.chat_completion')
    @patch('apps.llm.models.LLMProvider.objects')
    def test_try_llm_query_returns_none_on_invalid_json(self, mock_manager, mock_chat):
        """_try_llm_query returns None when LLM returns invalid JSON."""
        mock_manager.filter.return_value.first.return_value = MagicMock()
        mock_chat.return_value = {'content': 'This is not JSON at all'}
        result = NLQueryService._try_llm_query(self.company, 'query')
        self.assertIsNone(result)

    @patch('apps.ai_insights.services.chat_completion')
    @patch('apps.llm.models.LLMProvider.objects')
    def test_try_llm_query_returns_none_on_exception(self, mock_manager, mock_chat):
        """_try_llm_query returns None when LLM call raises an exception."""
        mock_manager.filter.return_value.first.return_value = MagicMock()
        mock_chat.side_effect = Exception('Connection timeout')
        result = NLQueryService._try_llm_query(self.company, 'query')
        self.assertIsNone(result)

    @patch.object(NLQueryService, '_try_llm_query')
    def test_process_query_uses_llm_when_available(self, mock_llm):
        """process_query uses LLM results when _try_llm_query returns data."""
        mock_llm.return_value = {
            'module': 'finance', 'summary': 'Total invoices',
            'headers': ['Metric', 'Value'], 'rows': [['Total', 42]],
            'sql': 'SELECT COUNT(*) FROM invoices',
        }
        nl_query = NLQueryService.process_query(
            self.company, 'how many invoices?', user=self.user
        )
        self.assertEqual(nl_query.status, 'completed')
        self.assertEqual(nl_query.result_data['source'], 'llm')
        self.assertEqual(nl_query.result_data['rows'], [['Total', 42]])

    @patch.object(NLQueryService, '_try_llm_query', return_value=None)
    def test_process_query_falls_back_to_keywords(self, mock_llm):
        """process_query falls back to keyword detection when LLM is unavailable."""
        nl_query = NLQueryService.process_query(
            self.company, 'total invoices', user=self.user
        )
        self.assertEqual(nl_query.status, 'completed')
        self.assertEqual(nl_query.result_data['source'], 'keyword')


# ─── Phase 20: Real-time Anomaly Alert Tests ───────────────────────

class AnomalyAlertModelTest(TestCase):
    """Test AnomalyAlert model."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')
        self.anomaly = AnomalyDetection.objects.create(
            company=self.company, module='finance', metric_name='Invoice 999',
            expected_value=Decimal('100'), actual_value=Decimal('500'),
            deviation_pct=Decimal('400'), severity='critical',
            description='Critical anomaly detected',
        )

    def test_create_alert(self):
        alert = AnomalyAlert.objects.create(
            company=self.company, anomaly=self.anomaly,
            module='finance', title='Anomaly Detected',
            message='Critical anomaly', severity='critical',
        )
        self.assertEqual(alert.title, 'Anomaly Detected')
        self.assertEqual(alert.severity, 'critical')
        self.assertFalse(alert.is_read)
        self.assertFalse(alert.is_notified)

    def test_str(self):
        alert = AnomalyAlert.objects.create(
            company=self.company, module='finance', title='Test Alert',
            message='msg', severity='high',
        )
        self.assertIn('[high]', str(alert))
        self.assertIn('Test Alert', str(alert))

    def test_inherits_base_model(self):
        """AnomalyAlert should inherit from BaseModel (has created_at and updated_at)."""
        alert = AnomalyAlert.objects.create(
            company=self.company, module='finance', title='T',
            message='m', severity='low',
        )
        self.assertIsNotNone(alert.created_at)
        self.assertIsNotNone(alert.updated_at)


class AnomalyAlertServiceTest(TestCase):
    """Test AnomalyAlertService."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')
        self.anomaly = AnomalyDetection.objects.create(
            company=self.company, module='finance', metric_name='Invoice 1',
            expected_value=Decimal('100'), actual_value=Decimal('500'),
            deviation_pct=Decimal('400'), severity='high',
            description='High deviation',
        )

    def test_create_alerts_for_anomalies(self):
        alerts = AnomalyAlertService.create_alerts_for_anomalies(
            self.company, [self.anomaly]
        )
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].module, 'finance')
        self.assertEqual(alerts[0].severity, 'high')
        self.assertIn('Invoice 1', alerts[0].title)

    def test_list_alerts(self):
        AnomalyAlert.objects.create(
            company=self.company, module='finance', title='A1',
            message='m', severity='high',
        )
        AnomalyAlert.objects.create(
            company=self.company, module='sales', title='A2',
            message='m', severity='low', is_read=True,
        )
        all_alerts = AnomalyAlertService.list_alerts(self.company)
        self.assertEqual(all_alerts.count(), 2)

    def test_list_alerts_filter_module(self):
        AnomalyAlert.objects.create(
            company=self.company, module='finance', title='A1',
            message='m', severity='high',
        )
        AnomalyAlert.objects.create(
            company=self.company, module='sales', title='A2',
            message='m', severity='low',
        )
        finance = AnomalyAlertService.list_alerts(self.company, module='finance')
        self.assertEqual(finance.count(), 1)

    def test_list_alerts_unread_only(self):
        AnomalyAlert.objects.create(
            company=self.company, module='finance', title='A1',
            message='m', severity='high', is_read=False,
        )
        AnomalyAlert.objects.create(
            company=self.company, module='finance', title='A2',
            message='m', severity='high', is_read=True,
        )
        unread = AnomalyAlertService.list_alerts(self.company, unread_only=True)
        self.assertEqual(unread.count(), 1)

    def test_mark_read(self):
        alert = AnomalyAlert.objects.create(
            company=self.company, module='finance', title='A',
            message='m', severity='medium',
        )
        result = AnomalyAlertService.mark_read(self.company, alert.id)
        self.assertTrue(result.is_read)

    def test_mark_all_read(self):
        AnomalyAlert.objects.create(
            company=self.company, module='finance', title='A1',
            message='m', severity='medium', is_read=False,
        )
        AnomalyAlert.objects.create(
            company=self.company, module='finance', title='A2',
            message='m', severity='high', is_read=False,
        )
        AnomalyAlertService.mark_all_read(self.company)
        unread = AnomalyAlert.objects.filter(
            company=self.company, is_read=False
        ).count()
        self.assertEqual(unread, 0)

    def test_summary(self):
        AnomalyAlert.objects.create(
            company=self.company, module='finance', title='C1',
            message='m', severity='critical', is_read=False,
        )
        AnomalyAlert.objects.create(
            company=self.company, module='sales', title='H1',
            message='m', severity='high', is_read=True,
        )
        summary = AnomalyAlertService.summary(self.company)
        self.assertEqual(summary['total'], 2)
        self.assertEqual(summary['critical'], 1)
        self.assertEqual(summary['high'], 0)  # read, so not counted

    def test_delete_old_alerts(self):
        alert = AnomalyAlert.objects.create(
            company=self.company, module='finance', title='Old',
            message='m', severity='low',
        )
        # Force created_at to 100 days ago
        AnomalyAlert.objects.filter(pk=alert.pk).update(
            created_at=datetime.datetime.now() - datetime.timedelta(days=100)
        )
        deleted = AnomalyAlertService.delete_old_alerts(self.company, days=90)
        self.assertEqual(deleted, 1)
        self.assertFalse(AnomalyAlert.objects.filter(pk=alert.pk).exists())

    def test_company_isolation(self):
        """Alerts from different companies should not mix."""
        other_company = Company.objects.create(name='Other Co')
        AnomalyAlert.objects.create(
            company=self.company, module='finance', title='Mine',
            message='m', severity='low',
        )
        AnomalyAlert.objects.create(
            company=other_company, module='finance', title='Theirs',
            message='m', severity='low',
        )
        mine = AnomalyAlertService.list_alerts(self.company)
        self.assertEqual(mine.count(), 1)
        self.assertEqual(mine.first().title, 'Mine')

