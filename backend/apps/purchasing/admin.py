"""
Purchasing Module Admin — Django Admin registration.
"""

from django.contrib import admin
from .models import (
    PurchaseRequest, PurchaseOrder, GoodsReceipt, PurchaseReturn,
)


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ["request_number", "item_name", "quantity", "status", "priority", "requested_by"]
    list_filter = ["status", "priority"]
    search_fields = ["request_number", "item_name", "title"]


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ["order_number", "item_name", "quantity", "unit_price", "total", "status", "supplier_name"]
    list_filter = ["status"]
    search_fields = ["order_number", "item_name", "supplier_name"]


@admin.register(GoodsReceipt)
class GoodsReceiptAdmin(admin.ModelAdmin):
    list_display = ["receipt_number", "item_name", "quantity_received", "quantity_rejected", "status"]
    list_filter = ["status"]
    search_fields = ["receipt_number", "item_name"]


@admin.register(PurchaseReturn)
class PurchaseReturnAdmin(admin.ModelAdmin):
    list_display = ["return_number", "item_name", "quantity_returned", "total_value", "status"]
    list_filter = ["status"]
    search_fields = ["return_number", "item_name"]
