"""
Service Management Module Models — Enterprise ERP After-Sales Lifecycle.

Per SERVICE_MANAGEMENT_MODULE.md:
- §4: Service Request Management
- §5: Warranty Management
- §7: Repair Center Management
- §9: Work Order Management
- §10: Technician Management
- §11: Spare Parts Management
- §12: Service Contract Management
- §13: SLA Management
- §14: Preventive Maintenance
- §15: Service Costing
- §17: Accounting Integration

Supports: Warranty, Repair Center, Work Orders, SLA, Maintenance, Contracts
"""

from decimal import Decimal
from django.db import models
from django.conf import settings

from apps.core.models import BaseModel


# ─── Service Request ──────────────────────────────────────────

class ServiceRequest(BaseModel):
    """
    Service Request — entry point of customer support.
    Per SERVICE_MANAGEMENT_MODULE.md §4: Service Request Management.
    """
    STATUS_CHOICES = [
        ("new", "New"),
        ("assigned", "Assigned"),
        ("in_progress", "In Progress"),
        ("waiting_customer", "Waiting Customer"),
        ("waiting_parts", "Waiting Parts"),
        ("completed", "Completed"),
        ("closed", "Closed"),
        ("cancelled", "Cancelled"),
    ]
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    request_number = models.CharField(max_length=50)
    customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.PROTECT,
        related_name="service_requests",
    )
    product_name = models.CharField(max_length=200, help_text="Product requiring service")
    product_code = models.CharField(max_length=50, blank=True, default="")
    serial_number = models.CharField(max_length=100, blank=True, default="")
    problem_description = models.TextField(default="")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_service_requests",
    )
    assigned_technician = models.ForeignKey(
        "Technician",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="service_requests",
    )

    # Linked entities
    warranty = models.ForeignKey(
        "Warranty",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="service_requests",
    )

    # Dates
    received_date = models.DateTimeField(auto_now_add=True)
    resolved_date = models.DateTimeField(null=True, blank=True)
    closed_date = models.DateTimeField(null=True, blank=True)

    # SLA tracking
    sla_response_deadline = models.DateTimeField(null=True, blank=True)
    sla_resolution_deadline = models.DateTimeField(null=True, blank=True)
    sla_response_met = models.BooleanField(null=True, blank=True)
    sla_resolution_met = models.BooleanField(null=True, blank=True)

    # Accounting — paid service invoicing
    is_chargeable = models.BooleanField(default=False, help_text="Is this a paid service?")
    service_invoice = models.ForeignKey(
        "sales.SalesInvoice",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="service_requests",
    )

    notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("company", "request_number")]
        ordering = ["-received_date"]

    def __str__(self):
        return f"SR #{self.request_number} — {self.customer}"


# ─── Warranty ─────────────────────────────────────────────────

class Warranty(BaseModel):
    """
    Warranty Management — product warranty lifecycle.
    Per SERVICE_MANAGEMENT_MODULE.md §5: Warranty Management.
    """
    TYPE_CHOICES = [
        ("manufacturer", "Manufacturer Warranty"),
        ("dealer", "Dealer Warranty"),
        ("extended", "Extended Warranty"),
        ("contract", "Contract Warranty"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("expired", "Expired"),
        ("voided", "Voided"),
    ]

    customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.PROTECT,
        related_name="warranties",
    )
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    serial_number = models.CharField(max_length=100, blank=True, default="")

    warranty_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="manufacturer")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    start_date = models.DateField()
    end_date = models.DateField()
    notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("company", "serial_number")]
        ordering = ["-end_date"]

    def __str__(self):
        return f"Warranty: {self.product_name} ({self.serial_number})"

    @property
    def is_active(self):
        from django.utils import timezone
        return self.status == "active" and self.end_date >= timezone.now().date()

    def validate_warranty(self):
        """Check if warranty covers the product."""
        if self.is_active:
            return {"covered": True, "reason": "Warranty is active"}
        return {"covered": False, "reason": "Warranty is expired or voided"}


# ─── Technician ───────────────────────────────────────────────

class Technician(BaseModel):
    """
    Technician Management — field staff for service execution.
    Per SERVICE_MANAGEMENT_MODULE.md §10: Technician Management.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="technician_profile",
    )
    name = models.CharField(max_length=200)
    employee_id = models.CharField(max_length=50, blank=True, default="")
    department = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    skills = models.CharField(max_length=500, blank=True, default="",
                              help_text="Comma-separated skills: electrical, mechanical, etc.")
    hourly_rate = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    is_active = models.BooleanField(default=True)
    performance_score = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("100.00"),
        help_text="Performance score 0-100"
    )

    class Meta:
        unique_together = [("company", "employee_id")]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.employee_id})"


# ─── Work Order ───────────────────────────────────────────────

class WorkOrder(BaseModel):
    """
    Work Order — main execution document for service.
    Per SERVICE_MANAGEMENT_MODULE.md §9: Work Order Management.
    """
    STATUS_CHOICES = [
        ("created", "Created"),
        ("assigned", "Assigned"),
        ("started", "Started"),
        ("paused", "Paused"),
        ("completed", "Completed"),
        ("approved", "Approved"),
        ("closed", "Closed"),
    ]

    work_order_number = models.CharField(max_length=50)
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="work_orders",
    )
    technician = models.ForeignKey(
        Technician,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="work_orders",
    )

    # Work details
    problem = models.TextField(blank=True, default="")
    diagnosis = models.TextField(blank=True, default="")
    resolution = models.TextField(blank=True, default="")
    required_parts = models.TextField(blank=True, default="",
                                       help_text="Comma-separated part names")

    # Cost tracking
    estimated_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    actual_labor_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    actual_parts_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    actual_external_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    actual_overhead = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    actual_total_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))

    # Time tracking
    estimated_hours = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    actual_hours = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="created")

    # Dates
    start_date = models.DateTimeField(null=True, blank=True)
    completed_date = models.DateTimeField(null=True, blank=True)
    approved_date = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("company", "work_order_number")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"WO #{self.work_order_number} — {self.service_request}"

    def calculate_total_cost(self):
        self.actual_total_cost = (
            self.actual_labor_cost + self.actual_parts_cost +
            self.actual_external_cost + self.actual_overhead
        )
        self.save(update_fields=["actual_total_cost"])


# ─── Work Order Operation ─────────────────────────────────────

class WorkOrderOperation(BaseModel):
    """Individual operation performed within a work order."""
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name="operations")
    sequence = models.IntegerField(default=1)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    labor_hours = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    parts_used = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, default="pending")  # pending, in_progress, completed
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["sequence"]

    def __str__(self):
        return f"{self.sequence}. {self.name}"


# ─── Service Contract ─────────────────────────────────────────

class ServiceContract(BaseModel):
    """
    Service Contract — recurring service agreements.
    Per SERVICE_MANAGEMENT_MODULE.md §12: Service Contract Management.
    """
    TYPE_CHOICES = [
        ("maintenance", "Maintenance Contract"),
        ("support", "Support Contract"),
        ("amc", "AMC Contract"),
        ("subscription", "Subscription Support"),
    ]
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("active", "Active"),
        ("expired", "Expired"),
        ("cancelled", "Cancelled"),
    ]
    BILLING_CHOICES = [
        ("monthly", "Monthly"),
        ("quarterly", "Quarterly"),
        ("annually", "Annually"),
        ("one_time", "One Time"),
    ]

    contract_number = models.CharField(max_length=50)
    customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.PROTECT,
        related_name="service_contracts",
    )
    contract_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="maintenance")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    start_date = models.DateField()
    end_date = models.DateField()

    # Coverage
    coverage_description = models.TextField(blank=True, default="")
    sla_level = models.CharField(max_length=20, blank=True, default="standard")  # standard, premium, critical

    # Billing
    price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CHOICES, default="monthly")
    currency = models.CharField(max_length=10, default="IRR")

    notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("company", "contract_number")]
        ordering = ["-start_date"]

    def __str__(self):
        return f"Contract #{self.contract_number} — {self.customer}"

    @property
    def is_active(self):
        from django.utils import timezone
        today = timezone.now().date()
        return self.status == "active" and self.start_date <= today <= self.end_date


# ─── SLA Rule ─────────────────────────────────────────────────

class SLARule(BaseModel):
    """
    SLA Rule — service level agreements.
    Per SERVICE_MANAGEMENT_MODULE.md §13: SLA Management.
    """
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    name = models.CharField(max_length=200)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium")
    response_time_hours = models.IntegerField(default=24, help_text="Max response time in hours")
    resolution_time_hours = models.IntegerField(default=72, help_text="Max resolution time in hours")
    working_hours_start = models.IntegerField(default=8, help_text="Working hours start (24h)")
    working_hours_end = models.IntegerField(default=17, help_text="Working hours end (24h)")
    escalate_after_hours = models.IntegerField(null=True, blank=True,
                                                help_text="Escalate if no response after X hours")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["priority", "response_time_hours"]
        verbose_name = "SLA Rule"
        verbose_name_plural = "SLA Rules"

    def __str__(self):
        return f"{self.name} ({self.priority}) — Response: {self.response_time_hours}h"


# ─── Maintenance Plan ─────────────────────────────────────────

class MaintenancePlan(BaseModel):
    """
    Preventive Maintenance Plan — scheduled maintenance.
    Per SERVICE_MANAGEMENT_MODULE.md §14: Preventive Maintenance.
    """
    TYPE_CHOICES = [
        ("time_based", "Time Based"),
        ("usage_based", "Usage Based"),
        ("condition_based", "Condition Based"),
    ]
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("active", "Active"),
        ("paused", "Paused"),
        ("completed", "Completed"),
    ]

    name = models.CharField(max_length=200)
    product_name = models.CharField(max_length=200, blank=True, default="")
    product_code = models.CharField(max_length=50, blank=True, default="")
    maintenance_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="time_based")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    # Schedule
    interval_days = models.IntegerField(default=90, help_text="Maintenance interval in days")
    last_maintenance_date = models.DateField(null=True, blank=True)
    next_maintenance_date = models.DateField(null=True, blank=True)

    # Scope
    checklist = models.TextField(blank=True, default="",
                                  help_text="Line-separated checklist items")
    estimated_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))

    assigned_technician = models.ForeignKey(
        Technician,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="maintenance_plans",
    )

    class Meta:
        ordering = ["next_maintenance_date"]

    def __str__(self):
        return f"Maintenance: {self.name} ({self.get_maintenance_type_display()})"


# ─── Maintenance Schedule ─────────────────────────────────────

class MaintenanceSchedule(BaseModel):
    """Generated schedule entries from a maintenance plan."""
    plan = models.ForeignKey(MaintenancePlan, on_delete=models.CASCADE, related_name="schedules")
    scheduled_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    work_order = models.ForeignKey(
        WorkOrder, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="maintenance_schedules",
    )
    status = models.CharField(max_length=20, default="scheduled")  # scheduled, in_progress, completed, missed

    class Meta:
        ordering = ["scheduled_date"]

    def __str__(self):
        return f"{self.plan.name} — {self.scheduled_date}"


# ─── Service Part Usage ───────────────────────────────────────

class ServicePart(BaseModel):
    """
    Spare Parts used in service operations.
    Per SERVICE_MANAGEMENT_MODULE.md §11: Spare Parts Management.
    Accounting: Debit Service Cost, Credit Inventory.
    """
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name="parts_used")
    product_name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=50, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    unit = models.CharField(max_length=20, default="عدد")
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    total_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))

    # Inventory link
    inventory_movement = models.ForeignKey(
        "inventory.StockMovement",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="service_parts",
    )

    notes = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"

    def save(self, *args, **kwargs):
        self.total_cost = self.quantity * self.unit_cost
        super().save(*args, **kwargs)


# ─── Service Feedback ─────────────────────────────────────────

class ServiceFeedback(BaseModel):
    """Customer feedback on completed service."""
    work_order = models.OneToOneField(WorkOrder, on_delete=models.CASCADE, related_name="feedback")
    rating = models.IntegerField(default=5, help_text="Rating 1-5")
    comment = models.TextField(blank=True, default="")
    created_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Service Feedback"
        verbose_name_plural = "Service Feedbacks"

    def __str__(self):
        return f"Feedback: {self.work_order.work_order_number} — {self.rating}/5"
