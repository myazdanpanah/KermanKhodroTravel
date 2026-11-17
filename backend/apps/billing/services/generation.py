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


def _template_path_for(variant: str) -> Path | None:
    """Uploaded .docx for this letter kind (falls back to the main debt one)."""
    company = CompanySettings.load()
    candidates = {
        "debt": [company.word_template_path],
        "subsidiary": [company.word_template_subsidiary_path, company.word_template_path],
        "credit": [company.word_template_credit_path],
    }.get(variant, [company.word_template_path])
    for relative in candidates:
        relative = (relative or "").strip()
        if not relative:
            continue
        path = Path(relative)
        if not path.is_absolute():
            path = Path(django_settings.MEDIA_ROOT) / relative
        if path.exists():
            return path
    return None


def render_docx(context: dict) -> bytes:
    """
    Word letter: render the uploaded official .docx template for this letter
    kind (docxtpl placeholders), otherwise build the same letter programmatically.
    """
    variant = str(context.get("variant") or "debt")
    template_file = _template_path_for(variant)
    if template_file is not None:
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
        para(f"احتراماً بدین وسیله صورت‌حساب {about}{context['period_range']}", size=12)
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
    return context


def regenerate_file(final_file) -> bytes:
    """
    Reproduce one generated artifact from the stored request data.

    Used after the retention window has released the original bytes, so a
    download always works without keeping old files on disk (spec §7).
    """
    context = _context_for(final_file.request, final_file.service_type)
    if final_file.file_name.lower().endswith(".pdf"):
        return render_pdf(render_html(context, active_template()))
    return render_docx(context)


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
        amount = context["total_debt"] - context["total_credit"]
        if context["variant"] == "credit" or amount <= 0:
            # Credit notes are not invoices; nothing to add to the invoice ledger.
            continue
        with transaction.atomic():
            Invoice.objects.get_or_create(
                letter_number=request_obj.letter_number,
                payer_code=request_obj.payer_code,
                invoice_type=label,
                defaults={
                    "payer": request_obj.payer_name,
                    "amount": amount,
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
