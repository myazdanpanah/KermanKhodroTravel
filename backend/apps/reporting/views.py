"""
Reporting & Analytics Engine Views
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from apps.accounts.permissions import RequireModule
from .models import (
    ReportTemplate, ReportExecution, Dashboard, DashboardWidget,
    KPI, ScheduledReport, ReportSnapshot,
)
from .serializers import (
    ReportTemplateSerializer, ReportExecutionSerializer,
    DashboardSerializer, DashboardListSerializer, DashboardWidgetSerializer,
    KPISerializer, ScheduledReportSerializer, ReportSnapshotSerializer,
)
from .services import ReportService, DashboardService, KPIService, ExportService


def _check_reporting(request):
    """Check if user has reporting module access."""
    company = getattr(request.user, 'company', None)
    if company and not company.has_module('reporting'):
        return None
    return company


class ReportTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = ReportTemplateSerializer
    permission_classes = [RequireModule.for_module('reporting')]

    def get_queryset(self):
        company = getattr(self.request.user, 'company', None)
        if not company:
            return ReportTemplate.objects.none()
        return ReportTemplate.objects.filter(
            Q(company=company) | Q(is_public=True)
        )

    def perform_create(self, serializer):
        company = getattr(self.request.user, 'company', None)
        serializer.save(company=company, created_by=self.request.user)


class ReportExecutionViewSet(viewsets.ModelViewSet):
    serializer_class = ReportExecutionSerializer
    permission_classes = [RequireModule.for_module('reporting')]

    def get_queryset(self):
        company = getattr(self.request.user, 'company', None)
        if not company:
            return ReportExecution.objects.none()
        return ReportExecution.objects.filter(company=company)

    def create(self, request, *args, **kwargs):
        """Execute a report."""
        company = _check_reporting(request)
        if not company:
            return Response({'error': 'Reporting module not enabled'}, status=403)

        template_id = request.data.get('template_id')
        parameters = request.data.get('parameters', {})

        if not template_id:
            return Response({'error': 'template_id is required'}, status=400)

        try:
            execution = ReportService.execute_report(
                company, template_id, parameters, request.user
            )
            serializer = self.get_serializer(execution)
            return Response(serializer.data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def export(self, request, pk=None):
        """Export report results."""
        execution = self.get_object()
        format_type = request.data.get('format', 'csv')

        if format_type == 'csv':
            content = ExportService.to_csv(execution)
            content_type = 'text/csv'
            ext = 'csv'
        elif format_type == 'json':
            content = ExportService.to_json(execution)
            content_type = 'application/json'
            ext = 'json'
        else:
            return Response({'error': f'Unsupported format: {format_type}'}, status=400)

        from django.http import HttpResponse
        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="report_{execution.id}.{ext}"'
        return response

    @action(detail=True, methods=['post'])
    def snapshot(self, request, pk=None):
        """Create an immutable snapshot."""
        execution = self.get_object()
        snapshot = ReportService.create_snapshot(
            execution.company, execution.id, request.user
        )
        serializer = ReportSnapshotSerializer(snapshot)
        return Response(serializer.data, status=201)


class DashboardViewSet(viewsets.ModelViewSet):
    permission_classes = [RequireModule.for_module('reporting')]

    def get_serializer_class(self):
        if self.action == 'list':
            return DashboardListSerializer
        return DashboardSerializer

    def get_queryset(self):
        company = getattr(self.request.user, 'company', None)
        if not company:
            return Dashboard.objects.none()
        return Dashboard.objects.filter(
            Q(company=company) | Q(is_public=True)
        )

    def perform_create(self, serializer):
        company = getattr(self.request.user, 'company', None)
        serializer.save(company=company, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def add_widget(self, request, pk=None):
        """Add a widget to the dashboard."""
        company = _check_reporting(request)
        if not company:
            return Response({'error': 'Reporting module not enabled'}, status=403)

        widget = DashboardService.add_widget(
            company, pk,
            title=request.data.get('title', 'Untitled'),
            chart_type=request.data.get('chart_type', 'bar'),
            report_template_id=request.data.get('report_template_id'),
            position_x=request.data.get('position_x', 0),
            position_y=request.data.get('position_y', 0),
            width=request.data.get('width', 6),
            height=request.data.get('height', 4),
            config=request.data.get('config', {}),
        )
        serializer = DashboardWidgetSerializer(widget)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['delete'], url_path='remove_widget/(?P<widget_id>\\d+)')
    def remove_widget(self, request, pk=None, widget_id=None):
        """Remove a widget from the dashboard."""
        company = _check_reporting(request)
        if not company:
            return Response({'error': 'Reporting module not enabled'}, status=403)
        DashboardService.remove_widget(company, widget_id)
        return Response(status=204)


class KPIViewSet(viewsets.ModelViewSet):
    serializer_class = KPISerializer
    permission_classes = [RequireModule.for_module('reporting')]

    def get_queryset(self):
        company = getattr(self.request.user, 'company', None)
        if not company:
            return KPI.objects.none()
        qs = KPI.objects.filter(company=company)
        module = self.request.query_params.get('module')
        if module:
            qs = qs.filter(module=module)
        return qs

    def perform_create(self, serializer):
        company = getattr(self.request.user, 'company', None)
        serializer.save(company=company)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get KPI summary stats."""
        company = getattr(request.user, 'company', None)
        if not company:
            return Response({'error': 'No company'}, status=400)
        summary = KPIService.calculate_summary(company)
        return Response(summary)

    @action(detail=True, methods=['post'])
    def update_value(self, request, pk=None):
        """Update a KPI's current value."""
        company = _check_reporting(request)
        if not company:
            return Response({'error': 'Reporting module not enabled'}, status=403)

        value = request.data.get('value')
        if value is None:
            return Response({'error': 'value is required'}, status=400)

        kpi = KPIService.update_kpi_value(company, pk, value)
        serializer = self.get_serializer(kpi)
        return Response(serializer.data)


class ScheduledReportViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduledReportSerializer
    permission_classes = [RequireModule.for_module('reporting')]

    def get_queryset(self):
        company = getattr(self.request.user, 'company', None)
        if not company:
            return ScheduledReport.objects.none()
        return ScheduledReport.objects.filter(company=company)

    def perform_create(self, serializer):
        company = getattr(self.request.user, 'company', None)
        serializer.save(company=company)


class ReportSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReportSnapshotSerializer
    permission_classes = [RequireModule.for_module('reporting')]

    def get_queryset(self):
        company = getattr(self.request.user, 'company', None)
        if not company:
            return ReportSnapshot.objects.none()
        return ReportSnapshot.objects.filter(company=company)
