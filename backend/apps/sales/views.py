"""
Sales Module Views — DRF views for sales API.
Per API_SPECIFICATION.md: Sales endpoints.
"""

import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import RequireModule
from .models import (
    SalesQuotation, SalesOrder, SalesInvoice, SalesReturn,
)
from .serializers import (
    SalesQuotationSerializer, SalesOrderSerializer,
    SalesInvoiceSerializer, SalesReturnSerializer,
)
from .services import QuotationService, SalesService, InvoiceService, ReturnService

logger = logging.getLogger(__name__)


class SalesQuotationViewSet(viewsets.ModelViewSet):
    """Sales Quotation CRUD + actions."""
    serializer_class = SalesQuotationSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("sales")]

    def get_queryset(self):
        return SalesQuotation.objects.filter(
            company=self.request.user.company
        ).select_related("customer")

    def perform_create(self, serializer):
        serializer.save(
            company=self.request.user.company,
            created_by=self.request.user,
        )

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        quotation = QuotationService.send_quotation(
            company=request.user.company,
            quotation_id=pk,
        )
        return Response(SalesQuotationSerializer(quotation).data)

    @action(detail=True, methods=["post"])
    def convert_to_order(self, request, pk=None):
        order = QuotationService.convert_to_order(
            company=request.user.company,
            quotation_id=pk,
            warehouse_id=request.data.get("warehouse_id"),
            delivery_date=request.data.get("delivery_date"),
            user=request.user,
        )
        return Response(SalesOrderSerializer(order).data, status=status.HTTP_201_CREATED)


class SalesOrderViewSet(viewsets.ModelViewSet):
    """Sales Order CRUD + actions."""
    serializer_class = SalesOrderSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("sales")]

    def get_queryset(self):
        return SalesOrder.objects.filter(
            company=self.request.user.company
        ).select_related("customer", "warehouse")

    def perform_create(self, serializer):
        serializer.save(
            company=self.request.user.company,
            created_by=self.request.user,
        )

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        order = SalesService.confirm_order(
            company=request.user.company,
            order_id=pk,
        )
        return Response(SalesOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = SalesService.cancel_order(
            company=request.user.company,
            order_id=pk,
        )
        return Response(SalesOrderSerializer(order).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        data = SalesService.get_order_summary(request.user.company)
        return Response(data)


class SalesInvoiceViewSet(viewsets.ModelViewSet):
    """Sales Invoice CRUD + actions."""
    serializer_class = SalesInvoiceSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("sales")]

    def get_queryset(self):
        return SalesInvoice.objects.filter(
            company=self.request.user.company
        ).select_related("customer")

    def perform_create(self, serializer):
        serializer.save(
            company=self.request.user.company,
            created_by=self.request.user,
        )

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        invoice = InvoiceService.issue_invoice(
            company=request.user.company,
            invoice_id=pk,
            user=request.user,
        )
        return Response(SalesInvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        from decimal import Decimal
        amount = Decimal(str(request.data.get("amount", 0)))
        invoice = InvoiceService.record_payment(
            company=request.user.company,
            invoice_id=pk,
            amount=amount,
            user=request.user,
        )
        return Response(SalesInvoiceSerializer(invoice).data)

    @action(detail=False, methods=["get"])
    def receivables(self, request):
        data = InvoiceService.get_receivables(request.user.company)
        return Response(data)


class SalesReturnViewSet(viewsets.ModelViewSet):
    """Sales Return CRUD + actions."""
    serializer_class = SalesReturnSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("sales")]

    def get_queryset(self):
        return SalesReturn.objects.filter(
            company=self.request.user.company
        ).select_related("customer")

    def perform_create(self, serializer):
        serializer.save(
            company=self.request.user.company,
            created_by=self.request.user,
        )

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        return_order = ReturnService.receive_return(
            company=request.user.company,
            return_id=pk,
            user=request.user,
        )
        return Response(SalesReturnSerializer(return_order).data)
