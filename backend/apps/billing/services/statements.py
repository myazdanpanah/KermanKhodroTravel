"""Excel customer statements: invoices (debit), payments (credit), balance."""

from __future__ import annotations

import io

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from ..models import Credit, Invoice, ManualDebt, Payer, Payment
from .normalize import gregorian_to_persian

HEADER_FILL = PatternFill("solid", fgColor="1F2937")
HEADER_FONT = Font(name="B Nazanin", size=11, bold=True, color="FFFFFF")
BODY_FONT = Font(name="B Nazanin", size=11)
BOLD_FONT = Font(name="B Nazanin", size=11, bold=True)
THIN = Side(style="thin", color="D1D5DB")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
MONEY = '#,##0;[Red]-#,##0'


def _debit_rows(payer_code: str | None = None) -> list[dict]:
    entries = []
    qs_invoices = Invoice.objects.filter(reversed_at__isnull=True)
    if payer_code:
        qs_invoices = qs_invoices.filter(payer_code=payer_code)
    for invoice in qs_invoices:
        desc_parts = [invoice.invoice_type]
        if invoice.letter_number:
            desc_parts.append(f"شماره نامه {invoice.letter_number}")
        if invoice.description and invoice.description.strip():
            desc_parts.append(invoice.description.strip())
        description = " — ".join(desc_parts)

        entries.append(
            {
                "date": invoice.issue_date,
                "kind": "صورتحساب",
                "payer_code": invoice.payer_code,
                "payer_name": invoice.payer,
                "description": description,
                "reference": invoice.letter_number,
                "debit": int(invoice.amount or 0),
                "credit": 0,
            }
        )

    qs_debts = ManualDebt.objects.all()
    if payer_code:
        qs_debts = qs_debts.filter(payer_code=payer_code)
    for debt in qs_debts:
        desc = debt.description or "بدهی دستی"
        if debt.notes and debt.notes.strip():
            desc = f"{desc} ({debt.notes.strip()})"
        entries.append(
            {
                "date": debt.date,
                "kind": "بدهی دستی",
                "payer_code": debt.payer_code,
                "payer_name": "",
                "description": desc,
                "reference": debt.notes or "ثبت دستی",
                "debit": int(debt.amount or 0),
                "credit": 0,
            }
        )
    return entries


def _credit_rows(payer_code: str | None = None) -> list[dict]:
    entries = []
    qs_payments = Payment.objects.all()
    if payer_code:
        qs_payments = qs_payments.filter(payer_code=payer_code)
    for payment in qs_payments:
        ref_parts = []
        if payment.tracking_number and payment.tracking_number.strip():
            ref_parts.append(f"پیگیری: {payment.tracking_number.strip()}")
        if payment.payment_code and payment.payment_code.strip():
            ref_parts.append(f"کد: {payment.payment_code.strip()}")
        ref = " | ".join(ref_parts) if ref_parts else (payment.tracking_number or payment.payment_code or "دریافت بانکی")

        entries.append(
            {
                "date": payment.payment_date,
                "kind": "پرداخت",
                "payer_code": payment.payer_code,
                "payer_name": payment.payer_name,
                "description": payment.description or "دریافت از شرکت / واریز وجه",
                "reference": ref,
                "debit": 0,
                "credit": int(payment.amount or 0),
            }
        )

    qs_credits = Credit.objects.all()
    if payer_code:
        qs_credits = qs_credits.filter(payer_code=payer_code)
    for credit in qs_credits:
        entries.append(
            {
                "date": credit.credit_date,
                "kind": "بستانکاری",
                "payer_code": credit.payer_code,
                "payer_name": "",
                "description": credit.description or "اعلامیه بستانکاری",
                "reference": credit.invoice_number or "سند بستانکاری",
                "debit": 0,
                "credit": int(credit.amount or 0),
            }
        )
    return entries


def statement_rows(payer_code: str) -> list[dict]:
    """Chronological ledger with a running balance."""
    entries = _debit_rows(payer_code) + _credit_rows(payer_code)
    entries.sort(key=lambda item: (item["date"], item["kind"]))
    running = 0
    for entry in entries:
        running += entry["debit"] - entry["credit"]
        entry["balance"] = running
    return entries


def statement_totals(rows: list[dict]) -> dict:
    return {
        "debit": sum(row["debit"] for row in rows),
        "credit": sum(row["credit"] for row in rows),
        "balance": sum(row["debit"] - row["credit"] for row in rows),
    }


def payer_breakdown(payer_code: str) -> dict:
    """Split the ledger into the four sources customers ask about."""
    invoices = sum(
        int(value or 0)
        for value in Invoice.objects.filter(payer_code=payer_code, reversed_at__isnull=True).values_list("amount", flat=True)
    )
    debts = sum(
        int(value or 0)
        for value in ManualDebt.objects.filter(payer_code=payer_code).values_list("amount", flat=True)
    )
    payments = sum(
        int(value or 0)
        for value in Payment.objects.filter(payer_code=payer_code).values_list("amount", flat=True)
    )
    credits = sum(
        int(value or 0)
        for value in Credit.objects.filter(payer_code=payer_code).values_list("amount", flat=True)
    )
    return {
        "invoices": invoices,
        "debts": debts,
        "debit": invoices + debts,
        "payments": payments,
        "credits": credits,
        "credit": payments + credits,
        "balance": invoices + debts - payments - credits,
    }


def _style_sheet(sheet, widths: list[int]) -> None:
    sheet.sheet_view.rightToLeft = True
    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    for row in sheet.iter_rows():
        for cell in row:
            if not cell.font.bold:
                cell.font = BODY_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = BORDER


def _write_header(sheet, headers: list[str]) -> None:
    sheet.append(headers)
    for cell in sheet[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
    sheet.freeze_panes = "A2"


def _safe_title(text: str) -> str:
    cleaned = "".join(ch for ch in text if ch not in r"[]:*?/\\")
    return cleaned[:31] or "شرکت"


def _add_summary_sheet(workbook: Workbook, payers: list[Payer]) -> None:
    sheet = workbook.active
    sheet.title = "خلاصه شرکت‌ها"
    _write_header(
        sheet,
        ["کد", "شرکت", "صورتحساب", "بدهی دستی", "جمع بدهی", "پرداخت", "بستانکاری", "مانده"],
    )
    totals = {"invoices": 0, "debts": 0, "debit": 0, "payments": 0, "credits": 0, "credit": 0, "balance": 0}
    for payer in payers:
        sums = payer_breakdown(payer.code)
        for key in totals:
            totals[key] += sums[key]
        sheet.append(
            [
                payer.code,
                payer.name,
                sums["invoices"],
                sums["debts"],
                sums["debit"],
                sums["payments"],
                sums["credits"],
                sums["balance"],
            ]
        )
    sheet.append(
        ["", "جمع کل", totals["invoices"], totals["debts"], totals["debit"], totals["payments"], totals["credits"], totals["balance"]]
    )
    for cell in sheet[sheet.max_row]:
        cell.font = BOLD_FONT
    for row in sheet.iter_rows(min_row=2):
        for cell in row[2:]:
            cell.number_format = MONEY
    _style_sheet(sheet, [8, 32, 16, 14, 16, 16, 14, 16])


def _add_payer_sheet(workbook: Workbook, payer: Payer, is_first: bool = False) -> None:
    rows = statement_rows(payer.code)
    sums = payer_breakdown(payer.code)
    sheet_title = _safe_title(f"{payer.code} - {payer.name}")
    if is_first and len(workbook.worksheets) == 1 and workbook.active.title == "Sheet":
        sheet = workbook.active
        sheet.title = sheet_title
    else:
        sheet = workbook.create_sheet(sheet_title)

    sheet.append([f"{payer.code} — {payer.name}"])
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=7)
    sheet["A1"].font = BOLD_FONT

    breakdown = [
        ("جمع بدهی (صورتحساب + بدهی دستی)", sums["debit"]),
        ("جمع پرداخت‌ها", sums["payments"]),
        ("بستانکاری", sums["credits"]),
        ("مانده", sums["balance"]),
    ]
    for label, value in breakdown:
        sheet.append([label, value])
        sheet.merge_cells(start_row=sheet.max_row, start_column=1, end_row=sheet.max_row, end_column=6)
        sheet.cell(row=sheet.max_row, column=7).value = value
        sheet.cell(row=sheet.max_row, column=7).number_format = MONEY
        sheet.cell(row=sheet.max_row, column=7).font = BOLD_FONT

    sheet.append([])
    header_row = sheet.max_row + 1
    headers = ["تاریخ", "نوع", "شرح", "مرجع", "بدهی (ریال)", "پرداخت (ریال)", "مانده (ریال)"]
    sheet.append(headers)
    for cell in sheet[header_row]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
    for entry in rows:
        sheet.append(
            [
                gregorian_to_persian(entry["date"]),
                entry["kind"],
                entry["description"],
                entry["reference"],
                entry["debit"],
                entry["credit"],
                entry["balance"],
            ]
        )
    for row in sheet.iter_rows(min_row=header_row + 1):
        for cell in row[4:]:
            cell.number_format = MONEY
    _style_sheet(sheet, [14, 12, 42, 20, 16, 16, 18])


def _add_all_transactions_sheet(workbook: Workbook, payers: list[Payer]) -> None:
    payer_map = {p.code: p.name for p in payers}
    sheet = workbook.create_sheet("ریز کل تراکنش‌ها")
    headers = [
        "کد شرکت",
        "نام شرکت",
        "تاریخ",
        "نوع سند",
        "شرح و توضیحات",
        "شماره مرجع / پیگیری",
        "بدهکار (ریال)",
        "بستانکار (ریال)",
        "مانده (ریال)",
    ]
    _write_header(sheet, headers)

    all_entries = _debit_rows(None) + _credit_rows(None)
    all_entries.sort(key=lambda item: (item["date"], item["kind"]))

    running_balance = 0
    total_debit = 0
    total_credit = 0

    for entry in all_entries:
        p_code = entry.get("payer_code", "")
        p_name = entry.get("payer_name") or payer_map.get(p_code, "")
        debit = entry["debit"]
        credit = entry["credit"]
        running_balance += debit - credit
        total_debit += debit
        total_credit += credit

        sheet.append(
            [
                p_code,
                p_name,
                gregorian_to_persian(entry["date"]),
                entry["kind"],
                entry["description"],
                entry["reference"],
                debit,
                credit,
                running_balance,
            ]
        )

    sheet.append(
        [
            "",
            "جمع کل اسناد",
            "",
            "",
            "",
            "",
            total_debit,
            total_credit,
            running_balance,
        ]
    )
    for cell in sheet[sheet.max_row]:
        cell.font = BOLD_FONT
    for row in sheet.iter_rows(min_row=2):
        for cell in row[6:]:
            cell.number_format = MONEY
    _style_sheet(sheet, [10, 28, 14, 14, 45, 22, 18, 18, 18])


def build_statement_workbook(payer_code: str | None = None) -> tuple[bytes, str]:
    """Return (xlsx bytes, suggested filename). ``payer_code`` limits the file."""
    if payer_code:
        payer = Payer.objects.filter(code=payer_code).first()
        if payer is None:
            payer = Payer.objects.filter(name=payer_code).first()
        if payer is None:
            raise ValueError("شرکت موردنظر پیدا نشد.")
        title = f"صورت وضعیت {payer.code} - {payer.name}"
        workbook = Workbook()
        # Single company workbook: The detailed transaction ledger is Sheet 1 directly!
        _add_payer_sheet(workbook, payer, is_first=True)
    else:
        payers = list(Payer.objects.all().order_by("code"))
        title = "صورت وضعیت شرکت‌ها"
        workbook = Workbook()
        _add_summary_sheet(workbook, payers)
        _add_all_transactions_sheet(workbook, payers)
        for payer in payers:
            _add_payer_sheet(workbook, payer)

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue(), f"{title}.xlsx"
