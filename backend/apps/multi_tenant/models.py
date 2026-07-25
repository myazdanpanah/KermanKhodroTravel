"""
Multi-tenant Architecture Models.

Phase 18: Multi-tenant Architecture
- Tenant: Top-level tenant organization
- TenantPlan: Subscription plans with limits
- TenantSubscription: Tracks which plan each tenant is on
- TenantFeature: Feature flags per tenant
"""

from django.db import models
from django.utils import timezone
from apps.core.models import BaseModel


class TenantPlan(BaseModel):
    """
    Subscription plan that defines limits and features for tenants.
    """

    PLAN_TYPES = [
        ("free", "Free"),
        ("starter", "Starter"),
        ("professional", "Professional"),
        ("enterprise", "Enterprise"),
    ]

    name = models.CharField(max_length=100, unique=True)
    plan_type = models.CharField(max_length=20, choices=PLAN_TYPES, default="free")
    description = models.TextField(blank=True, default="")
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    price_yearly = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Limits
    max_users = models.PositiveIntegerField(default=5)
    max_storage_gb = models.PositiveIntegerField(default=1)
    max_api_keys = models.PositiveIntegerField(default=2)
    max_requests_per_minute = models.PositiveIntegerField(default=60)
    max_requests_per_hour = models.PositiveIntegerField(default=1000)

    # Enabled features
    enabled_modules = models.JSONField(
        default=list,
        blank=True,
        help_text="List of module slugs included in this plan",
    )
    features = models.JSONField(
        default=dict,
        blank=True,
        help_text='Feature flags, e.g. {"sso": true, "audit_log": true}',
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["price_monthly"]

    def __str__(self):
        return f"{self.name} ({self.get_plan_type_display()})"


class Tenant(BaseModel):
    """
    Tenant organization. Each tenant has isolated data and configuration.
    Uses the company FK from BaseModel as the primary link.
    """

    plan = models.ForeignKey(
        TenantPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenants",
    )

    # Tenant settings
    subdomain = models.CharField(
        max_length=63,
        unique=True,
        blank=True,
        null=True,
        help_text="Custom subdomain (e.g., acme.nexivo.com)",
    )
    custom_domain = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Custom domain (e.g., erp.acme.com)",
    )

    # Status
    is_trial = models.BooleanField(default=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    is_suspended = models.BooleanField(default=False)
    suspension_reason = models.TextField(blank=True, default="")

    # Usage tracking
    current_users = models.PositiveIntegerField(default=0)
    storage_used_gb = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # Metadata
    onboarding_completed = models.BooleanField(default=False)
    last_active_at = models.DateTimeField(null=True, blank=True)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "tenant"
        verbose_name_plural = "tenants"
        constraints = [
            models.UniqueConstraint(fields=["company"], name="unique_tenant_company")
        ]

    def __str__(self):
        return f"Tenant: {self.company.name}"

    @property
    def is_active(self) -> bool:
        """Check if tenant is active (not suspended, trial not expired, company active)."""
        if self.is_suspended:
            return False
        if not self.company.is_active:
            return False
        if self.is_trial and self.trial_ends_at and self.trial_ends_at < timezone.now():
            return False
        return True

    @property
    def can_add_user(self) -> bool:
        """Check if tenant can add more users within plan limits."""
        if not self.plan:
            return self.current_users < 5  # Free tier limit
        return self.current_users < self.plan.max_users

    def record_activity(self):
        """Record user activity for analytics."""
        self.last_active_at = timezone.now()
        self.save(update_fields=["last_active_at"])


class TenantSubscription(BaseModel):
    """
    Tracks subscription history and billing for a tenant.
    """

    SUBSCRIPTION_STATUS = [
        ("active", "Active"),
        ("trialing", "Trialing"),
        ("past_due", "Past Due"),
        ("canceled", "Canceled"),
        ("suspended", "Suspended"),
    ]

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    plan = models.ForeignKey(
        TenantPlan,
        on_delete=models.SET_NULL,
        null=True,
        related_name="subscriptions",
    )
    status = models.CharField(
        max_length=20,
        choices=SUBSCRIPTION_STATUS,
        default="trialing",
    )

    # Billing period
    billing_cycle = models.CharField(
        max_length=20,
        choices=[("monthly", "Monthly"), ("yearly", "Yearly")],
        default="monthly",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    canceled_at = models.DateTimeField(null=True, blank=True)

    # Payment
    payment_method = models.CharField(max_length=50, blank=True, default="")
    last_payment_at = models.DateTimeField(null=True, blank=True)

    # External billing integration
    stripe_subscription_id = models.CharField(max_length=255, blank=True, default="")
    stripe_customer_id = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tenant.company.name} - {self.plan.name} ({self.status})"

    @property
    def is_active(self) -> bool:
        return self.status in ("active", "trialing") and self.ends_at > timezone.now()


class TenantFeature(BaseModel):
    """
    Feature flags for individual tenants.
    Allows enabling/disabling specific features per tenant.
    """

    FEATURE_TYPES = [
        ("module", "Module Access"),
        ("capability", "Capability"),
        ("integration", "Integration"),
        ("ui", "UI Feature"),
    ]

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="features",
    )
    feature_key = models.CharField(
        max_length=100,
        help_text="Unique feature identifier, e.g. 'advanced_reporting'",
    )
    feature_type = models.CharField(
        max_length=20,
        choices=FEATURE_TYPES,
        default="capability",
    )
    is_enabled = models.BooleanField(default=True)

    # Optional configuration
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Feature-specific configuration",
    )

    class Meta:
        unique_together = ["tenant", "feature_key"]
        ordering = ["feature_key"]

    def __str__(self):
        return f"{self.tenant.company.name}: {self.feature_key} ({'ON' if self.is_enabled else 'OFF'})"
