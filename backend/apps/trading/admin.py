"""
Trading Module Admin — Django admin configuration.
"""

from django.contrib import admin
from .models import (
    ImportOrder, ExportOrder, Container,
    Shipment, CustomsDocument, InternationalCost,
)


@admin.register(ImportOrder)
class ImportOrderAdmin(admin.ModelAdmin):
    list_display = ["order_number", "supplier", "product_name", "status", "total_price_irr"]
    list_filter = ["status", "foreign_currency"]
    search_fields = ["order_number", "product_name"]


@admin.register(ExportOrder)
class ExportOrderAdmin(admin.ModelAdmin):
    list_display = ["order_number", "customer", "product_name", "status", "total_price_irr"]
    list_filter = ["status", "foreign_currency"]
    search_fields = ["order_number", "product_name"]


@admin.register(Container)
class ContainerAdmin(admin.ModelAdmin):
    list_display = ["container_number", "container_type", "status", "carrier"]
    list_filter = ["status", "container_type"]


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ["shipment_number", "shipment_type", "status", "origin", "destination"]
    list_filter = ["status", "shipment_type"]


@admin.register(CustomsDocument)
class CustomsDocumentAdmin(admin.ModelAdmin):
    list_display = ["document_type", "document_number", "status", "import_order"]
    list_filter = ["document_type", "status"]


@admin.register(InternationalCost)
class InternationalCostAdmin(admin.ModelAdmin):
    list_display = ["cost_type", "amount_foreign", "foreign_currency", "amount_irr"]
    list_filter = ["cost_type"]
