"""
Rate Limiting & API Key Management Models.

Phase 22: API Rate Limiting & Throttling
- APIKey: API key authentication for programmatic access
- RateLimitPolicy: Configurable rate limit rules per endpoint/module
- RateLimitLog: Request logging for analytics and enforcement
"""

import uuid
import hashlib
import secrets
from django.db import models
from django.utils import timezone
from apps.core.models import BaseModel


def generate_api_key():
    """Generate a secure API key."""
    prefix = "nxv"
    random_part = secrets.token_hex(20)
    return f"{prefix}_{random_part}"


def hash_api_key(key: str) -> str:
    """Hash an API key for secure storage."""
    return hashlib.sha256(key.encode()).hexdigest()


class APIKey(BaseModel):
    """
    API key for programmatic access to the Nexivo ERP API.

    Keys are hashed before storage. The raw key is only shown once
    at creation time.
    """

    name = models.CharField(
        max_length=100,
        help_text="Descriptive name for this API key",
    )
    key_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="SHA-256 hash of the API key",
    )
    key_prefix = models.CharField(
        max_length=12,
        help_text="Visible prefix of the key (e.g., nxv_ab12...)",
    )

    # Permissions & scope
    is_active = models.BooleanField(default=True)
    scopes = models.JSONField(
        default=list,
        blank=True,
        help_text='List of allowed scopes, e.g. ["finance:read", "sales:write"]',
    )
    allowed_modules = models.JSONField(
        default=list,
        blank=True,
        help_text='List of module slugs this key can access, e.g. ["finance", "sales"]',
    )

    # Rate limit overrides (null = use default policy)
    rate_limit_override = models.JSONField(
        null=True,
        blank=True,
        help_text='Override rate limits, e.g. {"requests_per_minute": 100}',
    )

    # Expiration
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this key expires (null = never)",
    )

    # Usage tracking
    last_used_at = models.DateTimeField(null=True, blank=True)
    total_requests = models.PositiveIntegerField(default=0)

    # Owner
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="api_keys_created",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"

    def is_valid(self) -> bool:
        """Check if the key is active and not expired."""
        if not self.is_active:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True

    def record_usage(self):
        """Record a request using this key."""
        self.last_used_at = timezone.now()
        self.total_requests = models.F("total_requests") + 1
        self.save(update_fields=["last_used_at", "total_requests"])

    @classmethod
    def create_key(cls, company, name, created_by=None, **kwargs):
        """Create a new API key and return the raw key (shown once)."""
        raw_key = generate_api_key()
        key_hash_value = hash_api_key(raw_key)
        key_prefix = raw_key[:12] + "..."

        api_key = cls.objects.create(
            company=company,
            name=name,
            key_hash=key_hash_value,
            key_prefix=key_prefix,
            created_by=created_by,
            **kwargs,
        )
        return api_key, raw_key

    @classmethod
    def verify_key(cls, raw_key: str):
        """Verify a raw API key and return the APIKey object if valid."""
        key_hash_value = hash_api_key(raw_key)
        try:
            api_key = cls.objects.select_related("company").get(
                key_hash=key_hash_value,
                is_active=True,
            )
            if api_key.is_valid():
                return api_key
        except cls.DoesNotExist:
            pass
        return None


class RateLimitPolicy(BaseModel):
    """
    Configurable rate limit policy.

    Can be applied globally, per-module, or per-endpoint.
    More specific policies override less specific ones.
    """

    POLICY_SCOPE_CHOICES = [
        ("global", "Global"),
        ("module", "Module"),
        ("endpoint", "Endpoint"),
        ("api_key", "API Key"),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    # Scope
    scope = models.CharField(
        max_length=20,
        choices=POLICY_SCOPE_CHOICES,
        default="global",
    )
    module = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Module slug (required if scope=module)",
    )
    endpoint_pattern = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="URL pattern (required if scope=endpoint)",
    )

    # Rate limits
    requests_per_minute = models.PositiveIntegerField(default=60)
    requests_per_hour = models.PositiveIntegerField(default=1000)
    requests_per_day = models.PositiveIntegerField(default=10000)

    # Burst limits
    burst_size = models.PositiveIntegerField(
        default=10,
        help_text="Max requests in a burst (within 1 second)",
    )

    # Response when limited
    retry_after_seconds = models.PositiveIntegerField(
        default=60,
        help_text="Seconds to suggest waiting when rate limited",
    )

    # Priority (higher = checked first)
    priority = models.IntegerField(default=0)

    class Meta:
        ordering = ["-priority", "scope"]

    def __str__(self):
        return f"{self.name} ({self.scope}: {self.requests_per_minute}/min)"


class RateLimitLog(BaseModel):
    """
    Log of API requests for rate limit tracking and analytics.

    Uses lightweight fields for fast writes. Old records can be
    purged by a management command.
    """

    api_key = models.ForeignKey(
        APIKey,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rate_limit_logs",
    )

    # Request details
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=500)
    endpoint_name = models.CharField(max_length=200, blank=True, default="")
    module = models.CharField(max_length=50, blank=True, default="")

    # Response
    status_code = models.PositiveIntegerField()
    response_time_ms = models.PositiveIntegerField(null=True, blank=True)

    # Rate limit state at time of request
    rate_limit_remaining = models.IntegerField(null=True, blank=True)
    rate_limit_limit = models.IntegerField(null=True, blank=True)
    was_throttled = models.BooleanField(default=False)

    # Client info
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True, default="")

    # Timestamp
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["company", "timestamp"]),
            models.Index(fields=["api_key", "timestamp"]),
            models.Index(fields=["module", "timestamp"]),
            models.Index(fields=["was_throttled", "timestamp"]),
        ]

    def __str__(self):
        return f"{self.method} {self.path} [{self.status_code}] @ {self.timestamp}"
