"""
Reporting & Analytics Engine Models
"""
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel


class ReportTemplate(BaseModel):
    """Reusable report template with query definition."""
    MODULE_CHOICES = [
        ('finance', 'Finance'),
        ('inventory', 'Inventory'),
        ('purchasing', 'Purchasing'),
        ('sales', 'Sales'),
        ('manufacturing', 'Manufacturing'),
        ('trading', 'Trading'),
        ('service_sales', 'Service Sales'),
        ('service_management', 'Service Management'),
        ('crm', 'CRM'),
        ('hr', 'HR'),
        ('cross_module', 'Cross-Module'),
    ]
    FORMAT_CHOICES = [
        ('table', 'Table'),
        ('chart_bar', 'Bar Chart'),
        ('chart_line', 'Line Chart'),
        ('chart_pie', 'Pie Chart'),
        ('chart_area', 'Area Chart'),
        ('kpi', 'KPI Card'),
        ('pivot', 'Pivot Table'),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    module = models.CharField(max_length=50, choices=MODULE_CHOICES, default='cross_module')
    visualization = models.CharField(max_length=50, choices=FORMAT_CHOICES, default='table')
    query_config = models.JSONField(default=dict, help_text='Dataset/query configuration')
    parameters_schema = models.JSONField(default=list, help_text='Runtime parameter definitions')
    is_public = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='report_templates'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class ReportExecution(BaseModel):
    """A single execution of a report template."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    template = models.ForeignKey(ReportTemplate, on_delete=models.CASCADE, related_name='executions')
    parameters = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    result_data = models.JSONField(default=dict, blank=True)
    row_count = models.PositiveIntegerField(default=0)
    execution_time_ms = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True, default='')
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='report_executions'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.template.name} ({self.status})"


class Dashboard(BaseModel):
    """Configurable dashboard with widgets."""
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    layout_config = models.JSONField(default=dict, help_text='Grid layout configuration')
    is_default = models.BooleanField(default=False)
    is_public = models.BooleanField(default=False)
    refresh_interval = models.PositiveIntegerField(default=300, help_text='Auto-refresh in seconds')
    allowed_roles = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reporting_dashboards'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class DashboardWidget(BaseModel):
    """A widget within a dashboard."""
    CHART_TYPE_CHOICES = [
        ('line', 'Line Chart'),
        ('bar', 'Bar Chart'),
        ('stacked_bar', 'Stacked Bar'),
        ('pie', 'Pie Chart'),
        ('donut', 'Donut Chart'),
        ('area', 'Area Chart'),
        ('scatter', 'Scatter Plot'),
        ('heatmap', 'Heatmap'),
        ('treemap', 'Treemap'),
        ('gauge', 'Gauge'),
        ('funnel', 'Funnel'),
        ('kpi', 'KPI Card'),
        ('table', 'Data Table'),
        ('pivot', 'Pivot Table'),
    ]

    dashboard = models.ForeignKey(Dashboard, on_delete=models.CASCADE, related_name='widgets')
    report_template = models.ForeignKey(
        ReportTemplate, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='widgets'
    )
    title = models.CharField(max_length=200)
    chart_type = models.CharField(max_length=50, choices=CHART_TYPE_CHOICES, default='bar')
    query_config = models.JSONField(default=dict, help_text='Widget-specific query overrides')
    position_x = models.PositiveIntegerField(default=0)
    position_y = models.PositiveIntegerField(default=0)
    width = models.PositiveIntegerField(default=6)
    height = models.PositiveIntegerField(default=4)
    config = models.JSONField(default=dict, help_text='Chart styling and options')
    refresh_interval = models.PositiveIntegerField(default=0, help_text='Widget-specific refresh (0 = use dashboard)')

    class Meta:
        ordering = ['position_y', 'position_x']

    def __str__(self):
        return f"{self.dashboard.name} - {self.title}"


class KPI(BaseModel):
    """Key Performance Indicator definition and current value."""
    MODULE_CHOICES = ReportTemplate.MODULE_CHOICES

    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    module = models.CharField(max_length=50, choices=MODULE_CHOICES, default='cross_module')
    formula = models.TextField(help_text='Calculation formula or description')
    unit = models.CharField(max_length=50, blank=True, default='')
    target_value = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    current_value = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    previous_value = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    trend = models.CharField(max_length=20, choices=[
        ('up', 'Up'),
        ('down', 'Down'),
        ('stable', 'Stable'),
    ], default='stable')
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['display_order', 'name']

    def __str__(self):
        return self.name

    @property
    def variance(self):
        if self.previous_value == 0:
            return 0
        return ((self.current_value - self.previous_value) / self.previous_value) * 100

    @property
    def status(self):
        if self.target_value == 0:
            return 'neutral'
        ratio = self.current_value / self.target_value
        if ratio >= 1.0:
            return 'good'
        elif ratio >= 0.8:
            return 'warning'
        return 'critical'


class ScheduledReport(BaseModel):
    """Automated report scheduling."""
    FREQUENCY_CHOICES = [
        ('hourly', 'Hourly'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
    ]

    template = models.ForeignKey(ReportTemplate, on_delete=models.CASCADE, related_name='schedules')
    name = models.CharField(max_length=200)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='daily')
    cron_expression = models.CharField(max_length=100, blank=True, default='')
    parameters = models.JSONField(default=dict)
    recipients = models.JSONField(default=list, help_text='User IDs or email addresses')
    export_format = models.CharField(max_length=20, choices=[
        ('pdf', 'PDF'),
        ('xlsx', 'Excel'),
        ('csv', 'CSV'),
    ], default='pdf')
    is_active = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.frequency})"


class ReportSnapshot(BaseModel):
    """Immutable snapshot of report results at a point in time."""
    template = models.ForeignKey(ReportTemplate, on_delete=models.CASCADE, related_name='snapshots')
    execution = models.ForeignKey(ReportExecution, on_delete=models.SET_NULL, null=True, blank=True)
    parameters = models.JSONField(default=dict)
    result_data = models.JSONField(default=dict)
    row_count = models.PositiveIntegerField(default=0)
    file_path = models.CharField(max_length=500, blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='report_snapshots'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Snapshot: {self.template.name} ({self.created_at})"
