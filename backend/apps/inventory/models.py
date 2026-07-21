"""
Inventory Module Models — Enterprise ERP Inventory Management.

Per DATABASE_SCHEMA.md §2: inventory schema.
Per IMPLEMENTATION_ROADMAP.md §6: Inventory Management.
Per MASTER_ARCHITECTURE.md §4.2: Trading & Distribution — Inventory.

Supports:
- Multi-warehouse
- Stock movements (receipt, issue, transfer, adjustment)
- Reservation
- Cycle counting
- Valuation (FIFO, Average)
- Integration with Accounting Posting Engine
"""

from decimal import Decimal
from django.db import models
from django.conf import settings

from apps.core.models import BaseModel


# ─── Warehouse & Location ───────────────────────────────────────

class Warehouse(BaseModel):
    """
    Warehouse — physical storage location.
    Per DATABASE_SCHEMA.md: warehouses table.
    Per MASTER_ARCHITECTURE.md §6: Multi Warehouse support.
    """
    TYPE_CHOICES = [
        ("main", "انبار اصلی"),
        ("branch", "انبار شعبه"),
        ("production", "انبار تولید"),
        ("returned", "انبار برگشتی"),
        ("damaged", "انبار ضایعاتی"),
    ]

    branch_name = models.CharField(max_length=200, blank=True, default="", help_text="Branch name (future multi-branch support)")
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=200)
    warehouse_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="main")
    address = models.TextField(blank=True, default="")
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="managed_warehouses",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("company", "code")]
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Location(BaseModel):
    """
    Location within a warehouse — bin, shelf, zone.
    Supports unlimited hierarchy for warehouse organization.
    """
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="locations")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=200)
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="children")
    capacity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), help_text="Max capacity (0 = unlimited)")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("warehouse", "code")]
        ordering = ["code"]

    def __str__(self):
        return f"{self.warehouse.code}/{self.code} — {self.name}"


# ─── Stock Ledger ───────────────────────────────────────────────

class StockLedger(BaseModel):
    """
    Stock Ledger — current stock balance per product per warehouse.
    This is the source of truth for inventory quantities.
    Per DATABASE_SCHEMA.md: inventory balances.

    Every stock movement updates this record.
    """
    product_name = models.CharField(max_length=200, help_text="Product name")
    product_code = models.CharField(max_length=50, blank=True, default="")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stock_balances")
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_balances")

    # Quantities
    quantity_on_hand = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"), help_text="Physical quantity in warehouse")
    quantity_reserved = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"), help_text="Quantity reserved for orders")
    quantity_available = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"), help_text="Available = on_hand - reserved")

    # Costs (for valuation)
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"), help_text="Current unit cost (Rial)")
    total_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"), help_text="Total inventory value (Rial)")

    # Reorder
    reorder_level = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"), help_text="Minimum stock level")
    reorder_quantity = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"), help_text="Suggested reorder quantity")

    # Tracking
    last_receipt_date = models.DateTimeField(null=True, blank=True)
    last_issue_date = models.DateTimeField(null=True, blank=True)
    last_count_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("company", "product_code", "warehouse", "location")]
        ordering = ["product_code"]

    def __str__(self):
        return f"{self.product_name} @ {self.warehouse.code}: {self.quantity_on_hand}"

    def recalculate_available(self):
        """Recalculate available quantity."""
        self.quantity_available = self.quantity_on_hand - self.quantity_reserved
        self.total_value = self.quantity_on_hand * self.unit_cost
        self.save(update_fields=["quantity_available", "total_value"])


# ─── Stock Movement ─────────────────────────────────────────────

class StockMovement(BaseModel):
    """
    Stock Movement — every inventory transaction.
    Per DATABASE_SCHEMA.md: stock_movements.
    Per ACCOUNTING_MODULE.md §11: Inventory Accounting.

    Types:
    - receipt: goods received (purchase, production, return)
    - issue: goods shipped (sales, production consumption)
    - transfer: warehouse-to-warehouse
    - adjustment: cycle count correction
    - reservation: reserved for order
    - release: reservation released
    """
    MOVEMENT_TYPES = [
        ("receipt", "ورود"),
        ("issue", "خروج"),
        ("transfer", "انتقال"),
        ("adjustment", "اصلاح"),
        ("reservation", "رزرو"),
        ("release", "آزادسازی رزرو"),
    ]

    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="movements")
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name="incoming_movements")
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name="movements")

    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    reference_type = models.CharField(max_length=30, blank=True, default="", help_text="Source document type")
    reference_id = models.IntegerField(null=True, blank=True, help_text="Source document ID")

    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=4, help_text="Positive for receipt, negative for issue")
    unit = models.CharField(max_length=20, default="عدد")
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    total_cost = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    batch_number = models.CharField(max_length=50, blank=True, default="")
    serial_number = models.CharField(max_length=50, blank=True, default="")

    description = models.CharField(max_length=500, blank=True, default="")
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="stock_movements",
    )
    movement_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-movement_date"]

    def __str__(self):
        sign = "+" if self.quantity >= 0 else ""
        return f"{self.movement_type}: {self.product_name} {sign}{self.quantity} @ {self.warehouse.code}"

    def save(self, *args, **kwargs):
        self.total_cost = abs(self.quantity) * self.unit_cost
        super().save(*args, **kwargs)


# ─── Inventory Reservation ──────────────────────────────────────

class InventoryReservation(BaseModel):
    """
    Inventory Reservation — stock reserved for a specific order.
    Per DATABASE_SCHEMA.md: reservations.
    Ensures stock is available when needed.
    """
    STATUS_CHOICES = [
        ("active", "فعال"),
        ("fulfilled", "تکمیل شده"),
        ("cancelled", "لغو شده"),
        ("expired", "منقضی شده"),
    ]

    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="reservations")

    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    quantity_fulfilled = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"))
    unit = models.CharField(max_length=20, default="عدد")

    # Reference to the order/document
    reference_type = models.CharField(max_length=30, help_text="e.g. sales_order, production_order")
    reference_id = models.IntegerField(help_text="ID of the referencing document")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Reservation expiry")

    reserved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="inventory_reservations",
    )
    notes = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Reserve {self.product_name} × {self.quantity} ({self.status})"


# ─── Cycle Count ────────────────────────────────────────────────

class CycleCount(BaseModel):
    """
    Cycle Count — periodic physical inventory count.
    Per DATABASE_SCHEMA.md: cycle_counts.
    Supports partial and full warehouse counts.
    """
    STATUS_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("in_progress", "در حال شمارش"),
        ("completed", "تکمیل شده"),
        ("cancelled", "لغو شده"),
    ]

    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="cycle_counts")
    count_number = models.CharField(max_length=50)
    count_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    counted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="cycle_counts",
    )
    notes = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        unique_together = [("company", "count_number")]
        ordering = ["-count_date"]

    def __str__(self):
        return f"Count #{self.count_number} — {self.warehouse.code}"


class CycleCountLine(BaseModel):
    """
    Individual line item in a cycle count.
    Compares system quantity vs physical count.
    """
    cycle_count = models.ForeignKey(CycleCount, on_delete=models.CASCADE, related_name="lines")
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True)

    system_quantity = models.DecimalField(max_digits=12, decimal_places=4, help_text="Quantity in system")
    counted_quantity = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True, help_text="Physically counted")
    variance = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"), help_text="Counted - System")
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    variance_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"), help_text="Variance × unit_cost")

    notes = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        unique_together = [("cycle_count", "product_code")]
        ordering = ["product_code"]

    def __str__(self):
        return f"{self.product_name}: {self.system_quantity} → {self.counted_quantity}"

    def calculate_variance(self):
        """Calculate variance from system vs counted quantity."""
        if self.counted_quantity is not None:
            self.variance = self.counted_quantity - self.system_quantity
            self.variance_value = self.variance * self.unit_cost
            self.save(update_fields=["variance", "variance_value"])


# ─── Stock Adjustment ───────────────────────────────────────────

class StockAdjustment(BaseModel):
    """
    Stock Adjustment — correction to inventory quantities.
    Per ACCOUNTING_MODULE.md §11: Stock Adjustments create accounting entries.
    Generated from cycle count variances or manual adjustments.
    """
    REASON_CHOICES = [
        ("cycle_count", "اصلاح شمارش"),
        ("damage", "ضایعات"),
        ("found", "یافت شده"),
        ("correction", "اصلاح اشتباه"),
        ("other", "سایر"),
    ]

    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="adjustments")
    adjustment_number = models.CharField(max_length=50)
    adjustment_date = models.DateField()
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)

    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    quantity_before = models.DecimalField(max_digits=12, decimal_places=4, help_text="Quantity before adjustment")
    quantity_adjustment = models.DecimalField(max_digits=12, decimal_places=4, help_text="Positive or negative adjustment")
    quantity_after = models.DecimalField(max_digits=12, decimal_places=4, help_text="Quantity after adjustment")
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    adjustment_value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    # Accounting link
    journal_voucher = models.ForeignKey(
        "finance.JournalVoucher",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="stock_adjustments",
    )

    cycle_count = models.ForeignKey(
        CycleCount,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="adjustments",
    )

    description = models.CharField(max_length=500, blank=True, default="")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="approved_adjustments",
    )

    class Meta:
        unique_together = [("company", "adjustment_number")]
        ordering = ["-adjustment_date"]

    def __str__(self):
        return f"Adjustment #{self.adjustment_number}: {self.product_name} ({self.quantity_adjustment:+})"

    def save(self, *args, **kwargs):
        self.quantity_after = self.quantity_before + self.quantity_adjustment
        self.adjustment_value = abs(self.quantity_adjustment) * self.unit_cost
        super().save(*args, **kwargs)
