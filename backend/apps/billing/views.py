"""Billing API (spec §6). Every route is permission-gated per §9."""

from __future__ import annotations

import io
import json
import uuid
from datetime import timedelta
from pathlib import Path

from django.conf import settings as django_settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Sum
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response

class DocxRenderer(BaseRenderer):
    media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    format = "docx"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class PdfRenderer(BaseRenderer):
    media_type = "application/pdf"
    format = "pdf"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class BinaryPassthroughRenderer(BaseRenderer):
    media_type = "*/*"
    format = "any"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data

from .models import (
    ApprovalRequest,
    CompanySettings,
    Credit,
    FinalFile,
    Invoice,
    InvoiceTemplate,
    ManualDebt,
    Payer,
    Payment,
    ReportDesign,
    ServiceCategory,
)
from .permissions import has_perm, perm_required, permissions_payload
from .services.report_design import default_design, normalize_design, sample_context
from .serializers import (
    ApprovalRequestSerializer,
    CompanySettingsSerializer,
    CreditSerializer,
    FinalFileSerializer,
    InvoiceSerializer,
    InvoiceTemplateSerializer,
    ManualDebtSerializer,
    PayerSerializer,
    PaymentSerializer,
    ServiceCategorySerializer,
)
from .services import excel as excel_service
from .services.aging import aging_report
from .services.audit import record_deletion, reverse_invoice
from .services.backup import RestoreError, restore_tables, serialize_tables
from .services.balance import balances_for, payer_balance, total_outstanding
from .services.files import purge_expired_files, read_bytes, save_final_file
from .services.generation import (
    GenerationError,
    build_context,
    regenerate_file,
    html_to_pdf,
    render_html,
)
from .services.normalize import gregorian_to_persian, persian_date_to_gregorian, to_english_digits
from .services.numbers import (
    full_letter_number,
    peek_letter,
    release_numbers,
    reserve_numbers,
)
from .tasks import generate_invoice_task


# ── helpers ──────────────────────────────────────────────────────────────

# Two identical payments this close together are one submission, not two.
PAYMENT_REPEAT_WINDOW = timedelta(seconds=10)


def _error(message: str, code=status.HTTP_400_BAD_REQUEST):
    return Response({"error": message}, status=code)


def _parse_date(value, field="تاریخ"):
    """Accept 'YYYY-MM-DD' or a Jalali 'YYYY/MM/DD' string."""
    if value in (None, ""):
        return None, None
    if isinstance(value, str) and len(value) >= 10 and value[4] == "-":
        return value[:10], None
    parsed = persian_date_to_gregorian(value)
    if parsed is None:
        return None, f"{field} نامعتبر است."
    return parsed.isoformat(), None


def _with_dates(data, mapping: dict):
    payload = data.copy()
    for field, label in mapping.items():
        if field in payload:
            iso, error = _parse_date(payload[field], label)
            if error:
                return None, error
            payload[field] = iso
    return payload, None


def _payer_name(code: str) -> str:
    payer = Payer.objects.filter(code=code).first()
    return payer.name if payer else ""


def _enqueue_generation(request_id: int):
    """Prefer Celery; fall back to inline execution when no broker is running."""
    try:
        generate_invoice_task.delay(request_id)
        return "queued"
    except Exception:  # noqa: BLE001 - broker down / eager mode
        generate_invoice_task.apply(args=[request_id])
        return "inline"


# ── payers ───────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@perm_required("can_view")
def payer_list_create(request):
    if request.method == "GET":
        queryset = Payer.objects.all().select_related("parent")
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__startswith=search))
        payers = list(queryset)
        totals = balances_for(payers)
        data = []
        for payer in payers:
            item = PayerSerializer(payer).data
            item["balance"] = totals.get(payer.code, {})
            data.append(item)
        return Response(data)

    if not has_perm(request.user, "can_manage_companies"):
        return _error("شما مجوز مدیریت شرکت‌ها را ندارید.", status.HTTP_403_FORBIDDEN)
    serializer = PayerSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


def _can_manage_payer_status(user) -> bool:
    """Only Admin, CEO, or Finance roles can delete or activate/deactivate customers."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    role = str(getattr(user, "role", "")).lower()
    if role in ("admin", "ceo", "finance", "financial_manager", "finance_manager"):
        return True
    return bool(getattr(user, "can_manage_companies", False) or getattr(user, "can_manage_settings", False))


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@perm_required("can_view")
def payer_detail(request, code: str):
    payer = Payer.objects.filter(code=code).first()
    if payer is None:
        return _error("شرکت یافت نشد.", status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        data = PayerSerializer(payer).data
        data["balance"] = payer_balance(code)
        return Response(data)

    if not has_perm(request.user, "can_manage_companies"):
        return _error("شما مجوز مدیریت شرکت‌ها را ندارید.", status.HTTP_403_FORBIDDEN)

    if request.method in ("PUT", "PATCH"):
        # Check active status change
        if "is_active" in request.data:
            if not _can_manage_payer_status(request.user):
                return _error("فقط مدیرعامل، ادمین یا مدیر مالی مجاز به تغییر وضعیت فعال/غیرفعال مشتری هستند.", status.HTTP_403_FORBIDDEN)
            target_active = request.data["is_active"] in (True, "true", "True", 1, "1")
            # If deactivating, balance must be zero!
            if not target_active and payer.is_active:
                b = payer_balance(code)
                if b.get("balance", 0) != 0:
                    return _error(
                        f"امکان غیرفعال‌سازی مشتری با مانده حساب غیرصفر وجود ندارد. مانده فعلی: {b.get('balance', 0):,} ریال. ابتدا باید حساب تسویه کامل شود.",
                        status.HTTP_400_BAD_REQUEST,
                    )
        serializer = PayerSerializer(payer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        data = serializer.data
        data["balance"] = payer_balance(code)
        return Response(data)

    # DELETE request
    if not _can_manage_payer_status(request.user):
        return _error("فقط مدیرعامل، ادمین یا مدیر مالی مجاز به حذف مشتری هستند.", status.HTTP_403_FORBIDDEN)

    # Balance condition: must be 0
    b = payer_balance(code)
    if b.get("balance", 0) != 0:
        return _error(
            f"امکان حذف مشتری با مانده حساب غیرصفر وجود ندارد. مانده فعلی: {b.get('balance', 0):,} ریال. ابتدا باید حساب تسویه کامل شود.",
            status.HTTP_400_BAD_REQUEST,
        )

    # Spec 5.6: deleting a parent detaches its children instead of cascading.
    payer.children.update(parent=None)
    payer.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@perm_required("can_view")
def payer_balance_view(request, code: str):
    if not Payer.objects.filter(code=code).exists():
        return _error("شرکت یافت نشد.", status.HTTP_404_NOT_FOUND)
    return Response(payer_balance(code))


@api_view(["GET"])
@perm_required("can_view")
def aging_report_view(request):
    """Receivables aging: open invoice amounts per payer, by age bucket."""
    return Response(aging_report())


# ── invoices ─────────────────────────────────────────────────────────────

@api_view(["GET", "DELETE"])
@perm_required("can_view")
def invoice_list(request):
    if request.method == "DELETE":
        if not has_perm(request.user, "can_delete_history"):
            return _error("شما مجوز حذف تاریخچه را ندارید.", status.HTTP_403_FORBIDDEN)
        reason = str(request.data.get("reason") or "")
        with transaction.atomic():
            reversed_count = 0
            for invoice in Invoice.objects.filter(reversed_at__isnull=True):
                reverse_invoice(invoice, request.user, reason)
                reversed_count += 1
        return Response({"reversed": reversed_count})

    queryset = Invoice.objects.all()
    if request.query_params.get("include_reversed") not in ("1", "true", "yes"):
        queryset = queryset.filter(reversed_at__isnull=True)
    payer_code = request.query_params.get("payer_code")
    start = request.query_params.get("start_date")
    end = request.query_params.get("end_date")
    payer = request.query_params.get("payer")
    invoice_type = request.query_params.get("type")
    if invoice_type and invoice_type != "all":
        queryset = queryset.filter(invoice_type=invoice_type)
    if payer_code:
        queryset = queryset.filter(payer_code=payer_code)
    if payer:
        queryset = queryset.filter(payer__icontains=payer)
    if start:
        iso, err = _parse_date(start, "تاریخ شروع")
        if err:
            return _error(err)
        queryset = queryset.filter(issue_date__gte=iso)
    if end:
        iso, err = _parse_date(end, "تاریخ پایان")
        if err:
            return _error(err)
        queryset = queryset.filter(issue_date__lte=iso)
    return Response(InvoiceSerializer(queryset, many=True).data)


@api_view(["GET", "DELETE"])
@perm_required("can_view")
def invoice_detail(request, pk: int):
    invoice = Invoice.objects.filter(pk=pk).first()
    if invoice is None:
        return _error("صورتحساب یافت نشد.", status.HTTP_404_NOT_FOUND)
    if request.method == "GET":
        return Response(InvoiceSerializer(invoice).data)
    if not has_perm(request.user, "can_delete_history"):
        return _error("شما مجوز حذف تاریخچه را ندارید.", status.HTTP_403_FORBIDDEN)
    if invoice.reversed_at is not None:
        return _error("این صورتحساب قبلاً ابطال شده است.")
    with transaction.atomic():
        reverse_invoice(invoice, request.user, str(request.data.get("reason") or ""))
    return Response(InvoiceSerializer(invoice).data)


def _build_invoice_pdf_response(invoice: Invoice) -> HttpResponse:
    final_file = FinalFile.objects.filter(
        letter_number=invoice.letter_number, file_name__endswith=".pdf"
    ).order_by("-id").first()
    if final_file:
        try:
            data = read_bytes(final_file)
            letter_slug = invoice.letter_number.replace("/", "-")
            response = HttpResponse(data, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="invoice_{letter_slug}.pdf"'
            return response
        except FileNotFoundError:
            pass

    from .services.generation import html_to_pdf, HTML_DOCUMENT, DEFAULT_CSS
    from .services.normalize import gregorian_to_persian
    from .models import CompanySettings

    company = CompanySettings.load()
    items = list(invoice.items.all().order_by("id"))
    rows = []
    if items:
        for idx, it in enumerate(items, 1):
            rows.append({
                "ردیف": idx,
                "نام مسافر": it.passenger_name or "—",
                "شرح خدمت / مقصد": it.destination or it.hotel_name or it.description or invoice.invoice_type,
                "شماره بلیط / اتاق": it.ticket_number or it.room_type or "—",
                "تاریخ": it.item_date or str(invoice.issue_date),
                "بدهکار": f"{it.debt_amount:,}",
                "بستانکار": f"{it.credit_amount:,}",
                "مانده": f"{it.amount:,}",
            })
    else:
        rows.append({
            "ردیف": 1,
            "نام مسافر": "کلیه مسافران",
            "شرح خدمت / مقصد": invoice.description or invoice.invoice_type,
            "شماره بلیط / اتاق": "—",
            "تاریخ": str(invoice.issue_date),
            "بدهکار": f"{invoice.amount:,}",
            "بستانکار": "0",
            "مانده": f"{invoice.amount:,}",
        })

    jalali_date = gregorian_to_persian(invoice.issue_date) or str(invoice.issue_date)

    rows_html = "".join([
        f"<tr><td style='padding: 6px; border: 1px solid #cbd5e1;'>{r['ردیف']}</td><td style='padding: 6px; border: 1px solid #cbd5e1;'>{r['نام مسافر']}</td><td style='padding: 6px; border: 1px solid #cbd5e1;'>{r['شرح خدمت / مقصد']}</td><td style='padding: 6px; border: 1px solid #cbd5e1;'>{r['شماره بلیط / اتاق']}</td><td style='padding: 6px; border: 1px solid #cbd5e1;'>{r['تاریخ']}</td><td style='padding: 6px; border: 1px solid #cbd5e1;'>{r['بدهکار']}</td><td style='padding: 6px; border: 1px solid #cbd5e1;'>{r['بستانکار']}</td><td style='padding: 6px; border: 1px solid #cbd5e1;'>{r['مانده']}</td></tr>"
        for r in rows
    ])
    invoice_html_body = f"""
    <div style="font-family: 'Vazirmatn', Tahoma, sans-serif; direction: rtl; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #003366; padding-bottom: 12px; margin-bottom: 16px;">
            <div>
                <h2 style="margin: 0; color: #003366; font-size: 18px;">{company.company_name or 'سفرهای کرمان خودرو'}</h2>
                <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">صورت‌حساب رسمی خدمات مسافرتی و گردشگری</p>
            </div>
            <div style="text-align: left; font-size: 11px; line-height: 1.8;">
                <div><strong>شماره صورت‌حساب:</strong> {invoice.letter_number}</div>
                <div><strong>تاریخ صدور:</strong> {jalali_date}</div>
                <div><strong>نوع خدمت:</strong> {invoice.invoice_type}</div>
            </div>
        </div>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px;">
            <strong>طرف حساب / خریدار:</strong> {invoice.payer} (کد: {invoice.payer_code})
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; text-align: center;">
            <thead>
                <tr style="background: #003366; color: white;">
                    <th style="padding: 6px; border: 1px solid #002244;">ردیف</th>
                    <th style="padding: 6px; border: 1px solid #002244;">نام مسافر</th>
                    <th style="padding: 6px; border: 1px solid #002244;">شرح خدمت / مقصد</th>
                    <th style="padding: 6px; border: 1px solid #002244;">شماره بلیط / اتاق</th>
                    <th style="padding: 6px; border: 1px solid #002244;">تاریخ</th>
                    <th style="padding: 6px; border: 1px solid #002244;">بدهکار (ریال)</th>
                    <th style="padding: 6px; border: 1px solid #002244;">بستانکار (ریال)</th>
                    <th style="padding: 6px; border: 1px solid #002244;">مانده (ریال)</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
            <tfoot>
                <tr style="background: #f1f5f9; font-weight: bold;">
                    <td colspan="5" style="padding: 8px; text-align: left; border: 1px solid #cbd5e1;">جمع کل (ریال):</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1;">{invoice.amount:,}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1;">0</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1;">{invoice.amount:,}</td>
                </tr>
            </tfoot>
        </table>

        <div style="margin-top: 24px; font-size: 10px; color: #64748b; text-align: justify; line-height: 1.6; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
            {company.legal_note or 'برابر مقررات، برای هر یک از خدمات ارائه شده صورت‌حساب رسمی صادر می‌گردد.'}
        </div>
    </div>
    """
    full_html = HTML_DOCUMENT.format(css=DEFAULT_CSS, body=invoice_html_body)
    pdf_bytes = html_to_pdf(full_html)
    letter_slug = invoice.letter_number.replace("/", "-")
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="invoice_{letter_slug}.pdf"'
    return response


def _build_invoice_letter_response(invoice: Invoice) -> HttpResponse:
    from pathlib import Path
    from django.conf import settings as django_settings
    from .services.generation import render_docx, LEGAL_NOTE
    from .services.normalize import gregorian_to_persian
    from .models import CompanySettings, ApprovalRequest, Payer

    company = CompanySettings.load()
    jalali_issue_date = gregorian_to_persian(invoice.issue_date) or str(invoice.issue_date)

    # Check if an ApprovalRequest exists for this letter
    req = ApprovalRequest.objects.filter(letter_number=invoice.letter_number).first()
    period_range = req.period_range if (req and req.period_range) else ""
    if not period_range:
        item_dates = [it.item_date for it in invoice.items.all() if it.item_date]
        if item_dates:
            min_d = gregorian_to_persian(min(item_dates))
            max_d = gregorian_to_persian(max(item_dates))
            period_range = f"از {min_d} تا {max_d}" if min_d != max_d else f"مورخ {min_d}"
        else:
            period_range = f"از {jalali_issue_date} تا {jalali_issue_date}"

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

    docx_bytes = render_docx(context)

    # Update FinalFile on disk if it exists
    final_file = FinalFile.objects.filter(
        letter_number=invoice.letter_number, file_name__endswith=".docx"
    ).order_by("-id").first()
    if final_file and final_file.file_path:
        try:
            full_path = Path(django_settings.MEDIA_ROOT) / final_file.file_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_bytes(docx_bytes)
        except Exception:
            pass

    letter_slug = invoice.letter_number.replace("/", "-")
    response = HttpResponse(
        docx_bytes,
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    response["Content-Disposition"] = f'attachment; filename="letter_{letter_slug}.docx"'
    return response


@api_view(["GET"])
@renderer_classes([PdfRenderer, BinaryPassthroughRenderer, JSONRenderer])
@perm_required("can_view")
def invoice_download_pdf(request, pk: int):
    """
    Download the generated Invoice PDF (صورت‌حساب PDF) for this invoice.
    """
    invoice = Invoice.objects.filter(pk=pk).first()
    if invoice is None:
        return _error("صورتحساب یافت نشد.", status.HTTP_404_NOT_FOUND)

    try:
        return _build_invoice_pdf_response(invoice)
    except Exception as exc:
        return _error(f"خطا در تولید فایل PDF صورت‌حساب: {exc}", status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@renderer_classes([DocxRenderer, BinaryPassthroughRenderer, JSONRenderer])
@perm_required("can_view")
def invoice_download_letter(request, pk: int):
    """
    Download the generated Official Letter (Word .docx) for this invoice.
    Uses the official Word template from the system and reverses slash-delimited
    dates and letter numbers so Microsoft Word displays them in the correct visual RTL order.
    """
    invoice = Invoice.objects.filter(pk=pk).first()
    if invoice is None:
        return _error("صورتحساب یافت نشد.", status.HTTP_404_NOT_FOUND)

    try:
        return _build_invoice_letter_response(invoice)
    except Exception as exc:
        return _error(f"خطا در تولید نامه رسمی Word: {exc}", status.HTTP_400_BAD_REQUEST)


# ── payments / debts / credits ───────────────────────────────────────────

IDEMPOTENCY_MISMATCH = (
    "این کلید یکتایی قبلاً برای پرداختی با اطلاعات دیگر (شرکت، مبلغ، تاریخ یا شمارهٔ پیگیری) "
    "ثبت شده است؛ درخواست جدید ذخیره نشد."
)


def _same_payment_payload(existing, data: dict, tracking: str) -> bool:
    """Is this replay the same submission, or a corrected one with one key?"""
    return (
        existing.payer_code == str(data.get("payer_code") or "")
        and existing.amount == data.get("amount")
        and existing.payment_date == data.get("payment_date")
        and existing.tracking_number == tracking
        and (existing.description or "") == str(data.get("description") or "")
    )


@api_view(["GET", "POST"])
@perm_required("can_view")
def payment_list(request):
    if request.method == "GET":
        queryset = Payment.objects.all()
        if request.query_params.get("payer_code"):
            queryset = queryset.filter(payer_code=request.query_params["payer_code"])
        return Response(PaymentSerializer(queryset, many=True).data)

    if not has_perm(request.user, "can_pay"):
        return _error("شما مجوز ثبت پرداخت را ندارید.", status.HTTP_403_FORBIDDEN)
    payload, err = _with_dates(request.data, {"payment_date": "تاریخ پرداخت"})
    if err:
        return _error(err)
    code = str(payload.get("payer_code") or "")
    payload["payer_code"] = code
    payload.setdefault("payer_name", _payer_name(code))
    # Persian digits and stray spaces must not slip past the duplicate check.
    tracking = to_english_digits(str(payload.get("tracking_number") or "")).strip()
    payload["tracking_number"] = tracking
    serializer = PaymentSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # A retried request (or a double click that kept its token) names itself, so
    # the original payment is returned instead of being booked a second time.
    idempotency_key = str(
        request.headers.get("Idempotency-Key") or payload.get("idempotency_key") or ""
    ).strip()
    if len(idempotency_key) > 100:
        return _error("کلید یکتایی درخواست حداکثر ۱۰۰ کاراکتر است.")
    if idempotency_key:
        existing = Payment.objects.filter(
            created_by=request.user, idempotency_key=idempotency_key
        ).first()
        if existing is not None:
            if not _same_payment_payload(existing, data, tracking):
                return _error(IDEMPOTENCY_MISMATCH, status.HTTP_409_CONFLICT)
            return Response(PaymentSerializer(existing).data)

    if tracking and Payment.objects.filter(payer_code=code, tracking_number=tracking).exists():
        return _error(
            "پرداختی با همین شمارهٔ پیگیری برای این شرکت قبلاً ثبت شده است.",
            status.HTTP_409_CONFLICT,
        )

    # A double click or a retried request books the same payment twice and
    # silently lowers the payer's debt, so an identical row from the last few
    # seconds is treated as the same submission. Reading the stored rows keeps
    # this guard working across every worker, unlike a per-process cache.
    recent = Payment.objects.filter(
        payer_code=code,
        amount=data["amount"],
        payment_date=data["payment_date"],
        tracking_number=tracking,
        created_at__gte=timezone.now() - PAYMENT_REPEAT_WINDOW,
    ).exists()
    if recent:
        return _error(
            "همین پرداخت چند لحظه پیش ثبت شد؛ برای جلوگیری از ثبت تکراری یک بار دیگر بررسی کنید.",
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    try:
        with transaction.atomic():
            serializer.save(
                created_by=request.user, idempotency_key=idempotency_key or None
            )
    except IntegrityError:
        # Two parallel retries: the other one won, so answer with its row — but
        # only if it is the same submission.
        existing = Payment.objects.filter(
            created_by=request.user, idempotency_key=idempotency_key
        ).first()
        if existing is None:
            raise
        if not _same_payment_payload(existing, data, tracking):
            return _error(IDEMPOTENCY_MISMATCH, status.HTTP_409_CONFLICT)
        return Response(PaymentSerializer(existing).data)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@perm_required("can_delete_payment")
def payment_detail(request, pk: int):
    payment = Payment.objects.filter(pk=pk).first()
    if payment is None:
        return _error("پرداخت یافت نشد.", status.HTTP_404_NOT_FOUND)
    with transaction.atomic():
        record_deletion(request.user, "payment", payment, str(request.data.get("reason") or ""))
        payment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@perm_required("can_view")
def debt_list(request):
    if request.method == "GET":
        queryset = ManualDebt.objects.all()
        if request.query_params.get("payer_code"):
            queryset = queryset.filter(payer_code=request.query_params["payer_code"])
        return Response(ManualDebtSerializer(queryset, many=True).data)

    if not has_perm(request.user, "can_issue"):
        return _error("شما مجوز ثبت بدهی را ندارید.", status.HTTP_403_FORBIDDEN)
    payload, err = _with_dates(request.data, {"date": "تاریخ"})
    if err:
        return _error(err)
    if not payload.get("date"):
        payload["date"] = timezone.localdate().isoformat()
    serializer = ManualDebtSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@perm_required("can_delete_history")
def debt_detail(request, pk: int):
    debt = ManualDebt.objects.filter(pk=pk).first()
    if debt is None:
        return _error("بدهی یافت نشد.", status.HTTP_404_NOT_FOUND)
    with transaction.atomic():
        record_deletion(request.user, "debt", debt, str(request.data.get("reason") or ""))
        debt.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@perm_required("can_view")
def credit_list(request):
    if request.method == "GET":
        queryset = Credit.objects.all()
        if request.query_params.get("payer_code"):
            queryset = queryset.filter(payer_code=request.query_params["payer_code"])
        return Response(CreditSerializer(queryset, many=True).data)

    if not has_perm(request.user, "can_issue"):
        return _error("شما مجوز ثبت اعتبار را ندارید.", status.HTTP_403_FORBIDDEN)
    payload, err = _with_dates(request.data, {"credit_date": "تاریخ اعتبار"})
    if err:
        return _error(err)
    serializer = CreditSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@perm_required("can_delete_history")
def credit_detail(request, pk: int):
    credit = Credit.objects.filter(pk=pk).first()
    if credit is None:
        return _error("اعتبار یافت نشد.", status.HTTP_404_NOT_FOUND)
    with transaction.atomic():
        record_deletion(request.user, "credit", credit, str(request.data.get("reason") or ""))
        credit.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── approvals ────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@perm_required("can_view")
def approval_list(request):
    if request.method == "GET":
        queryset = ApprovalRequest.objects.all().prefetch_related("files")
        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        return Response(ApprovalRequestSerializer(queryset, many=True).data)

    if not has_perm(request.user, "can_submit"):
        return _error("شما مجوز ارسال درخواست را ندارید.", status.HTTP_403_FORBIDDEN)

    payload = request.data.copy()
    payload["requester_name"] = payload.get("requester_name") or request.user.username
    serializer = ApprovalRequestSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    approval = serializer.save(requester=request.user)
    _notify_approvers(approval)
    return Response(ApprovalRequestSerializer(approval).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@perm_required("can_view")
def approval_pending(request):
    queryset = ApprovalRequest.objects.filter(status=ApprovalRequest.STATUS_PENDING).prefetch_related("files")
    return Response(ApprovalRequestSerializer(queryset, many=True).data)


@api_view(["GET"])
@perm_required("can_submit")
def approval_mine(request):
    queryset = ApprovalRequest.objects.filter(requester=request.user).prefetch_related("files")
    return Response(ApprovalRequestSerializer(queryset, many=True).data)


@api_view(["GET", "DELETE"])
@perm_required("can_view")
def approval_detail(request, pk: int):
    approval = ApprovalRequest.objects.filter(pk=pk).prefetch_related("files").first()
    if approval is None:
        return _error("درخواست یافت نشد.", status.HTTP_404_NOT_FOUND)
    if request.method == "GET":
        return Response(ApprovalRequestSerializer(approval).data)
    if not has_perm(request.user, "can_approve"):
        return _error("شما مجوز حذف درخواست را ندارید.", status.HTTP_403_FORBIDDEN)
    approval.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)



def _notify_approvers(approval) -> None:
    """Put a freshly submitted request in every approver's bell."""
    from apps.accounts.models import User
    from apps.dashboards.models import Notification

    recipients = [
        user.pk
        for user in User.objects.filter(is_active=True).exclude(pk=approval.requester_id)
        if has_perm(user, "can_approve")
    ]
    if not recipients:
        return
    Notification.objects.bulk_create(
        [
            Notification(
                recipient_id=recipient,
                notification_type="system",
                title=f"درخواست جدید {approval.service_type}",
                message=(
                    f"درخواست {approval.service_type} برای {approval.payer_name} "
                    "در انتظار تأیید است."
                ),
                target_type="billing_request",
                target_id=str(approval.pk),
            )
            for recipient in recipients
        ]
    )


def _notify_approval_outcome(approval, *, approved: bool, reason: str = "") -> None:
    """Put the outcome in the requester's bell (dashboards Notification)."""
    from apps.dashboards.models import Notification

    if not approval.requester_id:
        return
    letters = "، ".join(
        value for value in (approval.service_letters or {}).values() if value
    )
    letters = letters or approval.letter_number
    outcome = "تأیید شد" if approved else "رد شد"
    message = f"درخواست {approval.service_type} برای {approval.payer_name} {outcome}."
    if approved and letters:
        message += f" شماره نامه: {letters}"
    if not approved and reason:
        message += f" دلیل: {reason}"
    Notification.objects.create(
        recipient_id=approval.requester_id,
        notification_type="system",
        title=f"درخواست {approval.service_type} {outcome}",
        message=message,
        target_type="billing_request",
        target_id=str(approval.pk),
    )


@api_view(["POST"])
@perm_required("can_approve")
def approval_approve(request, pk: int):
    approval = ApprovalRequest.objects.filter(pk=pk).first()
    if approval is None:
        return _error("درخواست یافت نشد.", status.HTTP_404_NOT_FOUND)
    if approval.status != ApprovalRequest.STATUS_PENDING:
        return _error("این درخواست قبلاً بررسی شده است.")

    # One letter (and one invoice) per service: flight, hotel and services each
    # get their own sequence number when a batch carries several of them.
    block_keys = [
        key
        for key, rows in (
            ("flight", approval.flight_data),
            ("hotel", approval.hotel_data),
            ("service", approval.service_data),
        )
        if rows
    ]
    count = max(1, len(block_keys))

    with transaction.atomic():
        year_two = str(approval.year % 100).zfill(2)
        numbers = reserve_numbers(approval.payer_code, year_two, count)
        service_letters = {
            key: full_letter_number(year_two, number, approval.payer_code)
            for key, number in zip(block_keys, numbers)
        }
        approval.letter_number = (
            service_letters.get("flight") or next(iter(service_letters.values()), "")
            or full_letter_number(year_two, numbers[0], approval.payer_code)
        )
        approval.service_letters = service_letters
        approval.reserved_numbers = numbers
        approval.status = ApprovalRequest.STATUS_APPROVED
        approval.approved_by = request.user
        approval.approved_at = timezone.now()
        approval.save(
            update_fields=[
                "letter_number",
                "service_letters",
                "reserved_numbers",
                "status",
                "approved_by",
                "approved_at",
            ]
        )
        _notify_approval_outcome(approval, approved=True)

    mode = _enqueue_generation(approval.id)
    approval.refresh_from_db()
    data = ApprovalRequestSerializer(approval).data
    data["generation_mode"] = mode
    return Response(data)


@api_view(["POST"])
@perm_required("can_approve")
def approval_reject(request, pk: int):
    approval = ApprovalRequest.objects.filter(pk=pk).first()
    if approval is None:
        return _error("درخواست یافت نشد.", status.HTTP_404_NOT_FOUND)
    if approval.status != ApprovalRequest.STATUS_PENDING:
        return _error("این درخواست قبلاً بررسی شده است.")

    reason = str(request.data.get("reason") or "").strip()
    approval.status = ApprovalRequest.STATUS_REJECTED
    approval.rejection_reason = reason[:500]
    approval.save(update_fields=["status", "rejection_reason"])
    _notify_approval_outcome(approval, approved=False, reason=approval.rejection_reason)
    return Response(ApprovalRequestSerializer(approval).data)


@api_view(["GET"])
@perm_required("can_view")
def approval_files(request, pk: int):
    approval = ApprovalRequest.objects.filter(pk=pk).first()
    if approval is None:
        return _error("درخواست یافت نشد.", status.HTTP_404_NOT_FOUND)
    purge_expired_files()
    return Response(FinalFileSerializer(approval.files.all(), many=True).data)


# ── files ────────────────────────────────────────────────────────────────

@api_view(["GET"])
@renderer_classes([DocxRenderer, PdfRenderer, BinaryPassthroughRenderer, JSONRenderer])
@perm_required("can_view")
def file_download(request, pk: int):
    final_file = FinalFile.objects.filter(pk=pk).first()
    if final_file is None:
        return _error("فایل یافت نشد.", status.HTTP_404_NOT_FOUND)

    # Keep storage bounded: anything past the retention window is released.
    purge_expired_files()

    try:
        data = read_bytes(final_file)
    except FileNotFoundError:
        # The payload was purged; reproduce it from the stored request.
        try:
            data = regenerate_file(final_file)
            final_file = save_final_file(
                final_file.request,
                final_file.service_type,
                final_file.file_name,
                data,
                letter_number=final_file.letter_number,
            )
        except Exception as exc:  # noqa: BLE001 - surface a Persian message
            return _error(f"تولید دوبارهٔ فایل ناموفق بود: {exc}", status.HTTP_400_BAD_REQUEST)
    content_type = (
        "application/pdf" if final_file.file_name.endswith(".pdf") else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    response = HttpResponse(data, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{final_file.file_name}"'
    return response


@api_view(["GET"])
@renderer_classes([DocxRenderer, PdfRenderer, BinaryPassthroughRenderer, JSONRenderer])
@perm_required("can_view")
def file_by_letter(request, letter_number: str):
    letter_number = (letter_number or "").strip().rstrip("/")
    format_type = (request.query_params.get("format") or "").lower()
    # 1. Prefer Invoice dynamic render to ensure latest official template and reverse slashes
    invoice = Invoice.objects.filter(letter_number=letter_number).first()
    if invoice:
        if format_type in ("docx", "word", "letter"):
            return _build_invoice_letter_response(invoice)
        return _build_invoice_pdf_response(invoice)

    # 2. Otherwise look up pre-generated FinalFile
    qs = FinalFile.objects.filter(letter_number=letter_number)
    if format_type == "pdf":
        final_file = qs.filter(file_name__endswith=".pdf").order_by("-id").first()
    elif format_type in ("docx", "word", "letter"):
        final_file = qs.filter(file_name__endswith=".docx").order_by("-id").first()
    else:
        final_file = qs.order_by("id").first()

    if final_file is None:
        return _error("برای این شماره نامه فایلی تولید نشده است.", status.HTTP_404_NOT_FOUND)
    return file_download(request, final_file.pk)


@api_view(["POST"])
@perm_required("can_approve")
def file_regenerate(request, pk: int):
    final_file = FinalFile.objects.filter(pk=pk).first()
    if final_file is None:
        return _error("فایل یافت نشد.", status.HTTP_404_NOT_FOUND)
    final_file.delete()
    mode = _enqueue_generation(final_file.request_id)
    return Response({"ok": True, "mode": mode})


# ── excel ingestion ──────────────────────────────────────────────────────

TMP_DIR = Path(django_settings.MEDIA_ROOT) / "tmp_excel"


@api_view(["POST"])
@perm_required("can_issue")
def excel_upload(request):
    uploaded = request.FILES.get("file")
    if uploaded is None:
        return _error("فایلی ارسال نشده است.")
    data = uploaded.read()
    try:
        columns, rows = excel_service.read_workbook(data)
    except excel_service.ExcelError as exc:
        return _error(str(exc))

    detected = excel_service.detect_file_type(columns)
    tmp_id = uuid.uuid4().hex
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    (TMP_DIR / f"{tmp_id}.xlsx").write_bytes(data)
    return Response(
        {
            "tmp_id": tmp_id,
            "detected_type": detected,
            "columns": columns,
            "row_count": len(rows),
        }
    )


@api_view(["POST"])
@perm_required("can_issue")
def excel_process(request):
    tmp_id = str(request.data.get("tmp_id") or "")
    file_type = str(request.data.get("type") or "")
    path = TMP_DIR / f"{tmp_id}.xlsx"
    if not tmp_id or not path.exists():
        return _error("فایل موقت یافت نشد؛ دوباره بارگذاری کنید.")
    try:
        columns, rows = excel_service.read_workbook(path.read_bytes())
        processed = excel_service.process(file_type, columns, rows)
    except excel_service.ExcelError as exc:
        return _error(str(exc))
    return Response(
        {
            "type": file_type,
            "columns": excel_service.COLUMNS[file_type],
            "rows": processed,
            "totals": excel_service.totals(processed),
        }
    )


# ── templates ────────────────────────────────────────────────────────────

@api_view(["GET", "PUT"])
@perm_required("can_view")
def template_active(request):
    template = InvoiceTemplate.objects.filter(is_active=True).order_by("-id").first()
    if request.method == "GET":
        return Response(InvoiceTemplateSerializer(template).data if template else None)

    if not has_perm(request.user, "can_edit_template"):
        return _error("شما مجوز ویرایش قالب را ندارید.", status.HTTP_403_FORBIDDEN)

    payload = request.data
    with transaction.atomic():
        InvoiceTemplate.objects.filter(is_active=True).update(is_active=False)
        new_template = InvoiceTemplate.objects.create(
            name=str(payload.get("name") or (template.name if template else "قالب اصلی")),
            description=str(payload.get("description") or ""),
            html_content=str(payload.get("html_content") or (template.html_content if template else "")),
            css_content=str(payload.get("css_content") or (template.css_content if template else "")),
            settings_json=payload.get("settings_json") or (template.settings_json if template else {}),
            is_active=True,
            created_by=request.user,
        )
    return Response(InvoiceTemplateSerializer(new_template).data)


@api_view(["POST"])
@perm_required("can_edit_template")
def template_preview(request):
    """Render a sample context with the active template to PDF."""
    template = InvoiceTemplate.objects.filter(is_active=True).order_by("-id").first()
    payer = Payer.objects.first()
    sample_rows = [
        {"ردیف": 1, "قرارداد": "1201", "نام مسافر": "نمونه مسافر", "مسیر": "KER-MHD",
         "شماره بلیط": "123456", "تاریخ پرواز": "1404/01/15", "بدهکار": 1500000,
         "بستانکار": 0, "مانده": 1500000},
    ]
    from .services.excel import FLIGHT_COLUMNS

    fake_request = ApprovalRequest(
        payer_code=payer.code if payer else "1000",
        payer_name=payer.name if payer else "شرکت نمونه",
        letter_number="1404012",
        letter_date="1404/01/15",
        period_range="فروردین ۱۴۰۴ - ۱ تا ۳۱",
        service_type="ویزا",
        start_day=1,
        end_day=31,
        month="فروردین",
        year=1404,
    )
    context = build_context(fake_request, sample_rows, FLIGHT_COLUMNS)
    request.data.get("sample_context") and context.update(request.data["sample_context"])
    try:
        pdf = html_to_pdf(render_html(context, template))
    except GenerationError as exc:
        return _error(str(exc), status.HTTP_503_SERVICE_UNAVAILABLE)
    if not pdf:
        return _error("تولید پیش‌نمایش ناموفق بود.")
    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="preview.pdf"'
    return response


# ── service categories & settings ────────────────────────────────────────

@api_view(["GET", "POST"])
@perm_required("can_view")
def service_category_list(request):
    if request.method == "GET":
        queryset = ServiceCategory.objects.all()
        if request.query_params.get("include_inactive") not in ("1", "true", "yes"):
            queryset = queryset.filter(is_active=True)
        return Response(ServiceCategorySerializer(queryset, many=True).data)

    if not has_perm(request.user, "can_manage_settings"):
        return _error("شما مجوز مدیریت تنظیمات را ندارید.", status.HTTP_403_FORBIDDEN)
    serializer = ServiceCategorySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PUT", "DELETE"])
@perm_required("can_manage_settings")
def service_category_detail(request, pk: int):
    category = ServiceCategory.objects.filter(pk=pk).first()
    if category is None:
        return _error("دسته خدمت یافت نشد.", status.HTTP_404_NOT_FOUND)
    if request.method == "PUT":
        serializer = ServiceCategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    category.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PUT"])
@perm_required("can_view")
def company_settings_view(request):
    company = CompanySettings.load()
    if request.method == "GET":
        return Response(CompanySettingsSerializer(company).data)
    if not has_perm(request.user, "can_manage_settings"):
        return _error("شما مجوز مدیریت تنظیمات را ندارید.", status.HTTP_403_FORBIDDEN)
    serializer = CompanySettingsSerializer(company, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["POST"])
@perm_required("can_manage_settings")
def company_settings_asset(request):
    asset_type = str(request.query_params.get("type") or "")
    if asset_type not in {"logo", "signature", "stamp"}:
        return _error("نوع فایل نامعتبر است (logo|signature|stamp).")
    uploaded = request.FILES.get("file")
    if uploaded is None:
        return _error("فایلی ارسال نشده است.")

    target_dir = Path(django_settings.MEDIA_ROOT) / "company_assets"
    target_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(uploaded.name).suffix or ".png"
    relative = f"company_assets/{asset_type}{suffix}"
    (Path(django_settings.MEDIA_ROOT) / relative).write_bytes(uploaded.read())

    company = CompanySettings.load()
    setattr(company, f"{asset_type}_path", relative)
    company.save(update_fields=[f"{asset_type}_path"])

    if asset_type == "logo":
        # Keep the system branding (splash + favicon) on the same logo.
        from apps.accounts.models import Company

        account_company = Company.objects.filter(is_active=True).order_by("id").first()
        if account_company is not None:
            from django.core.files.base import ContentFile

            account_company.logo.save(
                f"logo{suffix}",
                ContentFile((Path(django_settings.MEDIA_ROOT) / relative).read_bytes()),
                save=True,
            )

    return Response({"ok": True, "path": relative})


WORD_TEMPLATE_FIELDS = {
    "debt": "word_template_path",
    "subsidiary": "word_template_subsidiary_path",
    "credit": "word_template_credit_path",
}


@api_view(["POST"])
@perm_required("can_manage_settings")
def company_settings_word_template(request):
    """Upload an official .docx letter template for one of the three letters."""
    kind = str(request.query_params.get("kind") or "debt")
    field = WORD_TEMPLATE_FIELDS.get(kind)
    if field is None:
        return _error("نوع اعلامیه نامعتبر است (debt|subsidiary|credit).")
    uploaded = request.FILES.get("file")
    if uploaded is None:
        return _error("فایلی ارسال نشده است.")
    if not uploaded.name.lower().endswith(".docx"):
        return _error("فقط فایل Word با پسوند .docx پذیرفته می‌شود.")

    target_dir = Path(django_settings.MEDIA_ROOT) / "company_assets"
    target_dir.mkdir(parents=True, exist_ok=True)
    relative = f"company_assets/word_template_{kind}.docx"
    (Path(django_settings.MEDIA_ROOT) / relative).write_bytes(uploaded.read())

    company = CompanySettings.load()
    setattr(company, field, relative)
    company.save(update_fields=[field])
    return Response({"ok": True, "kind": kind, "path": relative})


# ── misc: permissions, next letter, summary, backup ─────────────────────

@api_view(["GET"])
@perm_required("can_view")
def me_permissions(request):
    return Response({"id": request.user.id, "username": request.user.username,
                     "permissions": permissions_payload(request.user)})


@api_view(["GET"])
@perm_required("can_issue")
def next_letter(request):
    payer_code = request.query_params.get("payer_code")
    if not payer_code:
        return _error("کد شرکت لازم است.")
    year = request.query_params.get("year")
    jalali_year = int(year) if year and year.isdigit() else None
    return Response({"letter_number": peek_letter(payer_code, jalali_year=jalali_year)})


@api_view(["GET"])
@perm_required("can_view")
def dashboard_summary(request):
    """Compact aggregates for the preset BI dashboards."""
    from collections import defaultdict
    total = total_outstanding()

    # 1. Service breakdown: top 5 services, remainder grouped into "سایر خدمات"
    service_rows = list(
        Invoice.objects.filter(reversed_at__isnull=True)
        .values("invoice_type")
        .annotate(amount=Sum("amount"))
        .order_by("-amount")
    )
    raw_service = []
    uncategorized_amount = 0
    for row in service_rows:
        itype = (row.get("invoice_type") or "").strip()
        if not itype:
            uncategorized_amount += row.get("amount") or 0
        else:
            raw_service.append({"invoice_type": itype, "amount": row.get("amount") or 0})
    if uncategorized_amount > 0:
        raw_service.append({"invoice_type": "بدون دسته‌بندی", "amount": uncategorized_amount})
    raw_service.sort(key=lambda x: x["amount"], reverse=True)

    if len(raw_service) > 5:
        top_services = raw_service[:5]
        other_amount = sum(item["amount"] for item in raw_service[5:])
        if other_amount > 0:
            top_services.append({"invoice_type": "سایر خدمات", "amount": other_amount})
        per_service = top_services
    else:
        per_service = raw_service

    # 2. Highest debtor companies: top 10 derived from remaining balance (debts - payments > 0)
    all_payers = list(Payer.objects.all())
    balances = balances_for(all_payers)
    per_payer = [
        {
            "payer_code": p.code,
            "payer": p.name,
            "amount": balances.get(p.code, {}).get("balance", 0),
        }
        for p in all_payers
        if balances.get(p.code, {}).get("balance", 0) > 0
    ]
    per_payer.sort(key=lambda x: x["amount"], reverse=True)
    per_payer = per_payer[:10]

    # 3. Monthly trend: aggregated by Persian month (newest first, with Persian month names)
    month_names = {
        "01": "فروردین", "02": "اردیبهشت", "03": "خرداد",
        "04": "تیر", "05": "مرداد", "06": "شهریور",
        "07": "مهر", "08": "آبان", "09": "آذر",
        "10": "دی", "11": "بهمن", "12": "اسفند",
    }
    month_invoiced = defaultdict(int)
    month_paid = defaultdict(int)
    for inv in Invoice.objects.filter(reversed_at__isnull=True).only("issue_date", "amount"):
        if inv.issue_date:
            j_month = gregorian_to_persian(inv.issue_date)[:7]
            month_invoiced[j_month] += int(inv.amount or 0)

    for pay in Payment.objects.only("payment_date", "amount"):
        if pay.payment_date:
            j_month = gregorian_to_persian(pay.payment_date)[:7]
            month_paid[j_month] += int(pay.amount or 0)

    all_months = sorted(set(month_invoiced.keys()) | set(month_paid.keys()), reverse=True)[:12]

    monthly = []
    for m in all_months:
        m_part = m.split("/")[1] if "/" in m else ""
        y_part = m.split("/")[0] if "/" in m else ""
        label = f"{month_names.get(m_part, m_part)} {y_part}" if m_part else m
        inv_amt = month_invoiced[m]
        pay_amt = month_paid[m]
        monthly.append({
            "month": m,
            "label": label,
            "issue_date_jalali": label,
            "issue_date": m,
            "amount": inv_amt,
            "invoiced": inv_amt,
            "paid": pay_amt,
        })

    return Response(
        {
            "totals": total,
            "outstanding": total["invoices"] + total["manual_debts"] - total["payments"] - total["credits"],
            "per_service": per_service,
            "per_payer": per_payer,
            "monthly": monthly,
            "approvals": list(
                ApprovalRequest.objects.values("status").annotate(count=Count("id"))
            ),
        }
    )


@api_view(["POST"])
@perm_required("can_manage_settings")
def admin_backup(request):
    """Portable JSON snapshot of the billing data (settings + rows)."""
    from django.core.serializers.json import DjangoJSONEncoder

    payload = {
        "generated_at": timezone.now().isoformat(),
        "settings": CompanySettingsSerializer(CompanySettings.load()).data,
        "tables": serialize_tables(),
    }
    body = json.dumps(payload, ensure_ascii=False, cls=DjangoJSONEncoder, indent=1)
    response = HttpResponse(body, content_type="application/json")
    stamp = timezone.now().strftime("%Y%m%d-%H%M%S")
    response["Content-Disposition"] = f'attachment; filename="kkt-backup-{stamp}.json"'
    return response


@api_view(["POST"])
@perm_required("can_manage_settings")
def admin_restore(request):
    """Restore a snapshot produced by :func:`admin_backup` (destructive)."""
    if str(request.data.get("confirm") or "").lower() not in {"true", "1", "yes"}:
        return _error("برای بازگردانی باید confirm=true ارسال شود.")
    uploaded = request.FILES.get("file") or request.data.get("file")
    if hasattr(uploaded, "read"):
        raw = uploaded.read()
    else:
        return _error("فایل پشتیبان ارسال نشده است.")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return _error("فایل پشتیبان معتبر نیست.")

    settings_data = payload.get("settings") or {}
    tables = payload.get("tables") or {}

    try:
        with transaction.atomic():
            restored = restore_tables(tables)
            company = CompanySettings.load()
            for field, value in settings_data.items():
                if hasattr(company, field):
                    setattr(company, field, value)
            company.save()
    except RestoreError as exc:
        return _error(str(exc))
    except IntegrityError:
        # A row that cannot fit this installation (stale foreign key, duplicate
        # key) must leave the ledger untouched instead of returning a 500.
        return _error("فایل پشتیبان با داده‌های این نصب سازگار نیست؛ هیچ تغییری اعمال نشد.")

    return Response({"ok": True, "restored": restored})


@api_view(["GET"])
@perm_required("can_view")
def passenger_suggestions(request):
    """Distinct passenger names from previous requests, for the manual editor."""
    names: dict[str, None] = {}
    for request_obj in ApprovalRequest.objects.only(
        "flight_data", "hotel_data", "service_data"
    ).iterator():
        for block in (request_obj.flight_data, request_obj.hotel_data, request_obj.service_data):
            for row in block or []:
                name = str(row.get("نام مسافر") or "").strip()
                if name:
                    names.setdefault(name, None)
        if len(names) >= 500:
            break
    return Response(sorted(names.keys())[:500])


@api_view(["GET"])
@perm_required("can_view")
def invoice_types(request):
    """Distinct invoice types for the per-service filters on the invoices screen."""
    from .models import ServiceCategory

    types = list(
        Invoice.objects.order_by().values_list("invoice_type", flat=True).distinct()
    )
    for label in ("پرواز", "هتل"):
        if label not in types:
            types.append(label)
    for name in ServiceCategory.objects.filter(is_active=True).values_list("name", flat=True):
        if name not in types:
            types.append(name)
    return Response(types)


@api_view(["GET"])
def management_summary(request):
    """Cross-module KPIs and ERP database status for the management dashboard."""
    import time
    from datetime import date
    from django.db import connection

    company = getattr(request.user, "company", None)
    total = total_outstanding()
    invoiced = Invoice.objects.filter(reversed_at__isnull=True).aggregate(total=Sum("amount"))["total"] or 0
    paid = Payment.objects.aggregate(total=Sum("amount"))["total"] or 0

    kpis = {
        "invoiced": invoiced,
        "paid": paid,
        "outstanding": total["invoices"] + total["manual_debts"] - total["payments"] - total["credits"],
        "payers": Payer.objects.count(),
        "invoices": Invoice.objects.filter(reversed_at__isnull=True).count(),
    }

    mix = []
    try:
        from apps.crm.models import Campaign, Lead, Opportunity
        leads = Lead.objects.filter(company=company).count() if company else Lead.objects.count()
        opportunities = Opportunity.objects.filter(company=company) if company else Opportunity.objects.all()
        kpis["leads"] = leads
        kpis["opportunities"] = opportunities.count()
        kpis["pipeline"] = float(opportunities.exclude(status__in=["closed_won", "closed_lost"]).aggregate(
            total=Sum("estimated_value"))["total"] or 0)
        kpis["campaigns"] = Campaign.objects.filter(company=company).count() if company else Campaign.objects.count()
        mix.append({"name": "سرنخ‌ها", "value": kpis["leads"]})
        mix.append({"name": "فرصت‌ها", "value": kpis["opportunities"]})
    except Exception:
        pass
    try:
        from apps.office.models import Contract, Correspondence
        kpis["letters"] = Correspondence.objects.filter(company=company).count() if company else Correspondence.objects.count()
        kpis["contracts"] = Contract.objects.filter(company=company).count() if company else Contract.objects.count()
        kpis["contract_value"] = float((Contract.objects.filter(company=company) if company else Contract.objects).aggregate(
            total=Sum("amount"))["total"] or 0)
        mix.append({"name": "نامه‌ها", "value": kpis["letters"]})
        mix.append({"name": "قراردادها", "value": kpis["contracts"]})
    except Exception:
        pass
    try:
        from apps.hr.models import Employee
        kpis["employees"] = Employee.objects.filter(company=company).count() if company else Employee.objects.count()
        mix.append({"name": "کارکنان", "value": kpis["employees"]})
    except Exception:
        pass
    try:
        from apps.sales.models import SalesOrder
        orders = SalesOrder.objects.filter(company=company) if company else SalesOrder.objects.all()
        kpis["sales_orders"] = orders.count()
        kpis["sales_value"] = float(orders.aggregate(total=Sum("total_amount"))["total"] or 0)
        mix.append({"name": "سفارش‌های فروش", "value": kpis["sales_orders"]})
    except Exception:
        kpis.setdefault("sales_orders", 0)

    # Last six months: invoiced vs collected.
    monthly = []
    today = date.today()
    for offset in range(5, -1, -1):
        year = today.year
        month = today.month - offset
        while month <= 0:
            month += 12
            year -= 1
        start = date(year, month, 1)
        end = date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1)
        month_invoiced = Invoice.objects.filter(
            reversed_at__isnull=True, issue_date__gte=start, issue_date__lt=end,
        ).aggregate(total=Sum("amount"))["total"] or 0
        month_paid = Payment.objects.filter(
            payment_date__gte=start, payment_date__lt=end,
        ).aggregate(total=Sum("amount"))["total"] or 0
        monthly.append({
            "label": gregorian_to_persian(start)[:7],
            "invoiced": month_invoiced,
            "paid": month_paid,
        })

    # Bug 9: Highest debtor companies based on remaining balance
    all_payers = list(Payer.objects.all())
    balances = balances_for(all_payers)
    top_payers = [
        {
            "payer_code": p.code,
            "payer": p.name,
            "amount": balances.get(p.code, {}).get("balance", 0),
        }
        for p in all_payers
        if balances.get(p.code, {}).get("balance", 0) > 0
    ]
    top_payers.sort(key=lambda x: x["amount"], reverse=True)
    top_payers = top_payers[:10]

    # Bug 7: Live ERP Database connectivity check
    db_status = {
        "connected": False,
        "engine": "PostgreSQL",
        "name": "nexivo",
        "host": "localhost",
        "port": "5544",
        "response_time_ms": 0,
        "table_count": 0,
        "version": "",
    }
    try:
        t0 = time.perf_counter()
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            ver_raw = cursor.fetchone()[0]
            cursor.execute("SELECT count(1) FROM information_schema.tables WHERE table_schema = 'public';")
            tbl_count = cursor.fetchone()[0]
        t1 = time.perf_counter()
        settings_dict = connection.settings_dict
        db_status = {
            "connected": True,
            "engine": "PostgreSQL",
            "name": settings_dict.get("NAME", "nexivo"),
            "host": settings_dict.get("HOST", "localhost") or "localhost",
            "port": str(settings_dict.get("PORT", "5544") or "5544"),
            "response_time_ms": round((t1 - t0) * 1000, 1),
            "table_count": tbl_count,
            "version": ver_raw.split()[0] + " " + ver_raw.split()[1] if ver_raw else "PostgreSQL 15",
        }
    except Exception as exc:
        db_status["error"] = str(exc)

    return Response({
        "kpis": kpis,
        "monthly": monthly,
        "mix": mix,
        "top_payers": top_payers,
        "db_status": db_status,
    })


@api_view(["GET", "PUT"])
def report_design_view(request):
    """گزارش‌ساز: the saved design the invoice PDF renderer uses."""
    design = ReportDesign.load()
    if request.method == "GET":
        return Response(
            {
                "name": design.name,
                "design": normalize_design(design.design_json),
                "defaults": default_design(),
                "sample": sample_context(normalize_design(design.design_json)),
                "updated_at": design.updated_at,
            }
        )
    if not has_perm(request.user, "can_manage_settings"):
        return _error("شما مجوز تغییر گزارش‌ساز را ندارید.", status.HTTP_403_FORBIDDEN)
    normalized = normalize_design(request.data.get("design", request.data))
    design.design_json = normalized
    design.name = str(request.data.get("name") or design.name).strip()[:100] or design.name
    design.updated_by = request.user
    design.save(update_fields=["design_json", "name", "updated_by", "updated_at"])
    return Response(
        {
            "name": design.name,
            "design": normalized,
            "sample": sample_context(normalized),
            "updated_at": design.updated_at,
        }
    )


@api_view(["POST"])
@perm_required("can_manage_settings")
def report_design_reset(request):
    design = ReportDesign.load()
    design.design_json = default_design()
    design.updated_by = request.user
    design.save(update_fields=["design_json", "updated_by", "updated_at"])
    normalized = normalize_design(design.design_json)
    return Response(
        {
            "name": design.name,
            "design": normalized,
            "sample": sample_context(normalized),
            "updated_at": design.updated_at,
        }
    )


@api_view(["GET"])
@perm_required("can_view")
def statements_excel(request):
    """Excel statement workbook: totals per company plus one ledger sheet each."""
    from urllib.parse import quote

    from .services.statements import build_statement_workbook

    payer_code = str(request.query_params.get("payer") or "").strip() or None
    try:
        content, filename = build_statement_workbook(payer_code)
    except ValueError as exc:
        return _error(str(exc), status.HTTP_404_NOT_FOUND)

    response = HttpResponse(
        content,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f"attachment; filename*=UTF-8''{quote(filename)}"
    return response


@api_view(["GET"])
@perm_required("can_view")
def payer_statement_view(request, code: str):
    """Detailed ledger and breakdown for a single payer/customer."""
    from .services.statements import payer_breakdown, statement_rows
    from .services.normalize import gregorian_to_persian

    payer = Payer.objects.filter(code=code).first()
    if not payer:
        payer = Payer.objects.filter(name=code).first()
    if not payer:
        return _error("طرف حساب یافت نشد.", status=status.HTTP_404_NOT_FOUND)

    breakdown = payer_breakdown(payer.code)
    raw_rows = statement_rows(payer.code)
    rows = []
    for r in raw_rows:
        rows.append({
            "date": r["date"].isoformat() if r.get("date") else "",
            "date_jalali": gregorian_to_persian(r["date"]) if r.get("date") else "",
            "kind": r.get("kind", ""),
            "payer_code": r.get("payer_code", ""),
            "payer_name": r.get("payer_name", "") or payer.name,
            "description": r.get("description", ""),
            "reference": r.get("reference", ""),
            "debit": r.get("debit", 0),
            "credit": r.get("credit", 0),
            "balance": r.get("balance", 0),
        })

    return Response({
        "payer": {
            "code": payer.code,
            "name": payer.name,
            "national_id": payer.national_id,
            "economic_code": payer.economic_code,
            "phone": payer.phone,
            "mobile": payer.mobile,
            "address": payer.address,
        },
        "breakdown": breakdown,
        "rows": rows,
    })
