"""
Rate Limiting Admin — Register models for Django admin.

Phase 22: API Rate Limiting & Throttling
"""

from django.contrib import admin
from .models import APIKey, RateLimitPolicy, RateLimitLog


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = [
        "name", "key_prefix", "company", "is_active",
        "total_requests", "last_used_at", "expires_at",
    ]
    list_filter = ["is_active", "created_at"]
    search_fields = ["name", "key_prefix"]
    readonly_fields = ["key_hash", "key_prefix", "total_requests", "last_used_at"]

    def has_add_permission(self, request):
        return False  # Create via API only


@admin.register(RateLimitPolicy)
class RateLimitPolicyAdmin(admin.ModelAdmin):
    list_display = [
        "name", "scope", "module", "is_active",
        "requests_per_minute", "requests_per_hour", "priority",
    ]
    list_filter = ["scope", "is_active"]
    search_fields = ["name", "module"]


@admin.register(RateLimitLog)
class RateLimitLogAdmin(admin.ModelAdmin):
    list_display = [
        "method", "path", "status_code", "module",
        "was_throttled", "response_time_ms", "timestamp",
    ]
    list_filter = ["was_throttled", "status_code", "module", "method"]
    search_fields = ["path"]
    readonly_fields = [
        "company", "api_key", "user", "method", "path",
        "status_code", "response_time_ms", "rate_limit_remaining",
        "rate_limit_limit", "was_throttled", "ip_address",
        "user_agent", "timestamp",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
