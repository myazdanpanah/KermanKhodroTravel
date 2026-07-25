"""
Rate Limiting Serializers.

Phase 22: API Key management and rate limit policy serializers.
"""

from rest_framework import serializers
from .models import APIKey, RateLimitPolicy, RateLimitLog


class APIKeyListSerializer(serializers.ModelSerializer):
    """Serializer for listing API keys (hides key hash)."""

    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = APIKey
        fields = [
            "id", "name", "key_prefix", "is_active", "scopes",
            "allowed_modules", "expires_at", "last_used_at",
            "total_requests", "created_by_name", "created_at",
        ]


class APIKeyCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating API keys. Returns raw key in response."""

    class Meta:
        model = APIKey
        fields = [
            "name", "scopes", "allowed_modules",
            "rate_limit_override", "expires_at",
        ]


class APIKeyCreateResponseSerializer(serializers.Serializer):
    """Response after creating an API key - includes raw key (shown once)."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    raw_key = serializers.CharField(help_text="Save this key - it won't be shown again")
    key_prefix = serializers.CharField()


class RateLimitPolicySerializer(serializers.ModelSerializer):
    """Serializer for rate limit policies."""

    class Meta:
        model = RateLimitPolicy
        fields = [
            "id", "name", "description", "is_active", "scope",
            "module", "endpoint_pattern",
            "requests_per_minute", "requests_per_hour", "requests_per_day",
            "burst_size", "retry_after_seconds", "priority",
            "created_at",
        ]


class RateLimitLogSerializer(serializers.ModelSerializer):
    """Serializer for rate limit logs (read-only)."""

    api_key_name = serializers.CharField(source="api_key.name", read_only=True, default="")
    user_name = serializers.CharField(source="user.username", read_only=True, default="")

    class Meta:
        model = RateLimitLog
        fields = [
            "id", "api_key_name", "user_name", "method", "path",
            "endpoint_name", "module", "status_code", "response_time_ms",
            "rate_limit_remaining", "rate_limit_limit", "was_throttled",
            "ip_address", "timestamp",
        ]
        read_only_fields = fields


class RateLimitStatsSerializer(serializers.Serializer):
    """Aggregated rate limit statistics."""

    total_requests = serializers.IntegerField()
    throttled_requests = serializers.IntegerField()
    unique_api_keys = serializers.IntegerField()
    unique_users = serializers.IntegerField()
    avg_response_time_ms = serializers.FloatField()
    top_modules = serializers.ListField(child=serializers.DictField())
    top_endpoints = serializers.ListField(child=serializers.DictField())
    hourly_distribution = serializers.ListField(child=serializers.DictField())
