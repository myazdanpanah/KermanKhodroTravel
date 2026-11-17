"""
Document generation (spec §5.2 step 6, §8).

Produces, for every non-empty service block of an approved request:
  * a Word (.docx) letter built with python-docx (RTL, B Nazanin),
  * an HTML→PDF letter rendered from the active ``InvoiceTemplate`` with
    WeasyPrint (best Persian shaping; wkhtmltopdf is forbidden).

Both artifacts go through :func:`apps.billing.services.files.save_final_file`,
so they exist on disk and in the DB BLOB.
"""

from __future__ import annotations

import base64
import datetime as dt
import io
from pathlib import Path

from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone

from ..models import ApprovalRequest, CompanySettings, FinalFile, Invoice, InvoiceTemplate, Payer
from .files import save_final_file
from .normalize import gregorian_to_persian, persian_date_to_gregorian

try:  # Jinja2 ships with WeasyPrint but is imported eagerly for the HTML path
    from jinja2 import Environment, select_autoescape
except Exception:  # pragma: no cover - dependency always installed via requirements
    Environment = None  # type: ignore[assignment]

SERVICE_KEYS = [
    ("flight", "flight_data", "پرواز"),
    ("hotel", "hotel_data", "هتل"),
    ("service", "service_data", "خدمات"),
]

DEFAULT_CSS = """
@page { size: A4; margin: 20mm 15mm; }
body { font-family: "B Nazanin", "Vazirmatn", Tahoma, sans-serif; font-size: 12pt; direction: rtl; color: #101D35; }
h1 { font-size: 15pt; margin: 0 0 4px; }
.meta { display: flex; justify-content: space-between; font-size: 11pt; margin: 8px 0 12px; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; }
th, td { border: 1px solid #9aa7bd; padding: 4px 6px; text-align: center; }
th { background: #eef2f8; font-weight: bold; }
tfoot td { font-weight: bold; background: #f7f9fc; }
.header { text-align: center; border-bottom: 2px solid #101D35; padding-bottom: 8px; margin-bottom: 10px; }
.footer { margin-top: 24px; font-size: 10pt; }
.footer .banks { line-height: 1.8; }
.signature { margin-top: 28px; text-align: left; }
"""

DEFAULT_HTML = """
<div class="header">
  {% if logo_data_uri %}<img src="{{ logo_data_uri }}" alt="logo" height="64">{% endif %}
  <h1>{{ company_name }}</h1>
  <div>{{ address }}{% if phone %} — تلفن: {{ phone }}{% endif %}</div>
</div>
<div class="meta">
  <div>شماره نامه: <strong>{{ letter_number }}</strong></div>
  <div>تاریخ: {{ letter_date }}</div>
</div>
<div class="meta">
  <div>شرکت طرف حساب: <strong>{{ payer }}</strong> (کد {{ payer_code }})</div>
  <div>بازه: {{ period_range }}</div>
</div>
<p>با سلام و احترام، صورتحساب خدمات {{ service_type }} به شرح زیر اعلام می‌گردد:</p>
<table>
  <thead>
    <tr>{% for column in columns %}<th>{{ column }}</th>{% endfor %}</tr>
  </thead>
  <tbody>
    {% for row in rows %}
      <tr>{% for column in columns %}<td>{{ row[column] }}</td>{% endfor %}</tr>
    {% endfor %}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="{{ columns|length - 2 }}">جمع</td>
      <td>{{ "{:,}".format(total_debt) }}</td>
      <td>{{ "{:,}".format(total_credit) }}</td>
    </tr>
  </tfoot>
</table>
<div class="footer">
  {% if total_credit > 0 and total_debt == 0 %}
    <p>با توجه به مانده بستانکار {{ "{:,}".format(total_credit) }} ریال، خواهشمند است صورتحساب مربوطه را صادر فرمایید.</p>
  {% else %}
    <p>مانده بدهکار این دوره: <strong>{{ "{:,}".format(total_debt) }}</strong> ریال.</p>
  {% endif %}
  <div class="banks">
    {% if bank_name1 %}<div>بانک {{ bank_name1 }} — حساب {{ account_number1 }} — شبا {{ shaba_number1 }}</div>{% endif %}
    {% if bank_name2 %}<div>بانک {{ bank_name2 }} — حساب {{ account_number2 }} — شبا {{ shaba_number2 }}</div>{% endif %}
  </div>
  <div class="signature">
    {% if signature_data_uri %}<img src="{{ signature_data_uri }}" alt="signature" height="48">{% endif %}
    {% if stamp_data_uri %}<img src="{{ stamp_data_uri }}" alt="stamp" height="56">{% endif %}
    <div>{{ manager_name }}</div>
    <div>{{ manager_position }}</div>
  </div>
</div>
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
    payer = Payer.objects.filter(code=request_obj.payer_code).first()
    if payer is not None and payer.parent_id:
        return "subsidiary"
    if request_obj.total_credit > 0 and request_obj.total_debt == 0:
        return "creditor"
    return "simple"


def build_context(request_obj: ApprovalRequest, rows: list[dict], columns: list[str]) -> dict:
    company = CompanySettings.load()
    payer = Payer.objects.filter(code=request_obj.payer_code).first()
    return {
        "letter_date": request_obj.letter_date,
        "letter_number": request_obj.letter_number,
        "payer": request_obj.payer_name,
        "payer_code": request_obj.payer_code,
        "period_range": request_obj.period_range,
        "service_type": request_obj.service_type,
        "subsidiary": payer.parent.name if payer and payer.parent else "",
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
        "variant": _variant(request_obj),
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


def render_pdf(html: str) -> bytes:
    """
    HTML -> PDF with WeasyPrint. Imported lazily: WeasyPrint needs native
    libraries (libpango/cairo) that exist in the Linux image but not on a bare
    Windows machine.
    """
    try:
        from weasyprint import HTML
    except Exception as exc:  # noqa: BLE001
        raise GenerationError(
            "موتور PDF (WeasyPrint) روی این سیستم در دسترس نیست؛ تولید PDF باید روی "
            "سرور لینوکس/Docker انجام شود."
        ) from exc
    return HTML(string=html).write_pdf()


def render_docx(context: dict) -> bytes:
    """
    Word letter: render the uploaded official .docx template when present
    (docxtpl placeholders), otherwise build a letter programmatically.
    """
    company = CompanySettings.load()
    template_rel = (company.word_template_path or "").strip()
    if template_rel:
        template_file = Path(template_rel)
        if not template_file.is_absolute():
            template_file = Path(django_settings.MEDIA_ROOT) / template_rel
        if template_file.exists():
            try:
                from docxtpl import DocxTemplate

                document = DocxTemplate(str(template_file))
                document.render(context)
                buffer = io.BytesIO()
                document.save(buffer)
                return buffer.getvalue()
            except Exception:  # noqa: BLE001 - fall back to the built-in letter
                pass

    return _render_programmatic_docx(context)


def _render_programmatic_docx(context: dict) -> bytes:
    """Build the Word letter with python-docx (RTL, B Nazanin)."""
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt

    # Tolerate partial contexts (e.g. a manual regeneration call).
    defaults = {
        "company_name": "", "address": "", "letter_number": "", "letter_date": "",
        "payer": "", "payer_code": "", "period_range": "", "service_type": "",
        "columns": [], "rows": [], "total_debt": 0, "total_credit": 0,
        "bank_name1": "", "account_number1": "", "shaba_number1": "",
        "bank_name2": "", "account_number2": "", "shaba_number2": "",
        "manager_name": "", "manager_position": "",
    }
    context = {**defaults, **context}

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

    para(context["company_name"], size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    if context["address"]:
        para(context["address"], size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    para(f"شماره نامه: {context['letter_number']}     تاریخ: {context['letter_date']}", size=12)
    para(f"شرکت طرف حساب: {context['payer']} (کد {context['payer_code']})", size=12)
    para(f"بازه: {context['period_range']}", size=12)
    para(f"موضوع: صورتحساب خدمات {context['service_type']}", size=12, bold=True)

    columns = context["columns"]
    table = document.add_table(rows=1, cols=len(columns))
    table.style = "Table Grid"
    for index, column in enumerate(columns):
        cell = table.rows[0].cells[index]
        cell.text = str(column)
        for paragraph in cell.paragraphs:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in paragraph.runs:
                run.bold = True
                run.font.size = Pt(10)

    for row in context["rows"]:
        cells = table.add_row().cells
        for index, column in enumerate(columns):
            value = row.get(column, "")
            cells[index].text = f"{value:,}" if isinstance(value, int) else str(value)
            for paragraph in cells[index].paragraphs:
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in paragraph.runs:
                    run.font.size = Pt(10)

    para(
        f"جمع بدهکار: {context['total_debt']:,} ریال     جمع بستانکار: {context['total_credit']:,} ریال",
        size=11,
        bold=True,
    )
    if context["total_credit"] > 0 and context["total_debt"] == 0:
        para("خواهشمند است صورتحساب مربوطه را صادر فرمایید.", size=11)
    for bank in (
        (context["bank_name1"], context["account_number1"], context["shaba_number1"]),
        (context["bank_name2"], context["account_number2"], context["shaba_number2"]),
    ):
        if bank[0]:
            para(f"بانک {bank[0]} — حساب {bank[1]} — شبا {bank[2]}", size=10)
    document.add_paragraph()
    para(context["manager_name"], size=11, align=WD_ALIGN_PARAGRAPH.LEFT)
    para(context["manager_position"], size=10, align=WD_ALIGN_PARAGRAPH.LEFT)

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


# ── orchestration ─────────────────────────────────────────────────────────

def _columns_for(service_key: str) -> list[str]:
    from .excel import COLUMNS

    return COLUMNS[service_key]


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

    for service_key, attr, label in SERVICE_KEYS:
        rows = list(getattr(request_obj, attr) or [])
        if not rows:
            continue
        columns = _columns_for(service_key)
        context = build_context(request_obj, rows, columns)
        context["service_type"] = f"{request_obj.service_type} — {label}"

        try:
            docx_bytes = render_docx(context)
            produced.append(
                save_final_file(
                    request_obj, service_key, f"{service_key}_{request_obj.letter_number}.docx", docx_bytes
                )
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Word ({label}): {exc}")

        try:
            pdf_bytes = render_pdf(render_html(context, template))
            produced.append(
                save_final_file(
                    request_obj, service_key, f"{service_key}_{request_obj.letter_number}.pdf", pdf_bytes
                )
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"PDF ({label}): {exc}")

        issue_date = persian_date_to_gregorian(request_obj.letter_date) or timezone.localdate()
        with transaction.atomic():
            Invoice.objects.get_or_create(
                letter_number=request_obj.letter_number,
                payer_code=request_obj.payer_code,
                invoice_type=label,
                defaults={
                    "payer": request_obj.payer_name,
                    "amount": context["total_debt"] - context["total_credit"],
                    "issue_date": issue_date,
                    "file_path": f"{request_obj.letter_number}/{service_key}_{request_obj.letter_number}.pdf",
                },
            )

    if errors and not produced:
        request_obj.generation_error = "; ".join(errors)[:2000]
        request_obj.save(update_fields=["generation_error"])
        raise GenerationError("تولید فایل ناموفق بود: " + "; ".join(errors))

    request_obj.generation_completed_at = timezone.now()
    request_obj.generation_error = "; ".join(errors)[:2000]
    request_obj.save(update_fields=["generation_completed_at", "generation_error"])
    return produced
