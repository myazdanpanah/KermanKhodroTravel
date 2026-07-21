"""
Trading Module Serializers — DRF serializers for trading API.
"""

from rest_framework import serializers
from .models import (
    ImportOrder, ExportOrder, Container,
    Shipment, CustomsDocument, InternationalCost,
)


class ImportOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = ImportOrder
        fields = [
            "id", "order_number", "supplier", "supplier_name",
            "product_name", "product_code", "quantity", "unit",
            "unit_price_foreign", "total_price_foreign", "foreign_currency",
            "exchange_rate", "total_price_irr",
            "incoterm", "port_of_loading", "port_of_discharge",
            "customs_declaration_number", "customs_duty_amount", "customs_vat_amount",
            "status", "estimated_delivery", "actual_delivery",
            "description", "created_at",
        ]
        read_only_fields = ["total_price_foreign", "total_price_irr", "order_number"]


class ExportOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = ExportOrder
        fields = [
            "id", "order_number", "customer", "customer_name",
            "product_name", "product_code", "quantity", "unit",
            "unit_price_foreign", "total_price_foreign", "foreign_currency",
            "exchange_rate", "total_price_irr",
            "incoterm", "port_of_loading", "port_of_discharge",
            "status", "estimated_ship_date", "actual_ship_date",
            "description", "created_at",
        ]
        read_only_fields = ["total_price_foreign", "total_price_irr", "order_number"]


class ContainerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Container
        fields = [
            "id", "container_number", "container_type", "status",
            "import_order", "export_order",
            "carrier", "vessel_name", "voyage_number", "seal_number",
            "current_location", "created_at",
        ]


class ShipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shipment
        fields = [
            "id", "shipment_number", "shipment_type", "status",
            "import_order", "export_order", "container",
            "origin", "destination", "carrier",
            "estimated_departure", "actual_departure",
            "estimated_arrival", "actual_arrival",
            "freight_cost", "insurance_cost", "other_costs",
            "total_cost", "cost_currency",
            "description", "created_at",
        ]
        read_only_fields = ["total_cost", "shipment_number"]


class CustomsDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomsDocument
        fields = [
            "id", "import_order", "document_type", "document_number",
            "status", "issued_date", "expiry_date", "notes", "created_at",
        ]


class InternationalCostSerializer(serializers.ModelSerializer):
    class Meta:
        model = InternationalCost
        fields = [
            "id", "import_order", "export_order",
            "cost_type", "description",
            "amount_foreign", "foreign_currency", "exchange_rate", "amount_irr",
            "created_at",
        ]
        read_only_fields = ["amount_irr"]
