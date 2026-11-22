"""SMS gateway adapters.

Each provider exposes the same ``send(settings, phone, message)`` contract and
either returns a provider message id or raises :class:`SmsError` with a Persian
message suitable for the UI. Keys are read from the stored company settings and
never echoed back by the API.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

REQUEST_TIMEOUT = 15


class SmsError(Exception):
    """Gateway rejected the message or could not be reached."""


def normalize_phone(raw: str) -> str:
    """Convert Persian/Arabic digits and +98 prefixes to 09xxxxxxxxx."""
    digits = str(raw or "").translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
    digits = "".join(ch for ch in digits if ch.isdigit())
    if digits.startswith("0098"):
        digits = "0" + digits[4:]
    elif digits.startswith("98") and len(digits) == 12:
        digits = "0" + digits[2:]
    elif digits.startswith("9") and len(digits) == 10:
        digits = "0" + digits
    return digits


def _post_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=data, method="POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("Accept", "application/json")
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        raise SmsError(f"سرویس پیامک خطا داد ({exc.code}): {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SmsError("ارتباط با سرویس پیامک برقرار نشد.") from exc
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {"raw": body}


def _send_kavenegar(settings, phone: str, message: str) -> str:
    if not settings.api_key:
        raise SmsError("کلید API کاوه‌نگار تنظیم نشده است.")
    base = f"https://api.kavenegar.com/v1/{urllib.parse.quote(settings.api_key)}/sms/send.json"
    params = {"receptor": phone, "message": message}
    if settings.sender:
        params["sender"] = settings.sender
    result = _post_json(f"{base}?{urllib.parse.urlencode(params)}", {})
    status = (result.get("return") or {}).get("status")
    if status not in (200, 201):
        message_text = (result.get("return") or {}).get("message") or "ارسال پیامک ناموفق بود."
        raise SmsError(message_text)
    entries = result.get("entries") or []
    return str(entries[0].get("messageid", "")) if entries else ""


def _send_niksms(settings, phone: str, message: str) -> str:
    if not settings.username or not settings.password or not settings.api_key:
        raise SmsError("نام کاربری، رمز یا کلید API نیک‌اس‌ام‌اس کامل نیست.")
    result = _post_json(
        "https://niksms.com/development/PublicApi/PostSmsWithApiKey",
        {
            "username": settings.username,
            "password": settings.password,
            "apiKey": settings.api_key,
            "senderNumber": settings.sender,
            "phoneNumbers": [phone],
            "message": message,
        },
    )
    status = result.get("Status")
    if status not in (1, 2, None):
        raise SmsError(str(result.get("Message") or "ارسال پیامک ناموفق بود."))
    return str(result.get("Id") or "")


def _send_generic(settings, phone: str, message: str) -> str:
    if not settings.endpoint:
        raise SmsError("آدرس سرویس پیامک سفارشی تنظیم نشده است.")
    headers = {"Authorization": f"Bearer {settings.api_key}"} if settings.api_key else {}
    result = _post_json(
        settings.endpoint,
        {"to": phone, "message": message, "sender": settings.sender},
        headers,
    )
    return str(result.get("id") or result.get("message_id") or "")


PROVIDERS = {
    "kavenegar": _send_kavenegar,
    "niksms": _send_niksms,
    "generic": _send_generic,
}


def send_sms(settings, phone: str, message: str) -> str:
    provider = PROVIDERS.get(settings.provider)
    if provider is None:
        raise SmsError("سرویس پیامک انتخاب‌شده پشتیبانی نمی‌شود.")
    return provider(settings, phone, message)
