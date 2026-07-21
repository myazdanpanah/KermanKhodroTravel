"""
Trading Module Models — Enterprise ERP Import/Export Management.

Per TRADING_MODULE.md §10: Import/Export Management.
Per TRADING_MODULE.md §12: Import/Export Flow.
Per TRADING_MODULE.md §13: Currency Management.
Per IMPLEMENTATION_ROADMAP.md §15: Trading Phase.

Supports:
- Import Orders (foreign supplier → customs → warehouse)
- Export Orders (customer order → export docs → shipment)
- Containers & Shipments
- Customs documents
- International cost tracking
- Multi-currency support
"""

from decimal import Decimal
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel


# ─── Import Order ─────────────────────────────────────────────

class ImportOrder(BaseModel):
    """
    Import Order — manages the full import lifecycle.
    Per TRADING_MODULE.md §12: Import Flow.
    Flow: Foreign Supplier → Purchase Contract → Shipment → Customs → Warehouse Receipt
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="import_orders")
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("confirmed", "Confirmed"),
        ("shipped", "Shipped"),
        ("customs_pending", "Customs Pending"),
        ("customs_cleared", "Customs Cleared"),
        ("warehouse_received", "Warehouse Received"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    INCOTERM_CHOICES = [
        ("EXW", "Ex Works"),
        ("FCA", "Free Carrier"),
        ("FOB", "Free On Board"),
        ("CFR", "Cost and Freight"),
        ("CIF", "Cost, Insurance & Freight"),
        ("CPT", "Carriage Paid To"),
        ("CIP", "Carriage & Insurance Paid To"),
        ("DAP", "Delivered at Place"),
        ("DPU", "Delivered at Place Unloaded"),
        ("DDP", "Delivered Duty Paid"),
    ]

    order_number = models.CharField(max_length=50)

    # Supplier & product
    supplier = models.ForeignKey("finance.Supplier", on_delete=models.PROTECT, related_name="import_orders")
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=20, default="عدد")

    # Pricing (foreign currency)
    unit_price_foreign = models.DecimalField(max_digits=15, decimal_places=4, default=Decimal("0"))
    total_price_foreign = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    foreign_currency = models.CharField(max_length=10, default="USD")
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("1"))

    # IRR equivalent
    total_price_irr = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    # Shipping
    incoterm = models.CharField(max_length=5, choices=INCOTERM_CHOICES, default="FOB")
    port_of_loading = models.CharField(max_length=200, blank=True, default="")
    port_of_discharge = models.CharField(max_length=200, blank=True, default="")

    # Customs
    customs_declaration_number = models.CharField(max_length=50, blank=True, default="")
    customs_duty_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    customs_vat_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    estimated_delivery = models.DateField(null=True, blank=True)
    actual_delivery = models.DateField(null=True, blank=True)

    # Accounting
    journal_voucher = models.ForeignKey("finance.JournalVoucher", on_delete=models.SET_NULL, null=True, blank=True, related_name="import_orders")

    description = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("company", "order_number")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Import #{self.order_number} — {self.product_name}"

    def save(self, *args, **kwargs):
        self.total_price_foreign = self.quantity * self.unit_price_foreign
        self.total_price_irr = self.total_price_foreign * self.exchange_rate
        super().save(*args, **kwargs)


# ─── Export Order ─────────────────────────────────────────────

class ExportOrder(BaseModel):
    """
    Export Order — manages export lifecycle.
    Per TRADING_MODULE.md §12: Export Flow.
    Flow: Customer Order → Export Documentation → Shipment → Invoice → Payment
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="export_orders")
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("confirmed", "Confirmed"),
        ("documentation", "Documentation"),
        ("shipped", "Shipped"),
        ("invoiced", "Invoiced"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    order_number = models.CharField(max_length=50)

    # Customer & product
    customer = models.ForeignKey("finance.Customer", on_delete=models.PROTECT, related_name="export_orders")
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=20, default="عدد")

    # Pricing (foreign currency)
    unit_price_foreign = models.DecimalField(max_digits=15, decimal_places=4, default=Decimal("0"))
    total_price_foreign = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    foreign_currency = models.CharField(max_length=10, default="USD")
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("1"))
    total_price_irr = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    # Shipping
    incoterm = models.CharField(max_length=5, choices=ImportOrder.INCOTERM_CHOICES, default="FOB")
    port_of_loading = models.CharField(max_length=200, blank=True, default="")
    port_of_discharge = models.CharField(max_length=200, blank=True, default="")

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    estimated_ship_date = models.DateField(null=True, blank=True)
    actual_ship_date = models.DateField(null=True, blank=True)

    # Accounting
    journal_voucher = models.ForeignKey("finance.JournalVoucher", on_delete=models.SET_NULL, null=True, blank=True, related_name="export_orders")

    description = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("company", "order_number")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Export #{self.order_number} — {self.product_name}"

    def save(self, *args, **kwargs):
        self.total_price_foreign = self.quantity * self.unit_price_foreign
        self.total_price_irr = self.total_price_foreign * self.exchange_rate
        super().save(*args, **kwargs)


# ─── Container ────────────────────────────────────────────────

class Container(BaseModel):
    """
    Container — physical shipping container tracking.
    Supports container-based logistics for import/export.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="containers")
    TYPE_CHOICES = [
        ("20ft", "20ft Standard"),
        ("40ft", "40ft Standard"),
        ("40ft_hq", "40ft High Cube"),
        ("45ft", "45ft High Cube"),
        ("reefer", "Reefer (Refrigerated)"),
    ]
    STATUS_CHOICES = [
        ("empty", "Empty"),
        ("loaded", "Loaded"),
        ("in_transit", "In Transit"),
        ("at_port", "At Port"),
        ("customs", "Customs"),
        ("delivered", "Delivered"),
        ("returned", "Returned"),
    ]

    container_number = models.CharField(max_length=20, unique=True)
    container_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default="40ft")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="empty")

    # Links
    import_order = models.ForeignKey(ImportOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="containers")
    export_order = models.ForeignKey(ExportOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="containers")

    # Tracking
    carrier = models.CharField(max_length=200, blank=True, default="")
    vessel_name = models.CharField(max_length=200, blank=True, default="")
    voyage_number = models.CharField(max_length=50, blank=True, default="")
    seal_number = models.CharField(max_length=50, blank=True, default="")

    # Location
    current_location = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.container_number} ({self.get_container_type_display()})"


# ─── Shipment ─────────────────────────────────────────────────

class Shipment(BaseModel):
    """
    Shipment — represents a shipment movement.
    Links containers to import/export orders.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="shipments")
    TYPE_CHOICES = [
        ("sea", "Sea Freight"),
        ("air", "Air Freight"),
        ("land", "Land Freight"),
        ("rail", "Rail Freight"),
        ("multimodal", "Multimodal"),
    ]
    STATUS_CHOICES = [
        ("preparing", "Preparing"),
        ("picked_up", "Picked Up"),
        ("in_transit", "In Transit"),
        ("at_port", "At Port"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    ]

    shipment_number = models.CharField(max_length=50)
    shipment_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default="sea")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="preparing")

    # Links
    import_order = models.ForeignKey(ImportOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="shipments")
    export_order = models.ForeignKey(ExportOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="shipments")
    container = models.ForeignKey(Container, on_delete=models.SET_NULL, null=True, blank=True, related_name="shipments")

    # Route
    origin = models.CharField(max_length=200, blank=True, default="")
    destination = models.CharField(max_length=200, blank=True, default="")
    carrier = models.CharField(max_length=200, blank=True, default="")

    # Dates
    estimated_departure = models.DateField(null=True, blank=True)
    actual_departure = models.DateField(null=True, blank=True)
    estimated_arrival = models.DateField(null=True, blank=True)
    actual_arrival = models.DateField(null=True, blank=True)

    # Costs
    freight_cost = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    insurance_cost = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    other_costs = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    total_cost = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    cost_currency = models.CharField(max_length=10, default="USD")

    description = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("company", "shipment_number")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Shipment #{self.shipment_number} ({self.get_shipment_type_display()})"

    def save(self, *args, **kwargs):
        self.total_cost = self.freight_cost + self.insurance_cost + self.other_costs
        super().save(*args, **kwargs)


# ─── Customs Document ─────────────────────────────────────────

class CustomsDocument(BaseModel):
    """
    Customs Document — tracks customs declaration documents.
    Per TRADING_MODULE.md §12: Customs Documents.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="customs_documents")
    DOC_TYPE_CHOICES = [
        ("proforma_invoice", "Proforma Invoice"),
        ("commercial_invoice", "Commercial Invoice"),
        ("packing_list", "Packing List"),
        ("bill_of_lading", "Bill of Lading"),
        ("certificate_of_origin", "Certificate of Origin"),
        ("insurance_cert", "Insurance Certificate"),
        ("customs_declaration", "Customs Declaration"),
        ("phyto_cert", "Phytosanitary Certificate"),
        ("other", "Other"),
    ]
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("submitted", "Submitted"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    import_order = models.ForeignKey(ImportOrder, on_delete=models.CASCADE, related_name="customs_documents")
    document_type = models.CharField(max_length=25, choices=DOC_TYPE_CHOICES)
    document_number = models.CharField(max_length=50, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    issued_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_document_type_display()} — {self.document_number}"


# ─── International Cost ───────────────────────────────────────

class InternationalCost(BaseModel):
    """
    International Cost — tracks additional costs for import/export.
    Per TRADING_MODULE.md §13: Currency Management.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="international_costs")
    COST_TYPES = [
        ("freight", "Freight"),
        ("insurance", "Insurance"),
        ("customs_duty", "Customs Duty"),
        ("customs_vat", "Customs VAT"),
        ("port_charges", "Port Charges"),
        ("handling", "Handling"),
        ("inspection", "Inspection"),
        ("documentation", "Documentation"),
        ("bank_charges", "Bank Charges"),
        ("other", "Other"),
    ]

    import_order = models.ForeignKey(ImportOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="international_costs")
    export_order = models.ForeignKey(ExportOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="international_costs")

    cost_type = models.CharField(max_length=20, choices=COST_TYPES)
    description = models.CharField(max_length=200, blank=True, default="")
    amount_foreign = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    foreign_currency = models.CharField(max_length=10, default="USD")
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("1"))
    amount_irr = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_cost_type_display()}: {self.amount_foreign} {self.foreign_currency}"

    def save(self, *args, **kwargs):
        self.amount_irr = self.amount_foreign * self.exchange_rate
        super().save(*args, **kwargs)
