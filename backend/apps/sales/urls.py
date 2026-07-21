"""
Sales Module URLs — API routes for sales endpoints.
Per API_SPECIFICATION.md: Sales API routes.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"quotations", views.SalesQuotationViewSet, basename="quotation")
router.register(r"orders", views.SalesOrderViewSet, basename="order")
router.register(r"invoices", views.SalesInvoiceViewSet, basename="sales-invoice")
router.register(r"returns", views.SalesReturnViewSet, basename="sales-return")

urlpatterns = [
    path("", include(router.urls)),
]
