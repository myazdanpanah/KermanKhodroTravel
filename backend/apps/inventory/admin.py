"""
Inventory Module Admin — Django Admin registration.
Per DJANGO_BACKEND.md §9: Admin configuration.
"""

from django.contrib import admin
from .models import (
    Warehouse, Location, StockLedger, StockMovement,
    InventoryReservation, CycleCount, CycleCountLine, StockAdjustment,
)


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "warehouse_type", "company", "is_active"]
    list_filter = ["warehouse_type", "is_active"]
    search_fields = ["code", "name"]


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "warehouse", "capacity"]
    list_filter = ["warehouse"]


@admin.register(StockLedger)
class StockLedgerAdmin(admin.ModelAdmin):
    list_display = ["product_name", "product_code", "warehouse", "quantity_on_hand", "quantity_available", "unit_cost", "total_value"]
    list_filter = ["warehouse"]
    search_fields = ["product_name", "product_code"]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ["movement_type", "product_name", "quantity", "unit_cost", "total_cost", "warehouse", "movement_date"]
    list_filter = ["movement_type", "warehouse"]
    search_fields = ["product_name", "product_code"]
    readonly_fields = ["total_cost", "movement_date"]


@admin.register(InventoryReservation)
class InventoryReservationAdmin(admin.ModelAdmin):
    list_display = ["product_name", "quantity", "quantity_fulfilled", "warehouse", "status", "reference_type", "reference_id"]
    list_filter = ["status"]
    search_fields = ["product_name", "product_code"]


class CycleCountLineInline(admin.TabularInline):
    model = CycleCountLine
    extra = 0


@admin.register(CycleCount)
class CycleCountAdmin(admin.ModelAdmin):
    list_display = ["count_number", "warehouse", "count_date", "status"]
    list_filter = ["status", "warehouse"]
    inlines = [CycleCountLineInline]


@admin.register(StockAdjustment)
class StockAdjustmentAdmin(admin.ModelAdmin):
    list_display = ["adjustment_number", "product_name", "quantity_before", "quantity_adjustment", "quantity_after", "reason", "adjustment_date"]
    list_filter = ["reason"]
    search_fields = ["product_name", "product_code"]
