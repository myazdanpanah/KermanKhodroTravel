"""
Trading Module Views — DRF views for trading API.
"""

import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import RequireModule
from .models import (
    ImportOrder, ExportOrder, Container,
    Shipment, CustomsDocument, InternationalCost,
)
from .serializers import (
    ImportOrderSerializer, ExportOrderSerializer, ContainerSerializer,
    ShipmentSerializer, CustomsDocumentSerializer, InternationalCostSerializer,
)
from .services import ImportService, ExportService, ShipmentService, TradingSummaryService

logger = logging.getLogger(__name__)


class ImportOrderViewSet(viewsets.ModelViewSet):
    serializer_class = ImportOrderSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("trading")]

    def get_queryset(self):
        return ImportOrder.objects.filter(company=self.request.user.company).select_related("supplier")

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        order = ImportService.confirm_import(request.user.company, pk)
        return Response(ImportOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def ship(self, request, pk=None):
        order = ImportService.mark_shipped(request.user.company, pk)
        return Response(ImportOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def clear_customs(self, request, pk=None):
        order = ImportService.clear_customs(
            request.user.company, pk,
            declaration_number=request.data.get("declaration_number", ""),
            duty_amount=request.data.get("duty_amount", 0),
            vat_amount=request.data.get("vat_amount", 0),
        )
        return Response(ImportOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        order = ImportService.receive_at_warehouse(request.user.company, pk)
        return Response(ImportOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        order = ImportService.complete_import(request.user.company, pk)
        return Response(ImportOrderSerializer(order).data)


class ExportOrderViewSet(viewsets.ModelViewSet):
    serializer_class = ExportOrderSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("trading")]

    def get_queryset(self):
        return ExportOrder.objects.filter(company=self.request.user.company).select_related("customer")

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        order = ExportService.confirm_export(request.user.company, pk)
        return Response(ExportOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def ship(self, request, pk=None):
        order = ExportService.mark_shipped(request.user.company, pk)
        return Response(ExportOrderSerializer(order).data)


class ContainerViewSet(viewsets.ModelViewSet):
    serializer_class = ContainerSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("trading")]

    def get_queryset(self):
        return Container.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class ShipmentViewSet(viewsets.ModelViewSet):
    serializer_class = ShipmentSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("trading")]

    def get_queryset(self):
        return Shipment.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        new_status = request.data.get("status", "")
        shipment = ShipmentService.update_status(request.user.company, pk, new_status)
        return Response(ShipmentSerializer(shipment).data)


class CustomsDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = CustomsDocumentSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("trading")]

    def get_queryset(self):
        return CustomsDocument.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class TradingSummaryView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RequireModule.for_module("trading")]

    def list(self, request):
        data = TradingSummaryService.get_summary(request.user.company)
        return Response(data)
