import uuid
from django.db import models
from django.conf import settings
from apps.messaging.storage import messaging_attachment_storage
from .conversation import Conversation
from .message import Message


class Attachment(models.Model):
    """Secure private file attachment."""

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("AVAILABLE", "Available"),
        ("REJECTED", "Rejected"),
        ("DELETED", "Deleted"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
        related_name="messaging_attachments",
        db_index=True,
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="attachments",
        db_index=True,
    )
    message = models.ForeignKey(
        Message,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attachments",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="messaging_uploads",
    )
    file = models.FileField(storage=messaging_attachment_storage, upload_to="uploads/%Y/%m/%d/")
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120)
    file_size = models.BigIntegerField()
    checksum = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING", db_index=True)
    scan_status = models.CharField(max_length=20, default="CLEAN")
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "messaging_attachment"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.original_filename} ({self.file_size} bytes)"
