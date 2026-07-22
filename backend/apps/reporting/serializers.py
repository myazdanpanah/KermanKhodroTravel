"""
Reporting & Analytics Engine Serializers
"""
from rest_framework import serializers
from .models import (
    ReportTemplate, ReportExecution, Dashboard, DashboardWidget,
    KPI, ScheduledReport, ReportSnapshot,
)


class ReportTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default='')

    class Meta:
        model = ReportTemplate
        fields = [
            'id', 'name', 'description', 'module', 'visualization',
            'query_config', 'parameters_schema', 'is_public',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ReportExecutionSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    executed_by_name = serializers.CharField(source='executed_by.username', read_only=True, default='')

    class Meta:
        model = ReportExecution
        fields = [
            'id', 'template', 'template_name', 'parameters', 'status',
            'result_data', 'row_count', 'execution_time_ms', 'error_message',
            'executed_by', 'executed_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'status', 'result_data', 'row_count']


class DashboardWidgetSerializer(serializers.ModelSerializer):
    report_template_name = serializers.CharField(source='report_template.name', read_only=True, default='')

    class Meta:
        model = DashboardWidget
        fields = [
            'id', 'dashboard', 'report_template', 'report_template_name',
            'title', 'chart_type', 'query_config',
            'position_x', 'position_y', 'width', 'height',
            'config', 'refresh_interval',
        ]


class DashboardSerializer(serializers.ModelSerializer):
    widgets = DashboardWidgetSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default='')

    class Meta:
        model = Dashboard
        fields = [
            'id', 'name', 'description', 'layout_config', 'is_default',
            'is_public', 'refresh_interval', 'allowed_roles',
            'created_by', 'created_by_name', 'widgets', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class DashboardListSerializer(serializers.ModelSerializer):
    widget_count = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default='')

    class Meta:
        model = Dashboard
        fields = [
            'id', 'name', 'description', 'is_default', 'is_public',
            'widget_count', 'created_by', 'created_by_name', 'created_at',
        ]

    def get_widget_count(self, obj):
        return obj.widgets.count()


class KPISerializer(serializers.ModelSerializer):
    variance = serializers.ReadOnlyField()
    status = serializers.ReadOnlyField()

    class Meta:
        model = KPI
        fields = [
            'id', 'name', 'code', 'description', 'module', 'formula',
            'unit', 'target_value', 'current_value', 'previous_value',
            'trend', 'variance', 'status', 'is_active', 'display_order',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'variance', 'status']


class ScheduledReportSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)

    class Meta:
        model = ScheduledReport
        fields = [
            'id', 'template', 'template_name', 'name', 'frequency',
            'cron_expression', 'parameters', 'recipients', 'export_format',
            'is_active', 'last_run_at', 'next_run_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'last_run_at', 'next_run_at']


class ReportSnapshotSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default='')

    class Meta:
        model = ReportSnapshot
        fields = [
            'id', 'template', 'template_name', 'parameters', 'result_data',
            'row_count', 'file_path', 'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'result_data', 'row_count']
