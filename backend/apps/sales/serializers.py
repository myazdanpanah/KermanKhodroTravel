"""
Sales Module Serializers — DRF serializers for sales API.
"""

from rest_framework import serializers
from .models import (
    SalesQuotation, SalesQuotationLine,
    SalesOrder, SalesOrderLine,
    SalesInvoice, SalesInvoiceLine,
    SalesReturn, SalesReturnLine,
)


class SalesQuotationLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesQuotationLine
        fields = [
            "id", "product_name", "product_code", "description",
            "quantity", "unit", "unit_price",
            "discount_percent", "discount_amount",
            "tax_percent", "tax_amount", "line_total",
        ]
        read_only_fields = ["discount_amount", "tax_amount", "line_total"]


class SalesQuotationSerializer(serializers.ModelSerializer):
    lines = SalesQuotationLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    company = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = SalesQuotation
        fields = [
            "id", "quotation_number", "customer", "customer_name",
            "quotation_date", "valid_until",
            "subtotal", "discount_amount", "tax_amount", "total",
            "currency", "status", "notes", "terms",
            "converted_order", "lines", "company", "created_at",
        ]
        read_only_fields = ["subtotal", "total", "quotation_number", "company"]


class SalesOrderLineSerializer(serializers.ModelSerializer):
    quantity_remaining = serializers.DecimalField(max_digits=12, decimal_places=4, read_only=True)

    class Meta:
        model = SalesOrderLine
        fields = [
            "id", "product_name", "product_code", "description",
            "quantity", "unit", "unit_price",
            "discount_percent", "discount_amount",
            "tax_percent", "tax_amount", "line_total",
            "quantity_delivered", "quantity_invoiced", "quantity_remaining",
        ]
        read_only_fields = ["discount_amount", "tax_amount", "line_total", "quantity_remaining"]


class SalesOrderSerializer(serializers.ModelSerializer):
    lines = SalesOrderLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    company = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = SalesOrder
        fields = [
            "id", "order_number", "customer", "customer_name",
            "warehouse", "order_date", "delivery_date",
            "subtotal", "discount_amount", "tax_amount", "total",
            "currency", "status", "payment_terms", "notes",
            "source_quotation", "lines", "company", "created_at",
        ]
        read_only_fields = ["subtotal", "total", "order_number", "company"]


class SalesInvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesInvoiceLine
        fields = [
            "id", "product_name", "product_code", "description",
            "quantity", "unit", "unit_price",
            "discount_percent", "discount_amount",
            "tax_percent", "tax_amount", "line_total",
        ]
        read_only_fields = ["discount_amount", "tax_amount", "line_total"]


class SalesInvoiceSerializer(serializers.ModelSerializer):
    lines = SalesInvoiceLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    balance_due = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    company = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = SalesInvoice
        fields = [
            "id", "invoice_number", "customer", "customer_name",
            "sales_order", "invoice_date", "due_date",
            "subtotal", "discount_amount", "tax_amount", "total",
            "amount_paid", "balance_due",
            "currency", "status", "notes",
            "journal_voucher", "lines", "company", "created_at",
        ]
        read_only_fields = ["subtotal", "total", "invoice_number", "balance_due", "company"]


class SalesReturnLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesReturnLine
        fields = [
            "id", "product_name", "product_code",
            "quantity", "unit", "unit_price", "line_total",
            "reason", "is_defective",
        ]
        read_only_fields = ["line_total"]


class SalesReturnSerializer(serializers.ModelSerializer):
    lines = SalesReturnLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    company = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = SalesReturn
        fields = [
            "id", "return_number", "customer", "customer_name",
            "sales_invoice", "sales_order",
            "return_date", "reason",
            "total_amount", "restocking_fee", "net_amount",
            "status", "notes", "journal_voucher",
            "lines", "company", "created_at",
        ]
        read_only_fields = ["total_amount", "net_amount", "return_number", "company"]
