"""
Reporting & Analytics Engine Services
"""
from django.utils import timezone
from django.db.models import Sum, Count, Avg, F, Q
from datetime import timedelta
from decimal import Decimal
import json

from apps.finance.exceptions import ValidationError
from .models import (
    ReportTemplate, ReportExecution, Dashboard, DashboardWidget,
    KPI, ScheduledReport, ReportSnapshot,
)


class ReportService:
    """Execute and manage reports."""

    @staticmethod
    def execute_report(company, template_id, parameters=None, user=None):
        """Execute a report template and store results."""
        template = ReportTemplate.objects.get(pk=template_id, company=company)
        parameters = parameters or {}

        execution = ReportExecution.objects.create(
            company=company,
            template=template,
            parameters=parameters,
            status='running',
            executed_by=user,
        )

        try:
            result_data = ReportService._run_query(company, template, parameters)
            execution.result_data = result_data
            execution.row_count = len(result_data.get('rows', []))
            execution.status = 'completed'
            execution.execution_time_ms = 0  # Would measure actual time
            execution.save()
        except Exception as e:
            execution.status = 'failed'
            execution.error_message = str(e)
            execution.save()
            raise ValidationError(f"Report execution failed: {e}")

        return execution

    @staticmethod
    def _run_query(company, template, parameters):
        """Run the report query based on template configuration."""
        config = template.query_config
        module = template.module

        # Route to appropriate data source based on module
        if module == 'finance':
            return ReportService._query_finance(company, config, parameters)
        elif module == 'sales':
            return ReportService._query_sales(company, config, parameters)
        elif module == 'inventory':
            return ReportService._query_inventory(company, config, parameters)
        elif module == 'hr':
            return ReportService._query_hr(company, config, parameters)
        elif module == 'crm':
            return ReportService._query_crm(company, config, parameters)
        else:
            return {'headers': [], 'rows': [], 'summary': {}}

    @staticmethod
    def _query_finance(company, config, parameters):
        """Query finance module data."""
        from apps.finance.models import Invoice
        qs = Invoice.objects.filter(company=company)

        if 'date_from' in parameters:
            qs = qs.filter(invoice_date__gte=parameters['date_from'])
        if 'date_to' in parameters:
            qs = qs.filter(invoice_date__lte=parameters['date_to'])

        data = qs.values('status').annotate(
            count=Count('id'),
            total=Sum('total_amount')
        )

        return {
            'headers': ['Status', 'Count', 'Total'],
            'rows': [[d['status'], d['count'], float(d['total'] or 0)] for d in data],
            'summary': {
                'total_records': qs.count(),
                'total_amount': float(qs.aggregate(s=Sum('total_amount'))['s'] or 0),
            }
        }

    @staticmethod
    def _query_sales(company, config, parameters):
        """Query sales module data."""
        from apps.sales.models import SalesOrder
        qs = SalesOrder.objects.filter(company=company)

        if 'date_from' in parameters:
            qs = qs.filter(order_date__gte=parameters['date_from'])
        if 'date_to' in parameters:
            qs = qs.filter(order_date__lte=parameters['date_to'])

        data = qs.values('status').annotate(
            count=Count('id'),
            total=Sum('total_amount')
        )

        return {
            'headers': ['Status', 'Count', 'Total'],
            'rows': [[d['status'], d['count'], float(d['total'] or 0)] for d in data],
            'summary': {
                'total_orders': qs.count(),
                'total_amount': float(qs.aggregate(s=Sum('total_amount'))['s'] or 0),
            }
        }

    @staticmethod
    def _query_inventory(company, config, parameters):
        """Query inventory module data."""
        from apps.inventory.models import StockLedger
        qs = StockLedger.objects.filter(company=company)

        data = qs.values('movement_type').annotate(
            count=Count('id'),
            total_qty=Sum('quantity')
        )

        return {
            'headers': ['Movement Type', 'Count', 'Total Quantity'],
            'rows': [[d['movement_type'], d['count'], float(d['total_qty'] or 0)] for d in data],
            'summary': {
                'total_movements': qs.count(),
            }
        }

    @staticmethod
    def _query_hr(company, config, parameters):
        """Query HR module data."""
        from apps.hr.models import Employee, Attendance
        employees = Employee.objects.filter(company=company)
        today = timezone.now().date()

        return {
            'headers': ['Metric', 'Value'],
            'rows': [
                ['Total Employees', employees.count()],
                ['Active Employees', employees.filter(status='active').count()],
                ['On Leave', employees.filter(status='on_leave').count()],
                ['Today Attendance', Attendance.objects.filter(company=company, date=today).count()],
            ],
            'summary': {
                'total_employees': employees.count(),
                'active_employees': employees.filter(status='active').count(),
            }
        }

    @staticmethod
    def _query_crm(company, config, parameters):
        """Query CRM module data."""
        from apps.crm.models import Lead, Opportunity
        leads = Lead.objects.filter(company=company)
        opps = Opportunity.objects.filter(company=company)

        return {
            'headers': ['Metric', 'Value'],
            'rows': [
                ['Total Leads', leads.count()],
                ['New Leads', leads.filter(status='new').count()],
                ['Converted Leads', leads.filter(status='converted').count()],
                ['Total Opportunities', opps.count()],
                ['Won Opportunities', opps.filter(stage='won').count()],
                ['Pipeline Value', float(opps.exclude(stage__in=['won', 'lost']).aggregate(s=Sum('expected_revenue'))['s'] or 0)],
            ],
            'summary': {
                'total_leads': leads.count(),
                'total_opportunities': opps.count(),
            }
        }

    @staticmethod
    def create_snapshot(company, execution_id, user=None):
        """Create an immutable snapshot of a report execution."""
        execution = ReportExecution.objects.get(pk=execution_id, company=company)
        snapshot = ReportSnapshot.objects.create(
            company=company,
            template=execution.template,
            execution=execution,
            parameters=execution.parameters,
            result_data=execution.result_data,
            row_count=execution.row_count,
            created_by=user,
        )
        return snapshot


class DashboardService:
    """Manage dashboards and widgets."""

    @staticmethod
    def get_dashboard(company, dashboard_id):
        """Get a dashboard with all widgets."""
        return Dashboard.objects.get(pk=dashboard_id, company=company)

    @staticmethod
    def list_dashboards(company, user=None):
        """List accessible dashboards."""
        qs = Dashboard.objects.filter(company=company)
        if user and not user.is_superuser:
            qs = qs.filter(
                Q(is_public=True) | Q(created_by=user) |
                Q(allowed_roles__contains=[])
            )
        return qs

    @staticmethod
    def create_dashboard(company, name, description='', user=None):
        """Create a new dashboard."""
        return Dashboard.objects.create(
            company=company,
            name=name,
            description=description,
            created_by=user,
        )

    @staticmethod
    def add_widget(company, dashboard_id, title, chart_type='bar',
                   report_template_id=None, position_x=0, position_y=0,
                   width=6, height=4, config=None):
        """Add a widget to a dashboard."""
        dashboard = Dashboard.objects.get(pk=dashboard_id, company=company)
        template = None
        if report_template_id:
            template = ReportTemplate.objects.get(pk=report_template_id, company=company)

        widget = DashboardWidget.objects.create(
            company=company,
            dashboard=dashboard,
            report_template=template,
            title=title,
            chart_type=chart_type,
            position_x=position_x,
            position_y=position_y,
            width=width,
            height=height,
            config=config or {},
        )
        return widget

    @staticmethod
    def update_widget_layout(company, widget_id, position_x=None, position_y=None,
                             width=None, height=None):
        """Update widget position and size."""
        widget = DashboardWidget.objects.get(pk=widget_id, company=company)
        if position_x is not None:
            widget.position_x = position_x
        if position_y is not None:
            widget.position_y = position_y
        if width is not None:
            widget.width = width
        if height is not None:
            widget.height = height
        widget.save()
        return widget

    @staticmethod
    def remove_widget(company, widget_id):
        """Remove a widget from a dashboard."""
        widget = DashboardWidget.objects.get(pk=widget_id, company=company)
        widget.delete()


class KPIService:
    """Manage Key Performance Indicators."""

    @staticmethod
    def list_kpis(company, module=None):
        """List KPIs, optionally filtered by module."""
        qs = KPI.objects.filter(company=company, is_active=True)
        if module:
            qs = qs.filter(module=module)
        return qs

    @staticmethod
    def get_kpi(company, kpi_id):
        """Get a single KPI."""
        return KPI.objects.get(pk=kpi_id, company=company)

    @staticmethod
    def update_kpi_value(company, kpi_id, current_value):
        """Update a KPI's current value and calculate trend."""
        kpi = KPI.objects.get(pk=kpi_id, company=company)
        kpi.previous_value = kpi.current_value
        kpi.current_value = Decimal(str(current_value))

        if kpi.previous_value > 0:
            change = ((kpi.current_value - kpi.previous_value) / kpi.previous_value) * 100
            if change > 2:
                kpi.trend = 'up'
            elif change < -2:
                kpi.trend = 'down'
            else:
                kpi.trend = 'stable'
        kpi.save()
        return kpi

    @staticmethod
    def calculate_summary(company):
        """Calculate summary stats for all KPIs."""
        kpis = KPI.objects.filter(company=company, is_active=True)
        return {
            'total_kpis': kpis.count(),
            'on_target': kpis.filter(current_value__gte=F('target_value')).count(),
            'below_target': kpis.filter(current_value__lt=F('target_value')).count(),
            'improving': kpis.filter(trend='up').count(),
            'declining': kpis.filter(trend='down').count(),
        }


class ExportService:
    """Export report results to various formats."""

    @staticmethod
    def to_csv(execution):
        """Export execution results to CSV format."""
        result = execution.result_data
        headers = result.get('headers', [])
        rows = result.get('rows', [])

        lines = [','.join(headers)]
        for row in rows:
            lines.append(','.join(str(cell) for cell in row))
        return '\n'.join(lines)

    @staticmethod
    def to_json(execution):
        """Export execution results to JSON format."""
        return json.dumps(execution.result_data, indent=2, default=str)
