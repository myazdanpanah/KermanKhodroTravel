from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.messaging.models import (
    Conversation,
    ConversationMembership,
    Channel,
    Message,
    Attachment,
    Reaction,
    Announcement,
    AnnouncementAcknowledgment,
)

User = get_user_model()


class UserMinimalSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "avatar_url",
            "role",
            "department",
            "last_seen_at",
        ]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_avatar_url(self, obj):
        if getattr(obj, "avatar", None):
            try:
                return obj.avatar.url
            except Exception:
                return ""
        return ""


class AttachmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = [
            "id",
            "original_filename",
            "mime_type",
            "file_size",
            "status",
            "download_url",
            "created_at",
        ]

    def get_download_url(self, obj):
        return f"/api/v1/messaging/attachments/{obj.id}/download/"


class ReactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Reaction
        fields = ["id", "user_id", "username", "emoji", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    reactions = ReactionSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation_id",
            "channel_id",
            "sender",
            "message_type",
            "content",
            "content_format",
            "root_message_id",
            "reply_count",
            "sequence",
            "client_message_id",
            "metadata",
            "attachments",
            "reactions",
            "edited_at",
            "deleted_at",
            "created_at",
        ]


class ChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = [
            "id",
            "conversation_id",
            "name",
            "slug",
            "description",
            "visibility",
            "is_default",
            "is_archived",
            "created_at",
        ]


class ConversationMembershipSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ConversationMembership
        fields = [
            "id",
            "user",
            "role",
            "state",
            "is_pinned",
            "is_archived",
            "notifications_muted_until",
            "last_read_sequence",
            "last_read_at",
            "joined_at",
        ]


class ConversationListSerializer(serializers.ModelSerializer):
    unread_count = serializers.SerializerMethodField()
    is_pinned = serializers.SerializerMethodField()
    is_archived = serializers.SerializerMethodField()
    is_muted = serializers.SerializerMethodField()
    members_count = serializers.SerializerMethodField()
    other_user = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "kind",
            "title",
            "description",
            "avatar",
            "membership_mode",
            "is_private",
            "is_archived",
            "last_message_at",
            "last_message_preview",
            "unread_count",
            "is_pinned",
            "is_archived",
            "is_muted",
            "members_count",
            "other_user",
            "created_at",
        ]

    def _get_req_user(self):
        if self.context.get("request"):
            return getattr(self.context.get("request"), "user", None)
        return self.context.get("user")

    def _get_membership(self, obj):
        req_user = self._get_req_user()
        if not req_user or not getattr(req_user, "is_authenticated", False):
            return None
        # Use prefetched or cached attribute if available
        if hasattr(obj, "_user_membership"):
            return obj._user_membership
        return obj.memberships.filter(user=req_user).first()

    def get_unread_count(self, obj):
        m = self._get_membership(obj)
        if not m:
            return 0
        return obj.messages.filter(sequence__gt=m.last_read_sequence).exclude(sender=m.user).count()

    def get_is_pinned(self, obj):
        m = self._get_membership(obj)
        return m.is_pinned if m else False

    def get_is_archived(self, obj):
        m = self._get_membership(obj)
        return m.is_archived if m else False

    def get_is_muted(self, obj):
        m = self._get_membership(obj)
        if not m or not m.notifications_muted_until:
            return False
        from django.utils import timezone
        return m.notifications_muted_until > timezone.now()

    def get_members_count(self, obj):
        return obj.memberships.filter(state="ACTIVE").count()

    def get_other_user(self, obj):
        if obj.kind != "DIRECT":
            return None
        req_user = self._get_req_user()
        if not req_user or not getattr(req_user, "is_authenticated", False):
            return None
        other_m = obj.memberships.exclude(user=req_user).select_related("user").first()
        if other_m and other_m.user:
            return UserMinimalSerializer(other_m.user).data
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        req_user = self._get_req_user()
        if instance.kind == "DIRECT" and req_user and getattr(req_user, "is_authenticated", False):
            other_m = instance.memberships.exclude(user=req_user).select_related("user").first()
            if other_m and other_m.user:
                data["title"] = other_m.user.get_full_name() or other_m.user.username
        return data


class ConversationDetailSerializer(ConversationListSerializer):
    members = serializers.SerializerMethodField()
    channels = ChannelSerializer(many=True, read_only=True)

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ["members", "channels"]

    def get_members(self, obj):
        memberships = obj.memberships.filter(state="ACTIVE").select_related("user")
        return ConversationMembershipSerializer(memberships, many=True).data


class DirectConversationCreateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=True)


class GroupConversationCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=True)
    description = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
    member_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    kind = serializers.ChoiceField(choices=["GROUP", "DEPARTMENT", "PROJECT"], default="GROUP")
    division_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    is_private = serializers.BooleanField(default=True)


class MessageSendSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=20000, required=False, allow_blank=True, default="")
    content_format = serializers.ChoiceField(choices=["PLAIN", "SAFE_MARKDOWN"], default="PLAIN")
    message_type = serializers.ChoiceField(
        choices=["TEXT", "SYSTEM", "ANNOUNCEMENT", "ENTITY_LINK"], default="TEXT"
    )
    client_message_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    channel_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    root_message_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    attachment_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)
    metadata = serializers.JSONField(required=False, default=dict)


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by = UserMinimalSerializer(read_only=True)
    message = MessageSerializer(read_only=True)
    is_acknowledged = serializers.SerializerMethodField()
    acknowledgments_count = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            "id",
            "conversation_id",
            "scope_type",
            "priority",
            "publish_at",
            "expires_at",
            "requires_acknowledgment",
            "is_acknowledged",
            "acknowledgments_count",
            "created_by",
            "message",
            "created_at",
        ]

    def get_is_acknowledged(self, obj):
        req_user = self.context.get("request").user if self.context.get("request") else None
        if not req_user:
            return False
        return obj.acknowledgments.filter(user=req_user).exists()

    def get_acknowledgments_count(self, obj):
        return obj.acknowledgments.count()


class AnnouncementCreateSerializer(serializers.Serializer):
    conversation_id = serializers.UUIDField(required=True)
    content = serializers.CharField(max_length=20000, required=True)
    priority = serializers.ChoiceField(choices=["LOW", "NORMAL", "HIGH", "URGENT"], default="NORMAL")
    scope_type = serializers.ChoiceField(choices=["TENANT", "DEPARTMENT", "GROUP", "CHANNEL"], default="GROUP")
    requires_acknowledgment = serializers.BooleanField(default=False)
