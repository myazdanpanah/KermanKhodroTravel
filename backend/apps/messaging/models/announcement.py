import uuid
from django.db import models
from django.conf import settings
from .conversation import Conversation
from .message import Message


class Announcement(models.Model):
    """Privileged announcement with optional acknowledgment requirement."""

    SCOPE_CHOICES = [
        ("TENANT", "Tenant-wide"),
        ("DEPARTMENT", "Department"),
        ("GROUP", "Group"),
        ("CHANNEL", "Channel"),
    ]

    PRIORITY_CHOICES = [
        ("LOW", "Low"),
        ("NORMAL", "Normal"),
        ("HIGH", "High"),
        ("URGENT", "Urgent"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
        related_name="messaging_announcements",
        db_index=True,
    )
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="announcement_details",
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="announcements",
    )
    scope_type = models.CharField(max_length=30, choices=SCOPE_CHOICES, default="GROUP")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="NORMAL")
    publish_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    requires_acknowledgment = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_announcements",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "messaging_announcement"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Announcement {self.id} ({self.priority})"


class AnnouncementAcknowledgment(models.Model):
    """User acknowledgment record for an announcement."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
    )
    announcement = models.ForeignKey(
        Announcement,
        on_delete=models.CASCADE,
        related_name="acknowledgments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="announcement_acknowledgments",
    )
    acknowledged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "messaging_announcement_ack"
        unique_together = ("announcement", "user")

    def __str__(self):
        return f"{self.user} acknowledged {self.announcement_id}"
