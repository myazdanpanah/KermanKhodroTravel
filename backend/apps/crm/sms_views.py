"""SMS endpoints: gateway settings, sending and history."""

from __future__ import annotations

import re

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.accounts.permissions import RequireModule

from .models import Campaign, SmsMessage, SmsSettings
from .sms import SmsError, normalize_phone, send_sms

_CRMPerm = RequireModule.for_module("crm")()


def _forbidden(message: str):
    return Response({"success": False, "error": message}, status=status.HTTP_403_FORBIDDEN)


def _company(request):
    return getattr(request.user, "company", None)


def _can_manage(request) -> bool:
    user = request.user
    return bool(
        getattr(user, "is_staff", False)
        or getattr(user, "role", "") in {"admin", "ceo"}
        or getattr(user, "can_manage_settings", False)
    )


def _settings_for(request) -> SmsSettings:
    company = _company(request)
    settings_obj, _ = SmsSettings.objects.get_or_create(company=company)
    return settings_obj


def _serialize(settings_obj: SmsSettings) -> dict:
    return {
        "provider": settings_obj.provider,
        "sender": settings_obj.sender,
        "endpoint": settings_obj.endpoint,
        "username": settings_obj.username,
        "enabled": settings_obj.enabled,
        "has_api_key": bool(settings_obj.api_key),
        "has_password": bool(settings_obj.password),
    }


@api_view(["GET", "PUT", "PATCH"])
def sms_settings_view(request):
    if not _CRMPerm.has_permission(request, None):
        return _forbidden("ماژول CRM برای این کاربر فعال نیست.")
    settings_obj = _settings_for(request)

    if request.method == "GET":
        return Response({"success": True, "data": _serialize(settings_obj), "can_manage": _can_manage(request)})

    if not _can_manage(request):
        return _forbidden("تغییر تنظیمات پیامک فقط برای مدیران مجاز است.")

    payload = request.data
    for field in ("provider", "sender", "endpoint", "username"):
        if field in payload:
            setattr(settings_obj, field, str(payload.get(field) or ""))
    if "enabled" in payload:
        settings_obj.enabled = bool(payload.get("enabled"))
    # Blank secrets keep the stored value so the UI never has to resend them.
    if payload.get("api_key"):
        settings_obj.api_key = str(payload["api_key"])
    if payload.get("password"):
        settings_obj.password = str(payload["password"])
    settings_obj.save()
    return Response({"success": True, "data": _serialize(settings_obj)})


@api_view(["GET"])
def sms_messages_view(request):
    if not _CRMPerm.has_permission(request, None):
        return _forbidden("ماژول CRM برای این کاربر فعال نیست.")
    rows = SmsMessage.objects.select_related("campaign")[:100]
    return Response({
        "success": True,
        "data": [
            {
                "id": row.id,
                "phone": row.phone,
                "body": row.body,
                "provider": row.provider,
                "status": row.status,
                "error": row.error,
                "campaign": row.campaign.name if row.campaign else "",
                "created_at": row.created_at,
            }
            for row in rows
        ],
    })


@api_view(["POST"])
def sms_send_view(request):
    if not _CRMPerm.has_permission(request, None):
        return _forbidden("ماژول CRM برای این کاربر فعال نیست.")

    phone = normalize_phone(request.data.get("phone", ""))
    body = str(request.data.get("message") or "").strip()
    if len(phone) != 11 or not phone.startswith("0"):
        return Response({"success": False, "error": "شمارهٔ موبایل معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
    if not body:
        return Response({"success": False, "error": "متن پیامک خالی است."}, status=status.HTTP_400_BAD_REQUEST)
    if len(body) > 1000:
        return Response({"success": False, "error": "متن پیامک بیش از حد طولانی است."}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj = _settings_for(request)
    if not settings_obj.enabled:
        return Response(
            {"success": False, "error": "ارسال پیامک فعال نیست؛ ابتدا در تنظیمات پیامک، سرویس را فعال کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    campaign = None
    campaign_id = request.data.get("campaign_id")
    if campaign_id:
        campaign = Campaign.objects.filter(pk=campaign_id).first()

    company = _company(request)
    record = SmsMessage.objects.create(
        company=company, phone=phone, body=body, provider=settings_obj.provider,
        status="failed", campaign=campaign,
    )
    try:
        provider_id = send_sms(settings_obj, phone, body)
    except SmsError as exc:
        record.error = str(exc)
        record.save(update_fields=["error"])
        return Response({"success": False, "error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    record.status = "sent"
    record.provider_message_id = provider_id
    record.save(update_fields=["status", "provider_message_id"])
    return Response({"success": True, "data": {"id": record.id, "provider_message_id": provider_id}})


def interpolate_template(template_str: str, variables: dict) -> str:
    """
    Substitutes {variable} placeholders with their string value from variables dict.
    Supports Persian and English keys, ignores whitespace inside braces e.g. { نام }.
    If a variable is missing, it is replaced with an empty string.
    """
    if not template_str:
        return ""
    clean_vars = {str(k).strip(): ("" if v is None else str(v).strip()) for k, v in (variables or {}).items()}

    def _replace(match):
        raw_key = match.group(1).strip()
        if raw_key in clean_vars:
            return clean_vars[raw_key]
        for k, v in clean_vars.items():
            if k.lower() == raw_key.lower():
                return v
        return ""

    return re.sub(r"\{\s*([^{}]+?)\s*\}", _replace, template_str)


@api_view(["POST"])
def sms_bulk_send_view(request):
    """
    Bulk SMS dispatch with dynamic variable templating.
    Payload:
    {
        "template": "سلام {نام} عزیز، صورت‌حساب شما به مبلغ {مبلغ} ریال صادر شد.",
        "recipients": [
            {"phone": "09123456789", "variables": {"نام": "حمیدرضا", "مبلغ": "۱۰۰,۰۰۰"}},
            ...
        ],
        "campaign_id": optional_int,
        "dry_run": optional_bool
    }
    """
    if not _CRMPerm.has_permission(request, None):
        return _forbidden("ماژول CRM برای این کاربر فعال نیست.")

    template = str(request.data.get("template") or "").strip()
    recipients = request.data.get("recipients")
    dry_run = bool(request.data.get("dry_run", False))

    if not recipients or not isinstance(recipients, list):
        return Response({"success": False, "error": "لیست گیرندگان پیامک خالی یا نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)

    if len(recipients) > 2000:
        return Response({"success": False, "error": "حداکثر ۲۰۰۰ گیرنده در هر ارسال گروهی مجاز است."}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj = _settings_for(request)
    if not dry_run and not settings_obj.enabled:
        return Response(
            {"success": False, "error": "ارسال پیامک فعال نیست؛ ابتدا در تنظیمات پیامک، سرویس را فعال کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    campaign = None
    campaign_id = request.data.get("campaign_id")
    if campaign_id:
        campaign = Campaign.objects.filter(pk=campaign_id).first()

    company = _company(request)
    results = []
    sent_count = 0
    failed_count = 0

    for idx, item in enumerate(recipients):
        if not isinstance(item, dict):
            failed_count += 1
            results.append({"index": idx, "phone": "", "status": "failed", "error": "فرمت داده نامعتبر است."})
            continue

        raw_phone = item.get("phone", "")
        phone = normalize_phone(raw_phone)
        item_vars = item.get("variables") or {}

        if template:
            body = interpolate_template(template, item_vars).strip()
        else:
            body = str(item.get("message") or "").strip()

        phone_valid = (len(phone) == 11 and phone.startswith("0"))
        body_valid = bool(body) and len(body) <= 1000

        if dry_run:
            is_valid = phone_valid and body_valid
            error_reason = ""
            if not phone_valid:
                error_reason = "شمارهٔ موبایل نامعتبر است"
            elif not body:
                error_reason = "متن پیامک خالی است"
            elif len(body) > 1000:
                error_reason = "طول پیامک بیش از ۱۰۰۰ کاراکتر است"

            results.append({
                "index": idx,
                "phone": phone or raw_phone,
                "body": body,
                "char_count": len(body),
                "valid": is_valid,
                "error": error_reason,
            })
            continue

        if not phone_valid:
            failed_count += 1
            results.append({
                "index": idx,
                "phone": raw_phone,
                "body": body,
                "status": "failed",
                "error": "شمارهٔ موبایل معتبر نیست.",
            })
            continue

        if not body_valid:
            failed_count += 1
            results.append({
                "index": idx,
                "phone": phone,
                "body": body,
                "status": "failed",
                "error": "متن پیامک خالی یا بیش از ۱۰۰۰ کاراکتر است.",
            })
            continue

        record = SmsMessage.objects.create(
            company=company,
            phone=phone,
            body=body,
            provider=settings_obj.provider,
            status="failed",
            campaign=campaign,
        )
        try:
            provider_id = send_sms(settings_obj, phone, body)
            record.status = "sent"
            record.provider_message_id = provider_id
            record.save(update_fields=["status", "provider_message_id"])
            sent_count += 1
            results.append({
                "index": idx,
                "id": record.id,
                "phone": phone,
                "body": body,
                "status": "sent",
                "provider_message_id": provider_id,
            })
        except SmsError as exc:
            record.error = str(exc)
            record.save(update_fields=["error"])
            failed_count += 1
            results.append({
                "index": idx,
                "id": record.id,
                "phone": phone,
                "body": body,
                "status": "failed",
                "error": str(exc),
            })

    if dry_run:
        return Response({
            "success": True,
            "dry_run": True,
            "total": len(recipients),
            "results": results,
        })

    return Response({
        "success": True,
        "total": len(recipients),
        "sent": sent_count,
        "failed": failed_count,
        "results": results,
    })
