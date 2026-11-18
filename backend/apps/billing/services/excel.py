"""
Excel ingestion (spec §4.2 - §4.5).

Every processor returns a list of flat dicts using the exact Persian output
column names from the specification, so the API/JSON/DB storage is stable.
"""

from __future__ import annotations

import io
import re
from typing import Any

from .normalize import persian_to_english_number, to_english_digits

FLIGHT = "flight"
HOTEL = "hotel"
SERVICE = "service"

FLIGHT_COLUMNS = ["ردیف", "قرارداد", "نام مسافر", "مسیر", "شماره بلیط", "تاریخ پرواز", "بدهکار", "بستانکار", "مانده"]
HOTEL_COLUMNS = ["ردیف", "قرارداد", "نام مسافر", "هتل", "نوع اتاق", "تعداد نفرات", "تاریخ ورود و خروج", "بدهکار", "بستانکار", "مانده"]
SERVICE_COLUMNS = ["ردیف", "قرارداد", "نام مسافر", "شرح خدمات", "تاریخ", "توضیحات", "بدهکار", "بستانکار", "مانده"]

PASSENGER_COUNT_NAMES = ["تعداد مسافر", "تعداد نفرات", "تعداد", "مسافرین", "تعداد افراد"]

_FLIGHT_DATE_RE = re.compile(r"تاریخ حرکت\s*[:：]?\s*([0-9۰-۹]{4}\s*[/\-.]\s*[0-9۰-۹]{1,2}\s*[/\-.]\s*[0-9۰-۹]{1,2})")


class ExcelError(ValueError):
    """Raised with a Persian message when a workbook cannot be processed."""


def _clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value != value:  # NaN
        return ""
    text = str(value).strip()
    return "" if text.lower() == "nan" else text


def _lookup(row: dict, *names: str) -> Any:
    for name in names:
        if name in row:
            return row[name]
    return None


def _strip_trailing_comma(text: str) -> str:
    """Spec §4.3: passenger names arrive with trailing ', ' artefacts."""
    return re.sub(r"[\s,،]+$", "", text)


def detect_file_type(columns: list[str]) -> str:
    """Spec §4.2."""
    if "هتل" in columns:
        return HOTEL
    if "مسیر" in columns:
        return FLIGHT
    return SERVICE


def read_workbook(data: bytes, sheet_name: str | None = None) -> tuple[list[str], list[dict]]:
    """Read the first (or named) sheet of an .xlsx/.xls file into rows."""
    import pandas as pd

    try:
        excel = pd.ExcelFile(io.BytesIO(data))
    except Exception as exc:  # noqa: BLE001 - surface a Persian message
        raise ExcelError("فایل اکسل قابل خواندن نیست.") from exc

    sheet = sheet_name or excel.sheet_names[0]
    frame = excel.parse(sheet)
    frame.columns = [_clean(c) for c in frame.columns]
    rows = frame.to_dict(orient="records")
    rows = [{_clean(k): v for k, v in row.items()} for row in rows]
    return list(frame.columns), rows


def _require(rows: list[dict], columns: list[str], required: list[str], label: str) -> None:
    if not rows:
        raise ExcelError(f"فایل {label} هیچ ردیفی ندارد.")
    missing = [c for c in required if c not in columns]
    if missing:
        raise ExcelError(f"ستون‌های لازم در فایل {label} وجود ندارد: {', '.join(missing)}")


# Workbooks from different offices name the same column differently
# ("قرارداد" vs "شماره قرارداد", "اتاق" vs "نوع اتاق"). Every processor reads the
# canonical name, so aliases are promoted to it before processing.
COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "شماره قرارداد": ("قرارداد", "شماره قرار داد", "قرارداد شماره", "شمارهٔ قرارداد"),
    "نام مسافر": ("مسافر", "نام و نام خانوادگی", "نام و نام خانوادگی مسافر", "نام مسافران"),
    "مسیر": ("مسیر پرواز", "مسیر رفت", "مسیر حرکت"),
    "شماره بلیط": ("شماره بلیت", "بلیط", "بلیت", "شماره بلیط/بلیت"),
    "هتل": ("نام هتل",),
    "اتاق": ("نوع اتاق", "نوع اقامت", "اتاق/نوع اتاق"),
    "تعداد نفرات": ("تعداد مسافر", "تعداد افراد", "تعداد", "نفرات"),
    "تاریخ ورود": ("ورود", "تاریخ ورود به هتل", "تاریخ چک‌این"),
    "تاریخ خروج": ("خروج", "تاریخ خروج از هتل", "تاریخ چک‌اوت"),
    "تاریخ پرواز": ("تاریخ حرکت", "تاریخ پرواز/حرکت", "پرواز"),
    "تاریخ": ("تاریخ خدمت", "تاریخ سرویس", "تاریخ ارائه خدمت"),
    "شرح خدمات": ("خدمات", "شرح خدمت", "نوع خدمت", "شرح"),
    "توضیحات": ("ملاحظات", "توضیح"),
    "بدهکار": ("بدهی", "مبلغ بدهکار"),
    "بستانکار": ("بستانکاری", "مبلغ بستانکار"),
}

# Columns that carry both stay dates in one cell: "ورود: 1404/03/05 خروج: 1404/03/07".
STAY_RANGE_NAMES = ("تاریخ ورود و خروج", "تاریخ اقامت", "ورود و خروج")


def _with_aliases(columns: list[str], rows: list[dict]) -> tuple[list[str], list[dict]]:
    """Promote known column aliases to their canonical names."""
    rename: dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        if canonical in columns:
            continue
        for alias in aliases:
            if alias in columns:
                rename[alias] = canonical
                break
    if not rename:
        return columns, rows

    new_columns = [rename.get(column, column) for column in columns]
    new_rows = []
    for row in rows:
        mapped = dict(row)
        for alias, canonical in rename.items():
            if canonical not in mapped and alias in mapped:
                mapped[canonical] = mapped[alias]
        new_rows.append(mapped)
    return new_columns, new_rows


def _flight_date(row: dict) -> str:
    for candidate in ("تاریخ پرواز", "مسیر", "توضیحات"):
        match = _FLIGHT_DATE_RE.search(to_english_digits(_clean(row.get(candidate))))
        if match:
            return match.group(1).replace(" ", "")
    raw = to_english_digits(_clean(row.get("تاریخ پرواز")))
    return raw if _FLIGHT_DATE_RE.match(f"تاریخ حرکت: {raw}") else ""


def process_flight(columns: list[str], rows: list[dict]) -> list[dict]:
    """Spec §4.3."""
    _require(
        rows,
        columns,
        ["نام مسافر", "شماره قرارداد", "مسیر", "شماره بلیط", "بدهکار", "بستانکار"],
        "پرواز",
    )
    out = []
    for index, row in enumerate(rows, start=1):
        debit = persian_to_english_number(_lookup(row, "بدهکار"))
        credit = persian_to_english_number(_lookup(row, "بستانکار"))
        out.append(
            {
                "ردیف": index,
                "قرارداد": _clean(_lookup(row, "شماره قرارداد")),
                "نام مسافر": _strip_trailing_comma(_clean(_lookup(row, "نام مسافر"))),
                "مسیر": _clean(_lookup(row, "مسیر")),
                "شماره بلیط": _clean(_lookup(row, "شماره بلیط")),
                "تاریخ پرواز": _flight_date(row),
                "بدهکار": debit,
                "بستانکار": credit,
                "مانده": debit - credit,
            }
        )
    return out


def _passenger_count(row: dict, columns: list[str]) -> int:
    """Spec §4.4 optional passenger-count column detection."""
    for name in PASSENGER_COUNT_NAMES:
        if name in columns:
            return max(1, persian_to_english_number(row.get(name)))

    for column in columns:
        if "نام" in column:
            continue
        if any(token in column for token in ("تعداد", "نفرات", "مسافر")):
            return max(1, persian_to_english_number(row.get(column)))
    return 1


def _stay_range(row: dict) -> str:
    combined = _clean(_lookup(row, *STAY_RANGE_NAMES))
    if combined:
        return to_english_digits(combined)
    check_in = to_english_digits(_clean(_lookup(row, "تاریخ ورود")))
    check_out = to_english_digits(_clean(_lookup(row, "تاریخ خروج")))
    if check_in and check_out:
        return f"ورود: {check_in}  خروج: {check_out}"
    if check_in:
        return f"ورود: {check_in}"
    if check_out:
        return f"خروج: {check_out}"
    return ""


def process_hotel(columns: list[str], rows: list[dict]) -> list[dict]:
    """Spec §4.4."""
    _require(
        rows,
        columns,
        ["نام مسافر", "شماره قرارداد", "هتل", "اتاق", "بدهکار", "بستانکار"],
        "هتل",
    )
    out = []
    for index, row in enumerate(rows, start=1):
        debit = persian_to_english_number(_lookup(row, "بدهکار"))
        credit = persian_to_english_number(_lookup(row, "بستانکار"))
        out.append(
            {
                "ردیف": index,
                "قرارداد": _clean(_lookup(row, "شماره قرارداد")),
                "نام مسافر": _strip_trailing_comma(_clean(_lookup(row, "نام مسافر"))),
                "هتل": _clean(_lookup(row, "هتل")),
                "نوع اتاق": _clean(_lookup(row, "اتاق")),
                "تعداد نفرات": _passenger_count(row, columns),
                "تاریخ ورود و خروج": _stay_range(row),
                "بدهکار": debit,
                "بستانکار": credit,
                "مانده": debit - credit,
            }
        )
    return out


def process_service(columns: list[str], rows: list[dict]) -> list[dict]:
    """Spec §4.5."""
    _require(rows, columns, ["نام مسافر", "شماره قرارداد", "بدهکار", "بستانکار"], "خدمات")
    out = []
    for index, row in enumerate(rows, start=1):
        debit = persian_to_english_number(_lookup(row, "بدهکار"))
        credit = persian_to_english_number(_lookup(row, "بستانکار"))
        out.append(
            {
                "ردیف": index,
                "قرارداد": _clean(_lookup(row, "شماره قرارداد")),
                "نام مسافر": _strip_trailing_comma(_clean(_lookup(row, "نام مسافر"))),
                "شرح خدمات": _clean(_lookup(row, "شرح خدمات")),
                "تاریخ": to_english_digits(_clean(_lookup(row, "تاریخ"))),
                "توضیحات": _clean(_lookup(row, "توضیحات")),
                "بدهکار": debit,
                "بستانکار": credit,
                "مانده": debit - credit,
            }
        )
    return out


PROCESSORS = {FLIGHT: process_flight, HOTEL: process_hotel, SERVICE: process_service}
COLUMNS = {FLIGHT: FLIGHT_COLUMNS, HOTEL: HOTEL_COLUMNS, SERVICE: SERVICE_COLUMNS}


def process(file_type: str, columns: list[str], rows: list[dict]) -> list[dict]:
    processor = PROCESSORS.get(file_type)
    if processor is None:
        raise ExcelError("نوع فایل نامعتبر است.")
    columns, rows = _with_aliases(columns, rows)
    return processor(columns, rows)


def totals(rows: list[dict]) -> dict:
    return {
        "debit": sum(int(r.get("بدهکار") or 0) for r in rows),
        "credit": sum(int(r.get("بستانکار") or 0) for r in rows),
        "balance": sum(int(r.get("مانده") or 0) for r in rows),
        "count": len(rows),
    }
