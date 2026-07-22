"""
AI Insights Module — Anomaly Detection, Forecasts, and Natural Language Queries
"""
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel


class AIInsight(BaseModel):
    """AI-generated insight or recommendation."""
    INSIGHT_TYPES = [
        ('anomaly', 'Anomaly'),
        ('forecast', 'Forecast'),
        ('recommendation', 'Recommendation'),
        ('trend', 'Trend'),
        ('summary', 'Summary'),
    ]
    SEVERITY_CHOICES = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]

    company = models.ForeignKey(
        'accounts.Company', on_delete=models.CASCADE, related_name='ai_insights'
    )
    insight_type = models.CharField(max_length=20, choices=INSIGHT_TYPES)
    title = models.CharField(max_length=255)
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='info')
    module = models.CharField(max_length=50, blank=True, default='')
    data_payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    is_dismissed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.insight_type}] {self.title}"


class AnomalyDetection(BaseModel):
    """Detected anomaly in business data."""
    MODULE_CHOICES = [
        ('finance', 'Finance'),
        ('sales', 'Sales'),
        ('inventory', 'Inventory'),
        ('hr', 'HR'),
        ('manufacturing', 'Manufacturing'),
        ('service_management', 'Service Management'),
    ]

    company = models.ForeignKey(
        'accounts.Company', on_delete=models.CASCADE, related_name='anomalies'
    )
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    metric_name = models.CharField(max_length=100)
    expected_value = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    actual_value = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    deviation_pct = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    severity = models.CharField(max_length=20, choices=[
        ('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('critical', 'Critical'),
    ], default='medium')
    description = models.TextField(blank=True, default='')
    is_resolved = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Anomaly: {self.metric_name} ({self.severity})"


class Forecast(BaseModel):
    """Time-series forecast for a business metric."""
    company = models.ForeignKey(
        'accounts.Company', on_delete=models.CASCADE, related_name='forecasts'
    )
    module = models.CharField(max_length=50)
    metric_name = models.CharField(max_length=100)
    forecast_period = models.CharField(max_length=50)  # e.g., '30d', '90d', '12m'
    forecast_data = models.JSONField(default=list)  # [{date, value, lower_bound, upper_bound}]
    accuracy_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    model_used = models.CharField(max_length=100, default='linear_regression')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Forecast: {self.metric_name} ({self.forecast_period})"


class NLQuery(BaseModel):
    """Natural language query and its result."""
    company = models.ForeignKey(
        'accounts.Company', on_delete=models.CASCADE, related_name='nl_queries'
    )
    query_text = models.TextField()
    generated_sql = models.TextField(blank=True, default='')
    result_data = models.JSONField(default=dict)
    execution_time_ms = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('executing', 'Executing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ], default='pending')
    error_message = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"NL Query: {self.query_text[:50]}"
