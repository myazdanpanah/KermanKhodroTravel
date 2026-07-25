"""
Multi-tenant Views — Tenant management, subscription, and feature flags.

Phase 18: Multi-tenant Architecture
"""

import logging
from datetime import timedelta
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Tenant, TenantPlan, TenantSubscription, TenantFeature
from .serializers import (
    TenantSerializer, TenantPlanSerializer,
    TenantSubscriptionSerializer, TenantFeatureSerializer,
    TenantOnboardingSerializer,
)

logger = logging.getLogger(__name__)


# ─── Tenant Management (Admin) ──────────────────────────────────


@api_view(["GET"])
@permission_classes([permissions.IsAdminUser])
def tenant_list(request):
    """List all tenants (superadmin only)."""
    tenants = Tenant.objects.select_related("company", "plan").all()
    return Response(TenantSerializer(tenants, many=True).data)


@api_view(["GET"])
@permission_classes([permissions.IsAdminUser])
def tenant_detail(request, pk):
    """Get tenant details (superadmin only)."""
    try:
        tenant = Tenant.objects.select_related("company", "plan").get(pk=pk)
    except Tenant.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response(TenantSerializer(tenant).data)


@api_view(["POST"])
def tenant_onboard(request):
    """Complete tenant onboarding after company creation."""
    company = request.user.company
    if not company:
        return Response({"error": "No company assigned"}, status=status.HTTP_400_BAD_REQUEST)

    # Check if tenant already exists
    tenant, created = Tenant.objects.get_or_create(
        company=company,
        defaults={
            "plan": TenantPlan.objects.filter(plan_type="free").first(),
            "is_trial": True,
            "trial_ends_at": timezone.now() + timedelta(days=14),
        },
    )

    # Check if onboarding was already completed
    if not created and tenant.onboarding_completed:
        return Response({
            "message": "Onboarding already completed",
            "tenant_id": tenant.id,
            "is_trial": tenant.is_trial,
            "trial_ends_at": tenant.trial_ends_at,
            "plan": TenantPlanSerializer(tenant.plan).data if tenant.plan else None,
        }, status=status.HTTP_200_OK)

    # Mark onboarding as completed
    tenant.onboarding_completed = True
    tenant.save(update_fields=["onboarding_completed"])

    return Response({
        "tenant_id": tenant.id,
        "is_trial": tenant.is_trial,
        "trial_ends_at": tenant.trial_ends_at,
        "plan": TenantPlanSerializer(tenant.plan).data if tenant.plan else None,
    })


@api_view(["GET"])
def tenant_my_info(request):
    """Get current user's tenant information."""
    company = request.user.company
    if not company:
        return Response({"error": "No company assigned"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        tenant = Tenant.objects.select_related("plan").get(company=company)
    except Tenant.DoesNotExist:
        return Response({"error": "Tenant not found"}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        "tenant": TenantSerializer(tenant).data,
        "plan": TenantPlanSerializer(tenant.plan).data if tenant.plan else None,
        "features": TenantFeatureSerializer(
            TenantFeature.objects.filter(tenant=tenant), many=True
        ).data,
    })


# ─── Plans ───────────────────────────────────────────────────────


@api_view(["GET"])
def plan_list(request):
    """List available subscription plans."""
    plans = TenantPlan.objects.filter(is_active=True)
    return Response(TenantPlanSerializer(plans, many=True).data)


@api_view(["POST"])
def tenant_change_plan(request):
    """Change tenant subscription plan."""
    company = request.user.company
    if not company:
        return Response({"error": "No company assigned"}, status=status.HTTP_400_BAD_REQUEST)

    plan_id = request.data.get("plan_id")
    if not plan_id:
        return Response({"error": "plan_id required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        tenant = Tenant.objects.get(company=company)
        plan = TenantPlan.objects.get(pk=plan_id, is_active=True)
    except (Tenant.DoesNotExist, TenantPlan.DoesNotExist):
        return Response({"error": "Tenant or plan not found"}, status=status.HTTP_404_NOT_FOUND)

    # Update plan
    tenant.plan = plan
    tenant.is_trial = False
    tenant.save(update_fields=["plan", "is_trial"])

    return Response({
        "message": f"Plan changed to {plan.name}",
        "plan": TenantPlanSerializer(plan).data,
    })


# ─── Features ────────────────────────────────────────────────────


@api_view(["GET"])
def feature_list(request):
    """List feature flags for the current tenant."""
    company = request.user.company
    if not company:
        return Response({"error": "No company assigned"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        tenant = Tenant.objects.get(company=company)
    except Tenant.DoesNotExist:
        return Response({"error": "Tenant not found"}, status=status.HTTP_404_NOT_FOUND)

    features = TenantFeature.objects.filter(tenant=tenant)
    return Response(TenantFeatureSerializer(features, many=True).data)


@api_view(["POST"])
@permission_classes([permissions.IsAdminUser])
def feature_toggle(request, pk):
    """Toggle a feature flag for a tenant."""
    try:
        feature = TenantFeature.objects.get(pk=pk)
    except TenantFeature.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    feature.is_enabled = not feature.is_enabled
    feature.save(update_fields=["is_enabled"])

    return Response(TenantFeatureSerializer(feature).data)


# ─── Subscription History ────────────────────────────────────────


@api_view(["GET"])
def subscription_list(request):
    """List subscription history for the current tenant."""
    company = request.user.company
    if not company:
        return Response({"error": "No company assigned"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        tenant = Tenant.objects.get(company=company)
    except Tenant.DoesNotExist:
        return Response({"error": "Tenant not found"}, status=status.HTTP_404_NOT_FOUND)

    subs = TenantSubscription.objects.filter(tenant=tenant)
    return Response(TenantSubscriptionSerializer(subs, many=True).data)
