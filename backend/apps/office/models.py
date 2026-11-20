"""
Nexivo Office — correspondence, secretariat and business-record links.

Office owns its own records; customers, invoices, receipts and CRM records
stay in the business domain and are referenced by (entity_type, id) only.
No foreign key crosses into finance or CRM, so the Office domain can later
move to its own database without a schema rewrite.
"""

from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel

from .storage import attachment_storage


class Secretariat(BaseModel):
    """A registration desk that owns a numbering sequence."""

    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, help_text="Short code used in registration numbers")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="uniq_secretariat_code"),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class SecretariatMember(models.Model):
    """Who may act for a secretariat, and whether they may register letters."""

    secretariat = models.ForeignKey(Secretariat, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="office_secretariats",
    )
    can_register = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["secretariat", "user"], name="uniq_secretariat_member"),
        ]

    def __str__(self):
        return f"{self.user} @ {self.secretariat}"


class SecretariatNumberSequence(models.Model):
    """Per company/secretariat/type/year counter, locked during allocation."""

    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="office_number_sequences")
    secretariat = models.ForeignKey(Secretariat, on_delete=models.CASCADE, related_name="sequences")
    correspondence_type = models.CharField(max_length=20)
    year = models.IntegerField()
    last_number = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["secretariat", "correspondence_type", "year"],
                name="uniq_number_sequence",
            ),
        ]

    def __str__(self):
        return f"{self.secretariat.code}/{self.correspondence_type}/{self.year}: {self.last_number}"


class Correspondence(BaseModel):
    """A letter: incoming, outgoing or internal."""

    TYPE_CHOICES = [
        ("incoming", "وارده"),
        ("outgoing", "صادره"),
        ("internal", "داخلی"),
    ]
    REGISTRATION_CHOICES = [
        ("draft", "پیش‌نویس"),
        ("registered", "ثبت‌شده"),
        ("cancelled", "لغو‌شده"),
    ]
    STATUS_CHOICES = [
        ("open", "باز"),
        ("in_progress", "در جریان"),
        ("awaiting_reply", "در انتظار پاسخ"),
        ("answered", "پاسخ داده‌شده"),
        ("closed", "بسته‌شده"),
    ]
    PRIORITY_CHOICES = [
        ("low", "کم"),
        ("normal", "عادی"),
        ("high", "زیاد"),
        ("urgent", "فوری"),
    ]
    CONFIDENTIALITY_CHOICES = [
        ("normal", "عادی"),
        ("confidential", "محرمانه"),
        ("highly_confidential", "خیلی محرمانه"),
        ("restricted", "محدود"),
    ]
    SENDER_CHOICES = [
        ("internal", "کاربر داخلی"),
        ("external", "فرستنده بیرونی"),
    ]

    secretariat = models.ForeignKey(
        Secretariat, on_delete=models.SET_NULL, null=True, blank=True, related_name="correspondence",
    )
    correspondence_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="internal")
    registration_status = models.CharField(max_length=20, choices=REGISTRATION_CHOICES, default="draft")

    registration_number = models.CharField(max_length=50, null=True, blank=True)
    registration_year = models.IntegerField(null=True, blank=True)
    registration_sequence = models.IntegerField(null=True, blank=True)
    registered_at = models.DateTimeField(null=True, blank=True)
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="registered_correspondence",
    )

    subject = models.CharField(max_length=300)
    body = models.TextField(blank=True, default="")

    sender_type = models.CharField(max_length=10, choices=SENDER_CHOICES, default="internal")
    sender_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sent_correspondence",
    )
    sender_name = models.CharField(max_length=200, blank=True, default="")
    sender_organization = models.CharField(max_length=200, blank=True, default="")
    sender_email = models.EmailField(blank=True, default="")

    letter_date = models.DateField(null=True, blank=True)
    letter_date_jalali = models.CharField(max_length=10, blank=True, default="")
    received_at = models.DateTimeField(null=True, blank=True)

    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="normal")
    confidentiality = models.CharField(max_length=20, choices=CONFIDENTIALITY_CHOICES, default="normal")
    current_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")

    due_at = models.DateTimeField(null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="owned_correspondence",
    )
    parent_correspondence = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replies",
    )
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "current_status"]),
            models.Index(fields=["company", "correspondence_type"]),
            models.Index(fields=["company", "registration_number"]),
            models.Index(fields=["company", "due_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "registration_number"],
                name="uniq_correspondence_registration_number",
            ),
        ]

    def __str__(self):
        label = self.registration_number or "پیش‌نویس"
        return f"{label} — {self.subject}"


def attachment_upload_to(instance, filename):
    """Random storage name: the user-supplied name never becomes a path."""
    suffix = Path(filename).suffix.lower()
    return f"company_{instance.company_id}/{instance.correspondence_id}/{uuid4().hex}{suffix}"


class CorrespondenceAttachment(models.Model):
    """A private file attached to a letter, reachable only through the API."""

    correspondence = models.ForeignKey(
        Correspondence, on_delete=models.CASCADE, related_name="attachments",
    )
    company = models.ForeignKey(
        "accounts.Company", on_delete=models.CASCADE, related_name="office_attachments",
    )
    file = models.FileField(storage=attachment_storage, upload_to=attachment_upload_to, max_length=255)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True, default="")
    size_bytes = models.PositiveBigIntegerField(default=0)
    checksum = models.CharField(max_length=64, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="office_attachments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["company", "correspondence"]),
        ]

    def __str__(self):
        return f"{self.original_name} ({self.correspondence_id})"


class CorrespondenceRecipient(models.Model):
    """Who receives a letter, and whether it is for action or information."""

    RECIPIENT_CHOICES = [
        ("user", "کاربر"),
        ("team", "تیم"),
        ("division", "بخش"),
        ("external", "بیرونی"),
    ]
    DELIVERY_CHOICES = [
        ("primary", "گیرنده اصلی"),
        ("cc", "رونوشت"),
        ("bcc", "رونوشت مخفی"),
        ("action_required", "نیازمند اقدام"),
        ("information", "جهت اطلاع"),
    ]
    STATUS_CHOICES = [
        ("pending", "در انتظار"),
        ("delivered", "تحویل‌شده"),
        ("read", "خوانده‌شده"),
    ]

    correspondence = models.ForeignKey(Correspondence, on_delete=models.CASCADE, related_name="recipients")
    recipient_type = models.CharField(max_length=10, choices=RECIPIENT_CHOICES, default="user")
    recipient_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
        related_name="received_correspondence",
    )
    recipient_team = models.ForeignKey(
        "accounts.Team", on_delete=models.CASCADE, null=True, blank=True, related_name="office_letters",
    )
    recipient_division = models.ForeignKey(
        "accounts.Division", on_delete=models.CASCADE, null=True, blank=True, related_name="office_letters",
    )
    external_name = models.CharField(max_length=200, blank=True, default="")
    external_email = models.EmailField(blank=True, default="")
    delivery_type = models.CharField(max_length=20, choices=DELIVERY_CHOICES, default="primary")
    delivery_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.correspondence_id} → {self.recipient_user or self.external_name or self.recipient_team}"


class CorrespondenceRoute(models.Model):
    """A referral of a letter to a person, team or division."""

    ROUTE_CHOICES = [
        ("action", "اقدام"),
        ("review", "بررسی"),
        ("information", "اطلاع"),
        ("signature", "امضا"),
        ("response", "پاسخ"),
    ]
    STATUS_CHOICES = [
        ("pending", "در انتظار"),
        ("accepted", "پذیرفته‌شده"),
        ("completed", "انجام‌شده"),
        ("cancelled", "لغو‌شده"),
    ]

    correspondence = models.ForeignKey(Correspondence, on_delete=models.CASCADE, related_name="routes")
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="sent_routes",
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="incoming_routes",
    )
    to_team = models.ForeignKey(
        "accounts.Team", on_delete=models.CASCADE, null=True, blank=True, related_name="office_routes",
    )
    to_division = models.ForeignKey(
        "accounts.Division", on_delete=models.CASCADE, null=True, blank=True, related_name="office_routes",
    )
    route_type = models.CharField(max_length=20, choices=ROUTE_CHOICES, default="action")
    instruction = models.TextField(blank=True, default="")
    assigned_at = models.DateTimeField(auto_now_add=True)
    due_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    route_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.correspondence_id} → {self.to_user or self.to_team or self.to_division}"


class CorrespondenceComment(models.Model):
    """Discussion note attached to a letter."""

    correspondence = models.ForeignKey(Correspondence, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="office_comments")
    body = models.TextField()
    is_internal = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class CorrespondenceAction(models.Model):
    """Immutable log of office actions (register, refer, reply, archive)."""

    correspondence = models.ForeignKey(Correspondence, on_delete=models.CASCADE, related_name="actions")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="office_actions")
    action = models.CharField(max_length=30)
    note = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class BusinessRecordReference(models.Model):
    """Stable pointer to a record that lives in the business domain."""

    ENTITY_CHOICES = [
        ("customer", "مشتری"),
        ("invoice", "صورت‌حساب"),
        ("receipt", "رسید دریافت"),
        ("payment", "پرداخت"),
        ("opportunity", "فرصت CRM"),
    ]

    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="office_business_refs")
    source_system = models.CharField(max_length=50, default="nexivo_business")
    entity_type = models.CharField(max_length=20, choices=ENTITY_CHOICES)
    source_record_id = models.CharField(max_length=64)
    display_snapshot = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "source_system", "entity_type", "source_record_id"],
                name="uniq_business_reference",
            ),
        ]

    def __str__(self):
        return f"{self.entity_type}:{self.source_record_id}"


class OfficeBusinessLink(models.Model):
    """Join table between an Office object and a business reference."""

    RELATIONSHIP_CHOICES = [
        ("about", "درباره"),
        ("concerns", "مربوط به"),
        ("invoice_for", "صورت‌حساب مربوط"),
        ("payment_for", "پرداخت مربوط"),
        ("customer_context", "زمینه مشتری"),
        ("supporting_evidence", "مستند پشتیبان"),
        ("follow_up_to", "پیگیری"),
        ("discussed_in", "بحث‌شده در"),
    ]

    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="office_business_links")
    office_object_type = models.CharField(max_length=30, default="correspondence")
    office_object_id = models.CharField(max_length=64)
    reference = models.ForeignKey(BusinessRecordReference, on_delete=models.CASCADE, related_name="links")
    relationship_type = models.CharField(max_length=30, choices=RELATIONSHIP_CHOICES, default="about")
    label = models.CharField(max_length=200, blank=True, default="")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "office_object_type", "office_object_id", "reference", "relationship_type"],
                name="uniq_office_business_link",
            ),
        ]

    def __str__(self):
        return f"{self.office_object_type}:{self.office_object_id} → {self.reference}"
