"""
CRM Module Models — Customer Relationship Management.

Per IMPLEMENTATION_ROADMAP.md §18: Phase 13 CRM.
- Lead Management
- Opportunity Management
- Activities
- Campaigns
- Tasks
- Customer Timeline
"""

from decimal import Decimal
from django.db import models
from django.conf import settings

from apps.core.models import BaseModel


# ─── Lead ─────────────────────────────────────────────────────

class Lead(BaseModel):
    """
    Lead — potential customer or business opportunity.
    Per IMPLEMENTATION_ROADMAP.md §18: Lead Management.
    """
    STATUS_CHOICES = [
        ("new", "New"),
        ("contacted", "Contacted"),
        ("qualified", "Qualified"),
        ("unqualified", "Unqualified"),
        ("converted", "Converted"),
        ("lost", "Lost"),
    ]
    SOURCE_CHOICES = [
        ("website", "Website"),
        ("referral", "Referral"),
        ("campaign", "Campaign"),
        ("social_media", "Social Media"),
        ("phone", "Phone"),
        ("email", "Email"),
        ("event", "Event"),
        ("other", "Other"),
    ]
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    name = models.CharField(max_length=200)
    company_name = models.CharField(max_length=200, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    mobile = models.CharField(max_length=20, blank=True, default="")
    website = models.URLField(blank=True, default="")
    address = models.TextField(blank=True, default="")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="other")
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    industry = models.CharField(max_length=100, blank=True, default="")
    employees_count = models.IntegerField(null=True, blank=True)
    annual_revenue = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default="IRR")

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_leads",
    )

    # Conversion
    converted_customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="converted_from_leads",
    )
    converted_at = models.DateTimeField(null=True, blank=True)

    # Attribution: which campaign produced this lead (better tracking).
    campaign = models.ForeignKey(
        "Campaign",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="leads",
    )

    # Scoring
    score = models.IntegerField(default=0, help_text="Lead score 0-100")

    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Lead: {self.name} ({self.get_status_display()})"


# ─── Opportunity ──────────────────────────────────────────────

class Opportunity(BaseModel):
    """
    Opportunity — potential deal with a customer.
    Per IMPLEMENTATION_ROADMAP.md §18: Opportunity Management.
    """
    STATUS_CHOICES = [
        ("prospecting", "Prospecting"),
        ("qualification", "Qualification"),
        ("proposal", "Proposal"),
        ("negotiation", "Negotiation"),
        ("closed_won", "Closed Won"),
        ("closed_lost", "Closed Lost"),
    ]
    STAGE_CHOICES = [
        ("lead", "Lead"),
        ("qualified", "Qualified"),
        ("proposal_sent", "Proposal Sent"),
        ("verbal_agreement", "Verbal Agreement"),
        ("contract_sent", "Contract Sent"),
        ("closed", "Closed"),
    ]

    name = models.CharField(max_length=200)
    customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="opportunities",
    )
    lead = models.ForeignKey(
        Lead,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="opportunities",
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="prospecting")
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default="lead")
    priority = models.CharField(max_length=10, choices=Lead.PRIORITY_CHOICES, default="medium")

    # Financials
    estimated_value = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    probability = models.IntegerField(default=0, help_text="Probability % 0-100")
    weighted_value = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=10, default="IRR")

    # Dates
    expected_close_date = models.DateField(null=True, blank=True)
    actual_close_date = models.DateField(null=True, blank=True)

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_opportunities",
    )

    # Source
    source = models.CharField(max_length=20, choices=Lead.SOURCE_CHOICES, default="other")
    campaign = models.ForeignKey(
        "Campaign",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="opportunities",
    )

    description = models.TextField(blank=True, default="")
    loss_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Opportunity: {self.name} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        self.weighted_value = self.estimated_value * self.probability / 100
        super().save(*args, **kwargs)


# ─── Activity ─────────────────────────────────────────────────

class Activity(BaseModel):
    """
    Activity — interaction record with a lead, opportunity, or customer.
    Per IMPLEMENTATION_ROADMAP.md §18: Activities.
    """
    TYPE_CHOICES = [
        ("call", "Call"),
        ("email", "Email"),
        ("meeting", "Meeting"),
        ("task", "Task"),
        ("note", "Note"),
        ("sms", "SMS"),
    ]
    STATUS_CHOICES = [
        ("planned", "Planned"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    activity_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="call")
    subject = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="planned")
    priority = models.CharField(max_length=10, choices=Lead.PRIORITY_CHOICES, default="medium")

    # Linked entities (polymorphic-like)
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name="activities")
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, null=True, blank=True, related_name="activities")
    customer = models.ForeignKey("finance.Customer", on_delete=models.SET_NULL, null=True, blank=True, related_name="crm_activities")

    # Scheduling
    due_date = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(default=0)

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="crm_activities",
    )

    # Outcome
    outcome = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-due_date"]

    def __str__(self):
        return f"{self.get_activity_type_display()}: {self.subject}"


# ─── Campaign ─────────────────────────────────────────────────

class Campaign(BaseModel):
    """
    Campaign — marketing campaign.
    Per IMPLEMENTATION_ROADMAP.md §18: Campaigns.
    """
    TYPE_CHOICES = [
        ("email", "Email Campaign"),
        ("social_media", "Social Media"),
        ("content", "Content Marketing"),
        ("event", "Event"),
        ("advertising", "Advertising"),
        ("referral", "Referral Program"),
        ("other", "Other"),
    ]
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("planned", "Planned"),
        ("active", "Active"),
        ("paused", "Paused"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    name = models.CharField(max_length=200)
    campaign_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="email")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    description = models.TextField(blank=True, default="")
    target_audience = models.TextField(blank=True, default="")

    # Financials
    budget = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    actual_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=10, default="IRR")

    # Dates
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    # Metrics
    expected_leads = models.IntegerField(default=0)
    actual_leads = models.IntegerField(default=0)
    expected_opportunities = models.IntegerField(default=0)
    actual_opportunities = models.IntegerField(default=0)
    expected_revenue = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    actual_revenue = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_campaigns",
    )

    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"Campaign: {self.name} ({self.get_status_display()})"

    @property
    def roi(self):
        if self.actual_cost > 0:
            return ((self.actual_revenue - self.actual_cost) / self.actual_cost) * 100
        return 0


# ─── Task ─────────────────────────────────────────────────────

class CRMTask(BaseModel):
    """
    Task — general CRM task linked to various entities.
    Per IMPLEMENTATION_ROADMAP.md §18: Tasks.
    """
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]
    STATUS_CHOICES = [
        ("todo", "To Do"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="todo")

    # Linked entities
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name="tasks")
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, null=True, blank=True, related_name="tasks")
    customer = models.ForeignKey("finance.Customer", on_delete=models.SET_NULL, null=True, blank=True, related_name="crm_tasks")

    # Dates
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="crm_tasks",
    )

    class Meta:
        ordering = ["due_date", "-priority"]

    def __str__(self):
        return f"Task: {self.title}"


# ─── Customer Timeline ────────────────────────────────────────

class CustomerTimeline(BaseModel):
    """
    Customer Timeline — chronological history of all interactions.
    Per IMPLEMENTATION_ROADMAP.md §18: Customer Timeline.
    """
    ENTITY_CHOICES = [
        ("lead", "Lead"),
        ("opportunity", "Opportunity"),
        ("activity", "Activity"),
        ("campaign", "Campaign"),
        ("task", "Task"),
        ("sale", "Sale"),
        ("service", "Service"),
    ]

    customer = models.ForeignKey(
        "finance.Customer",
        on_delete=models.CASCADE,
        related_name="crm_timeline",
    )
    entity_type = models.CharField(max_length=20, choices=ENTITY_CHOICES)
    entity_id = models.IntegerField()
    entity_label = models.CharField(max_length=200, blank=True, default="")

    event_type = models.CharField(max_length=100, help_text="e.g. 'created', 'status_changed', 'assigned'")
    description = models.TextField(blank=True, default="")

    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="crm_timeline_events",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.entity_type} #{self.entity_id}: {self.event_type}"


# ─── SMS ─────────────────────────────────────────────────────

class SmsSettings(BaseModel):
    """Per-company SMS gateway configuration (Kavenegar, NikSMS or custom)."""

    PROVIDERS = [
        ("kavenegar", "کاوه‌نگار"),
        ("niksms", "نیک‌اس‌ام‌اس"),
        ("generic", "سرویس سفارشی"),
    ]

    provider = models.CharField(max_length=20, choices=PROVIDERS, default="kavenegar")
    api_key = models.CharField(max_length=255, blank=True, default="")
    sender = models.CharField(max_length=40, blank=True, default="")
    # Generic provider only: full endpoint that accepts {"to","message","sender"}.
    endpoint = models.CharField(max_length=300, blank=True, default="")
    username = models.CharField(max_length=100, blank=True, default="")
    password = models.CharField(max_length=150, blank=True, default="")
    enabled = models.BooleanField(default=False)

    class Meta:
        verbose_name = "تنظیمات پیامک"
        verbose_name_plural = "تنظیمات پیامک"

    def __str__(self):
        return f"SMS ({self.get_provider_display()})"


class SmsMessage(BaseModel):
    """Outgoing SMS log; one row per send attempt."""

    STATUS_CHOICES = [
        ("sent", "ارسال شد"),
        ("failed", "ناموفق"),
    ]

    phone = models.CharField(max_length=20)
    body = models.TextField()
    provider = models.CharField(max_length=20, blank=True, default="")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="sent")
    provider_message_id = models.CharField(max_length=120, blank=True, default="")
    error = models.TextField(blank=True, default="")
    campaign = models.ForeignKey(
        Campaign, on_delete=models.SET_NULL, null=True, blank=True, related_name="sms_messages",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "پیامک"
        verbose_name_plural = "پیامک‌ها"
