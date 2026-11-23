from rest_framework import permissions
from apps.messaging.models import ConversationMembership


class IsActiveCompanyUser(permissions.BasePermission):
    """Ensure user is authenticated, active, and belongs to an active company."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and getattr(user, "company_id", None)
        )


class CanAccessConversation(permissions.BasePermission):
    """Ensure user belongs to the conversation's company and is an active member."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Must match company
        company_id = getattr(user, "company_id", None)
        if getattr(obj, "company_id", None) != company_id:
            return False

        # Admin override if company admin
        if getattr(user, "role", "") in ("admin", "ceo"):
            return True

        conversation = getattr(obj, "conversation", obj)
        return ConversationMembership.objects.filter(
            conversation=conversation,
            user=user,
            state="ACTIVE",
        ).exists()


class CanManageGroup(permissions.BasePermission):
    """Ensure user is an OWNER, MODERATOR, or company admin."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if getattr(user, "role", "") in ("admin", "ceo"):
            return True

        conversation = getattr(obj, "conversation", obj)
        membership = ConversationMembership.objects.filter(
            conversation=conversation,
            user=user,
            state="ACTIVE",
        ).first()

        if not membership:
            return False

        return membership.role in ("OWNER", "MODERATOR")
