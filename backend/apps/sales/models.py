"""
Sales Module Models — Enterprise ERP Sales Management.

Per TRADING_MODULE.md §5: Sales Management.
Per TRADING_MODULE.md §14: Return Management.
Per TRADING_MODULE.md §16: Accounting Integration.
Per IMPLEMENTATION_ROADMAP.md §13: Sales Phase.
Per DATABASE_SCHEMA.md: sales tables.

Supports:
- Quotations
- Sales Orders
- Sales Invoices
- Sales Returns
- Credit Notes
- Discount Engine
- Pricing Engine
"""

from decimal import Decimal

from django.db import models
from django.conf import settings

from apps.core.models import BaseModel


# ─── Sales Quotation ──────────────────────────────────────────

class SalesQuotation(BaseModel):
    """
    Sales Quotation — commercial offer to customer.
    Per TRADING_MODULE.md §5.2.
    """
    STATUS_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("sent", "ارسال شده"),
        ("approved", "تأیید شده"),
        ("rejected", "رد شده"),
        ("expired", "منقضی شده"),
        ("converted", "تبدیل شده"),
    ]

    quotation_number = models.CharField(max_length=50)
    customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.PROTECT,
        related_name="quotations",
    )
    quotation_date = models.DateField()
    valid_until = models.DateField()

    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    discount_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    currency = models.CharField(max_length=10, default="IRR")
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("1"))

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    notes = models.TextField(blank=True, default="")
    terms = models.TextField(blank=True, default="", help_text="Payment & delivery terms")

    # Converted to sales order
    converted_order = models.ForeignKey(
        "SalesOrder",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="from_quotation",
    )

    class Meta:
        unique_together = [("company", "quotation_number")]
        ordering = ["-quotation_date", "-id"]

    def __str__(self):
        return f"Quote #{self.quotation_number} → {self.customer}"

    def save(self, *args, **kwargs):
        self.total = self.subtotal - self.discount_amount + self.tax_amount
        super().save(*args, **kwargs)


class SalesQuotationLine(BaseModel):
    """Line item for a sales quotation."""
    quotation = models.ForeignKey(SalesQuotation, on_delete=models.CASCADE, related_name="lines")
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    description = models.CharField(max_length=500, blank=True, default="")

    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    unit = models.CharField(max_length=20, default="عدد")
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"

    def save(self, *args, **kwargs):
        gross = self.quantity * self.unit_price
        if self.discount_percent > 0:
            self.discount_amount = gross * self.discount_percent / Decimal("100")
        self.tax_amount = (gross - self.discount_amount) * self.tax_percent / Decimal("100")
        self.line_total = gross - self.discount_amount + self.tax_amount
        super().save(*args, **kwargs)


# ─── Sales Order ──────────────────────────────────────────────

class SalesOrder(BaseModel):
    """
    Sales Order — main sales document.
    Per TRADING_MODULE.md §5.3.
    """
    STATUS_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("confirmed", "تأیید شده"),
        ("processing", "در حال پردازش"),
        ("partially_delivered", "تحویل جزئی"),
        ("delivered", "تحویل شده"),
        ("invoiced", "فاکتور شده"),
        ("completed", "تکمیل شده"),
        ("cancelled", "لغو شده"),
    ]

    order_number = models.CharField(max_length=50)
    customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.PROTECT,
        related_name="sales_orders",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="sales_orders",
    )
    order_date = models.DateField()
    delivery_date = models.DateField(null=True, blank=True)

    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    discount_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    currency = models.CharField(max_length=10, default="IRR")
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("1"))

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    payment_terms = models.CharField(max_length=200, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    # Reference to quotation
    source_quotation = models.ForeignKey(
        SalesQuotation,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="converted_orders",
    )

    class Meta:
        unique_together = [("company", "order_number")]
        ordering = ["-order_date", "-id"]

    def __str__(self):
        return f"SO #{self.order_number} → {self.customer}"

    def save(self, *args, **kwargs):
        self.total = self.subtotal - self.discount_amount + self.tax_amount
        super().save(*args, **kwargs)


class SalesOrderLine(BaseModel):
    """Line item for a sales order."""
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="lines")
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    description = models.CharField(max_length=500, blank=True, default="")

    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    unit = models.CharField(max_length=20, default="عدد")
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    # Delivery tracking
    quantity_delivered = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"))
    quantity_invoiced = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"))

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"

    @property
    def quantity_remaining(self):
        return self.quantity - self.quantity_delivered

    def save(self, *args, **kwargs):
        gross = self.quantity * self.unit_price
        if self.discount_percent > 0:
            self.discount_amount = gross * self.discount_percent / Decimal("100")
        self.tax_amount = (gross - self.discount_amount) * self.tax_percent / Decimal("100")
        self.line_total = gross - self.discount_amount + self.tax_amount
        super().save(*args, **kwargs)


# ─── Sales Invoice ────────────────────────────────────────────

class SalesInvoice(BaseModel):
    """
    Sales Invoice — billing document.
    Per TRADING_MODULE.md §16: Sales Invoice accounting.
    Debit: Customer Receivable
    Credit: Sales Revenue
    Credit: VAT Payable
    """
    STATUS_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("issued", "صادر شده"),
        ("sent", "ارسال شده"),
        ("paid", "پرداخت شده"),
        ("partial", "پرداخت جزئی"),
        ("overdue", "سررسید گذشته"),
        ("cancelled", "لغو شده"),
    ]

    invoice_number = models.CharField(max_length=50)
    customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.PROTECT,
        related_name="sales_invoices",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="invoices",
    )

    invoice_date = models.DateField()
    due_date = models.DateField()

    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    discount_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    amount_paid = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    currency = models.CharField(max_length=10, default="IRR")
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("1"))

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    # Accounting link
    journal_voucher = models.ForeignKey(
        "finance.JournalVoucher",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="sales_invoices",
    )

    notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("company", "invoice_number")]
        ordering = ["-invoice_date", "-id"]

    def __str__(self):
        return f"Invoice #{self.invoice_number} → {self.customer}"

    @property
    def balance_due(self):
        return self.total - self.amount_paid

    def save(self, *args, **kwargs):
        self.total = self.subtotal - self.discount_amount + self.tax_amount
        super().save(*args, **kwargs)


class SalesInvoiceLine(BaseModel):
    """Line item for a sales invoice."""
    invoice = models.ForeignKey(SalesInvoice, on_delete=models.CASCADE, related_name="lines")
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    description = models.CharField(max_length=500, blank=True, default="")

    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    unit = models.CharField(max_length=20, default="عدد")
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"

    def save(self, *args, **kwargs):
        gross = self.quantity * self.unit_price
        if self.discount_percent > 0:
            self.discount_amount = gross * self.discount_percent / Decimal("100")
        self.tax_amount = (gross - self.discount_amount) * self.tax_percent / Decimal("100")
        self.line_total = gross - self.discount_amount + self.tax_amount
        super().save(*args, **kwargs)


# ─── Sales Return ─────────────────────────────────────────────

class SalesReturn(BaseModel):
    """
    Sales Return — customer returns goods.
    Per TRADING_MODULE.md §14: Sales Return.
    Accounting:
    Debit: Sales Return
    Credit: Customer Receivable
    """
    STATUS_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("received", "دریافت شده"),
        ("approved", "تأیید شده"),
        ("credited", "اعتبارنامه صادر شده"),
        ("cancelled", "لغو شده"),
    ]

    return_number = models.CharField(max_length=50)
    customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.PROTECT,
        related_name="sales_returns",
    )
    sales_invoice = models.ForeignKey(
        SalesInvoice,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="returns",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="returns",
    )

    return_date = models.DateField()
    reason = models.CharField(max_length=500, blank=True, default="")

    total_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    restocking_fee = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    net_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    # Accounting link
    journal_voucher = models.ForeignKey(
        "finance.JournalVoucher",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="sales_returns",
    )

    notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("company", "return_number")]
        ordering = ["-return_date", "-id"]

    def __str__(self):
        return f"Return #{self.return_number} ← {self.customer}"

    def save(self, *args, **kwargs):
        self.net_amount = self.total_amount - self.restocking_fee
        super().save(*args, **kwargs)


class SalesReturnLine(BaseModel):
    """Line item for a sales return."""
    return_order = models.ForeignKey(SalesReturn, on_delete=models.CASCADE, related_name="lines")
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")

    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    unit = models.CharField(max_length=20, default="عدد")
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    line_total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    reason = models.CharField(max_length=500, blank=True, default="")
    is_defective = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"

    def save(self, *args, **kwargs):
        self.line_total = self.quantity * self.unit_price
        super().save(*args, **kwargs)
