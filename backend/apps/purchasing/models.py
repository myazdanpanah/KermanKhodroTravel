"""
Purchasing Module Models — Enterprise ERP Procurement Lifecycle.

Per IMPLEMENTATION_ROADMAP.md §7: Purchasing.
Per TRADING_MODULE.md §9-§11: Purchase Management.
Per DATABASE_SCHEMA.md: purchase_requests, purchase_orders, goods_receipts.

Supports:
- Purchase Requests
- Requests for Quotation (RFQ)
- Purchase Orders
- Goods Receipt
- Supplier Invoices
- Returns
- Full accounting integration via PostingEngine
"""

from decimal import Decimal
from django.db import models
from django.conf import settings

from apps.core.models import BaseModel


# ─── Purchase Request ───────────────────────────────────────────

class PurchaseRequest(BaseModel):
    """
    Purchase Request — internal request to buy goods/services.
    Per TRADING_MODULE.md §9: Purchase Lifecycle starts with Purchase Request.
    """
    STATUS_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("submitted", "ارسال شده"),
        ("approved", "تأیید شده"),
        ("rejected", "رد شده"),
        ("converted", "تبدیل شده به سفارش"),
        ("cancelled", "لغو شده"),
    ]
    PRIORITY_CHOICES = [
        (1, "کم"),
        (2, "عادی"),
        (3, "زیاد"),
        (4, "فوری"),
    ]

    request_number = models.CharField(max_length=50)
    title = models.CharField(max_length=200, help_text="Description of what's needed")
    description = models.TextField(blank=True, default="")

    # Requester
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="purchase_requests",
    )
    department = models.CharField(max_length=100, blank=True, default="")

    # Items
    item_name = models.CharField(max_length=200, help_text="Item to purchase")
    item_code = models.CharField(max_length=50, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1"))
    unit = models.CharField(max_length=20, default="عدد")
    estimated_unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"),
                                               help_text="Estimated cost per unit (Rial)")
    estimated_total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    # Priority & dates
    priority = models.IntegerField(choices=PRIORITY_CHOICES, default=2)
    needed_by_date = models.DateField(null=True, blank=True, help_text="When is this needed?")

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_purchase_requests",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        unique_together = [("company", "request_number")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.request_number}: {self.item_name} × {self.quantity}"

    def save(self, *args, **kwargs):
        self.estimated_total = self.quantity * self.estimated_unit_cost
        super().save(*args, **kwargs)


# ─── Purchase Order ─────────────────────────────────────────────

class PurchaseOrder(BaseModel):
    """
    Purchase Order — formal order to a supplier.
    Per TRADING_MODULE.md §10: Purchase Order.
    Per API_SPECIFICATION.md §38: Purchase Order API.
    """
    STATUS_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("submitted", "ارسال شده"),
        ("approved", "تأیید شده"),
        ("confirmed", "تأیید شده تأمین‌کننده"),
        ("partially_received", "دریافت جزئی"),
        ("received", "دریافت کامل"),
        ("closed", "بسته شده"),
        ("cancelled", "لغو شده"),
    ]

    order_number = models.CharField(max_length=50)
    request = models.ForeignKey(
        PurchaseRequest, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="purchase_orders",
    )

    # Supplier
    supplier_name = models.CharField(max_length=200, blank=True, default="")
    supplier_code = models.CharField(max_length=50, blank=True, default="")
    supplier_reference = models.CharField(max_length=100, blank=True, default="",
                                           help_text="Supplier's reference number")

    # Dates
    order_date_jalali = models.CharField(max_length=10, blank=True, default="")
    order_date = models.DateField(auto_now_add=True)
    delivery_date_jalali = models.CharField(max_length=10, blank=True, default="")
    delivery_date = models.DateField(null=True, blank=True)

    # Items
    item_name = models.CharField(max_length=200)
    item_code = models.CharField(max_length=50, blank=True, default="")
    description = models.TextField(blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1"))
    unit = models.CharField(max_length=20, default="عدد")
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"),
                                      help_text="Unit price (Rial)")
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    notes = models.TextField(blank=True, default="")

    # Accounting
    journal_voucher = models.ForeignKey(
        "finance.JournalVoucher",
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="purchase_orders",
    )

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_purchase_orders",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("company", "order_number")]
        ordering = ["-order_date", "-order_number"]

    def __str__(self):
        return f"{self.order_number}: {self.item_name} × {self.quantity}"

    def save(self, *args, **kwargs):
        subtotal = self.quantity * self.unit_price - self.discount
        self.tax_amount = subtotal * self.tax_rate / Decimal("100")
        self.total = subtotal + self.tax_amount
        super().save(*args, **kwargs)


# ─── Goods Receipt ──────────────────────────────────────────────

class GoodsReceipt(BaseModel):
    """
    Goods Receipt — records physical receipt of purchased goods.
    Per TRADING_MODULE.md §11: Goods Receipt.
    Per API_SPECIFICATION.md §39: Goods Receipt API.
    """
    STATUS_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("inspected", "بازرسی شده"),
        ("approved", "تأیید شده"),
        ("posted", "سند زده شده"),
        ("returned", "برگشت داده شده"),
    ]

    receipt_number = models.CharField(max_length=50)
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.PROTECT,
        related_name="goods_receipts",
    )

    # Items received
    item_name = models.CharField(max_length=200)
    quantity_ordered = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    quantity_received = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    quantity_rejected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    unit = models.CharField(max_length=20, default="عدد")
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))

    # Quality
    inspection_notes = models.TextField(blank=True, default="")
    inspected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="inspected_receipts",
    )
    inspection_date = models.DateField(null=True, blank=True)

    # Warehouse
    warehouse_code = models.CharField(max_length=20, blank=True, default="")
    location_code = models.CharField(max_length=30, blank=True, default="")

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="received_goods",
    )

    # Accounting
    journal_voucher = models.ForeignKey(
        "finance.JournalVoucher",
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="goods_receipts",
    )

    class Meta:
        unique_together = [("company", "receipt_number")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.receipt_number}: {self.item_name} × {self.quantity_received}"


# ─── Purchase Return ────────────────────────────────────────────

class PurchaseReturn(BaseModel):
    """
    Purchase Return — returned goods to supplier.
    Per TRADING_MODULE.md §14: Purchase Return.
    """
    STATUS_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("approved", "تأیید شده"),
        ("shipped", "ارسال شده"),
        ("completed", "تکمیل شده"),
    ]

    return_number = models.CharField(max_length=50)
    goods_receipt = models.ForeignKey(
        GoodsReceipt, on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="returns",
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.PROTECT,
        related_name="returns",
    )

    item_name = models.CharField(max_length=200)
    quantity_returned = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    total_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    reason = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    # Accounting
    journal_voucher = models.ForeignKey(
        "finance.JournalVoucher",
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="purchase_returns",
    )

    class Meta:
        unique_together = [("company", "return_number")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.return_number}: {self.item_name} × {self.quantity_returned}"

    def save(self, *args, **kwargs):
        self.total_value = self.quantity_returned * self.unit_cost
        super().save(*args, **kwargs)
