"""Office serializers — output shapes and strict input validation."""

from rest_framework import serializers

from .models import (
    Correspondence,
    CorrespondenceAction,
    CorrespondenceAttachment,
    CorrespondenceComment,
    CorrespondenceRecipient,
    CorrespondenceRoute,
    Secretariat,
    SecretariatMember,
)


class SecretariatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Secretariat
        fields = [
            "id", "name", "code", "is_active", "number_pattern", "sequence_padding",
            "persian_digits", "type_letters",
        ]


class SecretariatNumberingSerializer(serializers.ModelSerializer):
    """Only the numbering rules; admins and the secretariat's members edit these."""

    class Meta:
        model = Secretariat
        fields = ["number_pattern", "sequence_padding", "persian_digits", "type_letters"]

    def validate_number_pattern(self, value):
        pattern = (value or "").strip()
        if "{seq}" not in pattern:
            raise serializers.ValidationError("الگوی شماره باید شامل {seq} باشد")
        try:
            pattern.format(year=1404, code="X", type="O", seq="000001")
        except (KeyError, IndexError, ValueError):
            raise serializers.ValidationError("فقط جای‌نگهدارهای {year}، {code}، {type} و {seq} مجاز هستند")
        return pattern

    def validate_sequence_padding(self, value):
        if not 3 <= value <= 10:
            raise serializers.ValidationError("تعداد ارقام شماره باید بین ۳ و ۱۰ باشد")
        return value

    def validate_type_letters(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("حروف نوع نامه باید به صورت نگاشت ارسال شود")
        allowed = {"incoming", "outgoing", "internal"}
        for key, letter in value.items():
            if key not in allowed:
                raise serializers.ValidationError(f"نوع نامعتبر: {key}")
            if not isinstance(letter, str) or len(letter.strip()) > 3:
                raise serializers.ValidationError("حرف هر نوع نامه باید حداکثر ۳ نویسه باشد")
        return value


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


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CorrespondenceAttachment
        fields = [
            "id", "original_name", "content_type", "size_bytes", "checksum",
            "uploaded_by", "uploaded_by_name", "created_at",
        ]

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by_id:
            return ""
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.username


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
    attachments = AttachmentSerializer(many=True, read_only=True)
    registered_by_name = serializers.SerializerMethodField()
    parent_subject = serializers.CharField(source="parent_correspondence.subject", read_only=True, default="")

    class Meta(CorrespondenceListSerializer.Meta):
        fields = CorrespondenceListSerializer.Meta.fields + [
            "body", "sender_type", "sender_user", "sender_name", "sender_organization", "sender_email",
            "letter_date", "received_at", "registered_at", "registered_by", "registered_by_name",
            "registration_year", "registration_sequence", "parent_correspondence", "parent_subject",
            "recipients", "routes", "comments", "actions", "attachments",
        ]

    def get_registered_by_name(self, obj):
        return obj.registered_by.get_full_name() if obj.registered_by_id else ""


class DraftUpdateSerializer(serializers.Serializer):
    """Validated fields a draft may change through PATCH."""

    subject = serializers.CharField(max_length=300, required=False)
    body = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(choices=Correspondence.PRIORITY_CHOICES, required=False)
    confidentiality = serializers.ChoiceField(
        choices=Correspondence.CONFIDENTIALITY_CHOICES, required=False,
    )
    due_at = serializers.DateTimeField(required=False, allow_null=True)
    letter_date = serializers.DateField(required=False, allow_null=True)
    letter_date_jalali = serializers.CharField(
        max_length=10, allow_blank=True, required=False,
    )
    sender_name = serializers.CharField(max_length=200, allow_blank=True, required=False)
    sender_organization = serializers.CharField(max_length=200, allow_blank=True, required=False)
    sender_email = serializers.EmailField(allow_blank=True, required=False)
    recipients = serializers.ListField(child=serializers.DictField(), required=False)

    def validate_subject(self, value):
        if not value.strip():
            raise serializers.ValidationError("موضوع نامه نمی‌تواند خالی باشد")
        return value.strip()

    def validate_recipients(self, value):
        allowed_types = {"user", "team", "division", "external"}
        allowed_delivery = {"primary", "cc", "bcc", "action_required", "information"}
        for item in value:
            if item.get("recipient_type", "user") not in allowed_types:
                raise serializers.ValidationError("نوع گیرنده نامعتبر است")
            if item.get("delivery_type", "primary") not in allowed_delivery:
                raise serializers.ValidationError("نحوه ارسال به گیرنده نامعتبر است")
        return value


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
