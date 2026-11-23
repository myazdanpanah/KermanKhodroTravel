import uuid
from django.db import models
from django.conf import settings
from .conversation import Conversation


class Channel(models.Model):
    """Named sub-space within a group or department conversation."""

    VISIBILITY_CHOICES = [
        ("GROUP", "Group"),
        ("PRIVATE", "Private"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
        related_name="messaging_channels",
        db_index=True,
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="channels",
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True, default="")
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default="GROUP")
    is_default = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_channels",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "messaging_channel"
        unique_together = [("conversation", "name"), ("conversation", "slug")]
        ordering = ["created_at"]

    def __str__(self):
        return f"#{self.name} ({self.conversation})"


class ChannelMembership(models.Model):
    """Explicit membership for private channels."""

    ROLE_CHOICES = [
        ("MODERATOR", "Moderator"),
        ("MEMBER", "Member"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
        related_name="messaging_channel_memberships",
    )
    channel = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="channel_memberships",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="MEMBER")
    joined_at = models.DateTimeField(auto_now_add=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "messaging_channel_membership"
        unique_together = ("channel", "user")

    def __str__(self):
        return f"{self.user} in {self.channel}"
