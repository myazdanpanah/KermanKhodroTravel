"""
Service Sales Module Admin — Django admin configuration.
"""

from django.contrib import admin
from .models import (
    ServiceCategory, ServiceProvider, Service,
    Booking, BookingLine, Passenger, Ticket,
    TourPackage, HotelReservation,
    CommissionRule, CommissionTransaction, RefundTransaction,
)


class BookingLineInline(admin.TabularInline):
    model = BookingLine
    extra = 0


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active"]


@admin.register(ServiceProvider)
class ServiceProviderAdmin(admin.ModelAdmin):
    list_display = ["name", "provider_type", "is_active"]
    list_filter = ["provider_type"]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ["name", "service_type", "selling_price", "supplier_cost", "is_active"]
    list_filter = ["service_type"]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["booking_number", "customer", "booking_date", "total", "status"]
    list_filter = ["status"]
    inlines = [BookingLineInline]


@admin.register(Passenger)
class PassengerAdmin(admin.ModelAdmin):
    list_display = ["first_name", "last_name", "passport_number", "seat_class"]


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ["ticket_number", "airline", "flight_number", "route", "status"]
    list_filter = ["status", "airline"]


@admin.register(TourPackage)
class TourPackageAdmin(admin.ModelAdmin):
    list_display = ["name", "destination", "duration_days", "selling_price", "is_active"]


@admin.register(HotelReservation)
class HotelReservationAdmin(admin.ModelAdmin):
    list_display = ["hotel_name", "room_type", "check_in", "check_out", "nights"]


@admin.register(CommissionRule)
class CommissionRuleAdmin(admin.ModelAdmin):
    list_display = ["name", "commission_type", "commission_rate", "is_active"]


@admin.register(CommissionTransaction)
class CommissionTransactionAdmin(admin.ModelAdmin):
    list_display = ["booking", "agent", "commission_amount", "status"]
    list_filter = ["status"]


@admin.register(RefundTransaction)
class RefundTransactionAdmin(admin.ModelAdmin):
    list_display = ["booking", "refund_amount", "penalty_amount", "net_refund", "status"]
    list_filter = ["status"]
