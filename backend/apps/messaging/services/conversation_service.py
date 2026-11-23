import uuid
from typing import List, Optional
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.messaging.models import (
    Conversation,
    ConversationMembership,
    generate_direct_key,
    Channel,
    Message,
)
from apps.audit_log.models import AuditLog

User = get_user_model()


def get_or_create_direct_conversation(company_id: int, user_a: User, user_b: User) -> tuple[Conversation, bool]:
    """Retrieve or atomically create the canonical 1-to-1 conversation between two users in the same company."""
    if user_a.id == user_b.id:
        raise ValueError("Cannot create a direct conversation with yourself.")
    if user_a.company_id != company_id or user_b.company_id != company_id:
        raise PermissionError("Users must belong to the specified company.")

    key = generate_direct_key(company_id, user_a.id, user_b.id)

    with transaction.atomic():
        # Select for update if exists to prevent duplicate creation
        conv = Conversation.objects.filter(company_id=company_id, direct_key=key).first()
        if conv:
            # Ensure both memberships exist and are active
            for u in (user_a, user_b):
                ConversationMembership.objects.update_or_create(
                    conversation=conv,
                    user=u,
                    defaults={
                        "company_id": company_id,
                        "state": "ACTIVE",
                        "role": "MEMBER",
                    },
                )
            return conv, False

        title = f"{user_a.get_full_name() or user_a.username} & {user_b.get_full_name() or user_b.username}"
        conv = Conversation.objects.create(
            company_id=company_id,
            kind="DIRECT",
            title=title,
            created_by=user_a,
            direct_key=key,
            is_private=True,
        )

        ConversationMembership.objects.create(
            company_id=company_id,
            conversation=conv,
            user=user_a,
            role="MEMBER",
            state="ACTIVE",
            joined_at=timezone.now(),
        )
        ConversationMembership.objects.create(
            company_id=company_id,
            conversation=conv,
            user=user_b,
            role="MEMBER",
            state="ACTIVE",
            joined_at=timezone.now(),
        )

        try:
            from django.contrib.contenttypes.models import ContentType
            AuditLog.objects.create(
                action="create",
                user=user_a,
                content_type=ContentType.objects.get_for_model(Conversation),
                object_id=str(conv.id),
                description=f"Direct conversation created between {user_a.username} and {user_b.username}",
            )
        except Exception:
            pass

        return conv, True


def create_group_conversation(
    company_id: int,
    creator: User,
    title: str,
    description: str = "",
    member_ids: Optional[List[int]] = None,
    kind: str = "GROUP",
    division_id: Optional[int] = None,
    is_private: bool = True,
) -> Conversation:
    """Create a new group, department, or project conversation with an owner and initial members."""
    with transaction.atomic():
        conv = Conversation.objects.create(
            company_id=company_id,
            kind=kind,
            title=title,
            description=description,
            created_by=creator,
            division_id=division_id,
            is_private=is_private,
        )

        # Creator is OWNER
        ConversationMembership.objects.create(
            company_id=company_id,
            conversation=conv,
            user=creator,
            role="OWNER",
            state="ACTIVE",
            joined_at=timezone.now(),
        )

        # Create default 'general' channel for groups
        Channel.objects.create(
            company_id=company_id,
            conversation=conv,
            name="عمومی",
            slug="general",
            description="کانال گفتگوی عمومی گروه",
            is_default=True,
            created_by=creator,
        )

        # Add initial members from same company
        if member_ids:
            users_to_add = User.objects.filter(
                id__in=member_ids,
                company_id=company_id,
                is_active=True,
            ).exclude(id=creator.id)

            for u in users_to_add:
                ConversationMembership.objects.create(
                    company_id=company_id,
                    conversation=conv,
                    user=u,
                    role="MEMBER",
                    state="ACTIVE",
                    joined_at=timezone.now(),
                    added_by=creator,
                )

        # Create system welcome message
        Message.objects.create(
            company_id=company_id,
            conversation=conv,
            sender=None,
            message_type="SYSTEM",
            content=f"گروه «{title}» توسط {creator.get_full_name() or creator.username} ایجاد شد.",
            sequence=1,
        )

        try:
            from django.contrib.contenttypes.models import ContentType
            AuditLog.objects.create(
                action="create",
                user=creator,
                content_type=ContentType.objects.get_for_model(Conversation),
                object_id=str(conv.id),
                description=f"Group conversation «{title}» created by {creator.username}",
            )
        except Exception:
            pass

        return conv


def sync_department_conversation(division_id: int) -> Conversation:
    """Idempotently synchronize department group members from active users in Division."""
    from apps.accounts.models import Division
    division = Division.objects.get(id=division_id)
    company_id = division.company_id

    with transaction.atomic():
        conv, created = Conversation.objects.get_or_create(
            company_id=company_id,
            division_id=division.id,
            kind="DEPARTMENT",
            defaults={
                "title": f"دپارتمان {division.name}",
                "description": division.description or f"گروه رسمی دپارتمان {division.name}",
                "membership_mode": "AUTO",
                "is_private": True,
            },
        )

        if created:
            Channel.objects.create(
                company_id=company_id,
                conversation=conv,
                name="عمومی",
                slug="general",
                is_default=True,
            )

        # Find active users in this division
        active_users = User.objects.filter(division=division, company_id=company_id, is_active=True)
        active_user_ids = set(active_users.values_list("id", flat=True))

        # Existing memberships
        existing_memberships = {
            m.user_id: m for m in ConversationMembership.objects.filter(conversation=conv)
        }

        # Add or reactivate
        for user in active_users:
            role = "OWNER" if (division.manager_id == user.id) else "MEMBER"
            if user.id in existing_memberships:
                m = existing_memberships[user.id]
                if m.state != "ACTIVE" or (division.manager_id == user.id and m.role != "OWNER"):
                    m.state = "ACTIVE"
                    if division.manager_id == user.id:
                        m.role = "OWNER"
                    m.left_at = None
                    m.save(update_fields=["state", "role", "left_at", "updated_at"])
            else:
                ConversationMembership.objects.create(
                    company_id=company_id,
                    conversation=conv,
                    user=user,
                    role=role,
                    state="ACTIVE",
                    joined_at=timezone.now(),
                )

        # Deactivate members no longer in division if AUTO mode
        if conv.membership_mode == "AUTO":
            for uid, m in existing_memberships.items():
                if uid not in active_user_ids and m.state == "ACTIVE":
                    m.state = "LEFT"
                    m.left_at = timezone.now()
                    m.save(update_fields=["state", "left_at", "updated_at"])

        return conv
