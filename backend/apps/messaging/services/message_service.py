import uuid
from typing import Optional, List
from django.db import transaction, models
from django.utils import timezone
from django.conf import settings
from apps.messaging.models import (
    Conversation,
    ConversationMembership,
    Channel,
    Message,
    MessageRevision,
    Attachment,
    Reaction,
)
from apps.dashboards.models import Notification
from apps.audit_log.models import AuditLog

try:
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
except ImportError:
    get_channel_layer = lambda: None
    async_to_sync = lambda f: f


def broadcast_event(group_name: str, event_type: str, payload: dict):
    """Safely dispatch WebSocket event across all workers via Redis channel layer."""
    channel_layer = get_channel_layer()
    if channel_layer:
        try:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "messaging_event",
                    "event": {
                        "type": event_type,
                        "occurred_at": timezone.now().isoformat(),
                        "payload": payload,
                    },
                },
            )
        except Exception:
            # Redis temporary failure must not crash the database transaction
            pass


def send_message(
    company_id: int,
    sender,
    conversation_id: uuid.UUID,
    content: str,
    client_message_id: Optional[uuid.UUID] = None,
    channel_id: Optional[uuid.UUID] = None,
    root_message_id: Optional[uuid.UUID] = None,
    attachment_ids: Optional[List[uuid.UUID]] = None,
    message_type: str = "TEXT",
    content_format: str = "PLAIN",
    metadata: Optional[dict] = None,
) -> Message:
    """Durably persist message in PostgreSQL, assign monotonic sequence, and broadcast."""
    # 1. Verify conversation & company
    conv = Conversation.objects.filter(id=conversation_id, company_id=company_id).first()
    if not conv:
        raise PermissionError("Conversation not found or access denied.")

    # 2. Check sender membership
    membership = ConversationMembership.objects.filter(
        conversation=conv,
        user=sender,
        state="ACTIVE",
    ).first()

    if not membership:
        raise PermissionError("You are not an active member of this conversation.")
    if membership.role == "READ_ONLY":
        raise PermissionError("You have read-only access to this conversation.")

    # 3. Check idempotency
    if client_message_id:
        existing = Message.objects.filter(
            company_id=company_id,
            conversation=conv,
            client_message_id=client_message_id,
        ).first()
        if existing:
            return existing

    # 4. Message length check
    max_len = getattr(settings, "NEXIVO_MESSAGING_MAX_MESSAGE_LENGTH", 20000)
    if len(content) > max_len:
        raise ValueError(f"Message exceeds maximum allowed length of {max_len} characters.")

    with transaction.atomic():
        # Lock conversation row to get next monotonic sequence
        locked_conv = Conversation.objects.select_for_update().get(id=conv.id)
        last_seq = (
            Message.objects.filter(conversation=locked_conv)
            .aggregate(max_s=models.Max("sequence"))["max_s"]
            or 0
        )
        new_seq = last_seq + 1

        # Check channel if provided
        channel = None
        if channel_id:
            channel = Channel.objects.filter(id=channel_id, conversation=locked_conv).first()

        # Check root message if replying
        root_msg = None
        if root_message_id:
            root_msg = Message.objects.filter(id=root_message_id, conversation=locked_conv).first()
            if root_msg:
                Message.objects.filter(id=root_msg.id).update(
                    reply_count=models.F("reply_count") + 1
                )

        # Create message
        msg = Message.objects.create(
            company_id=company_id,
            conversation=locked_conv,
            channel=channel,
            sender=sender,
            message_type=message_type,
            content=content,
            content_format=content_format,
            root_message=root_msg,
            client_message_id=client_message_id,
            sequence=new_seq,
            metadata=metadata or {},
        )

        # Attach uploaded files
        if attachment_ids:
            Attachment.objects.filter(
                id__in=attachment_ids,
                company_id=company_id,
                conversation=locked_conv,
                uploaded_by=sender,
            ).update(message=msg, status="AVAILABLE")

        # Update conversation preview
        preview = (content[:100] + "...") if len(content) > 100 else content
        if not preview and metadata and metadata.get("title"):
            preview = f"[{metadata.get('badge', 'پیوست')}] {metadata.get('title')}"
        if not preview:
            preview = "پیوست جدید"
        locked_conv.last_message_at = timezone.now()
        locked_conv.last_message_preview = preview
        locked_conv.save(update_fields=["last_message_at", "last_message_preview", "updated_at"])

        # Advance sender's read cursor to this message
        membership.last_read_message_id = msg.id
        membership.last_read_sequence = new_seq
        membership.last_read_at = timezone.now()
        membership.save(update_fields=["last_read_message_id", "last_read_sequence", "last_read_at"])

        # Create notifications for active members (excluding sender)
        recipients = ConversationMembership.objects.filter(
            conversation=locked_conv,
            state="ACTIVE",
        ).exclude(user=sender)

        now = timezone.now()
        sender_name = sender.get_full_name() or sender.username
        notif_title = f"پیام جدید از {sender_name}"
        if locked_conv.kind != "DIRECT":
            notif_title = f"پیام جدید در {locked_conv.title}"

        notif_objs = []
        for m in recipients:
            # Respect mute setting
            if m.notifications_muted_until and m.notifications_muted_until > now:
                continue
            notif_objs.append(
                Notification(
                    recipient=m.user,
                    notification_type="new_message",
                    title=notif_title,
                    message=preview,
                    target_type="messaging",
                    target_id=str(locked_conv.id),
                )
            )
        if notif_objs:
            Notification.objects.bulk_create(notif_objs)

        # Payload for broadcast
        payload = {
            "id": str(msg.id),
            "conversation_id": str(locked_conv.id),
            "channel_id": str(channel.id) if channel else None,
            "sender": {
                "id": sender.id,
                "username": sender.username,
                "full_name": sender.get_full_name() or sender.username,
                "avatar": getattr(sender.avatar, "url", "") if getattr(sender, "avatar", None) else "",
            },
            "message_type": msg.message_type,
            "content": msg.content,
            "content_format": msg.content_format,
            "root_message_id": str(root_msg.id) if root_msg else None,
            "sequence": msg.sequence,
            "metadata": msg.metadata,
            "created_at": msg.created_at.isoformat(),
        }

        # Safe dispatch on commit
        group_name = f"messaging_conv_{locked_conv.id}"
        transaction.on_commit(
            lambda: broadcast_event(group_name, "message.created", payload)
        )

        return msg


def edit_message(user, message_id: uuid.UUID, new_content: str) -> Message:
    """Edit message within policy window and log revision."""
    msg = Message.objects.select_related("conversation").get(id=message_id)

    if msg.sender_id != user.id:
        raise PermissionError("You can only edit your own messages.")
    if msg.deleted_at:
        raise ValueError("Cannot edit a deleted message.")

    # Check edit window
    window_minutes = getattr(settings, "NEXIVO_MESSAGING_EDIT_WINDOW_MINUTES", 15)
    elapsed = (timezone.now() - msg.created_at).total_seconds() / 60
    if elapsed > window_minutes:
        raise ValueError(f"Message can only be edited within {window_minutes} minutes.")

    with transaction.atomic():
        # Store revision
        rev_count = MessageRevision.objects.filter(message=msg).count() + 1
        MessageRevision.objects.create(
            company=msg.company,
            message=msg,
            editor=user,
            previous_content=msg.content,
            revision_number=rev_count,
        )

        msg.content = new_content
        msg.edited_at = timezone.now()
        msg.save(update_fields=["content", "edited_at", "updated_at"])

        payload = {
            "id": str(msg.id),
            "conversation_id": str(msg.conversation_id),
            "content": msg.content,
            "edited_at": msg.edited_at.isoformat(),
        }
        group_name = f"messaging_conv_{msg.conversation_id}"
        transaction.on_commit(
            lambda: broadcast_event(group_name, "message.updated", payload)
        )

    return msg


def delete_message(user, message_id: uuid.UUID) -> Message:
    """Soft-delete message with tombstone per spec §4.15."""
    msg = Message.objects.select_related("conversation").get(id=message_id)

    can_delete = False
    if msg.sender_id == user.id:
        can_delete = True
    else:
        # Check moderator or admin
        membership = ConversationMembership.objects.filter(
            conversation=msg.conversation,
            user=user,
            state="ACTIVE",
        ).first()
        if membership and membership.role in ("OWNER", "MODERATOR"):
            can_delete = True
        elif getattr(user, "role", "") in ("admin", "ceo"):
            can_delete = True

    if not can_delete:
        raise PermissionError("You do not have permission to delete this message.")

    with transaction.atomic():
        msg.deleted_at = timezone.now()
        msg.content = "این پیام حذف شده است."
        msg.save(update_fields=["deleted_at", "content", "updated_at"])

        # Also soft-delete associated attachments
        Attachment.objects.filter(message=msg).update(
            status="DELETED",
            deleted_at=timezone.now(),
        )

        try:
            from django.contrib.contenttypes.models import ContentType
            AuditLog.objects.create(
                action="delete",
                user=user,
                content_type=ContentType.objects.get_for_model(Message),
                object_id=str(msg.id),
                description=f"Message {msg.id} deleted by {user.username}",
            )
        except Exception:
            pass

        payload = {
            "id": str(msg.id),
            "conversation_id": str(msg.conversation_id),
            "deleted_at": msg.deleted_at.isoformat(),
        }
        group_name = f"messaging_conv_{msg.conversation_id}"
        transaction.on_commit(
            lambda: broadcast_event(group_name, "message.deleted", payload)
        )

    return msg


def add_reaction(user, message_id: uuid.UUID, emoji: str) -> Reaction:
    """Add emoji reaction and broadcast."""
    msg = Message.objects.select_related("conversation").get(id=message_id)

    # Check membership
    if not ConversationMembership.objects.filter(
        conversation=msg.conversation, user=user, state="ACTIVE"
    ).exists():
        raise PermissionError("Cannot react to messages in a conversation you are not part of.")

    reaction, created = Reaction.objects.get_or_create(
        company=msg.company,
        message=msg,
        user=user,
        emoji=emoji,
    )

    payload = {
        "message_id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "user_id": user.id,
        "emoji": emoji,
        "action": "added",
    }
    group_name = f"messaging_conv_{msg.conversation_id}"
    transaction.on_commit(
        lambda: broadcast_event(group_name, "message.reaction.updated", payload)
    )

    return reaction


def remove_reaction(user, reaction_id: uuid.UUID):
    """Remove user's emoji reaction and broadcast."""
    reaction = Reaction.objects.select_related("message").get(id=reaction_id)
    if reaction.user_id != user.id:
        raise PermissionError("Cannot remove another user's reaction.")

    msg = reaction.message
    emoji = reaction.emoji
    reaction.delete()

    payload = {
        "message_id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "user_id": user.id,
        "emoji": emoji,
        "action": "removed",
    }
    group_name = f"messaging_conv_{msg.conversation_id}"
    transaction.on_commit(
        lambda: broadcast_event(group_name, "message.reaction.updated", payload)
    )


def advance_read_cursor(user, message_id: uuid.UUID) -> ConversationMembership:
    """Advance reader cursor in conversation."""
    msg = Message.objects.select_related("conversation").get(id=message_id)
    membership = ConversationMembership.objects.filter(
        conversation=msg.conversation,
        user=user,
        state="ACTIVE",
    ).first()

    if not membership:
        raise PermissionError("User is not an active member.")

    if msg.sequence > membership.last_read_sequence:
        membership.last_read_message_id = msg.id
        membership.last_read_sequence = msg.sequence
        membership.last_read_at = timezone.now()
        membership.save(update_fields=["last_read_message_id", "last_read_sequence", "last_read_at"])

        payload = {
            "conversation_id": str(msg.conversation_id),
            "user_id": user.id,
            "last_read_sequence": msg.sequence,
            "last_read_message_id": str(msg.id),
        }
        group_name = f"messaging_conv_{msg.conversation_id}"
        transaction.on_commit(
            lambda: broadcast_event(group_name, "message.read.updated", payload)
        )

    return membership
