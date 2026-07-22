"""
Reporting & Analytics Engine URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'reports', views.ReportTemplateViewSet, basename='report-template')
router.register(r'executions', views.ReportExecutionViewSet, basename='report-execution')
router.register(r'dashboards', views.DashboardViewSet, basename='dashboard')
router.register(r'kpis', views.KPIViewSet, basename='kpi')
router.register(r'scheduled', views.ScheduledReportViewSet, basename='scheduled-report')
router.register(r'snapshots', views.ReportSnapshotViewSet, basename='report-snapshot')

urlpatterns = [
    path('', include(router.urls)),
]
