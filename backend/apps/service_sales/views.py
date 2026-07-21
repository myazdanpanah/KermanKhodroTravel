"""
Service Sales Module Views — DRF views for service sales API.
"""

import logging
from decimal import Decimal

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import RequireModule
from .models import (
    ServiceCategory, ServiceProvider, Service,
    Booking, Passenger, Ticket,
    TourPackage, HotelReservation,
    CommissionRule, CommissionTransaction, RefundTransaction,
)
from .serializers import (
    ServiceCategorySerializer, ServiceProviderSerializer, ServiceSerializer,
    BookingSerializer, PassengerSerializer, TicketSerializer,
    TourPackageSerializer, HotelReservationSerializer,
    CommissionRuleSerializer, CommissionTransactionSerializer,
    RefundTransactionSerializer,
)
from .services import BookingService, CommissionService, RefundService

logger = logging.getLogger(__name__)


class ServiceCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return ServiceCategory.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class ServiceProviderViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceProviderSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return ServiceProvider.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return Service.objects.filter(company=self.request.user.company).select_related("category", "provider")

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return Booking.objects.filter(company=self.request.user.company).select_related("customer")

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        booking = BookingService.confirm_booking(request.user.company, pk)
        return Response(BookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        booking = BookingService.complete_booking(request.user.company, pk)
        return Response(BookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        amount = Decimal(str(request.data.get("amount", 0)))
        booking = BookingService.record_payment(request.user.company, pk, amount)
        return Response(BookingSerializer(booking).data)


class PassengerViewSet(viewsets.ModelViewSet):
    serializer_class = PassengerSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return Passenger.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class TicketViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return Ticket.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class TourPackageViewSet(viewsets.ModelViewSet):
    serializer_class = TourPackageSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return TourPackage.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class HotelReservationViewSet(viewsets.ModelViewSet):
    serializer_class = HotelReservationSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return HotelReservation.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class CommissionRuleViewSet(viewsets.ModelViewSet):
    serializer_class = CommissionRuleSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return CommissionRule.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class CommissionTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = CommissionTransactionSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return CommissionTransaction.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class RefundTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = RefundTransactionSerializer
    permission_classes = [IsAuthenticated, RequireModule.for_module("service_sales")]

    def get_queryset(self):
        return RefundTransaction.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)
