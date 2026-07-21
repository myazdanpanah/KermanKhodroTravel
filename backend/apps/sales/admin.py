"""
Sales Module Admin — Django admin configuration.
"""

from django.contrib import admin
from .models import (
    SalesQuotation, SalesQuotationLine,
    SalesOrder, SalesOrderLine,
    SalesInvoice, SalesInvoiceLine,
    SalesReturn, SalesReturnLine,
)


class SalesQuotationLineInline(admin.TabularInline):
    model = SalesQuotationLine
    extra = 0


@admin.register(SalesQuotation)
class SalesQuotationAdmin(admin.ModelAdmin):
    list_display = ["quotation_number", "customer", "quotation_date", "total", "status"]
    list_filter = ["status", "quotation_date"]
    search_fields = ["quotation_number", "customer__name"]
    inlines = [SalesQuotationLineInline]


class SalesOrderLineInline(admin.TabularInline):
    model = SalesOrderLine
    extra = 0


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ["order_number", "customer", "order_date", "total", "status"]
    list_filter = ["status", "order_date"]
    search_fields = ["order_number", "customer__name"]
    inlines = [SalesOrderLineInline]


class SalesInvoiceLineInline(admin.TabularInline):
    model = SalesInvoiceLine
    extra = 0


@admin.register(SalesInvoice)
class SalesInvoiceAdmin(admin.ModelAdmin):
    list_display = ["invoice_number", "customer", "invoice_date", "total", "amount_paid", "status"]
    list_filter = ["status", "invoice_date"]
    search_fields = ["invoice_number", "customer__name"]
    inlines = [SalesInvoiceLineInline]


class SalesReturnLineInline(admin.TabularInline):
    model = SalesReturnLine
    extra = 0


@admin.register(SalesReturn)
class SalesReturnAdmin(admin.ModelAdmin):
    list_display = ["return_number", "customer", "return_date", "total_amount", "status"]
    list_filter = ["status", "return_date"]
    search_fields = ["return_number", "customer__name"]
    inlines = [SalesReturnLineInline]
