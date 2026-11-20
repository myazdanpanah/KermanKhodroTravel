"""Office serializers — output shapes and strict input validation."""

from rest_framework import serializers

from .models import (
    Correspondence,
    CorrespondenceAction,
    CorrespondenceComment,
    CorrespondenceRecipient,
    CorrespondenceRoute,
    Secretariat,
    SecretariatMember,
)


class SecretariatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Secretariat
        fields = ["id", "name", "code", "is_active"]


class SecretariatMemberSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = SecretariatMember
        fields = ["id", "user", "user_name", "can_register", "created_at"]

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class RecipientSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="recipient_user.get_full_name", read_only=True, default="")
    team_name = serializers.CharField(source="recipient_team.name", read_only=True, default="")
    division_name = serializers.CharField(source="recipient_division.name", read_only=True, default="")

    class Meta:
        model = CorrespondenceRecipient
        fields = [
            "id", "recipient_type", "recipient_user", "user_name", "recipient_team", "team_name",
            "recipient_division", "division_name", "external_name", "external_email",
            "delivery_type", "delivery_status", "delivered_at", "read_at",
        ]


class RouteSerializer(serializers.ModelSerializer):
    from_user_name = serializers.SerializerMethodField()
    to_user_name = serializers.SerializerMethodField()

    class Meta:
        model = CorrespondenceRoute
        fields = [
            "id", "from_user", "from_user_name", "to_user", "to_user_name", "to_team", "to_division",
            "route_type", "instruction", "assigned_at", "due_at", "accepted_at", "completed_at",
            "route_status",
        ]

    def get_from_user_name(self, obj):
        return obj.from_user.get_full_name() if obj.from_user_id else ""

    def get_to_user_name(self, obj):
        return obj.to_user.get_full_name() if obj.to_user_id else ""


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = CorrespondenceComment
        fields = ["id", "author", "author_name", "body", "is_internal", "created_at"]

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username if obj.author_id else ""


class ActionSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = CorrespondenceAction
        fields = ["id", "actor", "actor_name", "action", "note", "metadata", "created_at"]

    def get_actor_name(self, obj):
        return obj.actor.get_full_name() or obj.actor.username if obj.actor_id else ""


class CorrespondenceListSerializer(serializers.ModelSerializer):
    secretariat_name = serializers.CharField(source="secretariat.name", read_only=True, default="")
    owner_name = serializers.SerializerMethodField()
    sender_display = serializers.SerializerMethodField()

    class Meta:
        model = Correspondence
        fields = [
            "id", "registration_number", "registration_status", "correspondence_type", "subject",
            "priority", "confidentiality", "current_status", "due_at", "created_at", "updated_at",
            "secretariat", "secretariat_name", "owner", "owner_name", "sender_display",
            "archived_at", "letter_date_jalali",
        ]

    def get_owner_name(self, obj):
        return obj.owner.get_full_name() or obj.owner.username if obj.owner_id else ""

    def get_sender_display(self, obj):
        if obj.sender_type == "internal" and obj.sender_user_id:
            return obj.sender_user.get_full_name() or obj.sender_user.username
        return obj.sender_organization or obj.sender_name


class CorrespondenceDetailSerializer(CorrespondenceListSerializer):
    recipients = RecipientSerializer(many=True, read_only=True)
    routes = RouteSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    actions = ActionSerializer(many=True, read_only=True)
    registered_by_name = serializers.SerializerMethodField()
    parent_subject = serializers.CharField(source="parent_correspondence.subject", read_only=True, default="")

    class Meta(CorrespondenceListSerializer.Meta):
        fields = CorrespondenceListSerializer.Meta.fields + [
            "body", "sender_type", "sender_user", "sender_name", "sender_organization", "sender_email",
            "letter_date", "received_at", "registered_at", "registered_by", "registered_by_name",
            "registration_year", "registration_sequence", "parent_correspondence", "parent_subject",
            "recipients", "routes", "comments", "actions",
        ]

    def get_registered_by_name(self, obj):
        return obj.registered_by.get_full_name() if obj.registered_by_id else ""


class CorrespondenceCreateSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=300)
    body = serializers.CharField(required=False, allow_blank=True, default="")
    correspondence_type = serializers.ChoiceField(choices=Correspondence.TYPE_CHOICES, default="internal")
    secretariat_id = serializers.IntegerField(required=False, allow_null=True)
    priority = serializers.ChoiceField(choices=Correspondence.PRIORITY_CHOICES, default="normal")
    confidentiality = serializers.ChoiceField(choices=Correspondence.CONFIDENTIALITY_CHOICES, default="normal")
    sender_type = serializers.ChoiceField(choices=Correspondence.SENDER_CHOICES, default="internal")
    sender_name = serializers.CharField(required=False, allow_blank=True, default="")
    sender_organization = serializers.CharField(required=False, allow_blank=True, default="")
    sender_email = serializers.EmailField(required=False, allow_blank=True, default="")
    letter_date = serializers.DateField(required=False, allow_null=True)
    letter_date_jalali = serializers.CharField(required=False, allow_blank=True, max_length=10, default="")
    due_at = serializers.DateTimeField(required=False, allow_null=True)
    owner_id = serializers.IntegerField(required=False, allow_null=True)
    recipients = serializers.ListField(child=serializers.DictField(), required=False, default=list)

    def validate_recipients(self, value):
        for item in value:
            if item.get("recipient_type") not in {"user", "team", "division", "external"}:
                raise serializers.ValidationError("نوع گیرنده نامعتبر است")
        return value
