"""
Purchasing Module Serializers — Enterprise ERP.

Per API_SPECIFICATION.md §37-§39: Purchasing API.
"""

from rest_framework import serializers
from .models import (
    PurchaseRequest, PurchaseOrder, GoodsReceipt, PurchaseReturn,
)


class PurchaseRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source="requested_by.username", read_only=True, default="")
    approved_by_name = serializers.CharField(source="approved_by.username", read_only=True, default="")

    class Meta:
        model = PurchaseRequest
        fields = [
            "id", "request_number", "title", "description",
            "requested_by", "requested_by_name", "department",
            "item_name", "item_code", "quantity", "unit",
            "estimated_unit_cost", "estimated_total",
            "priority", "needed_by_date", "status",
            "approved_by", "approved_by_name", "approved_at",
            "rejection_reason", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "estimated_total", "approved_by", "approved_at",
            "created_at", "updated_at",
        ]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    approved_by_name = serializers.CharField(source="approved_by.username", read_only=True, default="")

    class Meta:
        model = PurchaseOrder
        fields = [
            "id", "order_number", "request",
            "supplier_name", "supplier_code", "supplier_reference",
            "order_date_jalali", "order_date",
            "delivery_date_jalali", "delivery_date",
            "item_name", "item_code", "description",
            "quantity", "unit", "unit_price", "discount",
            "tax_rate", "tax_amount", "total",
            "status", "notes",
            "journal_voucher",
            "approved_by", "approved_by_name", "approved_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "tax_amount", "total", "journal_voucher",
            "approved_by", "approved_at", "order_date",
            "created_at", "updated_at",
        ]


class GoodsReceiptSerializer(serializers.ModelSerializer):
    received_by_name = serializers.CharField(source="received_by.username", read_only=True, default="")
    po_order_number = serializers.CharField(source="purchase_order.order_number", read_only=True)

    class Meta:
        model = GoodsReceipt
        fields = [
            "id", "receipt_number", "purchase_order", "po_order_number",
            "item_name", "quantity_ordered", "quantity_received", "quantity_rejected",
            "unit", "unit_cost",
            "inspection_notes", "inspected_by", "inspection_date",
            "warehouse_code", "location_code",
            "status", "received_by", "received_by_name",
            "journal_voucher", "created_at",
        ]
        read_only_fields = [
            "id", "received_by", "journal_voucher", "created_at",
        ]


class PurchaseReturnSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseReturn
        fields = [
            "id", "return_number", "goods_receipt", "purchase_order",
            "item_name", "quantity_returned", "unit_cost", "total_value",
            "reason", "status", "journal_voucher", "created_at",
        ]
        read_only_fields = [
            "id", "total_value", "journal_voucher", "created_at",
        ]
