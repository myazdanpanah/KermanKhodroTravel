"""
AI Insights Module Tests
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from decimal import Decimal

from apps.accounts.models import Company
from .models import AIInsight, AnomalyDetection, Forecast, NLQuery
from .services import InsightService, AnomalyService, ForecastService, NLQueryService

User = get_user_model()


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
        module = NLQueryService._detect_module('production orders status')
        self.assertEqual(module, 'manufacturing')

    def test_detect_module_service_management(self):
        module = NLQueryService._detect_module('service requests open')
        self.assertEqual(module, 'service_management')

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


class AnomalyDetectionServiceTest(TestCase):
    """Test AnomalyService detection methods."""

    def setUp(self):
        self.company = Company.objects.create(name='Test Co')

    def test_no_data_returns_empty(self):
        """With no invoices, anomaly detection returns empty."""
        result = AnomalyService.detect_finance_anomalies(self.company)
        self.assertEqual(result, [])

    def test_insufficient_data_returns_empty(self):
        """With fewer than 10 invoices, returns empty."""
        # Just verify the method works without data
        result = AnomalyService.detect_finance_anomalies(self.company)
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
