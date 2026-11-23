"""
Document generation (spec §5.2 step 6, §8).

Produces, for every non-empty service block of an approved request:
  * a Word (.docx) letter built with python-docx (RTL, B Nazanin),
  * the صورتحساب as a PDF rendered from HTML by a headless Edge/Chrome
    (one browser launch shared by every document of the request).

Both artifacts go through :func:`apps.billing.services.files.save_final_file`,
so they exist on disk and in the DB BLOB.
"""

from __future__ import annotations

import base64
import html
import datetime as dt
import io
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import requests
from django.conf import settings as django_settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from ..models import (
    ApprovalRequest,
    CompanySettings,
    Credit,
    FinalFile,
    Invoice,
    InvoiceItem,
    InvoiceTemplate,
    ManualDebt,
    Payer,
    Payment,
    ReportDesign,
)
from .files import save_final_file
from .normalize import gregorian_to_persian, persian_date_to_gregorian, to_persian_digits
from .report_design import design_css, normalize_design, render_text, table_element, visible_columns

try:  # Jinja2 ships with WeasyPrint but is imported eagerly for the HTML path
    from jinja2 import Environment, select_autoescape
except Exception:  # pragma: no cover - dependency always installed via requirements
    Environment = None  # type: ignore[assignment]

SERVICE_KEYS = [
    ("flight", "flight_data", "پرواز"),
    ("hotel", "hotel_data", "هتل"),
    ("service", "service_data", "خدمات"),
]

LEGAL_NOTE = (
    "**** برابر قانون و با توجه به ماهیت کار آژانس (ارائه خدمات واسطه‌ای) برای هریک از خدمات "
    "ارائه شده ، صورتحساب به نام و کد ملی مسافر صادر و به سامانه مودیان ارسال می‌گردد. ****"
)

# The three official letters: debt (main), debt of a subsidiary, credit note.
LETTER_KINDS = (
    ("debt", "اعلامیه بدهی (اصلی)"),
    ("subsidiary", "اعلامیه بدهی (شرکت زیرمجموعه)"),
    ("credit", "اعلامیه بستانکاری"),
)

DEFAULT_CSS = """
@page { size: A4; margin: 22mm 18mm; }
body { font-family: "B Nazanin", "Vazirmatn", Tahoma, sans-serif; font-size: 12.5pt; direction: rtl; color: #101D35; line-height: 1.95; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.header .logo img { height: 62px; }
.header .meta { text-align: left; font-size: 11pt; line-height: 1.9; }
p { margin: 0 0 10px; }
.payer { font-weight: 700; margin: 4px 0 10px; }
.amount { font-weight: 700; }
.banks { margin-top: 6px; font-size: 11pt; line-height: 2; }
.signature { margin-top: 30px; text-align: left; font-size: 11pt; line-height: 1.9; }
.signature img { height: 46px; margin-bottom: 4px; }
.legal { margin-top: 28px; font-size: 9.5pt; color: #5a6a85; text-align: justify; }
"""

DEFAULT_HTML = """
<div class="header">
  <div class="logo">{% if logo_data_uri %}<img src="{{ logo_data_uri }}" alt="logo">{% endif %}</div>
  <div class="meta">
    <div>تاریخ: {{ letter_date }}</div>
    <div>شماره: {{ letter_number }}</div>
  </div>
</div>
<p class="payer">شرکت محترم {{ payer }}</p>
{% if variant == 'credit' %}
  <p>احتراماً {{ period_range }}</p>
  <p><strong>بابت خدمت {{ service_type }} خریداری‌شده، مبلغ <span class="amount">{{ total_credit_display }}</span> ریال</strong></p>
  <p>نزد شرکت {{ company_name }} <strong>بستانکار</strong> می‌باشید.</p>
  <p>در نظر داشته باشید که این مبلغ در خریدهای آینده از حساب شما کسر خواهد شد.</p>
{% else %}
  <p>احتراماً بدین وسیله صورت‌حساب {% if variant == 'subsidiary' %}مربوط به {{ subsidiary }} {% endif %}{{ period_range }}</p>
  <p><strong>بابت {{ service_type }} به مبلغ <span class="amount">{{ total_debt_display }}</span> ریال</strong></p>
  <p>جهت اطلاع و انجام اقدامات لازم به پیوست ایفاد می‌گردد.</p>
  <p>خواهشمند است دستور فرمائید مبلغ مربوطه به حساب این شرکت واریز شود.</p>
  <p>مشخصات حساب بانکی شرکت به شرح زیر است:</p>
  <div class="banks">
    {% if bank_name1 %}<div>بانک {{ bank_name1 }} شماره حساب: {{ account_number1 }} شماره شبا: {{ shaba_number1 }}</div>{% endif %}
    {% if bank_name2 %}<div>بانک {{ bank_name2 }} شماره حساب: {{ account_number2 }} شماره شبا: {{ shaba_number2 }}</div>{% endif %}
  </div>
{% endif %}
<div class="signature">
  {% if signature_data_uri %}<img src="{{ signature_data_uri }}" alt="signature">{% endif %}
  {% if stamp_data_uri %}<img src="{{ stamp_data_uri }}" alt="stamp">{% endif %}
  <div>{{ company_name }}</div>
  <div>{{ manager_name }}</div>
  <div>{{ manager_position }}</div>
</div>
<p class="legal">{{ legal_note }}</p>
"""

HTML_DOCUMENT = """<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head><meta charset="utf-8"><style>{css}</style></head>
<body>{body}</body>
</html>"""


class GenerationError(RuntimeError):
    pass


# ── context ───────────────────────────────────────────────────────────────

def _data_uri(path_value: str) -> str:
    if not path_value:
        return ""
    path = Path(path_value)
    if not path.is_absolute():
        path = Path(django_settings.MEDIA_ROOT) / path_value
    if not path.exists() or path.stat().st_size == 0:
        return ""
    suffix = path.suffix.lower().lstrip(".") or "png"
    mime = "image/jpeg" if suffix in {"jpg", "jpeg"} else f"image/{suffix}"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def _variant(request_obj: ApprovalRequest) -> str:
    """Pick one of the three official letters (spec §2)."""
    payer = Payer.objects.filter(code=request_obj.payer_code).first()
    if payer is not None and payer.parent_id:
        return "subsidiary"
    if request_obj.total_credit > 0 and request_obj.total_debt == 0:
        return "credit"
    return "debt"


def build_context(request_obj: ApprovalRequest, rows: list[dict], columns: list[str]) -> dict:
    company = CompanySettings.load()
    payer = Payer.objects.filter(code=request_obj.payer_code).first()
    variant = _variant(request_obj)
    subsidiary_name = ""
    recipient = request_obj.payer_name
    if variant == "subsidiary" and payer is not None and payer.parent is not None:
        # The letter about a subsidiary's account is addressed to its parent.
        subsidiary_name = payer.name
        recipient = payer.parent.name
    return {
        "letter_date": request_obj.letter_date,
        "letter_number": request_obj.letter_number,
        "payer": recipient,
        "payer_code": request_obj.payer_code,
        "period_range": request_obj.period_range,
        "service_type": request_obj.service_type,
        "subsidiary": subsidiary_name,
        "variant": variant,
        "legal_note": company.legal_note or LEGAL_NOTE,
        "total_debt": sum(int(r.get("بدهکار") or 0) for r in rows),
        "total_credit": sum(int(r.get("بستانکار") or 0) for r in rows),
        "company_name": company.company_name or "",
        "address": company.address or "",
        "phone": company.phone or "",
        "national_id": company.national_id or "",
        "economic_code": company.economic_code or "",
        "registration_number": company.registration_number or "",
        "postal_code": company.postal_code or "",
        "total_debt_display": f"{sum(int(r.get('بدهکار') or 0) for r in rows):,}",
        "total_credit_display": f"{sum(int(r.get('بستانکار') or 0) for r in rows):,}",
        "manager_name": company.manager_name or "",
        "manager_position": company.manager_position or "",
        "logo_path": company.logo_path,
        "signature_path": company.signature_path,
        "stamp_path": company.stamp_path,
        "bank_name1": company.bank_name1,
        "account_number1": company.account_number1,
        "shaba_number1": company.shaba_number1,
        "bank_name2": company.bank_name2,
        "account_number2": company.account_number2,
        "shaba_number2": company.shaba_number2,
        "logo_data_uri": _data_uri(company.logo_path),
        "signature_data_uri": _data_uri(company.signature_path),
        "stamp_data_uri": _data_uri(company.stamp_path),
        "rows": rows,
        "columns": columns,
        "generated_on": gregorian_to_persian(dt.date.today()),
    }


# ── renderers ─────────────────────────────────────────────────────────────

def active_template() -> InvoiceTemplate | None:
    return InvoiceTemplate.objects.filter(is_active=True).order_by("-id").first()


def render_html(context: dict, template: InvoiceTemplate | None = None) -> str:
    template = template or active_template()
    html = (template.html_content if template and template.html_content else DEFAULT_HTML)
    css = (template.css_content if template and template.css_content else DEFAULT_CSS)
    if Environment is None:  # pragma: no cover
        raise GenerationError("Jinja2 در دسترس نیست؛ بازسازی محیط لازم است.")
    env = Environment(autoescape=select_autoescape(["html", "xml"]))
    body = env.from_string(html).render(**context)
    return HTML_DOCUMENT.format(css=css, body=body)


# ── invoice PDF (HTML -> PDF) ────────────────────────────────────────────
#
# The Word file is the official letter. The PDF is the صورتحساب table rendered
# from HTML (A4 landscape, eight rows per page, per-page and grand totals) with
# the company logo, signature and stamp, matching the layout the finance team
# sends to customers.

INVOICE_FONT_FAMILY = "KKT Vazirmatn"
# The invoice PDF uses the embedded face first so the output is identical on
# every machine; B Nazanin stays available for the Word letter, where the font
# is referenced by name and applied by Word on the user's computer.
INVOICE_FONT_STACK = f"'{INVOICE_FONT_FAMILY}', 'B Nazanin', Tahoma, Arial, sans-serif"

ASSETS_DIR = Path(__file__).with_name("assets")


def _embedded_font_faces() -> str:
    """
    Embed Vazirmatn, B Nazanin, B Titr, and other fonts in the invoice stylesheet.
    """
    faces = []
    subsets = (
        ("arabic", "U+0600-06FF, U+0750-077F, U+0870-088E, U+FB50-FDFF, U+FE70-FEFF"),
        ("latin", "U+0000-00FF, U+2000-206F, U+20AC"),
    )
    for weight in (400, 700):
        for subset, unicode_range in subsets:
            path = ASSETS_DIR / f"vazirmatn-{subset}-{weight}-normal.woff2"
            if not path.exists():  # pragma: no cover - assets ship with the app
                continue
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            faces.append(
                f"@font-face {{ font-family: '{INVOICE_FONT_FAMILY}'; font-style: normal; "
                f"font-weight: {weight}; unicode-range: {unicode_range}; "
                f"src: url(data:font/woff2;base64,{encoded}) format('woff2'); }}"
            )
            faces.append(
                f"@font-face {{ font-family: 'Vazirmatn'; font-style: normal; "
                f"font-weight: {weight}; unicode-range: {unicode_range}; "
                f"src: url(data:font/woff2;base64,{encoded}) format('woff2'); }}"
            )

    fonts_dir = Path(django_settings.MEDIA_ROOT) / "fonts"
    p_nazanin = fonts_dir / "B_Nazanin.ttf"
    if p_nazanin.exists():
        enc_nazanin = base64.b64encode(p_nazanin.read_bytes()).decode("ascii")
        for weight in ("normal", "bold", "400", "700"):
            faces.append(
                f"@font-face {{ font-family: 'B Nazanin'; font-style: normal; "
                f"font-weight: {weight}; "
                f"src: url(data:font/truetype;base64,{enc_nazanin}) format('truetype'); }}"
            )

    p_titr = fonts_dir / "B_Titr_Bold.ttf"
    if p_titr.exists():
        enc_titr = base64.b64encode(p_titr.read_bytes()).decode("ascii")
        for weight in ("normal", "bold", "400", "700"):
            faces.append(
                f"@font-face {{ font-family: 'B Titr'; font-style: normal; "
                f"font-weight: {weight}; "
                f"src: url(data:font/truetype;base64,{enc_titr}) format('truetype'); }}"
            )

    p_mitra = fonts_dir / "B_Mitra.ttf"
    if p_mitra.exists():
        enc_mitra = base64.b64encode(p_mitra.read_bytes()).decode("ascii")
        for weight in ("normal", "bold", "400", "700"):
            faces.append(
                f"@font-face {{ font-family: 'B Mitra'; font-style: normal; "
                f"font-weight: {weight}; "
                f"src: url(data:font/truetype;base64,{enc_mitra}) format('truetype'); }}"
            )

    return "\n".join(faces)


INVOICE_CSS = f"""
{_embedded_font_faces()}
body {{ font-family: {INVOICE_FONT_STACK}; font-size: 12px; line-height: 1.4; margin: 0; direction: rtl; }}
.page {{ page-break-after: always; }}
.page:last-child {{ page-break-after: avoid; }}
.header-top {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }}
.left-info {{ text-align: left; font-size: 14px; line-height: 1.4; }}
.left-info div {{ margin-bottom: 2px; font-weight: bold; }}
.logo {{ max-height: 60px; max-width: 150px; }}
.header-box {{ border: 1.75px solid #000; padding: 8px 12px; margin-bottom: 6px; text-align: center; font-weight: bold; font-size: 16px; background-color: #f9f9f9; }}
.data-table {{ width: 100%; border-collapse: collapse; margin: 8px 0; border: 1.75px solid #000; table-layout: fixed; }}
.data-table th, .data-table td {{ border: 1.75px solid #000; padding: 6px 8px; text-align: center; font-size: 13px; font-weight: bold; overflow-wrap: anywhere; word-break: break-word; }}
.data-table col.c-rank {{ width: 5%; }}
.data-table col.c-contract {{ width: 9%; }}
.data-table col.c-passenger {{ width: 16%; }}
.data-table col.c-description {{ width: 20%; }}
.data-table col.c-date {{ width: 10%; }}
.data-table col.c-notes {{ width: 12%; }}
.data-table col.c-debit {{ width: 10%; }}
.data-table col.c-credit {{ width: 8%; }}
.data-table col.c-balance {{ width: 10%; }}
.data-table th {{ background-color: #f0f0f0; }}
.totals-row {{ margin-top: 6px; display: flex; justify-content: space-between; border-top: 1.75px solid #000; padding-top: 5px; font-size: 12px; }}
.footer {{ margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }}
"""

INVOICE_HTML = """
<!DOCTYPE html>
<html dir="rtl" lang="fa"><head><meta charset="UTF-8"><style>{{ css|safe }}</style></head>
<body>
{% for page in pages %}
  <div class="page">
    {% for el in page.elements %}
      {% if el.type == 'text' %}
      <div class="el el-text" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm; font-size: {{ el.size }}pt; font-weight: {{ 'bold' if el.bold else 'normal' }}; text-align: {{ el.align }}; color: {{ el.color }};{% if el.box %} background: {{ el.bg or '#ffffff' }};{% endif %}{% if el.border %} border: 0.4mm solid {{ accent }}; padding: 1.5mm;{% endif %}">{{ el.html|safe }}</div>
      {% elif el.type == 'table' %}
      <div class="el el-table" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm; font-size: {{ el.size }}pt;">
        <table>
          <colgroup>{% for column in el.columns %}<col style="width: {{ column.width }}%;">{% endfor %}</colgroup>
          <thead><tr>{% for column in el.columns %}<th>{{ column.label }}</th>{% endfor %}</tr></thead>
          <tbody>
          {% for row in page.rows %}
            <tr>{% for column in el.columns %}<td>{{ row[column.field] }}</td>{% endfor %}</tr>
          {% endfor %}
          {% if el.show_page_totals %}
            <tr class="page-totals">
              {% for column in el.columns %}<td>{% if loop.first %}جمع صفحه{% elif column.key == 'debit' %}{{ page.total_debt_display }}{% elif column.key == 'credit' %}{{ page.total_credit_display }}{% elif column.key == 'balance' %}{{ page.total_balance_display }}{% endif %}</td>{% endfor %}
            </tr>
          {% endif %}
          </tbody>
        </table>
      </div>
      {% elif el.type == 'line' %}
      <div class="el" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: 0; border-top: {{ el.thickness }}mm solid {{ el.color }};"></div>
      {% elif el.type == 'rect' %}
      <div class="el" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm; border: {{ el.thickness }}mm solid {{ el.color }};{% if el.bg %} background: {{ el.bg }};{% endif %}"></div>
      {% elif el.type == 'spacer' %}
      <div class="el" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm;"></div>
      {% elif el.type == 'qr' or el.type == 'barcode' %}
      <div class="el" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm;">{% if el.src %}<img src="{{ el.src }}" style="width: 100%; height: 100%; object-fit: contain;" alt="">{% endif %}</div>
      {% elif el.type == 'frame' %}
      <div class="el el-frame frame-{{ el.variant }}" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm;{% if el.border %} border: {{ el.thickness }}mm dashed {{ accent }};{% endif %}{% if el.bg %} background: {{ el.bg }};{% endif %}">
        {% if el.title %}<span class="frame-title" style="background: {{ header_bg }};">{{ el.title }}</span>{% endif %}
      </div>
      {% elif el.type == 'repeater' %}
      <div class="el" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm; font-size: {{ el.size }}pt; color: {{ el.color }}; overflow: hidden;">
        {% for line in el.lines %}<div class="repeater-line">{{ line|safe }}</div>{% endfor %}
      </div>
      {% elif el.type == 'subreport' %}
      <div class="el subreport" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm; font-size: {{ el.size }}pt;">
        {% if el.title %}<div class="subreport-title">{{ el.title }}</div>{% endif %}
        {% for line in el.lines %}<div>{{ line }}</div>{% endfor %}
      </div>
      {% elif el.type == 'labels' %}
      <div class="el labels" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm; font-size: {{ el.size }}pt; grid-template-columns: repeat({{ el.cols }}, 1fr); grid-template-rows: repeat({{ el.rows }}, 1fr);">
        {% for cell in el.cells %}<div class="label-cell"{% if el.border %} style="border: 0.3mm solid {{ accent }};"{% endif %}>{{ cell|safe }}</div>{% endfor %}
      </div>
      {% elif el.type == 'logo' %}
      <div class="el el-logo" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm;">{% if seller.logo %}<img src="{{ seller.logo }}" alt="">{% endif %}</div>
      {% elif el.type == 'signature' %}
      <div class="el el-signature" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm;">
        {% if seller.signature %}<img src="{{ seller.signature }}" alt="">{% else %}<p>................................</p>{% endif %}
        <p>{{ seller.manager_name }}<br>{{ seller.manager_position }}</p>
      </div>
      {% elif el.type == 'stamp' %}
      <div class="el el-stamp" style="left: {{ el.x }}mm; top: {{ el.y }}mm; width: {{ el.w }}mm; height: {{ el.h }}mm;">
        {% if seller.stamp %}<img src="{{ seller.stamp }}" alt="">{% else %}<p>................................</p>{% endif %}
        <p>{{ signature_label }}</p>
      </div>
      {% endif %}
    {% endfor %}
  </div>
{% endfor %}
</body></html>
"""


def _amount(value: int | float) -> str:
    """Grouped Persian digits for a debit/credit amount."""
    return to_persian_digits(f"{int(value):,}")


def _signed_amount(value: int | float) -> str:
    """Running balance: a negative figure prints in accounting parentheses."""
    return f"({_amount(abs(value))})" if int(value) < 0 else _amount(value)


def _format_row_date(raw_date: Any) -> str:
    """Format any row date into Persian (Jalali) with Persian digits."""
    if not raw_date:
        return ""
    if isinstance(raw_date, (dt.date, dt.datetime)):
        return to_persian_digits(gregorian_to_persian(raw_date))
    s = str(raw_date).strip()
    if not s:
        return ""
    if "T" in s and len(s) >= 10 and s[4] in ("-", "/") and s[7] in ("-", "/"):
        s = s.split("T")[0]

    def _replace_gregorian(m):
        y, mth, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y >= 1900:
            try:
                import jdatetime
                g_date = dt.date(y, mth, d)
                j = jdatetime.date.fromgregorian(date=g_date)
                return f"{j.year:04d}/{j.month:02d}/{j.day:02d}"
            except Exception:
                return m.group(0)
        return m.group(0)

    converted = re.sub(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", _replace_gregorian, s)
    return to_persian_digits(converted)


def _invoice_row(row: dict, service_key: str) -> dict:
    """Map one stored data row onto the invoice table columns."""
    if service_key == "flight":
        description = str(row.get("مسیر") or "")
        date = _format_row_date(row.get("تاریخ پرواز") or row.get("تاریخ") or row.get("item_date"))
        notes = f"بلیط: {row.get('شماره بلیط')}" if row.get("شماره بلیط") else ""
    elif service_key == "hotel":
        description = " — ".join(
            part for part in (str(row.get("هتل") or ""), str(row.get("نوع اتاق") or "")) if part
        )
        date = _format_row_date(row.get("تاریخ ورود و خروج") or row.get("تاریخ") or row.get("item_date"))
        notes = f"{row.get('تعداد نفرات')} نفر" if row.get("تعداد نفرات") else ""
    else:
        description = str(row.get("شرح خدمات") or "")
        date = _format_row_date(row.get("تاریخ") or row.get("item_date"))
        notes = str(row.get("توضیحات") or "")

    debt = int(row.get("بدهکار") or row.get("debt") or row.get("debit") or row.get("amount") or 0)
    credit = int(row.get("بستانکار") or row.get("credit") or 0)
    return {
        "contract": str(row.get("قرارداد") or row.get("contract") or row.get("contract_number") or ""),
        "passenger": str(row.get("نام مسافر") or row.get("passenger") or row.get("passenger_name") or ""),
        "description": description,
        "date": date,
        "notes": notes,
        "debt": debt,
        "credit": credit,
        "balance": debt - credit,
        "row_number": "",
        "debit_display": _amount(debt),
        "debt_display": _amount(debt),
        "credit_display": _amount(credit),
        "balance_display": _signed_amount(debt - credit),
    }


def _qr_data_uri(text: str) -> str:
    try:
        import qrcode

        image = qrcode.make(text or " ")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    except Exception:  # noqa: BLE001 - a missing optional lib must not break the PDF
        return ""


def _barcode_data_uri(text: str) -> str:
    try:
        import barcode
        from barcode.writer import SVGWriter

        buffer = io.BytesIO()
        barcode.get("code128", text or "-", writer=SVGWriter()).write(buffer)
        return "data:image/svg+xml;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    except Exception:  # noqa: BLE001
        return ""


def _subreport_lines(source: str, request_obj, values: dict) -> list[str]:
    """Small database-backed report blocks (payer totals, payments, invoices)."""
    code = str(getattr(request_obj, "payer_code", "") or "")
    if source == "payer_summary" and code:
        invoices = Invoice.objects.filter(payer_code=code, reversed_at__isnull=True).aggregate(total=Sum("amount"))["total"] or 0
        debts = ManualDebt.objects.filter(payer_code=code).aggregate(total=Sum("amount"))["total"] or 0
        payments = Payment.objects.filter(payer_code=code).aggregate(total=Sum("amount"))["total"] or 0
        credits = Credit.objects.filter(payer_code=code).aggregate(total=Sum("amount"))["total"] or 0
        balance = int(invoices) + int(debts) - int(payments) - int(credits)
        return [
            f"جمع بدهی: {_amount(int(invoices) + int(debts))} ریال",
            f"جمع پرداخت: {_amount(int(payments))} ریال",
            f"بستانکاری: {_amount(int(credits))} ریال",
            f"مانده: {_signed_amount(balance)} ریال",
        ]
    if source == "payments" and code:
        rows = Payment.objects.filter(payer_code=code).order_by("-payment_date", "-id")[:3]
        return [
            f"{gregorian_to_persian(row.payment_date)} — {_amount(row.amount)} ریال"
            + (f" — {row.tracking_number}" if row.tracking_number else "")
            for row in rows
        ] or ["پرداختی ثبت نشده است."]
    if source == "invoices" and code:
        qs = Invoice.objects.filter(payer_code=code, reversed_at__isnull=True)
        total = qs.aggregate(total=Sum("amount"))["total"] or 0
        return [f"تعداد صورتحساب: {to_persian_digits(str(qs.count()))}", f"جمع مبلغ: {_amount(total)} ریال"]
    return [
        f"شماره نامه: {values.get('number', '')}",
        f"تاریخ: {values.get('date', '')}",
        f"شرکت: {values.get('buyer_name', '')}",
    ]


def _page_elements(design: dict, values: dict, rows: list[dict], request_obj) -> list[dict]:
    """Render the design blocks for one page (text placeholders resolved)."""
    elements = []
    for element in design["elements"]:
        if not element.get("show", True):
            continue
        item = dict(element)
        if element["type"] == "text":
            plain = render_text(element["text"], values)
            item["html"] = html.escape(plain).replace(chr(10), "<br>")
        elif element["type"] == "table":
            item["columns"] = visible_columns({"elements": [element]})
        elif element["type"] == "qr":
            item["src"] = _qr_data_uri(render_text(element.get("data") or "", values))
        elif element["type"] == "barcode":
            item["src"] = _barcode_data_uri(render_text(element.get("data") or "", values))
        elif element["type"] == "repeater":
            limit = max(1, min(int(element.get("max_rows") or 6), 20))
            item["lines"] = [
                html.escape(render_text(element.get("template") or "", {**values, **row})).replace(chr(10), "<br>")
                for row in rows[:limit]
            ]
        elif element["type"] == "labels":
            capacity = max(1, min(int(element.get("cols") or 2), 6)) * max(1, min(int(element.get("rows") or 4), 12))
            item["cells"] = [
                html.escape(render_text(element.get("template") or "", {**values, **row}))
                for row in rows[:capacity]
            ]
            if not item["cells"]:
                item["cells"] = [""] * capacity
        elif element["type"] == "subreport":
            item["lines"] = _subreport_lines(element.get("source") or "payer_summary", request_obj, values)
        elements.append(item)
    return elements


def build_invoice_context(
    request_obj: ApprovalRequest, service_key: str, rows: list[dict], letter_number: str
) -> dict:
    company = CompanySettings.load()
    design_model = ReportDesign.load()
    design = normalize_design(design_model.design_json)
    invoice_rows = [_invoice_row(row, service_key) for row in rows]
    for index, row in enumerate(invoice_rows):
        row["row_number"] = to_persian_digits(str(index + 1))

    table = table_element(design)
    is_landscape = design.get("page_orientation") == "landscape"
    user_rows = int(table.get("rows_per_page") or (6 if is_landscape else 9))
    max_safe_rows = 6 if is_landscape else 9
    chunk_size = max(1, min(user_rows, max_safe_rows))

    grand_debt = sum(row["debt"] for row in invoice_rows)
    grand_credit = sum(row["credit"] for row in invoice_rows)
    grand_balance = sum(row["balance"] for row in invoice_rows)
    label = dict((key, title) for key, _attr, title in SERVICE_KEYS).get(service_key, service_key)
    service_cat = (getattr(request_obj, "service_category", "") or getattr(request_obj, "invoice_type", "") or "").strip()
    if service_key == "service" and service_cat:
        label = service_cat

    from .normalize import gregorian_to_persian
    buyer_name = getattr(request_obj, "payer_name", None) or getattr(request_obj, "payer", "")
    letter_date = getattr(request_obj, "letter_date", None) or (
        gregorian_to_persian(getattr(request_obj, "issue_date", None)) if getattr(request_obj, "issue_date", None) else ""
    )

    values = {
        "service_type": label,
        "buyer_name": buyer_name,
        "number": letter_number,
        "date": letter_date,
        "grand_debt": _amount(grand_debt),
        "grand_credit": _amount(grand_credit),
        "grand_balance": _signed_amount(grand_balance),
        "manager_name": company.manager_name,
        "manager_position": company.manager_position,
    }

    pages = []
    for index in range(0, max(len(invoice_rows), 1), chunk_size):
        chunk = invoice_rows[index : index + chunk_size]
        page_debt = sum(row["debt"] for row in chunk)
        page_credit = sum(row["credit"] for row in chunk)
        page_balance = sum(row["balance"] for row in chunk)
        page_values = {
            **values,
            "page_debt": _amount(page_debt),
            "page_credit": _amount(page_credit),
            "page_balance": _signed_amount(page_balance),
        }
        pages.append(
            {
                "page_num": len(pages) + 1,
                "rows": chunk,
                "total_debt_display": page_values["page_debt"],
                "total_credit_display": page_values["page_credit"],
                "total_balance_display": page_values["page_balance"],
                "is_last": index + chunk_size >= len(invoice_rows),
                "elements": _page_elements(design, page_values, chunk, request_obj),
            }
        )

    title_texts = [
        render_text(element["text"], values)
        for element in design["elements"]
        if element["type"] == "text" and element.get("id") == "title"
    ]

    return {
        "css": INVOICE_CSS + design_css(design),
        "pages": pages,
        "columns": visible_columns(design),
        "design": design,
        "accent": design["accent_color"],
        "font_family": design["font_family"],
        "title": title_texts[0] if title_texts else values["buyer_name"],
        "signature_label": design["signature_label"],
        "seller": {
            "logo": _data_uri(company.logo_path),
            "signature": _data_uri(company.signature_path),
            "stamp": _data_uri(company.stamp_path),
            "manager_name": company.manager_name,
            "manager_position": company.manager_position,
        },
        "buyer_name": request_obj.payer_name,
        "service_type": label,
        "invoice_number": letter_number,
        "invoice_date": request_obj.letter_date,
        "grand_total_debt_display": _amount(grand_debt),
        "grand_total_credit_display": _amount(grand_credit),
        "grand_total_balance_display": _signed_amount(grand_balance),
    }


PDF_BROWSER_CANDIDATES = (
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
)

BROWSER_LAUNCH_ERROR = (
    "مرورگر PDF (Microsoft Edge یا Google Chrome) اجرا نشد؛ صورت‌حساب PDF ساخته نشد. "
    "نصب مرورگر یا مسیر آن (متغیر PDF_BROWSER_PATH) را بررسی کنید."
)


def _find_pdf_browser() -> str | None:
    """Locate a Chromium-family binary, honouring the PDF_BROWSER_PATH override."""
    override = os.environ.get("PDF_BROWSER_PATH", "").strip()
    for path in ([override] if override else []) + list(PDF_BROWSER_CANDIDATES):
        if path and os.path.exists(path):
            return path
    for name in ("microsoft-edge", "google-chrome", "chromium", "chrome", "msedge"):
        found = shutil.which(name)
        if found:
            return found
    return None


def _launch_flags() -> list[str]:
    """Extra Chromium flags for this host.

    Chromium refuses to enable its sandbox as root, which is exactly how the
    Docker image runs, so a root process would fail to launch the browser and
    lose the PDF path entirely. Only root on Linux needs this.
    """
    if sys.platform.startswith("linux") and hasattr(os, "geteuid") and os.geteuid() == 0:
        return ["--no-sandbox"]
    return []


def _shutdown_tree(process: subprocess.Popen, timeout: float = 10.0) -> None:
    """Terminate the browser and every helper process it spawned.

    Chromium forks renderer and zygote helpers, so terminating only the parent
    leaves them behind and every approval leaks another set of headless
    processes. On Windows the tree is taken down with ``taskkill /T``; elsewhere
    the browser runs in its own process group (``start_new_session``) and the
    whole group is signalled, TERM first and KILL if it does not exit.
    """
    pid = process.pid
    if sys.platform.startswith("win"):
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=timeout,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):  # pragma: no cover - no taskkill
            process.kill()
    else:
        try:
            pgid = os.getpgid(pid)
        except ProcessLookupError:
            pgid = None
        if pgid is not None:
            try:
                os.killpg(pgid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:  # pragma: no cover - stubborn process
                pass
            # SIGKILL is POSIX-only, and the attribute is absent when this
            # branch is exercised on Windows; 9 is its value on every POSIX.
            try:
                os.killpg(pgid, getattr(signal, "SIGKILL", 9))
            except ProcessLookupError:
                pass
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:  # pragma: no cover - already killed above
        pass


# A Gunicorn worker serves several requests on one process (threads, or simply
# overlapping work), and a full Chromium tree per concurrent request is what
# exhausts the box. Only one browser may run per process; a second request waits
# for the first to close. Each worker process has its own lock, which is what
# keeps four workers from sharing a browser across processes (they cannot and
# should not).
_browser_lock = threading.Lock()


class PdfBrowser:
    """
    One headless Chromium/Edge process shared by every PDF of a request.

    Starting a browser costs about a second, and approving a batch produces one
    invoice per service, so the process is launched once and driven over the
    DevTools protocol instead of being spawned per file.
    """

    def __init__(self, timeout: int = 90):
        self.timeout = timeout
        self.path = _find_pdf_browser()
        self.launch_error: str | None = None
        self._process = None
        self._port: int | None = None
        self._profile: str | None = None
        self._lock_held = False

    @property
    def found(self) -> bool:
        return self.path is not None

    def _command(self) -> list[str]:
        """The Chromium command line used to start the shared browser."""
        return [
            self.path,
            "--headless=new",
            "--disable-gpu",
            "--disable-extensions",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={self._profile}",
            "--remote-debugging-port=0",
            *_launch_flags(),
            "about:blank",
        ]

    def start(self) -> "PdfBrowser":
        if self.path is None:
            self.launch_error = (
                "برای تولید PDF نه مرورگر headless (Edge/Chrome) پیدا شد و نه WeasyPrint در دسترس است."
            )
            return self
        if self._process is not None:
            return self
        if not self._lock_held:
            # Waiting is the point: starting a second tree while the first is
            # printing is exactly what this guard prevents.
            if not _browser_lock.acquire(timeout=self.timeout):
                self.launch_error = (
                    "مرورگر PDF دیگری در همین پروسه در حال کار است؛ تولید صورت‌حساب دیرتر دوباره تلاش می‌شود."
                )
                return self
            self._lock_held = True
        self._profile = tempfile.mkdtemp(prefix="kkt-pdf-")
        try:
            self._process = subprocess.Popen(
                self._command(),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                # Own process group so the whole Chromium tree can be signalled.
                start_new_session=not sys.platform.startswith("win"),
            )
            self._port = self._wait_for_port()
        except Exception as exc:  # noqa: BLE001 - surfaced to the caller below
            self.launch_error = f"{BROWSER_LAUNCH_ERROR} ({exc})"
            self.close()
            return self
        if not self._port:
            self.launch_error = BROWSER_LAUNCH_ERROR
            self.close()
        return self

    def _wait_for_port(self, timeout: float = 15.0) -> int | None:
        """Chromium writes the DevTools port to <profile>/DevToolsActivePort."""
        port_file = Path(self._profile) / "DevToolsActivePort"  # type: ignore[arg-type]
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if port_file.exists():
                try:
                    return int(port_file.read_text(encoding="utf-8").splitlines()[0])
                except (ValueError, IndexError):
                    pass
            if self._process is not None and self._process.poll() is not None:
                return None
            time.sleep(0.1)
        return None

    def render(self, html: str) -> bytes:
        if self.launch_error:
            raise GenerationError(self.launch_error)
        if self._port is None or self._profile is None:
            raise GenerationError(BROWSER_LAUNCH_ERROR)

        folder = tempfile.mkdtemp(prefix="kkt-pdf-doc-", dir=self._profile)
        html_path = Path(folder) / "invoice.html"
        html_path.write_text(html, encoding="utf-8")
        target = None
        try:
            response = requests.put(
                f"http://127.0.0.1:{self._port}/json/new?about:blank", timeout=10
            )
            response.raise_for_status()
            target = response.json()
            data = self._print(target["webSocketDebuggerUrl"], html_path.as_uri())
        except GenerationError:
            raise
        except Exception as exc:  # noqa: BLE001 - any CDP hiccup is a real failure
            raise GenerationError(f"تبدیل صورت‌حساب به PDF با مرورگر ناموفق بود: {exc}") from exc
        finally:
            if target and self._port:
                try:
                    requests.get(
                        f"http://127.0.0.1:{self._port}/json/close/{target['id']}", timeout=5
                    )
                except Exception:  # noqa: BLE001 - closing a tab must never fail a render
                    pass
            shutil.rmtree(folder, ignore_errors=True)

        if not data.startswith(b"%PDF-"):
            raise GenerationError("مرورگر خروجی PDF معتبری برنگرداند (فایل خالی بود).")
        return data

    def _print(self, websocket_url: str, page_url: str) -> bytes:
        import websocket  # websocket-client; a thin CDP client

        def receive(ws, wanted):
            while True:
                message = json.loads(ws.recv())
                if wanted(message):
                    return message

        def command(ws, command_id: int, method: str, params: dict | None = None) -> dict:
            payload = {"id": command_id, "method": method}
            if params:
                payload["params"] = params
            ws.send(json.dumps(payload))
            reply = receive(ws, lambda message: message.get("id") == command_id)
            if "error" in reply:
                raise GenerationError(f"مرورگر PDF خطا داد: {reply['error'].get('message', reply['error'])}")
            return reply.get("result", {})

        ws = websocket.create_connection(
            websocket_url, timeout=self.timeout, suppress_origin=True
        )
        try:
            try:
                command(ws, 1, "Page.enable")
                # Wait for both the navigate acknowledgement and the load event:
                # they may arrive in either order, and printing before the page
                # has loaded makes Chromium answer "Printing failed".
                ws.send(json.dumps({"id": 2, "method": "Page.navigate", "params": {"url": page_url}}))
                navigated = loaded = False
                while not (navigated and loaded):
                    message = json.loads(ws.recv())
                    if message.get("id") == 2:
                        if "error" in message:
                            raise GenerationError(
                                f"مرورگر PDF خطا داد: {message['error'].get('message', message['error'])}"
                            )
                        navigated = True
                    elif message.get("method") == "Page.loadEventFired":
                        loaded = True
                result = command(
                    ws,
                    3,
                    "Page.printToPDF",
                    {
                        "printBackground": True,
                        "preferCSSPageSize": True,
                        "displayHeaderFooter": False,
                        "marginTop": 0,
                        "marginBottom": 0,
                        "marginLeft": 0,
                        "marginRight": 0,
                    },
                )
            except GenerationError:
                raise
            except Exception as exc:  # noqa: BLE001 - timeout / protocol / socket
                raise GenerationError(
                    "مرورگر PDF در زمان مقرر پاسخ نداد؛ تولید صورت‌حساب ناموفق بود. "
                    f"({type(exc).__name__})"
                ) from exc
        finally:
            ws.close()
        return base64.b64decode(result.get("data") or "")

    def close(self) -> None:
        try:
            if self._process is not None:
                _shutdown_tree(self._process)
            self._process = None
            if self._profile:
                shutil.rmtree(self._profile, ignore_errors=True)
                self._profile = None
        finally:
            # Always hand the slot to the next request, even if shutdown fails.
            if self._lock_held:
                self._lock_held = False
                _browser_lock.release()

    def __enter__(self) -> "PdfBrowser":
        return self.start()

    def __exit__(self, *exc_info) -> None:
        self.close()


@contextmanager
def pdf_session() -> Iterator[PdfBrowser]:
    """Start one browser for the caller and always shut it down afterwards."""
    browser = PdfBrowser()
    browser.start()
    try:
        yield browser
    finally:
        browser.close()


def _weasyprint_pdf(html: str) -> bytes:
    try:
        from weasyprint import HTML
    except Exception as exc:  # noqa: BLE001
        raise GenerationError(
            "برای تولید PDF نه مرورگر headless پیدا شد و نه WeasyPrint در دسترس است."
        ) from exc
    return HTML(string=html).write_pdf()


def html_to_pdf(html: str, browser: PdfBrowser | None = None) -> bytes:
    """
    Render HTML to PDF.

    Pass ``browser`` to reuse one launch across several documents; without it a
    single request-scoped browser is started. WeasyPrint is used only when no
    Chromium-family binary exists at all — a browser that is present but fails
    is reported to the caller instead of being silently replaced.
    """
    if browser is None:
        with pdf_session() as session:
            return html_to_pdf(html, session)
    if browser.found:
        return browser.render(html)
    return _weasyprint_pdf(html)


def render_invoice_pdf(
    request_obj: ApprovalRequest,
    service_key: str,
    rows: list[dict],
    letter_number: str,
    browser: PdfBrowser | None = None,
) -> bytes:
    if Environment is None:  # pragma: no cover
        raise GenerationError("Jinja2 در دسترس نیست؛ بازسازی محیط لازم است.")
    context = build_invoice_context(request_obj, service_key, rows, letter_number)
    html = Environment(autoescape=select_autoescape(["html", "xml"])).from_string(INVOICE_HTML).render(**context)
    return html_to_pdf(html, browser)


def _template_path_for(variant: str) -> Path | None:
    """Uploaded .docx for this letter kind (falls back to the main debt one)."""
    company = CompanySettings.load()
    candidates = {
        "debt": [company.word_template_path],
        "subsidiary": [company.word_template_subsidiary_path, company.word_template_path],
        "credit": [company.word_template_credit_path],
    }.get(variant, [company.word_template_path])

    default_fallbacks = {
        "debt": ["company_assets/word_template_debt.docx", "company_assets/word_template.docx"],
        "subsidiary": ["company_assets/word_template_subsidiary.docx", "company_assets/word_template_debt.docx"],
        "credit": ["company_assets/word_template_credit.docx"],
    }.get(variant, ["company_assets/word_template_debt.docx"])

    for relative in candidates + default_fallbacks:
        relative = (relative or "").strip()
        if not relative:
            continue
        path = Path(relative)
        if not path.is_absolute():
            path = Path(django_settings.MEDIA_ROOT) / relative
        if path.exists():
            return path
    return None


def _reverse_slashed(val: str) -> str:
    """
    Reverse slash-separated segments (e.g. 1405/013/00002 -> 00002/013/1405,
    or 1405/08/24 -> 24/08/1405, or 'از 1405/08/24 تا 1405/08/30' -> 'از 24/08/1405 تا 30/08/1405')
    so Microsoft Word's RTL paragraph layout displays the numbers in the proper visual left-to-right order.
    """
    if not val or not isinstance(val, str) or "/" not in val:
        return val

    def _reverse_token(m):
        return "/".join(reversed(m.group(0).split("/")))

    # Matches any sequence of digits (ASCII or Persian/Arabic) separated by slashes
    return re.sub(
        r"[\d\u06F0-\u06F9\u0660-\u0669]+(?:/[\d\u06F0-\u06F9\u0660-\u0669]+)+",
        _reverse_token,
        val,
    )


def render_docx(context: dict) -> bytes:
    """
    Word letter: render the uploaded official .docx template for this letter
    kind (docxtpl placeholders), otherwise build the same letter programmatically.
    Slash-delimited numbers (dates, letter numbers) are reversed so Word's RTL
    text engine displays them in the correct visual order.
    """
    docx_ctx = dict(context)
    for field in ("letter_date", "letter_number", "generated_on", "period_range", "description"):
        if field in docx_ctx and docx_ctx[field]:
            docx_ctx[field] = _reverse_slashed(str(docx_ctx[field]))

    # Also adapt any slash-separated dates or numbers inside rows
    if "rows" in docx_ctx and isinstance(docx_ctx["rows"], list):
        adapted_rows = []
        for row in docx_ctx["rows"]:
            new_row = dict(row)
            for k, v in new_row.items():
                if isinstance(v, str) and "/" in v and any(c.isdigit() for c in v):
                    new_row[k] = _reverse_slashed(v)
            adapted_rows.append(new_row)
        docx_ctx["rows"] = adapted_rows

    variant = str(docx_ctx.get("variant") or "debt")
    template_file = _template_path_for(variant)
    if template_file is not None:
        try:
            from docxtpl import DocxTemplate

            document = DocxTemplate(str(template_file))
            document.render(docx_ctx)
            buffer = io.BytesIO()
            document.save(buffer)
            return buffer.getvalue()
        except Exception:  # noqa: BLE001 - fall back to the built-in letter
            pass

    return _render_programmatic_docx(docx_ctx)


def _render_programmatic_docx(context: dict) -> bytes:
    """Build the Word letter with python-docx (RTL, B Nazanin)."""
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt

    # Tolerate partial contexts (e.g. a manual regeneration call).
    defaults = {
        "company_name": "", "address": "", "letter_number": "", "letter_date": "",
        "payer": "", "payer_code": "", "period_range": "", "service_type": "",
        "subsidiary": "", "variant": "debt", "legal_note": LEGAL_NOTE,
        "columns": [], "rows": [], "total_debt": 0, "total_credit": 0,
        "total_debt_display": "0", "total_credit_display": "0",
        "bank_name1": "", "account_number1": "", "shaba_number1": "",
        "bank_name2": "", "account_number2": "", "shaba_number2": "",
        "manager_name": "", "manager_position": "",
        "logo_path": "", "signature_path": "", "stamp_path": "",
    }
    context = {**defaults, **context}
    context["total_debt_display"] = context.get("total_debt_display") or f"{context['total_debt']:,}"
    context["total_credit_display"] = context.get("total_credit_display") or f"{context['total_credit']:,}"
    if not context.get("legal_note"):
        context["legal_note"] = LEGAL_NOTE

    document = Document()
    section = document.sections[0]
    section.left_margin = section.right_margin = Pt(42)

    def para(text: str, size: int = 16, bold: bool = False, align=WD_ALIGN_PARAGRAPH.RIGHT):
        paragraph = document.add_paragraph()
        paragraph.alignment = align
        run = paragraph.add_run(text)
        run.bold = bold
        run.font.size = Pt(size)
        run.font.name = "B Nazanin"
        try:
            run.font.rtl = True
        except Exception:  # pragma: no cover - older python-docx
            pass
        return paragraph

    def image(path_value: str, height: int = 40):
        if not path_value:
            return
        path = Path(path_value)
        if not path.is_absolute():
            path = Path(django_settings.MEDIA_ROOT) / path_value
        if not path.exists() or path.stat().st_size == 0:
            return
        paragraph = document.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
        try:
            paragraph.add_run().add_picture(str(path), height=Pt(height))
        except Exception:  # noqa: BLE001 - unreadable image must not block the letter
            pass

    # Header: logo left, date/number right.
    image(context.get("logo_path", ""), 46)
    para(f"تاریخ: {context['letter_date']}", size=12)
    para(f"شماره: {context['letter_number']}", size=12)
    document.add_paragraph()
    para(f"شرکت محترم {context['payer']}", size=13, bold=True)

    if context["variant"] == "credit":
        para(f"احتراماً {context['period_range']}", size=12)
        para(
            f"بابت خدمت {context['service_type']} خریداری‌شده، مبلغ "
            f"{context['total_credit_display']} ریال",
            size=12,
            bold=True,
        )
        para(f"نزد شرکت {context['company_name']} بستانکار می‌باشید.", size=12)
        para("در نظر داشته باشید که این مبلغ در خریدهای آینده از حساب شما کسر خواهد شد.", size=12)
    else:
        about = f"مربوط به {context['subsidiary']} " if context["variant"] == "subsidiary" else ""
        para(f"احتراما بدین وسیله صورت حساب {about}{context['period_range']}", size=12)
        para(
            f"بابت {context['service_type']} به مبلغ {context['total_debt_display']} ریال",
            size=12,
            bold=True,
        )
        para("جهت اطلاع و انجام اقدامات لازم به پیوست ایفاد می‌گردد.", size=12)
        para("خواهشمند است دستور فرمائید مبلغ مربوطه به حساب این شرکت واریز شود.", size=12)
        para("مشخصات حساب بانکی شرکت به شرح زیر است:", size=12)
        for bank in (
            (context["bank_name1"], context["account_number1"], context["shaba_number1"]),
            (context["bank_name2"], context["account_number2"], context["shaba_number2"]),
        ):
            if bank[0]:
                para(f"بانک {bank[0]} شماره حساب: {bank[1]} شماره شبا: {bank[2]}", size=11)

    document.add_paragraph()
    image(context.get("signature_path", ""), 34)
    image(context.get("stamp_path", ""), 40)
    para(context["company_name"], size=12, align=WD_ALIGN_PARAGRAPH.LEFT)
    para(context["manager_name"], size=12, align=WD_ALIGN_PARAGRAPH.LEFT)
    para(context["manager_position"], size=11, align=WD_ALIGN_PARAGRAPH.LEFT)
    document.add_paragraph()
    para(context["legal_note"], size=9, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


# ── orchestration ─────────────────────────────────────────────────────────

def _columns_for(service_key: str) -> list[str]:
    from .excel import COLUMNS

    return COLUMNS[service_key]


SERVICE_ATTRS = {key: (attr, label) for key, attr, label in SERVICE_KEYS}


def _context_for(request_obj: ApprovalRequest, service_key: str) -> dict:
    attr, label = SERVICE_ATTRS[service_key]
    rows = list(getattr(request_obj, attr) or [])
    if not rows:
        raise GenerationError(f"ردیفی برای {label} ثبت نشده است.")
    context = build_context(request_obj, rows, _columns_for(service_key))
    context["service_type"] = f"{request_obj.service_type} — {label}"
    context["letter_number"] = (request_obj.service_letters or {}).get(service_key) or request_obj.letter_number
    return context


def generate_invoice_pdf_bytes(invoice) -> bytes:
    """Render official Invoice PDF bytes following the ReportDesign (گزارش‌ساز)."""
    from ..models import ApprovalRequest
    from .normalize import gregorian_to_persian

    jalali_date = gregorian_to_persian(invoice.issue_date) or str(invoice.issue_date)

    inv_type = (invoice.invoice_type or "").strip()
    if "پرواز" in inv_type or inv_type.lower() == "flight":
        service_key = "flight"
    elif "هتل" in inv_type or inv_type.lower() == "hotel":
        service_key = "hotel"
    else:
        service_key = "service"

    request_obj = ApprovalRequest.objects.filter(letter_number=invoice.letter_number).first()

    rows = []
    if request_obj and service_key in SERVICE_ATTRS:
        attr, _label = SERVICE_ATTRS[service_key]
        rows = list(getattr(request_obj, attr) or [])

    if not rows:
        items = list(invoice.items.all().order_by("id"))
        if items:
            for idx, it in enumerate(items, 1):
                row = {
                    "ردیف": idx,
                    "نام مسافر": it.passenger_name or "—",
                    "قرارداد": it.contract_number or "",
                    "بدهکار": it.debt_amount or (invoice.amount if len(items) == 1 else 0),
                    "بستانکار": it.credit_amount or 0,
                }
                if service_key == "flight":
                    row["مسیر"] = it.destination or inv_type
                    row["شماره بلیط"] = it.ticket_number or "—"
                    row["تاریخ پرواز"] = it.item_date or jalali_date
                elif service_key == "hotel":
                    row["هتل"] = it.hotel_name or invoice.description or "هتل"
                    row["نوع اتاق"] = it.room_type or ""
                    row["تاریخ ورود و خروج"] = it.item_date or jalali_date
                    row["تعداد نفرات"] = it.guest_count or 1
                else:
                    row["شرح خدمات"] = it.description or invoice.description or inv_type
                    row["تاریخ"] = it.item_date or jalali_date
                    row["توضیحات"] = it.room_type or it.ticket_number or ""
                rows.append(row)
        else:
            row = {
                "ردیف": 1,
                "نام مسافر": "کلیه مسافران",
                "مسیر": invoice.description or inv_type,
                "هتل": invoice.description or inv_type,
                "شرح خدمات": invoice.description or inv_type,
                "شماره بلیط": "—",
                "نوع اتاق": "",
                "تعداد نفرات": 1,
                "تاریخ پرواز": jalali_date,
                "تاریخ ورود و خروج": jalali_date,
                "تاریخ": jalali_date,
                "قرارداد": "",
                "توضیحات": invoice.period_range or "",
                "بدهکار": invoice.amount,
                "بستانکار": 0,
            }
            rows = [row]

    if not request_obj:
        class _InvoiceReqAdapter:
            def __init__(self, inv, jdate):
                self.payer_name = inv.payer
                self.payer_code = inv.payer_code
                self.letter_number = inv.letter_number
                self.letter_date = jdate
                self.period_range = inv.period_range or ""
                self.service_category = inv.invoice_type
                self.service_type = inv.invoice_type
                self.year = None
                self.month = None
                self.start_day = None
                self.end_day = None

        request_obj = _InvoiceReqAdapter(invoice, jalali_date)

    try:
        with pdf_session() as browser:
            if browser.found:
                try:
                    return render_invoice_pdf(request_obj, service_key, rows, invoice.letter_number, browser=browser)
                except Exception:
                    pass
    except Exception:
        pass

    context = build_invoice_context(request_obj, service_key, rows, invoice.letter_number)
    html = Environment(autoescape=select_autoescape(["html", "xml"])).from_string(INVOICE_HTML).render(**context)
    return _weasyprint_pdf(html)


def generate_invoice_letter_bytes(invoice) -> bytes:
    """Render official Letter Word (.docx) bytes directly from an Invoice model instance."""
    from ..models import CompanySettings, ApprovalRequest, Payer
    from .normalize import gregorian_to_persian

    company = CompanySettings.load()
    jalali_issue_date = gregorian_to_persian(invoice.issue_date) or str(invoice.issue_date)

    req = ApprovalRequest.objects.filter(letter_number=invoice.letter_number).first()
    period_range = invoice.period_range or (req.period_range if (req and req.period_range) else "")
    if not period_range:
        item_dates = [it.item_date for it in invoice.items.all() if it.item_date]
        if item_dates:
            min_d = gregorian_to_persian(min(item_dates))
            max_d = gregorian_to_persian(max(item_dates))
            period_range = f"از {min_d} تا {max_d}" if min_d != max_d else f"مورخ {min_d}"
        else:
            period_range = f"مورخ {jalali_issue_date}"

    payer_obj = Payer.objects.filter(code=invoice.payer_code).first() if invoice.payer_code else None
    subsidiary_name = ""
    recipient = invoice.payer
    variant = "debt"
    if payer_obj and payer_obj.parent:
        subsidiary_name = payer_obj.name
        recipient = payer_obj.parent.name
        variant = "subsidiary"

    amount_num = int(invoice.amount or 0)
    formatted_amount = f"{amount_num:,}"

    context = {
        "letter_date": jalali_issue_date,
        "letter_number": invoice.letter_number,
        "payer": recipient,
        "payer_code": invoice.payer_code or "",
        "period_range": period_range,
        "service_type": invoice.invoice_type or "خدمات مسافرتی",
        "subsidiary": subsidiary_name,
        "variant": variant,
        "legal_note": company.legal_note or LEGAL_NOTE,
        "total_debt": formatted_amount,
        "total_credit": "0",
        "total_debt_display": formatted_amount,
        "total_credit_display": "0",
        "company_name": company.company_name or "سفرهای کرمان خودرو",
        "address": company.address or "",
        "phone": company.phone or "",
        "national_id": company.national_id or "",
        "bank_name1": company.bank_name1 or "",
        "account_number1": company.account_number1 or "",
        "shaba_number1": company.shaba_number1 or "",
        "bank_name2": company.bank_name2 or "",
        "account_number2": company.account_number2 or "",
        "shaba_number2": company.shaba_number2 or "",
        "manager_name": company.manager_name or "",
        "manager_position": company.manager_position or "",
        "logo_path": company.logo_path or "",
        "signature_path": company.signature_path or "",
        "stamp_path": company.stamp_path or "",
        "rows": [],
    }
    return render_docx(context)


def regenerate_file(final_file) -> bytes:
    """
    Reproduce one generated artifact from the stored request data or invoice record.

    Used after the retention window has released the original bytes, so a
    download always works without keeping old files on disk (spec §7).
    """
    is_pdf = final_file.file_name.lower().endswith(".pdf")
    request_obj = getattr(final_file, "request", None)
    service_key = getattr(final_file, "service_type", None)

    # 1. Try from ApprovalRequest if request object and service rows exist
    if request_obj and service_key in SERVICE_ATTRS:
        attr, label = SERVICE_ATTRS[service_key]
        rows = list(getattr(request_obj, attr) or [])
        if rows:
            letter = final_file.letter_number or request_obj.letter_number
            if is_pdf:
                try:
                    with pdf_session() as browser:
                        return render_invoice_pdf(request_obj, service_key, rows, letter, browser=browser)
                except Exception:
                    pass
            else:
                try:
                    context = _context_for(request_obj, service_key)
                    return render_docx(context)
                except Exception:
                    pass

    # 2. Try from Invoice model by letter_number
    from ..models import Invoice
    inv = Invoice.objects.filter(letter_number=final_file.letter_number).first()
    if inv:
        if is_pdf:
            return generate_invoice_pdf_bytes(inv)
        return generate_invoice_letter_bytes(inv)

    # 3. Fallback: if ApprovalRequest exists even without specific service rows
    if request_obj:
        if is_pdf:
            return render_invoice_pdf(request_obj, service_key or "flight", [], final_file.letter_number or "")
        context = {
            "letter_date": request_obj.letter_date or "",
            "letter_number": final_file.letter_number or request_obj.letter_number,
            "payer": request_obj.payer_name,
            "payer_code": request_obj.payer_code or "",
            "period_range": request_obj.period_range or "",
            "service_type": request_obj.service_type or "خدمات",
            "subsidiary": "",
            "variant": "debt",
            "total_debt": "0",
            "total_credit": "0",
            "rows": [],
        }
        return render_docx(context)

    raise GenerationError(f"امکان بازتولید فایل {final_file.file_name} وجود ندارد؛ داده‌های درخواست یا صورت‌حساب یافت نشد.")


def generate_request(request_obj: ApprovalRequest) -> list[FinalFile]:
    """
    Idempotent generation for an approved request (spec §11).

    Skips a (request, service_type, file_name) tuple that already exists, so a
    retry never duplicates artifacts or invoices.
    """
    if request_obj.status != ApprovalRequest.STATUS_APPROVED:
        raise GenerationError("فقط درخواست تأییدشده قابل تولید فایل است.")

    produced: list[FinalFile] = []
    template = active_template()
    errors: list[str] = []

    # One browser launch serves every invoice of this batch.
    with pdf_session() as browser:
        for service_key, attr, label in SERVICE_KEYS:
            rows = list(getattr(request_obj, attr) or [])
            if not rows:
                continue
            # Each service carries its own letter number; a batch of flight + hotel +
            # services therefore yields separate letters instead of one shared one.
            context = _context_for(request_obj, service_key)
            letter = context["letter_number"]
            # Letter numbers contain slashes (YYYY/CODE/NNNNN); file names must not.
            letter_slug = (letter or "letter").replace("/", "-")

            try:
                docx_bytes = render_docx(context)
                produced.append(
                    save_final_file(
                        request_obj,
                        service_key,
                        f"{service_key}_{letter_slug}.docx",
                        docx_bytes,
                        letter_number=letter,
                    )
                )
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Word ({label}): {exc}")

            try:
                pdf_bytes = render_invoice_pdf(
                    request_obj, service_key, rows, letter, browser=browser
                )
                produced.append(
                    save_final_file(
                        request_obj,
                        service_key,
                        f"{service_key}_{letter_slug}.pdf",
                        pdf_bytes,
                        letter_number=letter,
                    )
                )
            except Exception as exc:  # noqa: BLE001
                errors.append(f"PDF ({label}): {exc}")

            issue_date = persian_date_to_gregorian(request_obj.letter_date) or timezone.localdate()
            amount = context["total_debt"] - context["total_credit"]
            if context["variant"] == "credit" or amount <= 0:
                # Credit notes are not invoices; nothing to add to the invoice ledger.
                continue
            invoice_type = label
            if service_key == "service":
                invoice_type = (request_obj.service_category or "").strip() or label

            period_range = request_obj.period_range or ""
            start_date = None
            end_date = None
            try:
                if request_obj.year and request_obj.month and request_obj.start_day:
                    m = int(str(request_obj.month).strip())
                    start_date = persian_date_to_gregorian(f"{request_obj.year:04d}/{m:02d}/{request_obj.start_day:02d}")
                if request_obj.year and request_obj.month and request_obj.end_day:
                    m = int(str(request_obj.month).strip())
                    end_date = persian_date_to_gregorian(f"{request_obj.year:04d}/{m:02d}/{request_obj.end_day:02d}")
            except Exception:
                pass

            with transaction.atomic():
                invoice, created = Invoice.objects.get_or_create(
                    letter_number=letter,
                    payer_code=request_obj.payer_code,
                    invoice_type=invoice_type,
                    defaults={
                        "payer": request_obj.payer_name,
                        "amount": amount,
                        "issue_date": issue_date,
                        "file_path": f"{letter_slug}/{service_key}_{letter_slug}.pdf",
                        "period_range": period_range,
                        "start_date": start_date,
                        "end_date": end_date,
                    },
                )
                if not created:
                    invoice.payer = request_obj.payer_name
                    invoice.amount = amount
                    invoice.issue_date = issue_date
                    invoice.file_path = f"{letter_slug}/{service_key}_{letter_slug}.pdf"
                    invoice.period_range = period_range
                    if start_date:
                        invoice.start_date = start_date
                    if end_date:
                        invoice.end_date = end_date
                    invoice.save(update_fields=["payer", "amount", "issue_date", "file_path", "period_range", "start_date", "end_date"])
                if not created and invoice.reversed_at is not None:
                    # Regenerating an aborted invoice would emit a document that
                    # never reaches the ledger; surface it instead.
                    errors.append(
                        f"{invoice_type}: صورتحساب {letter} ابطال شده و دوباره به دفتر اضافه نشد."
                    )

                # Persist detailed line items for BI and reporting
                InvoiceItem.objects.filter(invoice=invoice).delete()
                for r in rows:
                    p_name = str(r.get("نام مسافر") or r.get("مسافر") or r.get("passenger") or "").strip()
                    dest = str(r.get("مسیر") or r.get("مقصد") or r.get("destination") or r.get("route") or "").strip()
                    hotel = str(r.get("هتل") or r.get("hotel") or "").strip()
                    t_num = str(r.get("شماره بلیط") or r.get("ticket") or "").strip()
                    r_type = str(r.get("نوع اتاق") or r.get("room") or "").strip()
                    c_num = str(r.get("قرارداد") or r.get("contract") or "").strip()
                    g_cnt = 1
                    try:
                        g_cnt = int(r.get("تعداد نفرات") or r.get("guests") or 1)
                    except (ValueError, TypeError):
                        g_cnt = 1
                    i_date = str(r.get("تاریخ پرواز") or r.get("تاریخ ورود و خروج") or r.get("تاریخ") or "").strip()
                    desc = str(r.get("شرح خدمات") or r.get("توضیحات") or "").strip()
                    try:
                        debt_val = int(r.get("بدهکار") or 0)
                    except (ValueError, TypeError):
                        debt_val = 0
                    try:
                        credit_val = int(r.get("بستانکار") or 0)
                    except (ValueError, TypeError):
                        credit_val = 0
                    try:
                        net_val = int(r.get("مانده") or (debt_val - credit_val))
                    except (ValueError, TypeError):
                        net_val = debt_val - credit_val

                    InvoiceItem.objects.create(
                        invoice=invoice,
                        approval_request=request_obj,
                        letter_number=letter,
                        payer=request_obj.payer_name,
                        payer_code=request_obj.payer_code,
                        service_type=invoice_type,
                        passenger_name=p_name,
                        destination=dest,
                        hotel_name=hotel,
                        ticket_number=t_num,
                        room_type=r_type,
                        contract_number=c_num,
                        guest_count=g_cnt,
                        item_date=i_date,
                        issue_date=issue_date,
                        description=desc,
                        debt_amount=debt_val,
                        credit_amount=credit_val,
                        amount=net_val,
                        raw_data=r,
                    )

    if errors and not produced:
        request_obj.generation_error = "; ".join(errors)[:2000]
        request_obj.save(update_fields=["generation_error"])
        raise GenerationError("تولید فایل ناموفق بود: " + "; ".join(errors))

    request_obj.generation_completed_at = timezone.now()
    request_obj.generation_error = "; ".join(errors)[:2000]
    request_obj.save(update_fields=["generation_completed_at", "generation_error"])
    return produced
