"""
Multi-tenant Serializers.

Phase 18: Multi-tenant Architecture
"""

from rest_framework import serializers
from .models import Tenant, TenantPlan, TenantSubscription, TenantFeature


class TenantPlanSerializer(serializers.ModelSerializer):
    """Serializer for subscription plans."""

    class Meta:
        model = TenantPlan
        fields = [
            "id", "name", "plan_type", "description",
            "price_monthly", "price_yearly",
            "max_users", "max_storage_gb", "max_api_keys",
            "max_requests_per_minute", "max_requests_per_hour",
            "enabled_modules", "features", "is_active",
        ]


class TenantSerializer(serializers.ModelSerializer):
    """Serializer for tenant information."""

    company_name = serializers.CharField(source="company.name", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True, default="")

    class Meta:
        model = Tenant
        fields = [
            "id", "company_name", "plan", "plan_name",
            "subdomain", "custom_domain",
            "is_trial", "trial_ends_at", "is_suspended",
            "current_users", "storage_used_gb",
            "onboarding_completed", "last_active_at",
            "created_at",
        ]
        read_only_fields = ["current_users", "storage_used_gb", "last_active_at"]


class TenantOnboardingSerializer(serializers.Serializer):
    """Serializer for tenant onboarding completion."""

    company_name = serializers.CharField(max_length=255)
    industry = serializers.CharField(max_length=100, required=False, default="")
    team_size = serializers.ChoiceField(
        choices=[
            ("1-5", "1-5 employees"),
            ("6-20", "6-20 employees"),
            ("21-100", "21-100 employees"),
            ("100+", "100+ employees"),
        ],
        required=False,
        default="1-5",
    )


class TenantSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for subscription history."""

    plan_name = serializers.CharField(source="plan.name", read_only=True)

    class Meta:
        model = TenantSubscription
        fields = [
            "id", "plan", "plan_name", "status", "billing_cycle",
            "starts_at", "ends_at", "canceled_at",
            "last_payment_at", "created_at",
        ]


class TenantFeatureSerializer(serializers.ModelSerializer):
    """Serializer for feature flags."""

    class Meta:
        model = TenantFeature
        fields = [
            "id", "feature_key", "feature_type",
            "is_enabled", "config", "created_at",
        ]
