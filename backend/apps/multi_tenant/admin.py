"""
Multi-tenant Admin — Register models for Django admin.

Phase 18: Multi-tenant Architecture
"""

from django.contrib import admin
from .models import Tenant, TenantPlan, TenantSubscription, TenantFeature


@admin.register(TenantPlan)
class TenantPlanAdmin(admin.ModelAdmin):
    list_display = ["name", "plan_type", "price_monthly", "max_users", "is_active"]
    list_filter = ["plan_type", "is_active"]
    search_fields = ["name"]


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = [
        "company", "plan", "is_trial", "trial_ends_at",
        "is_suspended", "current_users", "onboarding_completed",
    ]
    list_filter = ["is_trial", "is_suspended", "onboarding_completed"]
    search_fields = ["company__name", "subdomain"]
    raw_id_fields = ["company", "plan"]


@admin.register(TenantSubscription)
class TenantSubscriptionAdmin(admin.ModelAdmin):
    list_display = ["tenant", "plan", "status", "billing_cycle", "starts_at", "ends_at"]
    list_filter = ["status", "billing_cycle"]
    raw_id_fields = ["tenant", "plan"]


@admin.register(TenantFeature)
class TenantFeatureAdmin(admin.ModelAdmin):
    list_display = ["tenant", "feature_key", "feature_type", "is_enabled"]
    list_filter = ["feature_type", "is_enabled"]
    search_fields = ["feature_key"]
    raw_id_fields = ["tenant"]
