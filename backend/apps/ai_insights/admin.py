from django.contrib import admin
from .models import AIInsight, AnomalyDetection, Forecast, NLQuery
from .alerts import AnomalyAlert


@admin.register(AIInsight)
class AIInsightAdmin(admin.ModelAdmin):
    list_display = ['title', 'insight_type', 'severity', 'module', 'is_read', 'created_at']
    list_filter = ['insight_type', 'severity', 'module', 'is_read']
    search_fields = ['title', 'description']


@admin.register(AnomalyDetection)
class AnomalyDetectionAdmin(admin.ModelAdmin):
    list_display = ['metric_name', 'module', 'severity', 'deviation_pct', 'is_resolved', 'created_at']
    list_filter = ['module', 'severity', 'is_resolved']
    search_fields = ['metric_name', 'description']


@admin.register(Forecast)
class ForecastAdmin(admin.ModelAdmin):
    list_display = ['metric_name', 'module', 'forecast_period', 'accuracy_score', 'model_used', 'created_at']
    list_filter = ['module', 'model_used']
    search_fields = ['metric_name']


@admin.register(NLQuery)
class NLQueryAdmin(admin.ModelAdmin):
    list_display = ['query_text', 'status', 'execution_time_ms', 'created_at']
    list_filter = ['status']
    search_fields = ['query_text']


@admin.register(AnomalyAlert)
class AnomalyAlertAdmin(admin.ModelAdmin):
    list_display = ['title', 'module', 'severity', 'is_read', 'is_notified', 'created_at']
    list_filter = ['module', 'severity', 'is_read', 'is_notified']
    search_fields = ['title', 'message']
