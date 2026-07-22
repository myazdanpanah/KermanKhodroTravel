"""
Reporting & Analytics Engine Tests
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.accounts.models import Company
from apps.core.models import BaseModel
from .models import (
    ReportTemplate, ReportExecution, Dashboard, DashboardWidget,
    KPI, ScheduledReport, ReportSnapshot,
)
from .services import ReportService, DashboardService, KPIService, ExportService

User = get_user_model()


class ReportingTestBase(TestCase):
    """Base test class with common setup for Reporting tests."""

    def setUp(self):
        self.company = Company.objects.create(
            name='Test Company',
            enabled_modules=['reporting'],
        )
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            company=self.company,
        )
        self.client.force_login(self.user)


class ReportTemplateTests(ReportingTestBase):
    """Tests for ReportTemplate CRUD."""

    def test_create_template(self):
        t = ReportTemplate.objects.create(
            company=self.company,
            name='Sales Report',
            module='sales',
            visualization='table',
            query_config={'source': 'sales_orders'},
        )
        self.assertEqual(t.name, 'Sales Report')
        self.assertEqual(t.module, 'sales')

    def test_list_templates(self):
        ReportTemplate.objects.create(company=self.company, name='R1', module='finance')
        ReportTemplate.objects.create(company=self.company, name='R2', module='sales')
        self.assertEqual(ReportTemplate.objects.filter(company=self.company).count(), 2)

    def test_delete_template(self):
        t = ReportTemplate.objects.create(company=self.company, name='Delete Me', module='finance')
        t_id = t.id
        t.delete()
        self.assertFalse(ReportTemplate.objects.filter(id=t_id).exists())


class ReportExecutionTests(ReportingTestBase):
    """Tests for report execution."""

    def setUp(self):
        super().setUp()
        self.template = ReportTemplate.objects.create(
            company=self.company,
            name='Finance Summary',
            module='finance',
            visualization='table',
            query_config={},
        )

    def test_execute_report(self):
        execution = ReportService.execute_report(
            self.company, self.template.id, {}, self.user
        )
        self.assertEqual(execution.status, 'completed')
        self.assertIsNotNone(execution.result_data)

    def test_execute_report_creates_execution(self):
        ReportService.execute_report(self.company, self.template.id, {}, self.user)
        self.assertEqual(ReportExecution.objects.filter(company=self.company).count(), 1)


class DashboardTests(ReportingTestBase):
    """Tests for Dashboard CRUD and widget management."""

    def test_create_dashboard(self):
        d = DashboardService.create_dashboard(
            self.company, 'Executive Dashboard', 'High-level KPIs', self.user
        )
        self.assertEqual(d.name, 'Executive Dashboard')
        self.assertEqual(d.created_by, self.user)

    def test_add_widget(self):
        d = DashboardService.create_dashboard(self.company, 'Test Dashboard', user=self.user)
        w = DashboardService.add_widget(
            self.company, d.id, 'Revenue Chart', 'bar', width=6, height=4
        )
        self.assertEqual(w.title, 'Revenue Chart')
        self.assertEqual(w.chart_type, 'bar')

    def test_remove_widget(self):
        d = DashboardService.create_dashboard(self.company, 'Test Dashboard', user=self.user)
        w = DashboardService.add_widget(self.company, d.id, 'Widget 1')
        DashboardService.remove_widget(self.company, w.id)
        self.assertEqual(DashboardWidget.objects.filter(dashboard=d).count(), 0)

    def test_list_dashboards(self):
        DashboardService.create_dashboard(self.company, 'D1', user=self.user)
        DashboardService.create_dashboard(self.company, 'D2', user=self.user)
        dashboards = DashboardService.list_dashboards(self.company)
        self.assertEqual(dashboards.count(), 2)


class KPITests(ReportingTestBase):
    """Tests for KPI management."""

    def test_create_kpi(self):
        kpi = KPI.objects.create(
            company=self.company,
            name='Revenue',
            code='revenue',
            module='finance',
            formula='SUM(invoice.total)',
            target_value=100000,
            current_value=85000,
        )
        self.assertEqual(kpi.name, 'Revenue')
        self.assertEqual(kpi.status, 'warning')  # 85% of target

    def test_update_kpi_value(self):
        kpi = KPI.objects.create(
            company=self.company,
            name='Revenue',
            code='revenue',
            module='finance',
            formula='SUM(invoice.total)',
            target_value=100000,
            current_value=80000,
        )
        updated = KPIService.update_kpi_value(self.company, kpi.id, 95000)
        self.assertEqual(updated.current_value, 95000)
        self.assertEqual(updated.previous_value, 80000)
        self.assertEqual(updated.trend, 'up')

    def test_kpi_summary(self):
        KPI.objects.create(company=self.company, name='K1', code='k1', formula='x', target_value=100, current_value=110)
        KPI.objects.create(company=self.company, name='K2', code='k2', formula='x', target_value=100, current_value=80)
        summary = KPIService.calculate_summary(self.company)
        self.assertEqual(summary['total_kpis'], 2)
        self.assertEqual(summary['on_target'], 1)
        self.assertEqual(summary['below_target'], 1)

    def test_kpi_status(self):
        kpi_on = KPI.objects.create(company=self.company, name='On', code='on', formula='x', target_value=100, current_value=100)
        kpi_warn = KPI.objects.create(company=self.company, name='Warn', code='warn', formula='x', target_value=100, current_value=85)
        kpi_crit = KPI.objects.create(company=self.company, name='Crit', code='crit', formula='x', target_value=100, current_value=50)
        self.assertEqual(kpi_on.status, 'good')
        self.assertEqual(kpi_warn.status, 'warning')
        self.assertEqual(kpi_crit.status, 'critical')


class ExportTests(ReportingTestBase):
    """Tests for export functionality."""

    def setUp(self):
        super().setUp()
        self.template = ReportTemplate.objects.create(
            company=self.company, name='Test', module='finance', visualization='table'
        )
        self.execution = ReportService.execute_report(
            self.company, self.template.id, {}, self.user
        )

    def test_csv_export(self):
        csv = ExportService.to_csv(self.execution)
        self.assertIn(',', csv)
        self.assertIsInstance(csv, str)

    def test_json_export(self):
        import json
        result = ExportService.to_json(self.execution)
        data = json.loads(result)
        self.assertIn('headers', data)
        self.assertIn('rows', data)


class SnapshotTests(ReportingTestBase):
    """Tests for report snapshots."""

    def test_create_snapshot(self):
        template = ReportTemplate.objects.create(
            company=self.company, name='Snap Test', module='finance', visualization='table'
        )
        execution = ReportService.execute_report(
            self.company, template.id, {}, self.user
        )
        snapshot = ReportService.create_snapshot(
            self.company, execution.id, self.user
        )
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot.template, template)
