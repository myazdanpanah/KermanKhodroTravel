"""Number / date normalisation helpers (spec §4.1, §4.6)."""

from __future__ import annotations

import datetime as dt
import re
from typing import Any

import jdatetime

PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
ENGLISH_DIGITS = "0123456789"

_DIGIT_MAP = {
    **{ord(p): e for p, e in zip(PERSIAN_DIGITS, ENGLISH_DIGITS)},
    **{ord(a): e for a, e in zip(ARABIC_DIGITS, ENGLISH_DIGITS)},
}
_REVERSE_DIGIT_MAP = {ord(e): p for p, e in zip(PERSIAN_DIGITS, ENGLISH_DIGITS)}

_JALALI_MIN_YEAR = 1300
_JALALI_MAX_YEAR = 1500
_DATE_RE = re.compile(r"^\s*(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*$")


def to_english_digits(value: Any) -> str:
    """Convert Persian/Arabic digits to ASCII digits, leaving other text alone."""
    if value is None:
        return ""
    return str(value).translate(_DIGIT_MAP)


def to_persian_digits(value: Any) -> str:
    if value is None:
        return ""
    return str(value).translate(_REVERSE_DIGIT_MAP)


def persian_to_english_number(value: Any) -> int:
    """
    Spec §4.1: NULL/NaN -> 0, Persian digits -> English, commas stripped,
    everything that is not a digit removed, then int(). Never raises.
    """
    if value is None:
        return 0
    if isinstance(value, float) and value != value:  # NaN
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int,)):
        return value
    if isinstance(value, float):
        return int(value)

    text = to_english_digits(value)
    text = text.replace(",", "").replace("،", "").replace(" ", "")
    text = re.sub(r"[^\d]", "", text)
    if not text:
        return 0
    return int(text)


def _is_valid_jalali(year: int, month: int, day: int) -> bool:
    if not (_JALALI_MIN_YEAR <= year <= _JALALI_MAX_YEAR):
        return False
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return False
    try:
        jdatetime.date(year, month, day)
        return True
    except (ValueError, TypeError):
        return False


def persian_date_to_gregorian(value: Any) -> dt.date | None:
    """
    '1404/01/15' or '۱۴۰۴/۰۱/۱۵' -> datetime.date(2025, 4, 4).
    Garbage / empty / out-of-range -> None. Also accepts a date instance.
    """
    if value is None or value == "":
        return None
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value

    match = _DATE_RE.match(to_english_digits(value))
    if not match:
        return None
    year, month, day = (int(g) for g in match.groups())
    if not _is_valid_jalali(year, month, day):
        return None
    return jdatetime.date(year, month, day).togregorian()


def persian_date_to_iso(value: Any) -> str | None:
    """Same as :func:`persian_date_to_gregorian` but returns 'YYYY-MM-DD'."""
    gregorian = persian_date_to_gregorian(value)
    return gregorian.isoformat() if gregorian else None


def gregorian_to_persian(value: Any) -> str:
    """date / datetime / ISO string -> Jalali 'YYYY/MM/DD' (zero padded)."""
    if value is None or value == "":
        return ""
    if isinstance(value, str):
        value = dt.date.fromisoformat(value[:10])
    if isinstance(value, dt.datetime):
        value = value.date()
    jalali = jdatetime.date.fromgregorian(date=value)
    return f"{jalali.year:04d}/{jalali.month:02d}/{jalali.day:02d}"


def jalali_year_two_digits(value: dt.date | None = None) -> str:
    """Two-digit Jalali year used by letter numbering (spec §5.1)."""
    value = value or dt.date.today()
    return f"{jdatetime.date.fromgregorian(date=value).year % 100:02d}"
