"""
Service Sales Module Models — Enterprise ERP Service Sales Management.

Per SERVICE_SALES_MODULE.md §4: Service Product Model.
Per SERVICE_SALES_MODULE.md §6-§8: Flight, Tour, Hotel.
Per SERVICE_SALES_MODULE.md §9: Booking Engine.
Per SERVICE_SALES_MODULE.md §11: Commission Engine.
Per SERVICE_SALES_MODULE.md §12: Cancellation & Refund.
Per SERVICE_SALES_MODULE.md §14: Accounting Integration.
"""

from decimal import Decimal
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel


# ─── Service Catalog ──────────────────────────────────────────

class ServiceCategory(BaseModel):
    """Service category — grouping for service products."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="service_categories")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(max_length=50, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ServiceProvider(BaseModel):
    """Service provider — airline, hotel, tour operator, etc."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="service_providers")
    name = models.CharField(max_length=200)
    provider_type = models.CharField(max_length=30, choices=[
        ("airline", "Airline"),
        ("hotel", "Hotel"),
        ("tour_operator", "Tour Operator"),
        ("insurance", "Insurance"),
        ("consulting", "Consulting"),
        ("other", "Other"),
    ])
    contact_info = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_provider_type_display()})"


class Service(BaseModel):
    """Service product — a sellable service."""
    SERVICE_TYPES = [
        ("flight", "Flight Ticket"),
        ("hotel", "Hotel Reservation"),
        ("tour", "Tour Package"),
        ("insurance", "Insurance"),
        ("consulting", "Consulting"),
        ("subscription", "Subscription"),
        ("training", "Training"),
        ("other", "Other"),
    ]
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="services")
    name = models.CharField(max_length=200)
    service_type = models.CharField(max_length=20, choices=SERVICE_TYPES)
    category = models.ForeignKey(ServiceCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="services")
    provider = models.ForeignKey(ServiceProvider, on_delete=models.SET_NULL, null=True, blank=True, related_name="services")
    description = models.TextField(blank=True, default="")
    duration_days = models.IntegerField(default=1, help_text="Duration in days")
    selling_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    supplier_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=10, default="IRR")
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("9"))
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_service_type_display()})"

    @property
    def gross_margin(self):
        return self.selling_price - self.supplier_cost


# ─── Booking Engine ───────────────────────────────────────────

class Booking(BaseModel):
    """Booking — main transaction for service sales."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="bookings")
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("reserved", "Reserved"),
        ("confirmed", "Confirmed"),
        ("paid", "Paid"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
        ("refunded", "Refunded"),
    ]
    booking_number = models.CharField(max_length=50)
    customer = models.ForeignKey("finance.Customer", on_delete=models.PROTECT, related_name="bookings")
    booking_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    discount_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    amount_paid = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=10, default="IRR")
    notes = models.TextField(blank=True, default="")
    journal_voucher = models.ForeignKey("finance.JournalVoucher", on_delete=models.SET_NULL, null=True, blank=True, related_name="bookings")

    class Meta:
        unique_together = [("company", "booking_number")]
        ordering = ["-booking_date", "-id"]

    def __str__(self):
        return f"Booking #{self.booking_number}"

    @property
    def balance_due(self):
        return self.total - self.amount_paid

    def save(self, *args, **kwargs):
        self.total = self.subtotal - self.discount_amount + self.tax_amount
        super().save(*args, **kwargs)


class BookingLine(BaseModel):
    """Booking line item — individual service in a booking."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="booking_lines")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="lines")
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="booking_lines")
    description = models.CharField(max_length=500, blank=True, default="")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    supplier_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.service.name} × {self.quantity}"

    def save(self, *args, **kwargs):
        gross = self.quantity * self.unit_price
        if self.discount_percent > 0:
            self.discount_amount = gross * self.discount_percent / Decimal("100")
        self.tax_amount = (gross - self.discount_amount) * self.tax_percent / Decimal("100")
        self.line_total = gross - self.discount_amount + self.tax_amount
        super().save(*args, **kwargs)


# ─── Passenger (Flight) ──────────────────────────────────────

class Passenger(BaseModel):
    """Passenger — traveler information for flight bookings."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="passengers")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="passengers")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    passport_number = models.CharField(max_length=50, blank=True, default="")
    national_id = models.CharField(max_length=20, blank=True, default="")
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=[("M", "Male"), ("F", "Female")], default="M")
    seat_class = models.CharField(max_length=20, choices=[
        ("economy", "Economy"), ("business", "Business"), ("first", "First Class"),
    ], default="economy")

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


# ─── Ticket (Flight) ─────────────────────────────────────────

class Ticket(BaseModel):
    """Ticket — issued flight ticket."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="tickets")
    STATUS_CHOICES = [
        ("reserved", "Reserved"),
        ("issued", "Issued"),
        ("cancelled", "Cancelled"),
    ]
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="tickets")
    passenger = models.ForeignKey(Passenger, on_delete=models.CASCADE, related_name="tickets")
    ticket_number = models.CharField(max_length=50, blank=True, default="")
    pnr = models.CharField(max_length=10, blank=True, default="", help_text="PNR / Record Locator")
    airline = models.CharField(max_length=100, blank=True, default="")
    flight_number = models.CharField(max_length=20, blank=True, default="")
    route = models.CharField(max_length=200, blank=True, default="", help_text="e.g. THR → IST")
    departure_date = models.DateField(null=True, blank=True)
    departure_time = models.TimeField(null=True, blank=True)
    arrival_date = models.DateField(null=True, blank=True)
    arrival_time = models.TimeField(null=True, blank=True)
    fare = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    taxes = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    total_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="reserved")

    class Meta:
        ordering = ["-departure_date"]

    def __str__(self):
        return f"Ticket {self.ticket_number} — {self.passenger}"


# ─── Tour Package ─────────────────────────────────────────────

class TourPackage(BaseModel):
    """Tour Package — bundled service for travel."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="tour_packages")
    name = models.CharField(max_length=200)
    destination = models.CharField(max_length=200, blank=True, default="")
    duration_days = models.IntegerField(default=1)
    description = models.TextField(blank=True, default="")
    includes_hotel = models.BooleanField(default=False)
    includes_flight = models.BooleanField(default=False)
    includes_transfer = models.BooleanField(default=False)
    includes_guide = models.BooleanField(default=False)
    includes_meals = models.BooleanField(default=False)
    selling_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    supplier_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=10, default="IRR")
    max_participants = models.IntegerField(default=20)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.duration_days}d)"


# ─── Hotel Reservation ────────────────────────────────────────

class HotelReservation(BaseModel):
    """Hotel Reservation — hotel booking details."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="hotel_reservations")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="hotel_reservations")
    hotel_name = models.CharField(max_length=200)
    room_type = models.CharField(max_length=50, default="standard")
    check_in = models.DateField()
    check_out = models.DateField()
    nights = models.IntegerField(default=1)
    guests = models.IntegerField(default=1)
    room_rate = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    total_rate = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    special_requests = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-check_in"]

    def __str__(self):
        return f"{self.hotel_name} ({self.check_in} → {self.check_out})"

    def save(self, *args, **kwargs):
        if self.check_in and self.check_out:
            self.nights = (self.check_out - self.check_in).days
        self.total_rate = self.nights * self.room_rate
        super().save(*args, **kwargs)


# ─── Commission Engine ────────────────────────────────────────

class CommissionRule(BaseModel):
    """Commission Rule — defines commission rates."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="commission_rules")
    name = models.CharField(max_length=200)
    service_type = models.CharField(max_length=20, choices=Service.SERVICE_TYPES, blank=True, default="")
    commission_type = models.CharField(max_length=20, choices=[
        ("percentage", "Percentage of Selling Price"),
        ("fixed", "Fixed Amount"),
        ("margin_based", "Percentage of Gross Margin"),
    ], default="percentage")
    commission_rate = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"))
    fixed_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    applies_to_role = models.CharField(max_length=50, blank=True, default="", help_text="e.g. 'agent', 'salesperson'")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_commission_type_display()})"


class CommissionTransaction(BaseModel):
    """Commission Transaction — recorded commission for a booking."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="commission_transactions")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="commissions")
    rule = models.ForeignKey(CommissionRule, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="commissions_earned")
    commission_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    base_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    status = models.CharField(max_length=20, choices=[
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("paid", "Paid"),
    ], default="pending")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Commission: {self.commission_amount} for Booking #{self.booking.booking_number}"


# ─── Refund ───────────────────────────────────────────────────

class RefundTransaction(BaseModel):
    """Refund Transaction — records a refund for cancelled booking."""
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="refund_transactions")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="refunds")
    refund_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    penalty_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    net_refund = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    reason = models.TextField(blank=True, default="")
    refund_date = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=[
        ("pending", "Pending"),
        ("processed", "Processed"),
        ("denied", "Denied"),
    ], default="pending")
    journal_voucher = models.ForeignKey("finance.JournalVoucher", on_delete=models.SET_NULL, null=True, blank=True, related_name="refunds")

    class Meta:
        ordering = ["-refund_date"]

    def __str__(self):
        return f"Refund: {self.net_refund} for Booking #{self.booking.booking_number}"

    def save(self, *args, **kwargs):
        self.net_refund = self.refund_amount - self.penalty_amount
        super().save(*args, **kwargs)
