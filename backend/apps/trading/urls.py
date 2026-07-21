"""
Trading Module URLs — API routes for trading endpoints.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"imports", views.ImportOrderViewSet, basename="import")
router.register(r"exports", views.ExportOrderViewSet, basename="export")
router.register(r"containers", views.ContainerViewSet, basename="container")
router.register(r"shipments", views.ShipmentViewSet, basename="shipment")
router.register(r"customs-documents", views.CustomsDocumentViewSet, basename="customs-document")
router.register(r"summary", views.TradingSummaryView, basename="summary")

urlpatterns = [
    path("", include(router.urls)),
]
