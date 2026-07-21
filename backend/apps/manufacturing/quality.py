"""
Quality Control Module — per MANUFACTURING_MODULE.md §22.

Supports:
- Quality Plans (inspection definitions)
- Inspection Points (checkpoints in production)
- Inspection Results (actual findings)
- Non-Conformance Reports
- Corrective Actions
"""

import logging
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.models import BaseModel

logger = logging.getLogger(__name__)


class QualityPlan(BaseModel):
    """
    Quality Plan — defines inspection criteria for products/operations.
    Per MANUFACTURING_MODULE.md §22: Quality Integration.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="quality_plans")
    INSPECTION_TYPES = [
        ("incoming", "Inbound Quality"),
        ("process", "Process Quality"),
        ("final", "Final Quality"),
    ]

    name = models.CharField(max_length=200)
    inspection_type = models.CharField(max_length=20, choices=INSPECTION_TYPES, default="final")
    product_name = models.CharField(max_length=200, blank=True, default="")
    product_code = models.CharField(max_length=50, blank=True, default="")

    # Optional link to BOM/routing
    bom = models.ForeignKey("manufacturing.BOM", on_delete=models.SET_NULL, null=True, blank=True, related_name="quality_plans")
    routing = models.ForeignKey("manufacturing.Routing", on_delete=models.SET_NULL, null=True, blank=True, related_name="quality_plans")

    # Criteria (JSON list of inspection criteria)
    criteria = models.JSONField(default=list, blank=True, help_text='e.g. [{"name": "Visual", "method": "visual", "tolerance": "±0.5mm"}]')

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_inspection_type_display()})"


class InspectionResult(BaseModel):
    """
    Inspection Result — records actual inspection findings.
    Per MANUFACTURING_MODULE.md §22: Inspection Result.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="inspection_results")
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("passed", "Passed"),
        ("failed", "Failed"),
        ("conditional", "Conditional"),
    ]

    quality_plan = models.ForeignKey(QualityPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name="results")

    # Reference to what is being inspected
    reference_type = models.CharField(max_length=30, blank=True, default="")
    reference_id = models.IntegerField(null=True, blank=True)

    # Inspection details
    product_name = models.CharField(max_length=200)
    quantity_inspected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1"))
    quantity_passed = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    quantity_failed = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    notes = models.TextField(blank=True, default="")

    # Inspector
    inspected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="inspections")
    inspected_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-inspected_at"]

    def __str__(self):
        return f"Inspection: {self.product_name} — {self.status}"

    @property
    def pass_rate(self):
        if self.quantity_inspected > 0:
            return (self.quantity_passed / self.quantity_inspected) * 100
        return Decimal("0")


class NonConformance(BaseModel):
    """
    Non-Conformance Report — records quality failures.
    Per MANUFACTURING_MODULE.md §22: Non Conformance.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="non_conformances")
    SEVERITY_CHOICES = [
        ("minor", "Minor"),
        ("major", "Major"),
        ("critical", "Critical"),
    ]
    STATUS_CHOICES = [
        ("open", "Open"),
        ("investigating", "Investigating"),
        ("resolved", "Resolved"),
        ("closed", "Closed"),
    ]

    nc_number = models.CharField(max_length=50)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="minor")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")

    description = models.TextField()
    product_name = models.CharField(max_length=200, blank=True, default="")
    quantity_affected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    # Links
    inspection_result = models.ForeignKey(InspectionResult, on_delete=models.SET_NULL, null=True, blank=True, related_name="non_conformances")
    production_order = models.ForeignKey("manufacturing.ProductionOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="non_conformances")

    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reported_ncs")
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_ncs")
    root_cause = models.TextField(blank=True, default="")
    resolution = models.TextField(blank=True, default="")

    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("company", "nc_number")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"NC #{self.nc_number} — {self.severity}: {self.description[:50]}"


class CorrectiveAction(BaseModel):
    """
    Corrective Action — follows up on non-conformance.
    Per MANUFACTURING_MODULE.md §22: Corrective Action.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="corrective_actions")
    STATUS_CHOICES = [
        ("planned", "Planned"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("verified", "Verified"),
    ]

    non_conformance = models.ForeignKey(NonConformance, on_delete=models.CASCADE, related_name="corrective_actions")
    action_number = models.CharField(max_length=50)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="planned")

    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="corrective_actions")
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("company", "action_number")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"CA #{self.action_number} — {self.status}"
