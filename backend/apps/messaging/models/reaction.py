import uuid
from django.db import models
from django.conf import settings
from .message import Message


class Reaction(models.Model):
    """Emoji reaction on a message."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
        related_name="messaging_reactions",
    )
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="message_reactions",
    )
    emoji = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "messaging_reaction"
        unique_together = ("message", "user", "emoji")
        indexes = [
            models.Index(fields=["message", "emoji"]),
        ]

    def __str__(self):
        return f"{self.user} reacted {self.emoji} on {self.message_id}"
