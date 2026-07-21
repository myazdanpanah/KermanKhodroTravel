"""
Inventory Module Serializers — Enterprise ERP.

Per API_SPECIFICATION.md §25: Inventory API.
Per DJANGO_BACKEND.md §25: Serializer validation.
"""

from rest_framework import serializers
from .models import (
    Warehouse, Location, StockLedger, StockMovement,
    InventoryReservation, CycleCount, CycleCountLine, StockAdjustment,
)


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = [
            "id", "code", "name", "warehouse_type", "branch",
            "address", "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = [
            "id", "warehouse", "code", "name", "parent",
            "capacity", "is_active",
        ]
        read_only_fields = ["id"]


class StockLedgerSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = StockLedger
        fields = [
            "id", "product_name", "product_code",
            "warehouse", "warehouse_code", "warehouse_name",
            "location", "quantity_on_hand", "quantity_reserved",
            "quantity_available", "unit_cost", "total_value",
            "reorder_level", "reorder_quantity",
            "last_receipt_date", "last_issue_date", "last_count_date",
        ]
        read_only_fields = [
            "id", "quantity_available", "total_value",
            "last_receipt_date", "last_issue_date", "last_count_date",
        ]


class StockMovementSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    performed_by_name = serializers.CharField(source="performed_by.username", read_only=True, default="")

    class Meta:
        model = StockMovement
        fields = [
            "id", "warehouse", "warehouse_code", "to_warehouse", "location",
            "movement_type", "reference_type", "reference_id",
            "product_name", "product_code", "quantity", "unit",
            "unit_cost", "total_cost", "batch_number", "serial_number",
            "description", "performed_by", "performed_by_name", "movement_date",
        ]
        read_only_fields = ["id", "total_cost", "movement_date"]


class InventoryReservationSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    reserved_by_name = serializers.CharField(source="reserved_by.username", read_only=True, default="")

    class Meta:
        model = InventoryReservation
        fields = [
            "id", "product_name", "product_code", "warehouse", "warehouse_code",
            "quantity", "quantity_fulfilled", "unit",
            "reference_type", "reference_id", "status",
            "expires_at", "reserved_by", "reserved_by_name", "notes",
            "created_at",
        ]
        read_only_fields = ["id", "quantity_fulfilled", "created_at"]


class CycleCountLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = CycleCountLine
        fields = [
            "id", "product_name", "product_code", "location",
            "system_quantity", "counted_quantity", "variance",
            "unit_cost", "variance_value", "notes",
        ]
        read_only_fields = ["id", "variance", "variance_value"]


class CycleCountSerializer(serializers.ModelSerializer):
    lines = CycleCountLineSerializer(many=True, read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:
        model = CycleCount
        fields = [
            "id", "warehouse", "warehouse_code", "count_number",
            "count_date", "status", "counted_by", "notes",
            "lines", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class StockAdjustmentSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.username", read_only=True, default="")

    class Meta:
        model = StockAdjustment
        fields = [
            "id", "warehouse", "warehouse_code", "adjustment_number",
            "adjustment_date", "reason",
            "product_name", "product_code",
            "quantity_before", "quantity_adjustment", "quantity_after",
            "unit_cost", "adjustment_value",
            "journal_voucher", "cycle_count",
            "description", "approved_by", "approved_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "quantity_after", "adjustment_value", "created_at"]
