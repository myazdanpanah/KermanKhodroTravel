"""Configurable, free-form design for the generated images/PDF (گزارش‌ساز).

Design v2 is a page layout: every block (title, meta, table, totals, footer,
logo, signature, stamp) is an absolutely positioned element in millimetres on
an A4 page. The editor drags those blocks around; the server renders exactly
the same geometry with Jinja, so what the user arranges is what the PDF shows.

Older v1 designs (columns + flags, no ``elements``) are migrated on read.
"""

from __future__ import annotations

import re
import uuid

from .normalize import to_persian_digits

COLUMN_KEYS = (
    "rank",
    "contract",
    "passenger",
    "description",
    "date",
    "notes",
    "debit",
    "credit",
    "balance",
)

COLUMN_LABELS = {
    "rank": "ردیف",
    "contract": "شماره قرارداد",
    "passenger": "نام مسافر",
    "description": "شرح خدمات",
    "date": "تاریخ",
    "notes": "توضیحات",
    "debit": "بدهکار (ریال)",
    "credit": "بستانکار (ریال)",
    "balance": "مانده در خط",
}

COLUMN_WIDTHS = {
    "rank": 5,
    "contract": 9,
    "passenger": 16,
    "description": 20,
    "date": 10,
    "notes": 12,
    "debit": 10,
    "credit": 8,
    "balance": 10,
}

ROW_FIELDS = {
    "rank": "row_number",
    "contract": "contract",
    "passenger": "passenger",
    "description": "description",
    "date": "date",
    "notes": "notes",
    "debit": "debit_display",
    "credit": "credit_display",
    "balance": "balance_display",
}

FONT_CHOICES = ("KKT Vazirmatn", "B Nazanin", "B Titr")

ELEMENT_TYPES = (
    "text", "table", "logo", "signature", "stamp", "line", "rect", "spacer", "qr", "barcode",
    "frame", "repeater", "subreport", "labels",
)

FRAME_VARIANTS = ("container", "row", "column", "grid")

SUBREPORT_SOURCES = ("payer_summary", "payments", "invoices", "request")

PAGE_SIZES = {"landscape": (297, 210), "portrait": (210, 297)}

TITLE_TEXT = "صورت حساب {service_type} {buyer_name}"
META_TEXT = "تاریخ: {date}\nشماره صورتحساب: {number}"
TOTALS_TEXT = (
    "جمع کل بدهکار: {grand_debt} ریال" + chr(10)
    + "جمع کل بستانکار: {grand_credit} ریال" + chr(10)
    + "مانده نهایی: {grand_balance} ریال"
)

# Elements shared by both orientations; the page origin differs only by size.
LANDSCAPE_ELEMENTS = [
    {"id": "logo", "type": "logo", "x": 12, "y": 8, "w": 35, "h": 18, "show": True},
    {
        "id": "meta",
        "type": "text",
        "x": 177,
        "y": 8,
        "w": 108,
        "h": 14,
        "text": META_TEXT,
        "size": 11,
        "bold": True,
        "align": "left",
        "color": "#000000",
        "box": False,
        "bg": "",
        "border": False,
        "show": True,
    },
    {
        "id": "title",
        "type": "text",
        "x": 12,
        "y": 27,
        "w": 273,
        "h": 12,
        "text": TITLE_TEXT,
        "size": 15,
        "bold": True,
        "align": "center",
        "color": "#000000",
        "box": True,
        "bg": "#f0f0f0",
        "border": True,
        "show": True,
    },
    {
        "id": "table",
        "type": "table",
        "x": 12,
        "y": 43,
        "w": 273,
        "h": 95,
        "rows_per_page": 8,
        "size": 10,
        "show_page_totals": True,
        "columns": [{"key": key, "label": label, "visible": True} for key, label in COLUMN_LABELS.items()],
        "show": True,
    },
    {
        "id": "totals",
        "type": "text",
        "x": 12,
        "y": 134,
        "w": 273,
        "h": 22,
        "text": TOTALS_TEXT,
        "size": 10,
        "bold": True,
        "align": "right",
        "color": "#000000",
        "box": False,
        "bg": "",
        "border": False,
        "show": True,
    },
    {
        "id": "footer_note",
        "type": "text",
        "x": 12,
        "y": 153,
        "w": 273,
        "h": 12,
        "text": "",
        "size": 9,
        "bold": False,
        "align": "right",
        "color": "#000000",
        "box": False,
        "bg": "",
        "border": False,
        "show": True,
    },
    {"id": "signature", "type": "signature", "x": 190, "y": 167, "w": 70, "h": 30, "show": True},
    {"id": "stamp", "type": "stamp", "x": 37, "y": 167, "w": 70, "h": 30, "show": True},
]

PORTRAIT_ELEMENTS = [
    {"id": "logo", "type": "logo", "x": 10, "y": 8, "w": 32, "h": 16, "show": True},
    {
        "id": "meta",
        "type": "text",
        "x": 95,
        "y": 8,
        "w": 105,
        "h": 14,
        "text": META_TEXT,
        "size": 10,
        "bold": True,
        "align": "left",
        "color": "#000000",
        "box": False,
        "bg": "",
        "border": False,
        "show": True,
    },
    {
        "id": "title",
        "type": "text",
        "x": 10,
        "y": 26,
        "w": 190,
        "h": 12,
        "text": TITLE_TEXT,
        "size": 13,
        "bold": True,
        "align": "center",
        "color": "#000000",
        "box": True,
        "bg": "#f0f0f0",
        "border": True,
        "show": True,
    },
    {
        "id": "table",
        "type": "table",
        "x": 10,
        "y": 42,
        "w": 190,
        "h": 140,
        "rows_per_page": 9,
        "size": 9,
        "show_page_totals": True,
        "columns": [{"key": key, "label": label, "visible": True} for key, label in COLUMN_LABELS.items()],
        "show": True,
    },
    {
        "id": "totals",
        "type": "text",
        "x": 10,
        "y": 188,
        "w": 190,
        "h": 12,
        "text": TOTALS_TEXT,
        "size": 9,
        "bold": True,
        "align": "center",
        "color": "#000000",
        "box": False,
        "bg": "",
        "border": False,
        "show": True,
    },
    {
        "id": "footer_note",
        "type": "text",
        "x": 10,
        "y": 205,
        "w": 190,
        "h": 14,
        "text": "",
        "size": 8,
        "bold": False,
        "align": "right",
        "color": "#000000",
        "box": False,
        "bg": "",
        "border": False,
        "show": True,
    },
    {"id": "signature", "type": "signature", "x": 125, "y": 230, "w": 70, "h": 30, "show": True},
    {"id": "stamp", "type": "stamp", "x": 15, "y": 230, "w": 70, "h": 30, "show": True},
]

DEFAULT_DESIGN = {
    "design_version": 2,
    "font_family": "KKT Vazirmatn",
    "accent_color": "#000000",
    "header_bg": "#f0f0f0",
    "page_orientation": "landscape",
    "signature_label": "مهر شرکت",
    "elements": LANDSCAPE_ELEMENTS,
}

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _clone(value):
    if isinstance(value, dict):
        return {key: _clone(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_clone(item) for item in value]
    return value


def default_design(orientation: str = "landscape") -> dict:
    orientation = orientation if orientation in PAGE_SIZES else "landscape"
    return {
        "design_version": 2,
        "font_family": "KKT Vazirmatn",
        "accent_color": "#000000",
        "header_bg": "#f0f0f0",
        "page_orientation": orientation,
        "signature_label": "مهر شرکت",
        "elements": _clone(LANDSCAPE_ELEMENTS if orientation == "landscape" else PORTRAIT_ELEMENTS),
    }


def _text(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _color(value, fallback: str) -> str:
    value = str(value or "").strip()
    return value if _HEX.match(value) else fallback


def _num(value, fallback: float, low: float, high: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number != number:  # NaN
        return fallback
    return max(low, min(number, high))


def _bool(value, fallback: bool = True) -> bool:
    if value is None:
        return fallback
    return bool(value)


def _normalize_columns(raw) -> list[dict]:
    submitted: dict[str, dict] = {}
    if isinstance(raw, list):
        for column in raw[: len(COLUMN_KEYS)]:
            if isinstance(column, dict) and column.get("key") in COLUMN_LABELS:
                submitted[column["key"]] = column
    columns = []
    for key in COLUMN_KEYS:
        source = submitted.get(key, {})
        label = _text(source.get("label"), 40) or COLUMN_LABELS[key]
        width = int(_num(source.get("width"), COLUMN_WIDTHS[key], 3, 60))
        columns.append(
            {"key": key, "label": label, "visible": _bool(source.get("visible"), True), "width": width}
        )
    return columns


def _element_from_v1(raw: dict, base_elements: list[dict]) -> list[dict]:
    """Turn a legacy (v1) design into positioned elements."""
    by_id = {element["id"]: _clone(element) for element in base_elements}

    title = _text(raw.get("title_template"), 200)
    if title:
        by_id["title"]["text"] = title

    columns = _normalize_columns(raw.get("columns"))
    by_id["table"]["columns"] = columns
    by_id["table"]["rows_per_page"] = int(_num(raw.get("rows_per_page"), 8, 1, 20))
    by_id["table"]["show_page_totals"] = _bool(raw.get("show_totals"), True)

    by_id["logo"]["show"] = _bool(raw.get("show_logo"), True)
    by_id["signature"]["show"] = _bool(raw.get("show_signature"), True)
    by_id["stamp"]["show"] = _bool(raw.get("show_stamp"), True)
    by_id["totals"]["show"] = _bool(raw.get("show_final_totals"), True)
    by_id["footer_note"]["text"] = _text(raw.get("footer_note"), 500)
    by_id["title"]["bg"] = _color(raw.get("header_bg"), "#f0f0f0")
    by_id["title"]["color"] = _color(raw.get("accent_color"), "#000000")
    return list(by_id.values())


def normalize_design(raw) -> dict:
    """Validate a v2 design, or migrate a v1 one. Unknown content is dropped."""
    if not isinstance(raw, dict):
        raw = {}

    orientation = str(raw.get("page_orientation") or "").strip()
    orientation = orientation if orientation in PAGE_SIZES else "landscape"
    page_w, page_h = PAGE_SIZES[orientation]

    design = default_design(orientation)
    design["font_family"] = (
        str(raw.get("font_family") or "").strip()
        if str(raw.get("font_family") or "").strip() in FONT_CHOICES
        else design["font_family"]
    )
    design["accent_color"] = _color(raw.get("accent_color"), design["accent_color"])
    design["header_bg"] = _color(raw.get("header_bg"), design["header_bg"])
    design["signature_label"] = _text(raw.get("signature_label"), 60) or design["signature_label"]

    submitted = raw.get("elements")
    if isinstance(submitted, list) and submitted:
        defaults = {element["id"]: element for element in design["elements"]}
        normalized: list[dict] = []
        seen_ids: set[str] = set()
        for item in submitted[:40]:
            if not isinstance(item, dict):
                continue
            element_type = item.get("type")
            if element_type not in ELEMENT_TYPES:
                continue
            element_id = re.sub(r"[^a-zA-Z0-9_-]", "", str(item.get("id") or ""))[:40] or uuid.uuid4().hex[:8]
            if element_id in seen_ids:
                element_id = f"{element_id[:32]}-{uuid.uuid4().hex[:4]}"
            seen_ids.add(element_id)
            base = _clone(
                defaults.get(
                    element_id,
                    {"id": element_id, "type": element_type, "x": 20, "y": 20, "w": 40, "h": 10},
                )
            )
            base["type"] = element_type

            el_x = round(_num(item.get("x"), base.get("x", 10), 0, max(0, page_w - 5)), 2)
            el_y = round(_num(item.get("y"), base.get("y", 10), 0, max(0, page_h - 5)), 2)
            el_w = round(_num(item.get("w"), base.get("w", 60), 5, max(5, page_w - el_x)), 2)
            el_h = round(_num(item.get("h"), base.get("h", 10), 4, max(4, page_h - el_y)), 2)

            base.update(
                {
                    "id": element_id,
                    "type": element_type,
                    "x": el_x,
                    "y": el_y,
                    "w": el_w,
                    "h": el_h,
                    "show": _bool(item.get("show"), True),
                }
            )

            if element_type == "text":
                base.update(
                    {
                        "text": _text(item.get("text"), 1200),
                        "size": int(_num(item.get("size"), base.get("size", 11), 5, 40)),
                        "bold": _bool(item.get("bold"), False),
                        "align": item.get("align") if item.get("align") in {"right", "center", "left"} else "right",
                        "color": _color(item.get("color"), "#000000"),
                        "box": _bool(item.get("box"), False),
                        "bg": _color(item.get("bg"), "") if item.get("bg") else "",
                        "border": _bool(item.get("border"), False),
                    }
                )
            elif element_type in {"line", "rect"}:
                base.update(
                    {
                        "color": _color(item.get("color"), design["accent_color"]),
                        "bg": _color(item.get("bg"), "") if item.get("bg") else "",
                        "thickness": round(_num(item.get("thickness"), 0.4, 0.1, 3), 2),
                    }
                )
            elif element_type in {"qr", "barcode"}:
                base.update({"data": _text(item.get("data"), 300) or "{number}"})
            elif element_type == "frame":
                base.update(
                    {
                        "variant": item.get("variant") if item.get("variant") in FRAME_VARIANTS else "container",
                        "title": _text(item.get("title"), 60),
                        "bg": _color(item.get("bg"), "") if item.get("bg") else "",
                        "border": _bool(item.get("border"), True),
                        "thickness": round(_num(item.get("thickness"), 0.3, 0.1, 2), 2),
                    }
                )
            elif element_type == "repeater":
                base.update(
                    {
                        "template": _text(item.get("template"), 300) or "{passenger} — {debt}",
                        "max_rows": int(_num(item.get("max_rows"), 6, 1, 20)),
                        "size": int(_num(item.get("size"), base.get("size", 10), 6, 20)),
                        "color": _color(item.get("color"), "#000000"),
                    }
                )
            elif element_type == "labels":
                base.update(
                    {
                        "template": _text(item.get("template"), 200) or "{passenger}",
                        "cols": int(_num(item.get("cols"), 2, 1, 6)),
                        "rows": int(_num(item.get("rows"), 4, 1, 12)),
                        "size": int(_num(item.get("size"), base.get("size", 9), 6, 20)),
                        "border": _bool(item.get("border"), True),
                    }
                )
            elif element_type == "subreport":
                base.update(
                    {
                        "source": item.get("source") if item.get("source") in SUBREPORT_SOURCES else "payer_summary",
                        "title": _text(item.get("title"), 60),
                        "size": int(_num(item.get("size"), base.get("size", 10), 6, 20)),
                    }
                )
            elif element_type == "table":
                base.update(
                    {
                        "columns": _normalize_columns(item.get("columns", base.get("columns"))),
                        "rows_per_page": int(_num(item.get("rows_per_page"), base.get("rows_per_page", 8), 1, 20)),
                        "size": int(_num(item.get("size"), base.get("size", 10), 6, 20)),
                        "show_page_totals": _bool(item.get("show_page_totals"), True),
                    }
                )
            normalized.append(base)

        if not any(element["type"] == "table" for element in normalized):
            normalized.extend(_clone([defaults["table"]]))
        design["elements"] = normalized
    else:
        design["elements"] = _element_from_v1(raw, design["elements"])

    return design


def visible_columns(design_or_columns) -> list[dict]:
    """Printing columns of the table element, with width class and row field."""
    columns = design_or_columns
    if isinstance(design_or_columns, dict):
        columns = []
        for element in design_or_columns.get("elements", []):
            if element.get("type") == "table":
                columns = element.get("columns", [])
                break
    result = []
    for column in columns or []:
        if not column.get("visible", True):
            continue
        key = column["key"]
        result.append(
            {
                "key": key,
                "label": column["label"],
                "field": ROW_FIELDS[key],
                "width": column.get("width") or COLUMN_WIDTHS[key],
            }
        )
    if not result:
        return [{"key": "rank", "label": COLUMN_LABELS["rank"], "field": "row_number", "width": 100.0}]

    total_w = sum(c["width"] for c in result) or 1
    for c in result:
        c["width"] = round((c["width"] / total_w) * 100.0, 1)

    diff = round(100.0 - sum(c["width"] for c in result), 1)
    if diff != 0:
        largest = max(result, key=lambda c: c["width"])
        largest["width"] = round(largest["width"] + diff, 1)

    return result


def table_element(design: dict) -> dict:
    for element in design.get("elements", []):
        if element.get("type") == "table":
            return element
    return normalize_design(design)["elements"][3]


def render_text(text: str, values: dict) -> str:
    """Substitute {placeholders} without ever raising or leaking braces."""
    safe = {key: str(value) for key, value in values.items()}

    class _Safe(dict):
        def __missing__(self, key):  # unknown placeholder stays literal
            return "{" + key + "}"

    try:
        return str(text or "").format_map(_Safe(safe))
    except (IndexError, ValueError):
        return str(text or "")


def design_css(design: dict) -> str:
    page_w, page_h = PAGE_SIZES[design["page_orientation"]]
    font_name = design.get("font_family") or "KKT Vazirmatn"
    return f"""
@page {{ size: {page_w}mm {page_h}mm; margin: 0; }}
body {{ font-family: '{font_name}', 'KKT Vazirmatn', 'B Nazanin', Tahoma, sans-serif; }}
.page {{ position: relative; width: {page_w}mm; height: {page_h}mm; overflow: hidden; background: #fff; page-break-after: always; }}
.page:last-child {{ page-break-after: avoid; }}
.el {{ position: absolute; box-sizing: border-box; }}
.el-text {{ white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; }}
.el-table {{ overflow: hidden; }}
.el-table table {{ width: 100%; border-collapse: collapse; table-layout: fixed; box-sizing: border-box; }}
.el-table th, .el-table td {{ border: 0.4mm solid {design['accent_color']}; padding: 1mm 1.2mm; text-align: center; overflow-wrap: anywhere; word-break: break-word; font-size: inherit; }}
.el-table th {{ background: {design['header_bg']}; font-weight: bold; }}
.el-table .page-totals td {{ font-weight: bold; background: #fafafa; }}
.el-signature, .el-stamp {{ text-align: center; font-size: 9pt; }}
.el-signature img, .el-stamp img {{ max-height: 18mm; max-width: 100%; }}
.el-logo img {{ max-height: 100%; max-width: 100%; }}
"""


def sample_values() -> dict:
    return {
        "service_type": "پرواز",
        "buyer_name": "شرکت نمونه",
        "number": "1404/8101/00001",
        "date": "1404/03/01",
        "grand_debt": to_persian_digits("20,500,000"),
        "grand_credit": to_persian_digits("0"),
        "grand_balance": to_persian_digits("20,500,000"),
        "page_debt": to_persian_digits("20,500,000"),
        "page_credit": to_persian_digits("0"),
        "page_balance": to_persian_digits("20,500,000"),
        "manager_name": "مدیر امور اداری و مالی",
        "manager_position": "",
    }


def sample_rows() -> list[dict]:
    samples = (
        ("KER-THR", "نمونه مسافر یک", "KER-MHD", "1404/03/12", "بلیط: ۱۲۳۴۵۶", 12_500_000, 0),
        ("KER-THR", "نمونه مسافر دو", "THR-KER", "1404/03/14", "بلیط: ۱۲۳۴۵۷", 8_000_000, 0),
    )
    rows = []
    for index, (contract, passenger, description, date, notes, debit, credit) in enumerate(samples):
        rows.append(
            {
                "row_number": to_persian_digits(str(index + 1)),
                "contract": contract,
                "passenger": passenger,
                "description": description,
                "date": to_persian_digits(date),
                "notes": notes,
                "debit_display": to_persian_digits(f"{debit:,}"),
                "credit_display": to_persian_digits(f"{credit:,}"),
                "balance_display": to_persian_digits(f"{debit - credit:,}"),
            }
        )
    return rows


def sample_context(design: dict) -> dict:
    """Synthetic data for the live editor; no customer data leaves the server."""
    table = table_element(design)
    rows = sample_rows()
    values = sample_values()
    return {
        "values": values,
        "rows": rows,
        "columns": visible_columns(design),
        "rows_per_page": table.get("rows_per_page", 8),
        "subreports": {
            "payer_summary": [
                f"جمع صورتحساب: {values['grand_debt']} ریال",
                f"جمع پرداخت: {values['grand_credit']} ریال",
                f"مانده: {values['grand_balance']} ریال",
            ],
            "payments": [
                "1404/03/02 — ۵,۰۰۰,۰۰۰ ریال — پیگیری ۱۲۳۴",
                "1404/03/05 — ۳,۵۰۰,۰۰۰ ریال — پیگیری ۵۶۷۸",
            ],
            "invoices": ["تعداد صورتحساب: ۲", f"جمع مبلغ: {values['grand_debt']} ریال"],
            "request": [
                f"شماره نامه: {values['number']}",
                f"تاریخ: {values['date']}",
                f"شرکت: {values['buyer_name']}",
            ],
        },
    }
