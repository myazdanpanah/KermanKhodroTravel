"""
Rate Limiting Views — API Key management, rate limit policies, and usage analytics.

Phase 22: API Rate Limiting & Throttling
"""

import logging
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Avg, Q
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import APIKey, RateLimitPolicy, RateLimitLog
from .serializers import (
    APIKeyListSerializer, APIKeyCreateSerializer, APIKeyCreateResponseSerializer,
    RateLimitPolicySerializer, RateLimitLogSerializer, RateLimitStatsSerializer,
)

logger = logging.getLogger(__name__)


# ─── API Key Management ──────────────────────────────────────────


@api_view(["GET", "POST"])
def api_key_list(request):
    """List or create API keys for the user's company."""
    company = request.user.company
    if not company:
        return Response({"error": "No company assigned"}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == "GET":
        keys = APIKey.objects.filter(company=company)
        return Response(APIKeyListSerializer(keys, many=True).data)

    elif request.method == "POST":
        serializer = APIKeyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        api_key, raw_key = APIKey.create_key(
            company=company,
            name=serializer.validated_data["name"],
            created_by=request.user,
            scopes=serializer.validated_data.get("scopes", []),
            allowed_modules=serializer.validated_data.get("allowed_modules", []),
            rate_limit_override=serializer.validated_data.get("rate_limit_override"),
            expires_at=serializer.validated_data.get("expires_at"),
        )

        return Response(
            APIKeyCreateResponseSerializer({
                "id": api_key.id,
                "name": api_key.name,
                "raw_key": raw_key,
                "key_prefix": api_key.key_prefix,
            }).data,
            status=status.HTTP_201_CREATED,
        )


@api_view(["GET", "PUT", "DELETE"])
def api_key_detail(request, pk):
    """Retrieve, update, or delete an API key."""
    company = request.user.company
    try:
        api_key = APIKey.objects.get(pk=pk, company=company)
    except APIKey.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(APIKeyListSerializer(api_key).data)

    elif request.method == "PUT":
        serializer = APIKeyCreateSerializer(api_key, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(APIKeyListSerializer(api_key).data)

    elif request.method == "DELETE":
        api_key.soft_delete(user=request.user, reason="User deleted API key")
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def api_key_toggle(request, pk):
    """Toggle API key active/inactive status."""
    company = request.user.company
    try:
        api_key = APIKey.objects.get(pk=pk, company=company)
    except APIKey.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    api_key.is_active = not api_key.is_active
    api_key.save(update_fields=["is_active"])
    return Response(APIKeyListSerializer(api_key).data)


@api_view(["POST"])
def api_key_regenerate(request, pk):
    """Regenerate an API key (old key immediately invalidated)."""
    company = request.user.company
    try:
        old_key = APIKey.objects.get(pk=pk, company=company)
    except APIKey.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    # Create new key with same settings
    new_key, raw_key = APIKey.create_key(
        company=company,
        name=old_key.name,
        created_by=request.user,
        scopes=old_key.scopes,
        allowed_modules=old_key.allowed_modules,
        rate_limit_override=old_key.rate_limit_override,
        expires_at=old_key.expires_at,
    )

    # Soft-delete old key
    old_key.soft_delete(user=request.user, reason="Regenerated")

    return Response(
        APIKeyCreateResponseSerializer({
            "id": new_key.id,
            "name": new_key.name,
            "raw_key": raw_key,
            "key_prefix": new_key.key_prefix,
        }).data,
        status=status.HTTP_201_CREATED,
    )


# ─── Rate Limit Policies ────────────────────────────────────────


@api_view(["GET", "POST"])
def policy_list(request):
    """List or create rate limit policies (admin only)."""
    if not request.user.is_staff and request.user.role != "admin":
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        policies = RateLimitPolicy.objects.all()
        return Response(RateLimitPolicySerializer(policies, many=True).data)

    elif request.method == "POST":
        serializer = RateLimitPolicySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(company=request.user.company)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def policy_detail(request, pk):
    """Retrieve, update, or delete a rate limit policy."""
    if not request.user.is_staff and request.user.role != "admin":
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    try:
        policy = RateLimitPolicy.objects.get(pk=pk)
    except RateLimitPolicy.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(RateLimitPolicySerializer(policy).data)

    elif request.method == "PUT":
        serializer = RateLimitPolicySerializer(policy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    elif request.method == "DELETE":
        policy.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Usage Analytics ─────────────────────────────────────────────


@api_view(["GET"])
def rate_limit_stats(request):
    """Get aggregated rate limit usage statistics."""
    company = request.user.company
    if not company:
        return Response({"error": "No company assigned"}, status=status.HTTP_400_BAD_REQUEST)

    # Time range filter
    hours = int(request.query_params.get("hours", 24))
    since = timezone.now() - timedelta(hours=hours)

    logs = RateLimitLog.objects.filter(
        company=company,
        timestamp__gte=since,
    )

    stats = logs.aggregate(
        total_requests=Count("id"),
        throttled_requests=Count("id", filter=Q(was_throttled=True)),
        unique_api_keys=Count("api_key", distinct=True),
        unique_users=Count("user", distinct=True),
        avg_response_time_ms=Avg("response_time_ms"),
    )

    # Top modules
    top_modules = (
        logs.exclude(module="")
        .values("module")
        .annotate(count=Count("id"))
        .order_by("-count")[:10]
    )

    # Top endpoints
    top_endpoints = (
        logs.values("path")
        .annotate(count=Count("id"))
        .order_by("-count")[:10]
    )

    # Hourly distribution
    from django.db.models.functions import TruncHour
    hourly = (
        logs.annotate(hour=TruncHour("timestamp"))
        .values("hour")
        .annotate(count=Count("id"))
        .order_by("hour")
    )

    return Response({
        "total_requests": stats["total_requests"] or 0,
        "throttled_requests": stats["throttled_requests"] or 0,
        "unique_api_keys": stats["unique_api_keys"] or 0,
        "unique_users": stats["unique_users"] or 0,
        "avg_response_time_ms": round(stats["avg_response_time_ms"] or 0, 1),
        "top_modules": list(top_modules),
        "top_endpoints": list(top_endpoints),
        "hourly_distribution": list(hourly),
    })


@api_view(["GET"])
def rate_limit_logs(request):
    """List rate limit logs with filtering."""
    company = request.user.company
    if not company:
        return Response({"error": "No company assigned"}, status=status.HTTP_400_BAD_REQUEST)

    logs = RateLimitLog.objects.filter(company=company)

    # Filters
    module = request.query_params.get("module")
    if module:
        logs = logs.filter(module=module)

    was_throttled = request.query_params.get("throttled")
    if was_throttled is not None:
        logs = logs.filter(was_throttled=was_throttled.lower() == "true")

    api_key_id = request.query_params.get("api_key")
    if api_key_id:
        logs = logs.filter(api_key_id=api_key_id)

    # Pagination
    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("page_size", 50))
    offset = (page - 1) * page_size

    total = logs.count()
    logs = logs[offset:offset + page_size]

    return Response({
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": RateLimitLogSerializer(logs, many=True).data,
    })
