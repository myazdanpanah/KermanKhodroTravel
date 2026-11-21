"""
Office correspondence services — registration, routing, replies and access.

Registration is the one place a letter gets an official number: it locks the
per-secretariat sequence row inside a transaction, so two secretaries clicking
"register" at the same time can never receive the same number.
"""

import hashlib
from pathlib import Path

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
import jdatetime

from apps.accounts.models import User

from .models import (
    Correspondence,
    CorrespondenceAction,
    CorrespondenceAttachment,
    CorrespondenceComment,
    CorrespondenceRecipient,
    CorrespondenceRoute,
    Secretariat,
    SecretariatMember,
    SecretariatNumberSequence,
)

PRIVILEGED_ROLES = ("admin", "ceo")


class OfficeError(Exception):
    """A business-rule failure that the view turns into a 4xx response."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def is_privileged(user):
    """Admins and CEOs see every letter in their company."""
    return bool(user.is_staff or getattr(user, "role", None) in PRIVILEGED_ROLES)


def visible_correspondence(user):
    """Letters the user may open, scoped to the user's company."""
    qs = Correspondence.objects.filter(company=user.company)
    if is_privileged(user):
        return qs
    participation = (
        Q(created_by=user)
        | Q(owner=user)
        | Q(sender_user=user)
        | Q(recipients__recipient_user=user)
        | Q(routes__to_user=user)
        | Q(secretariat__members__user=user)
    )
    # Only add team/division clauses when the user belongs to one: a NULL
    # team would otherwise match every letter whose recipient has no team.
    if user.team_id:
        participation |= Q(recipients__recipient_team_id=user.team_id) | Q(routes__to_team_id=user.team_id)
    if user.division_id:
        participation |= (
            Q(recipients__recipient_division_id=user.division_id)
            | Q(routes__to_division_id=user.division_id)
        )
    return qs.filter(participation).filter(
        Q(confidentiality__in=["normal", "confidential"])
        | Q(created_by=user)
        | Q(owner=user)
        | Q(sender_user=user)
        | Q(recipients__recipient_user=user)
        | Q(routes__to_user=user)
    ).distinct()


def can_open(user, letter):
    if letter.company_id != getattr(user.company, "id", None):
        return False
    if is_privileged(user):
        return True
    if letter.confidentiality in ("highly_confidential", "restricted"):
        # Confidential letters are limited to people explicitly attached to them.
        return (
            letter.created_by_id == user.id
            or letter.owner_id == user.id
            or letter.sender_user_id == user.id
            or letter.recipients.filter(recipient_user=user).exists()
            or letter.routes.filter(to_user=user).exists()
        )
    return visible_correspondence(user).filter(pk=letter.pk).exists()


def log_action(letter, user, action, note="", metadata=None):
    return CorrespondenceAction.objects.create(
        correspondence=letter,
        actor=user,
        action=action,
        note=note or "",
        metadata=metadata or {},
    )


def notify(user, title, message, letter):
    """Reuse the platform notification feed for office events."""
    from apps.dashboards.models import Notification

    if user is None or user.company_id != letter.company_id:
        return None
    return Notification.objects.create(
        recipient=user,
        notification_type="system",
        title=title,
        message=message,
        target_type="office_correspondence",
        target_id=str(letter.id),
    )


def _company_user(company, user_id):
    user = User.objects.filter(pk=user_id, company=company, is_active=True).first()
    if user is None:
        raise OfficeError("کاربر انتخاب‌شده در این شرکت فعال نیست", 400)
    return user


def _validate_recipient(company, data):
    """Exactly one target must be set, and it must belong to the company."""
    recipient_type = data.get("recipient_type", "user")
    if recipient_type == "user":
        user = _company_user(company, data.get("recipient_user_id"))
        return {"recipient_type": "user", "recipient_user": user}
    if recipient_type == "team":
        from apps.accounts.models import Team

        team = Team.objects.filter(pk=data.get("recipient_team_id"), division__company=company).first()
        if team is None:
            raise OfficeError("تیم انتخاب‌شده معتبر نیست", 400)
        return {"recipient_type": "team", "recipient_team": team}
    if recipient_type == "division":
        from apps.accounts.models import Division

        division = Division.objects.filter(pk=data.get("recipient_division_id"), company=company).first()
        if division is None:
            raise OfficeError("بخش انتخاب‌شده معتبر نیست", 400)
        return {"recipient_type": "division", "recipient_division": division}
    if recipient_type == "external":
        name = (data.get("external_name") or "").strip()
        if not name:
            raise OfficeError("نام گیرنده بیرونی الزامی است", 400)
        return {"recipient_type": "external", "external_name": name, "external_email": data.get("external_email", "")}
    raise OfficeError("نوع گیرنده نامعتبر است", 400)


@transaction.atomic
def create_correspondence(user, data, recipients=None):
    company = user.company
    secretariat = None
    if data.get("secretariat_id"):
        secretariat = Secretariat.objects.filter(pk=data["secretariat_id"], company=company, is_active=True).first()
        if secretariat is None:
            raise OfficeError("دبیرخانه انتخاب‌شده معتبر نیست", 400)

    letter = Correspondence.objects.create(
        company=company,
        secretariat=secretariat,
        correspondence_type=data.get("correspondence_type", "internal"),
        subject=data["subject"].strip(),
        body=data.get("body", ""),
        sender_type=data.get("sender_type", "internal"),
        sender_user=user if data.get("sender_type", "internal") == "internal" else None,
        sender_name=data.get("sender_name", ""),
        sender_organization=data.get("sender_organization", ""),
        sender_email=data.get("sender_email", ""),
        letter_date=data.get("letter_date"),
        letter_date_jalali=data.get("letter_date_jalali", ""),
        received_at=data.get("received_at"),
        priority=data.get("priority", "normal"),
        confidentiality=data.get("confidentiality", "normal"),
        due_at=data.get("due_at"),
        owner=_company_user(company, data["owner_id"]) if data.get("owner_id") else user,
        created_by=user,
        updated_by=user,
    )

    for item in recipients or []:
        CorrespondenceRecipient.objects.create(
            correspondence=letter,
            delivery_type=item.get("delivery_type", "primary"),
            **_validate_recipient(company, item),
        )

    log_action(letter, user, "created")
    return letter


def _jalali_year(letter, fallback=None):
    """Registration year follows the letter date, always in the Jalali calendar."""
    raw = (letter.letter_date_jalali or "").strip()
    if len(raw) >= 4 and raw[:4].isdigit():
        return int(raw[:4])
    if fallback:
        return int(fallback)
    gregorian = letter.letter_date or timezone.localdate()
    return jdatetime.date.fromgregorian(date=gregorian).year


TYPE_CODE = {"incoming": "I", "outgoing": "O", "internal": "N"}


def registration_number(year, secretariat_code, correspondence_type, sequence):
    """Official number: year/secretariat/type-book/sequence."""
    return f"{year}/{secretariat_code}/{TYPE_CODE.get(correspondence_type, 'X')}/{sequence:06d}"


def is_secretariat_member(user, secretariat_id, require_register=False):
    if not secretariat_id:
        return False
    members = SecretariatMember.objects.filter(secretariat_id=secretariat_id, user=user)
    if require_register:
        members = members.filter(can_register=True)
    return members.exists()


def can_register_letter(user, letter):
    """Registration needs secretariat authority, not just ownership of the draft."""
    if is_privileged(user):
        return True
    return is_secretariat_member(user, letter.secretariat_id, require_register=True)


def registration_label(letter):
    return registration_number(
        letter.registration_year, letter.secretariat.code,
        letter.correspondence_type, letter.registration_sequence,
    )


@transaction.atomic
def register_correspondence(letter, user, year=None):
    """Allocate the next number for the letter's secretariat, type and year."""
    letter = Correspondence.objects.select_for_update().get(pk=letter.pk)
    if letter.registration_status == "registered":
        raise OfficeError("این نامه قبلاً ثبت شده است", 409)
    if letter.archived_at:
        raise OfficeError("نامه بایگانی‌شده قابل ثبت نیست", 409)
    if letter.secretariat_id is None:
        raise OfficeError("برای ثبت، دبیرخانه را انتخاب کنید", 400)
    if not (letter.subject or "").strip():
        raise OfficeError("موضوع نامه الزامی است", 400)
    if not can_register_letter(user, letter):
        raise OfficeError("ثبت نامه فقط برای اعضای مجاز دبیرخانه است", 403)

    reg_year = _jalali_year(letter, year)
    sequence, _ = SecretariatNumberSequence.objects.select_for_update().get_or_create(
        secretariat=letter.secretariat,
        correspondence_type=letter.correspondence_type,
        year=reg_year,
        defaults={"company": letter.company, "last_number": 0},
    )
    # get_or_create may have raced; lock the row explicitly.
    sequence = SecretariatNumberSequence.objects.select_for_update().get(pk=sequence.pk)
    sequence.last_number += 1
    sequence.save(update_fields=["last_number"])

    letter.registration_status = "registered"
    letter.registration_year = reg_year
    letter.registration_sequence = sequence.last_number
    letter.registration_number = registration_number(
        reg_year, letter.secretariat.code, letter.correspondence_type, sequence.last_number,
    )
    letter.registered_at = timezone.now()
    letter.registered_by = user
    letter.current_status = "open"
    letter.save(update_fields=[
        "registration_status", "registration_year", "registration_sequence",
        "registration_number", "registered_at", "registered_by", "current_status",
    ])

    for recipient in letter.recipients.select_related("recipient_user"):
        if recipient.recipient_user_id:
            recipient.delivery_status = "delivered"
            recipient.delivered_at = timezone.now()
            recipient.save(update_fields=["delivery_status", "delivered_at"])
            notify(recipient.recipient_user, "نامه ثبت‌شده", f"نامه «{letter.subject}» ثبت شد.", letter)

    log_action(letter, user, "registered", metadata={"number": letter.registration_number})
    return letter


@transaction.atomic
def refer_correspondence(letter, user, data):
    """Route a letter to one user, team or division."""
    company = letter.company
    target = data.get("target_type", "user")
    kwargs = {}
    recipients = []
    if target == "user":
        target_user = _company_user(company, data.get("user_id"))
        kwargs["to_user"] = target_user
        recipients.append({"recipient_type": "user", "recipient_user": target_user,
                           "delivery_type": "action_required"})
    elif target == "team":
        from apps.accounts.models import Team

        team = Team.objects.filter(pk=data.get("team_id"), division__company=company).first()
        if team is None:
            raise OfficeError("تیم انتخاب‌شده معتبر نیست", 400)
        kwargs["to_team"] = team
        recipients.append({"recipient_type": "team", "recipient_team": team,
                           "delivery_type": "action_required"})
    elif target == "division":
        from apps.accounts.models import Division

        division = Division.objects.filter(pk=data.get("division_id"), company=company).first()
        if division is None:
            raise OfficeError("بخش انتخاب‌شده معتبر نیست", 400)
        kwargs["to_division"] = division
        recipients.append({"recipient_type": "division", "recipient_division": division,
                           "delivery_type": "action_required"})
    else:
        raise OfficeError("مقصد ارجاع نامعتبر است", 400)

    route = CorrespondenceRoute.objects.create(
        correspondence=letter,
        from_user=user,
        route_type=data.get("route_type", "action"),
        instruction=data.get("instruction", ""),
        due_at=data.get("due_at"),
        **kwargs,
    )
    for item in recipients:
        CorrespondenceRecipient.objects.get_or_create(
            correspondence=letter,
            recipient_user=item.get("recipient_user"),
            recipient_team=item.get("recipient_team"),
            recipient_division=item.get("recipient_division"),
            defaults={"recipient_type": item["recipient_type"], "delivery_type": item["delivery_type"]},
        )

    if letter.current_status in ("open", "answered"):
        letter.current_status = "in_progress"
        letter.save(update_fields=["current_status"])

    if route.to_user_id:
        notify(route.to_user, "ارجاع نامه", f"نامه «{letter.subject}» برای شما ارجاع شد.", letter)
    log_action(letter, user, "referred", note=data.get("instruction", ""),
               metadata={"route_id": route.id, "target_type": target})
    return route


@transaction.atomic
def reply_to_correspondence(letter, user, body, subject=""):
    """Create a reply letter linked to the original and mark the thread answered."""
    if not (body or "").strip():
        raise OfficeError("متن پاسخ الزامی است", 400)
    child = Correspondence.objects.create(
        company=letter.company,
        secretariat=letter.secretariat,
        correspondence_type="internal" if letter.correspondence_type == "internal" else "outgoing",
        subject=(subject or f"پاسخ: {letter.subject}")[:300],
        body=body,
        sender_type="internal",
        sender_user=user,
        priority=letter.priority,
        confidentiality=letter.confidentiality,
        parent_correspondence=letter,
        owner=user,
        created_by=user,
        updated_by=user,
    )
    if letter.sender_user_id and letter.sender_user_id != user.id:
        CorrespondenceRecipient.objects.create(
            correspondence=child,
            recipient_type="user",
            recipient_user=letter.sender_user,
            delivery_type="primary",
        )
        notify(letter.sender_user, "پاسخ نامه", f"پاسخی برای «{letter.subject}» ثبت شد.", child)

    letter.current_status = "answered"
    letter.save(update_fields=["current_status"])
    log_action(letter, user, "replied", metadata={"reply_id": child.id})
    return child


@transaction.atomic
def archive_correspondence(letter, user, note=""):
    if letter.archived_at:
        raise OfficeError("این نامه قبلاً بایگانی شده است", 409)
    letter.current_status = "closed"
    letter.archived_at = timezone.now()
    letter.save(update_fields=["current_status", "archived_at"])
    log_action(letter, user, "archived", note=note)
    return letter


def add_comment(letter, user, body, is_internal=True):
    if not (body or "").strip():
        raise OfficeError("متن یادداشت الزامی است", 400)
    return CorrespondenceComment.objects.create(
        correspondence=letter, author=user, body=body, is_internal=is_internal,
    )


def mark_read(letter, user):
    """Reading is tracked separately from acting on a letter."""
    updated = letter.recipients.filter(recipient_user=user).update(
        delivery_status="read", read_at=timezone.now(),
    )
    return updated > 0


# Attachment policy: a closed allowlist, a hard size cap and a per-letter cap.
ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
ATTACHMENT_MAX_PER_LETTER = 10
ALLOWED_ATTACHMENT_TYPES = {
    ".pdf": {"application/pdf"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
}
_GENERIC_CONTENT_TYPES = {"", "application/octet-stream"}

# The declared content type and the extension are both claims; the file head is
# evidence. A renamed executable must not pass as a PDF just because it says so.
_ZIP_MAGIC = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
ATTACHMENT_SIGNATURES = {
    ".pdf": (b"%PDF",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    # DOCX and XLSX are ZIP containers, so they share the archive signature.
    ".docx": _ZIP_MAGIC,
    ".xlsx": _ZIP_MAGIC,
    ".zip": _ZIP_MAGIC,
}
ATTACHMENT_SIGNATURE_BYTES = 8
ATTACHMENT_HINT = "فقط PDF، تصویر (JPG/PNG)، Word (DOCX)، Excel (XLSX) و ZIP مجاز است"


def _attachment_checksum(upload):
    digest = hashlib.sha256()
    for chunk in upload.chunks():
        digest.update(chunk)
    upload.seek(0)
    return digest.hexdigest()


def _file_head(upload):
    """Read the first bytes for signature checks without consuming the upload."""
    upload.seek(0)
    head = upload.read(ATTACHMENT_SIGNATURE_BYTES) or b""
    upload.seek(0)
    return head


def _signature_matches(suffix, head):
    return any(head.startswith(magic) for magic in ATTACHMENT_SIGNATURES.get(suffix, ()))


def validate_attachment(upload):
    """Validate name, extension, declared type and size before saving bytes."""
    original_name = Path(upload.name or "").name.strip()
    if not original_name:
        raise OfficeError("نام فایل نامعتبر است", 400)
    suffix = Path(original_name).suffix.lower()
    allowed_types = ALLOWED_ATTACHMENT_TYPES.get(suffix)
    if allowed_types is None:
        raise OfficeError(f"نوع فایل مجاز نیست؛ {ATTACHMENT_HINT}", 400)
    declared = (getattr(upload, "content_type", "") or "").split(";")[0].strip().lower()
    if declared not in _GENERIC_CONTENT_TYPES and declared not in allowed_types:
        raise OfficeError(f"نوع محتوای فایل با پسوند آن هم‌خوانی ندارد؛ {ATTACHMENT_HINT}", 400)
    size = getattr(upload, "size", 0) or 0
    if size <= 0:
        raise OfficeError("فایل انتخاب‌شده خالی است", 400)
    if size > ATTACHMENT_MAX_BYTES:
        limit_mb = ATTACHMENT_MAX_BYTES // (1024 * 1024)
        raise OfficeError(f"حجم فایل بیش از حد مجاز ({limit_mb} مگابایت) است", 400)
    if not _signature_matches(suffix, _file_head(upload)):
        raise OfficeError(f"محتوای فایل با پسوند آن هم‌خوانی ندارد؛ {ATTACHMENT_HINT}", 400)
    return original_name, suffix, declared, size


def add_attachment(letter, user, upload):
    """Store one private attachment and record it in the letter's audit trail."""
    if letter.archived_at:
        raise OfficeError("نامه بایگانی‌شده قابل تغییر نیست", 400)
    if letter.attachments.count() >= ATTACHMENT_MAX_PER_LETTER:
        raise OfficeError(
            f"حداکثر {ATTACHMENT_MAX_PER_LETTER} پیوست برای هر نامه مجاز است", 400,
        )
    original_name, _suffix, declared, size = validate_attachment(upload)
    checksum = _attachment_checksum(upload)
    attachment = CorrespondenceAttachment.objects.create(
        correspondence=letter,
        company_id=letter.company_id,
        file=upload,
        original_name=original_name[:255],
        content_type=declared or "application/octet-stream",
        size_bytes=size,
        checksum=checksum,
        uploaded_by=user,
    )
    log_action(
        letter, user, "attachment_added", note=attachment.original_name,
        metadata={"attachment_id": attachment.id, "size_bytes": size},
    )
    return attachment


def can_manage_attachments(user, letter):
    """Who may delete any attachment: managers, the letter's creator or owner."""
    return bool(
        is_privileged(user)
        or letter.created_by_id == user.id
        or letter.owner_id == user.id
    )


def can_manage_attachment(user, attachment):
    """Uploader, letter creator/owner or a manager may delete an attachment."""
    letter = attachment.correspondence
    return bool(
        is_privileged(user)
        or attachment.uploaded_by_id == user.id
        or letter.created_by_id == user.id
        or letter.owner_id == user.id
    )


def delete_attachment(attachment, user):
    if not can_manage_attachment(user, attachment):
        raise OfficeError("حذف پیوست فقط توسط بارگذار، سازنده یا مسئول نامه مجاز است", 403)
    letter = attachment.correspondence
    attachment_id = attachment.id
    attachment.file.delete(save=False)
    attachment.delete()
    log_action(letter, user, "attachment_deleted", metadata={"attachment_id": attachment_id})


DRAFT_EDITABLE_FIELDS = (
    "subject", "body", "priority", "confidentiality", "due_at",
    "letter_date", "letter_date_jalali", "sender_name", "sender_organization", "sender_email",
)


def can_edit_draft(letter, user):
    return bool(
        letter.registration_status == "draft"
        and letter.archived_at is None
        and (is_privileged(user) or letter.created_by_id == user.id)
    )


@transaction.atomic
def update_draft(letter, user, data):
    """Update a draft's fields and optionally replace its recipients."""
    if letter.registration_status != "draft":
        raise OfficeError("نامه ثبت‌شده قابل ویرایش نیست", 400)
    if letter.archived_at:
        raise OfficeError("نامه بایگانی‌شده قابل ویرایش نیست", 400)
    if not (is_privileged(user) or letter.created_by_id == user.id):
        raise OfficeError("فقط سازنده پیش‌نویس یا مدیر می‌تواند آن را ویرایش کند", 403)

    recipients = data.pop("recipients", None)
    changed = [field for field in DRAFT_EDITABLE_FIELDS if field in data]
    for field in changed:
        setattr(letter, field, data[field])
    letter.updated_by = user
    letter.save()

    if recipients is not None:
        rows = []
        for item in recipients:
            rows.append({
                "delivery_type": item.get("delivery_type", "primary"),
                **_validate_recipient(letter.company, item),
            })
        letter.recipients.all().delete()
        CorrespondenceRecipient.objects.bulk_create([
            CorrespondenceRecipient(correspondence=letter, **row) for row in rows
        ])

    log_action(
        letter, user, "updated",
        metadata={"fields": changed, "recipients_changed": recipients is not None},
    )
    return letter
