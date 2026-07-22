"""
Reporting & Analytics Engine Admin
"""
from django.contrib import admin
from .models import (
    ReportTemplate, ReportExecution, Dashboard, DashboardWidget,
    KPI, ScheduledReport, ReportSnapshot,
)


@admin.register(ReportTemplate)
class ReportTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'module', 'visualization', 'is_public', 'created_at']
    list_filter = ['module', 'visualization', 'is_public']
    search_fields = ['name', 'description']


@admin.register(ReportExecution)
class ReportExecutionAdmin(admin.ModelAdmin):
    list_display = ['template', 'status', 'row_count', 'executed_by', 'created_at']
    list_filter = ['status']
    readonly_fields = ['result_data', 'error_message']


@admin.register(Dashboard)
class DashboardAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_default', 'is_public', 'created_by', 'created_at']
    list_filter = ['is_default', 'is_public']


@admin.register(DashboardWidget)
class DashboardWidgetAdmin(admin.ModelAdmin):
    list_display = ['title', 'dashboard', 'chart_type', 'position_x', 'position_y']
    list_filter = ['chart_type']


@admin.register(KPI)
class KPIAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'module', 'current_value', 'target_value', 'trend', 'is_active']
    list_filter = ['module', 'is_active', 'trend']
    search_fields = ['name', 'code']


@admin.register(ScheduledReport)
class ScheduledReportAdmin(admin.ModelAdmin):
    list_display = ['name', 'template', 'frequency', 'is_active', 'last_run_at']
    list_filter = ['frequency', 'is_active']


@admin.register(ReportSnapshot)
class ReportSnapshotAdmin(admin.ModelAdmin):
    list_display = ['template', 'row_count', 'created_by', 'created_at']
    readonly_fields = ['result_data', 'parameters']
