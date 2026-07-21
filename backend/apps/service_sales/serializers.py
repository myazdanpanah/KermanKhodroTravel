"""
Service Sales Module Serializers — DRF serializers for service sales API.
"""

from rest_framework import serializers
from .models import (
    ServiceCategory, ServiceProvider, Service,
    Booking, BookingLine, Passenger, Ticket,
    TourPackage, HotelReservation,
    CommissionRule, CommissionTransaction, RefundTransaction,
)


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "description", "icon", "is_active"]


class ServiceProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceProvider
        fields = ["id", "name", "provider_type", "contact_info", "is_active"]


class ServiceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    provider_name = serializers.CharField(source="provider.name", read_only=True)

    class Meta:
        model = Service
        fields = [
            "id", "name", "service_type", "category", "category_name",
            "provider", "provider_name", "description", "duration_days",
            "selling_price", "supplier_cost", "currency", "tax_percent", "is_active",
        ]


class BookingLineSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)

    class Meta:
        model = BookingLine
        fields = [
            "id", "service", "service_name", "description",
            "quantity", "unit_price", "discount_percent", "discount_amount",
            "tax_percent", "tax_amount", "line_total", "supplier_cost",
        ]
        read_only_fields = ["discount_amount", "tax_amount", "line_total"]


class BookingSerializer(serializers.ModelSerializer):
    lines = BookingLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    balance_due = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "booking_number", "customer", "customer_name",
            "booking_date", "status",
            "subtotal", "discount_amount", "tax_amount", "total",
            "amount_paid", "balance_due", "currency",
            "notes", "lines", "created_at",
        ]
        read_only_fields = ["subtotal", "total", "booking_number", "balance_due"]


class PassengerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Passenger
        fields = [
            "id", "booking", "first_name", "last_name",
            "passport_number", "national_id", "date_of_birth",
            "gender", "seat_class",
        ]


class TicketSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source="passenger.__str__", read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id", "booking", "passenger", "passenger_name",
            "ticket_number", "pnr", "airline", "flight_number",
            "route", "departure_date", "departure_time",
            "arrival_date", "arrival_time",
            "fare", "taxes", "total_price", "status",
        ]


class TourPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TourPackage
        fields = [
            "id", "name", "destination", "duration_days", "description",
            "includes_hotel", "includes_flight", "includes_transfer",
            "includes_guide", "includes_meals",
            "selling_price", "supplier_cost", "currency",
            "max_participants", "is_active",
        ]


class HotelReservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelReservation
        fields = [
            "id", "booking", "hotel_name", "room_type",
            "check_in", "check_out", "nights", "guests",
            "room_rate", "total_rate", "special_requests",
        ]
        read_only_fields = ["nights", "total_rate"]


class CommissionRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommissionRule
        fields = [
            "id", "name", "service_type", "commission_type",
            "commission_rate", "fixed_amount", "applies_to_role", "is_active",
        ]


class CommissionTransactionSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.username", read_only=True)

    class Meta:
        model = CommissionTransaction
        fields = [
            "id", "booking", "rule", "agent", "agent_name",
            "commission_amount", "base_amount", "status", "notes", "created_at",
        ]


class RefundTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefundTransaction
        fields = [
            "id", "booking", "refund_amount", "penalty_amount",
            "net_refund", "reason", "refund_date", "status", "created_at",
        ]
        read_only_fields = ["net_refund"]
