import uuid
import hashlib
from django.db import models
from django.conf import settings


def generate_direct_key(company_id: int, user_a_id: int, user_b_id: int) -> str:
    """Generate deterministic SHA256 key for a canonical direct conversation between two users."""
    u1, u2 = sorted([int(user_a_id), int(user_b_id)])
    raw = f"{company_id}:{u1}:{u2}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class Conversation(models.Model):
    """Container for direct, group, department, or project chats."""

    KIND_CHOICES = [
        ("DIRECT", "Direct"),
        ("GROUP", "Group"),
        ("DEPARTMENT", "Department"),
        ("PROJECT", "Project"),
    ]

    MEMBERSHIP_MODE_CHOICES = [
        ("AUTO", "Auto"),
        ("MANUAL", "Manual"),
        ("HYBRID", "Hybrid"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
        related_name="messaging_conversations",
        db_index=True,
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="DIRECT", db_index=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, default="")
    avatar = models.CharField(max_length=500, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_conversations",
    )
    division = models.ForeignKey(
        "accounts.Division",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="messaging_conversations",
    )
    membership_mode = models.CharField(
        max_length=20,
        choices=MEMBERSHIP_MODE_CHOICES,
        default="AUTO",
    )
    is_private = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)
    direct_key = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_message_preview = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "messaging_conversation"
        ordering = ["-last_message_at", "-created_at"]
        indexes = [
            models.Index(fields=["company", "kind", "last_message_at"]),
            models.Index(fields=["company", "direct_key"]),
        ]

    def __str__(self):
        return self.title or f"{self.kind} ({self.id})"


class ConversationMembership(models.Model):
    """User membership, preferences, and read cursor inside a conversation."""

    ROLE_CHOICES = [
        ("OWNER", "Owner"),
        ("MODERATOR", "Moderator"),
        ("MEMBER", "Member"),
        ("READ_ONLY", "Read Only"),
    ]

    STATE_CHOICES = [
        ("ACTIVE", "Active"),
        ("INVITED", "Invited"),
        ("LEFT", "Left"),
        ("REMOVED", "Removed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
        related_name="messaging_memberships",
        db_index=True,
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversation_memberships",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="MEMBER")
    state = models.CharField(max_length=20, choices=STATE_CHOICES, default="ACTIVE", db_index=True)
    joined_at = models.DateTimeField(null=True, blank=True)
    left_at = models.DateTimeField(null=True, blank=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="added_conversation_members",
    )
    notifications_muted_until = models.DateTimeField(null=True, blank=True)
    is_pinned = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    last_read_message_id = models.UUIDField(null=True, blank=True)
    last_read_sequence = models.BigIntegerField(default=0)
    last_read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "messaging_membership"
        unique_together = ("conversation", "user")
        indexes = [
            models.Index(fields=["company", "user", "state"]),
            models.Index(fields=["conversation", "state"]),
        ]

    def __str__(self):
        return f"{self.user} in {self.conversation} ({self.role})"
