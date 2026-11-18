"""Billing API (spec §6). Every route is permission-gated per §9."""

from __future__ import annotations

import json
import uuid
from datetime import timedelta
from pathlib import Path

from django.conf import settings as django_settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

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
    ServiceCategory,
)
from .permissions import has_perm, perm_required, permissions_payload
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


@api_view(["GET", "PUT", "DELETE"])
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

    if request.method == "PUT":
        serializer = PayerSerializer(payer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

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


# ── payments / debts / credits ───────────────────────────────────────────

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

    serializer.save(created_by=request.user)
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
@perm_required("can_view")
def file_by_letter(request, letter_number: str):
    final_file = FinalFile.objects.filter(letter_number=letter_number).order_by("id").first()
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
    total = total_outstanding()
    per_service = list(
        Invoice.objects.values("invoice_type").annotate(amount=Sum("amount")).order_by("-amount")
    )
    per_payer = list(
        Invoice.objects.values("payer_code", "payer").annotate(amount=Sum("amount")).order_by("-amount")[:10]
    )
    monthly = list(
        Invoice.objects.values("issue_date").annotate(amount=Sum("amount")).order_by("issue_date")
    )
    for row in monthly:
        row["issue_date_jalali"] = gregorian_to_persian(row["issue_date"])
        row["issue_date"] = row["issue_date"].isoformat() if row["issue_date"] else None
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


BACKUP_MODELS = [
    ("payers", Payer),
    ("invoices", Invoice),
    ("payments", Payment),
    ("debts", ManualDebt),
    ("credits", Credit),
    ("service_categories", ServiceCategory),
    ("templates", InvoiceTemplate),
]


@api_view(["POST"])
@perm_required("can_manage_settings")
def admin_backup(request):
    """Portable JSON snapshot of the billing data (settings + rows)."""
    from django.core.serializers.json import DjangoJSONEncoder

    payload = {
        "generated_at": timezone.now().isoformat(),
        "settings": CompanySettingsSerializer(CompanySettings.load()).data,
        "tables": {},
    }
    for name, model in BACKUP_MODELS:
        payload["tables"][name] = list(model.objects.all().values())
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

    with transaction.atomic():
        for name, model in BACKUP_MODELS:
            if name == "templates":
                continue  # templates are versioned; keep existing history
            model.objects.all().delete()
            rows = tables.get(name) or []
            if rows:
                model.objects.bulk_create([model(**row) for row in rows])
        company = CompanySettings.load()
        for field, value in settings_data.items():
            if hasattr(company, field):
                setattr(company, field, value)
        company.save()

    return Response({"ok": True, "restored": {name: len(tables.get(name) or []) for name, _ in BACKUP_MODELS}})


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
