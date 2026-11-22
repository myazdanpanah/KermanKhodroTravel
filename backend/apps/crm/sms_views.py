"""SMS endpoints: gateway settings, sending and history."""

from __future__ import annotations

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
