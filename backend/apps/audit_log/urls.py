"""
Audit Log URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"entries", views.AuditLogViewSet, basename="audit-entry")
router.register(r"config", views.AuditLogConfigViewSet, basename="audit-config")

urlpatterns = [
    path("", include(router.urls)),
    path("summary/", views.audit_summary, name="audit-summary"),
]
