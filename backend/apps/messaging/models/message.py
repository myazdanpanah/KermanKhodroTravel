import uuid
from django.db import models
from django.conf import settings
from .conversation import Conversation
from .channel import Channel


class Message(models.Model):
    """Durable message record in PostgreSQL."""

    TYPE_CHOICES = [
        ("TEXT", "Text"),
        ("SYSTEM", "System"),
        ("ANNOUNCEMENT", "Announcement"),
        ("ENTITY_LINK", "Entity Link"),
    ]

    FORMAT_CHOICES = [
        ("PLAIN", "Plain Text"),
        ("SAFE_MARKDOWN", "Safe Markdown"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
        related_name="messaging_messages",
        db_index=True,
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
        db_index=True,
    )
    channel = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_messages",
    )
    message_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="TEXT")
    content = models.TextField(blank=True, default="")
    content_format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default="PLAIN")
    root_message = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )
    reply_count = models.IntegerField(default=0)
    client_message_id = models.UUIDField(null=True, blank=True, db_index=True)
    sequence = models.BigIntegerField(default=0, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "messaging_message"
        ordering = ["sequence", "created_at"]
        indexes = [
            models.Index(fields=["company", "conversation", "sequence"]),
            models.Index(fields=["company", "conversation", "created_at"]),
            models.Index(fields=["company", "sender", "created_at"]),
        ]

    def __str__(self):
        snippet = (self.content[:30] + "...") if len(self.content) > 30 else self.content
        return f"Msg {self.id} by {self.sender}: {snippet}"


class MessageRevision(models.Model):
    """Audit log of message edits."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="revisions")
    editor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    previous_content = models.TextField()
    revised_at = models.DateTimeField(auto_now_add=True)
    revision_number = models.IntegerField(default=1)

    class Meta:
        db_table = "messaging_message_revision"
        ordering = ["-revised_at"]
