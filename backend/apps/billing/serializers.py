from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    ApprovalRequest,
    AvailableLetterNumber,
    CompanySettings,
    Credit,
    FinalFile,
    Invoice,
    InvoiceTemplate,
    LetterSequence,
    ManualDebt,
    Payer,
    Payment,
    ServiceCategory,
)


class PayerSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, default=None)
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = Payer
        fields = [
            "code", "name", "parent", "parent_name", "children_count",
            "national_id", "economic_code", "registration_number", "address",
            "postal_code", "phone", "mobile", "email", "customer_type", "is_active",
        ]

    def get_children_count(self, obj) -> int:
        return obj.children.count()

    def validate_code(self, value: str) -> str:
        if not value.isdigit() or not (1 <= len(value) <= 5):
            raise serializers.ValidationError("کد شرکت باید ۱ تا ۵ رقم باشد.")
        return value

    def validate(self, attrs):
        # Spec 5.6: a company set as its own parent is silently nulled by the
        # model, so no validation error is raised here.
        if self.instance and "code" in attrs and attrs["code"] != self.instance.pk:
            raise serializers.ValidationError({"code": "کد شرکت قابل تغییر نیست."})
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    issue_date_jalali = serializers.SerializerMethodField()
    file_id = serializers.SerializerMethodField()
    pdf_file_id = serializers.SerializerMethodField()
    letter_file_id = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id", "letter_number", "payer", "payer_code", "invoice_type",
            "amount", "issue_date", "issue_date_jalali", "file_path", "created_at", "file_id",
            "pdf_file_id", "letter_file_id", "items_count",
            "is_reversed", "reversed_at", "reversal_reason",
        ]
        read_only_fields = [
            "id", "created_at", "issue_date_jalali", "file_id",
            "pdf_file_id", "letter_file_id", "items_count",
            "is_reversed", "reversed_at", "reversal_reason",
        ]

    def get_file_id(self, obj):
        """Newest generated document for this letter, for the download button."""
        from .models import FinalFile

        match = FinalFile.objects.filter(letter_number=obj.letter_number).order_by("-id").first()
        return match.id if match else None

    def get_pdf_file_id(self, obj):
        from .models import FinalFile

        match = FinalFile.objects.filter(letter_number=obj.letter_number, file_name__endswith=".pdf").order_by("-id").first()
        return match.id if match else None

    def get_letter_file_id(self, obj):
        from .models import FinalFile

        match = FinalFile.objects.filter(letter_number=obj.letter_number, file_name__endswith=".docx").order_by("-id").first()
        return match.id if match else None

    def get_items_count(self, obj):
        return obj.items.count()

    def get_issue_date_jalali(self, obj) -> str:
        from .services.normalize import gregorian_to_persian

        return gregorian_to_persian(obj.issue_date)


class PaymentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id", "payment_code", "payer_code", "payer_name", "payment_date",
            "amount", "tracking_number", "description", "created_at", "created_by_name",
        ]
        read_only_fields = ["id", "created_at", "created_by_name"]

    def get_created_by_name(self, obj: Payment) -> str:
        return obj.created_by.username if obj.created_by_id else ""
        extra_kwargs = {"payer_code": {"required": False}, "payer_name": {"required": False}}

    def validate_amount(self, value: int) -> int:
        if value <= 0:
            raise serializers.ValidationError("مبلغ پرداخت باید بزرگ‌تر از صفر باشد.")
        return value

    def validate(self, attrs):
        code = attrs.get("payer_code") or (self.instance.payer_code if self.instance else "")
        payer = Payer.objects.filter(code=code).first()
        if payer is None:
            raise serializers.ValidationError({"payer_code": "شرکت با این کد یافت نشد."})
        attrs.setdefault("payer_name", payer.name)
        return attrs


class ManualDebtSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualDebt
        fields = ["id", "payer_code", "description", "amount", "date", "notes", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_amount(self, value: int) -> int:
        if value <= 0:
            raise serializers.ValidationError("مبلغ باید بزرگ‌تر از صفر باشد.")
        return value

    def validate_payer_code(self, value: str) -> str:
        if not Payer.objects.filter(code=value).exists():
            raise serializers.ValidationError("شرکت با این کد یافت نشد.")
        return value


class CreditSerializer(ManualDebtSerializer):
    class Meta(ManualDebtSerializer.Meta):
        model = Credit
        fields = ["id", "payer_code", "amount", "credit_date", "description", "invoice_number", "created_at"]
        read_only_fields = ["id", "created_at"]


class FinalFileSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = FinalFile
        fields = ["id", "service_type", "letter_number", "file_name", "file_path", "download_url", "created_at"]
        read_only_fields = fields

    def get_download_url(self, obj) -> str:
        return f"/api/v1/billing/files/{obj.id}/download"


class ApprovalRequestSerializer(serializers.ModelSerializer):
    files = FinalFileSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    requester_username = serializers.CharField(source="requester.username", read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = [
            "id", "requester", "requester_username", "requester_name", "payer_code", "payer_name",
            "service_type", "letter_number", "letter_date", "start_day", "end_day", "month", "year",
            "period_range", "service_data", "flight_data", "hotel_data", "reserved_numbers",
            "service_letters", "service_category",
            "status", "status_display", "rejection_reason", "approved_by", "approved_at",
            "generation_completed_at", "generation_error", "created_at", "files",
        ]
        read_only_fields = [
            "id", "requester", "requester_username", "requester_name", "status", "rejection_reason",
            "approved_by", "approved_at", "generation_completed_at", "generation_error",
            "created_at", "reserved_numbers", "service_letters",
        ]

    def validate_payer_code(self, value: str) -> str:
        if not Payer.objects.filter(code=value).exists():
            raise serializers.ValidationError("شرکت با این کد یافت نشد.")
        return value

    def validate(self, attrs):
        start = attrs.get("start_day")
        end = attrs.get("end_day")
        if start is not None and end is not None and start > end:
            raise serializers.ValidationError({"start_day": "روز شروع نمی‌تواند بعد از روز پایان باشد."})
        blocks = [attrs.get("service_data"), attrs.get("flight_data"), attrs.get("hotel_data")]
        if not any(blocks):
            raise serializers.ValidationError({"service_data": "هیچ ردیفی برای صدور وجود ندارد."})
        return attrs


class ServiceCategorySerializer(serializers.ModelSerializer):
    # Codes are technical keys: the UI only asks for the service name.
    code = serializers.CharField(max_length=20, required=False, allow_blank=True)

    class Meta:
        model = ServiceCategory
        fields = ["id", "parent", "name", "code", "is_active", "display_order", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        if not str(validated_data.get("code") or "").strip():
            base = f"SVC{ServiceCategory.objects.count() + 1}"
            code, suffix = base, 1
            while ServiceCategory.objects.filter(code=code).exists():
                suffix += 1
                code = f"{base}{suffix}"
            validated_data["code"] = code
        return super().create(validated_data)


class CompanySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanySettings
        exclude = ["id"]


class InvoiceTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceTemplate
        fields = [
            "id", "name", "description", "html_content", "css_content",
            "settings_json", "is_active", "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class LetterSequenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LetterSequence
        fields = ["payer_code", "year", "last_number"]


class AvailableLetterNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailableLetterNumber
        fields = ["payer_code", "year", "number"]
