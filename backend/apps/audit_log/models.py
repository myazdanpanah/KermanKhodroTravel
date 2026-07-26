"""
Audit Logging — Tracks all model changes with before/after snapshots.

Phase 25: Middleware-based audit trail that records create, update, and
delete operations on any registered model, including field-level diffs.
"""
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey


class AuditLog(models.Model):
    """Immutable audit trail for all tracked model operations."""

    ACTION_CHOICES = [
        ("create", "Create"),
        ("update", "Update"),
        ("delete", "Delete"),
        ("view", "View"),
    ]

    # What happened
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    # Who did it
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="audit_logs",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")

    # What was affected
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="audit_logs",
    )
    object_id = models.CharField(max_length=255, blank=True, default="")
    content_object = GenericForeignKey("content_type", "object_id")

    # Human-readable description
    description = models.TextField(blank=True, default="")

    # Before/after snapshots
    old_values = models.JSONField(default=dict, blank=True, help_text="Field values before the change")
    new_values = models.JSONField(default=dict, blank=True, help_text="Field values after the change")

    # Field-level diffs
    changed_fields = models.JSONField(default=list, blank=True, help_text="List of changed field names")

    # Context
    module = models.CharField(max_length=50, blank=True, default="", db_index=True, help_text="ERP module context")
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="audit_logs",
    )
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional context (request path, etc.)")

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["user", "-timestamp"]),
            models.Index(fields=["action", "-timestamp"]),
        ]

    def __str__(self):
        return f"{self.action} {self.content_type or 'unknown'} by {self.user or 'system'} at {self.timestamp}"


class AuditLogConfig(models.Model):
    """Configuration for which models to audit."""

    content_type = models.OneToOneField(
        ContentType,
        on_delete=models.CASCADE,
        related_name="audit_config",
    )
    is_enabled = models.BooleanField(default=True)
    track_fields = models.JSONField(
        default=list, blank=True,
        help_text='Fields to track. Empty = track all. e.g. ["name", "status", "total"]',
    )
    exclude_fields = models.JSONField(
        default=list, blank=True,
        help_text='Fields to exclude from tracking. e.g. ["updated_at", "last_login"]',
    )
    capture_snapshots = models.BooleanField(default=True, help_text="Store full before/after snapshots")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Audit Log Configuration"
        verbose_name_plural = "Audit Log Configurations"

    def __str__(self):
        return f"Audit: {self.content_type} ({'enabled' if self.is_enabled else 'disabled'})"
