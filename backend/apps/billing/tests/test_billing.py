"""Tests for the billing domain (spec §12 acceptance scenarios)."""

from __future__ import annotations

import datetime as dt
import io
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.billing.models import (
    ApprovalRequest,
    AvailableLetterNumber,
    BillingAuditEntry,
    CompanySettings,
    FinalFile,
    Invoice,
    InvoiceTemplate,
    LetterSequence,
    ManualDebt,
    Payer,
    Payment,
    Credit,
)
from apps.billing.services import excel as excel_service
from apps.billing.services.balance import payer_balance


class BrokenBrowser:
    """A Chromium that is installed but refuses to print (the failure paths)."""

    found = True
    launch_error = None

    def __init__(self, *args, **kwargs):
        pass

    def start(self):
        return self

    def render(self, html):
        from apps.billing.services import generation

        raise generation.GenerationError(generation.BROWSER_LAUNCH_ERROR)

    def close(self):
        pass
from apps.billing.services.generation import render_docx
from apps.billing.services.normalize import (
    gregorian_to_persian,
    persian_date_to_gregorian,
    persian_to_english_number,
    to_english_digits,
    to_persian_digits,
)
from apps.billing.services.numbers import (
    full_letter_number,
    number_from_letter,
    peek,
    release_numbers,
    reserve_numbers,
    year_from_invoice,
)

User = get_user_model()


class NormalizeTests(TestCase):
    def test_digit_conversion(self):
        self.assertEqual(to_english_digits("۱۲۳۴۵۶۷۸۹۰"), "1234567890")
        self.assertEqual(to_persian_digits("1234567890"), "۱۲۳۴۵۶۷۸۹۰")

    def test_persian_to_english_number(self):
        self.assertEqual(persian_to_english_number("۱,۲۳۴,۵۶۷"), 1234567)
        self.assertEqual(persian_to_english_number(None), 0)
        self.assertEqual(persian_to_english_number("نامشخص"), 0)
        self.assertEqual(persian_to_english_number(42), 42)

    def test_persian_date_to_gregorian(self):
        self.assertEqual(persian_date_to_gregorian("1404/01/15"), dt.date(2025, 4, 4))
        self.assertEqual(persian_date_to_gregorian("۱۴۰۴/۰۱/۱۵"), dt.date(2025, 4, 4))
        self.assertIsNone(persian_date_to_gregorian("garbage"))
        self.assertIsNone(persian_date_to_gregorian(""))
        self.assertIsNone(persian_date_to_gregorian("1200/01/01"))  # out of range

    def test_gregorian_to_persian(self):
        self.assertEqual(gregorian_to_persian("2025-04-04"), "1404/01/15")
        self.assertEqual(gregorian_to_persian(dt.date(2025, 4, 4)), "1404/01/15")


class ExcelProcessorTests(TestCase):
    def test_flight_processor(self):
        columns = ["نام مسافر", "شماره قرارداد", "مسیر", "شماره بلیط", "تاریخ پرواز", "بدهکار", "بستانکار"]
        rows = [
            {
                "نام مسافر": "علی رضایی, ",
                "شماره قرارداد": 1201,
                "مسیر": "KER-MHD تاریخ حرکت: ۱۴۰۴/۰۱/۱۵",
                "شماره بلیط": "123456",
                "تاریخ پرواز": "",
                "بدهکار": "۱,۵۰۰,۰۰۰",
                "بستانکار": 0,
            }
        ]
        result = excel_service.process_flight(columns, rows)
        self.assertEqual(len(result), 1)
        row = result[0]
        self.assertEqual(row["ردیف"], 1)
        self.assertEqual(row["نام مسافر"], "علی رضایی")
        # Date is normalised to ASCII digits so letters and tables stay uniform.
        self.assertEqual(row["تاریخ پرواز"], "1404/01/15")
        self.assertEqual(row["بدهکار"], 1500000)
        self.assertEqual(row["مانده"], 1500000)

    def test_flight_without_move_date_returns_empty(self):
        columns = ["نام مسافر", "شماره قرارداد", "مسیر", "شماره بلیط", "تاریخ پرواز", "بدهکار", "بستانکار"]
        rows = [{"نام مسافر": "X", "شماره قرارداد": "1", "مسیر": "KER-MHD",
                 "شماره بلیط": "1", "تاریخ پرواز": "", "بدهکار": 10, "بستانکار": 0}]
        self.assertEqual(excel_service.process_flight(columns, rows)[0]["تاریخ پرواز"], "")

    def test_hotel_processor_defaults_passenger_count(self):
        columns = ["نام مسافر", "شماره قرارداد", "هتل", "اتاق", "تاریخ ورود", "تاریخ خروج", "بدهکار", "بستانکار"]
        rows = [{
            "نام مسافر": " مهمان ", "شماره قرارداد": "77", "هتل": "هتل پارس", "اتاق": "دبل",
            "تاریخ ورود": "1404/01/10", "تاریخ خروج": "1404/01/12",
            "بدهکار": "2000000", "بستانکار": "500000",
        }]
        row = excel_service.process_hotel(columns, rows)[0]
        self.assertEqual(row["تعداد نفرات"], 1)
        self.assertEqual(row["تاریخ ورود و خروج"], "ورود: 1404/01/10  خروج: 1404/01/12")
        self.assertEqual(row["مانده"], 1500000)

    def test_hotel_passenger_count_column(self):
        columns = ["نام مسافر", "شماره قرارداد", "هتل", "اتاق", "تعداد مسافر", "بدهکار", "بستانکار"]
        rows = [{"نام مسافر": "A", "شماره قرارداد": "1", "هتل": "H", "اتاق": "D",
                 "تعداد مسافر": "۳", "بدهکار": 100, "بستانکار": 0}]
        self.assertEqual(excel_service.process_hotel(columns, rows)[0]["تعداد نفرات"], 3)

    def test_service_processor_optional_columns(self):
        columns = ["نام مسافر", "شماره قرارداد", "بدهکار", "بستانکار"]
        rows = [{"نام مسافر": "S", "شماره قرارداد": "9", "بدهکار": "1000", "بستانکار": "0"}]
        row = excel_service.process_service(columns, rows)[0]
        self.assertEqual(row["شرح خدمات"], "")
        self.assertEqual(row["مانده"], 1000)

    def test_missing_columns_raises_persian_error(self):
        with self.assertRaises(excel_service.ExcelError) as ctx:
            excel_service.process_flight(["نام مسافر"], [{"نام مسافر": "A"}])
        self.assertIn("ستون", str(ctx.exception))

    def test_read_workbook_from_xlsx_bytes(self):
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.append(["نام مسافر", "شماره قرارداد", "مسیر", "شماره بلیط", "تاریخ پرواز", "بدهکار", "بستانکار"])
        ws.append(["علی", "1201", "KER-MHD", "999", "", "۱۰۰۰", "۰"])
        buffer = io.BytesIO()
        wb.save(buffer)
        columns, rows = excel_service.read_workbook(buffer.getvalue())
        self.assertIn("نام مسافر", columns)
        processed = excel_service.process("flight", columns, rows)
        self.assertEqual(processed[0]["بدهکار"], 1000)


class LetterNumberingTests(TestCase):
    def setUp(self):
        self.payer = Payer.objects.create(code="1001", name="شرکت نمونه")

    def test_peek_fresh_payer_returns_one(self):
        self.assertEqual(peek("1001", "04"), 1)

    def test_reserve_sequence(self):
        self.assertEqual(reserve_numbers("1001", "04", 3), [1, 2, 3])
        self.assertEqual(peek("1001", "04"), 4)

    def test_released_number_is_recycled_first(self):
        reserve_numbers("1001", "04", 2)  # 1, 2
        release_numbers("1001", "04", [1])
        self.assertEqual(peek("1001", "04"), 1)
        self.assertEqual(reserve_numbers("1001", "04", 1), [1])
        self.assertEqual(peek("1001", "04"), 3)

    def test_full_letter_number_format(self):
        letter = full_letter_number("04", 12, "5001")
        self.assertEqual(letter, "1404/5001/00012")

    def test_number_from_letter(self):
        self.assertEqual(number_from_letter("1404/5001/00012"), 12)
        self.assertEqual(number_from_letter("1404012"), 12)
        self.assertIsNone(number_from_letter("no-digits"))

    def test_year_from_invoice(self):
        invoice = Invoice.objects.create(
            letter_number="1404012", payer="x", payer_code="1001",
            invoice_type="پرواز", amount=1000, issue_date=dt.date(2025, 4, 4),
        )
        self.assertEqual(year_from_invoice(invoice), "04")


class BalanceTests(TestCase):
    def test_balance_formula(self):
        payer = Payer.objects.create(code="1002", name="مشتری")
        Invoice.objects.create(letter_number="1404001", payer=payer.name, payer_code="1002",
                               invoice_type="پرواز", amount=10_000, issue_date=dt.date(2025, 1, 1))
        ManualDebt.objects.create(payer_code="1002", description="بدهی", amount=2_000, date=dt.date(2025, 1, 2))
        Payment.objects.create(payer_code="1002", payer_name=payer.name, amount=3_000,
                               payment_date=dt.date(2025, 1, 3))
        Credit.objects.create(payer_code="1002", amount=1_000, credit_date=dt.date(2025, 1, 4))
        result = payer_balance("1002")
        self.assertEqual(result["invoices"], 10_000)
        self.assertEqual(result["balance"], 10_000 + 2_000 - 3_000 - 1_000)


class BillingApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="kkt_admin", password="pass12345", role="admin", is_staff=True, is_superuser=True,
        )
        self.viewer = User.objects.create_user(username="kkt_viewer", password="pass12345", role="sales")
        self.client.force_authenticate(user=self.admin)
        self.payer = Payer.objects.create(code="2001", name="شرکت آلفا")

    def test_create_payer_and_reject_bad_code(self):
        response = self.client.post("/api/v1/billing/payers/", {"code": "2002", "name": "بتا"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        bad = self.client.post("/api/v1/billing/payers/", {"code": "123456", "name": "بد"}, format="json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_payer_self_parent_is_nulled(self):
        response = self.client.put("/api/v1/billing/payers/2001/", {"parent": "2001"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.payer.refresh_from_db()
        self.assertIsNone(self.payer.parent_id)

    def test_delete_parent_keeps_children(self):
        child = Payer.objects.create(code="2003", name="زیرمجموعه", parent=self.payer)
        response = self.client.delete("/api/v1/billing/payers/2001/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        child.refresh_from_db()
        self.assertIsNone(child.parent_id)

    def test_viewer_cannot_pay(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.post(
            "/api/v1/billing/payments/",
            {"payer_code": "2001", "payment_date": "1404/01/15", "amount": 1000},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_payment_registration_with_jalali_date(self):
        response = self.client.post(
            "/api/v1/billing/payments/",
            {"payer_code": "2001", "payment_date": "1404/01/15", "amount": 1500000, "tracking_number": "T1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payment = Payment.objects.get()
        self.assertEqual(payment.payment_date, dt.date(2025, 4, 4))
        self.assertEqual(payment.payer_name, "شرکت آلفا")

    def test_duplicate_tracking_number_is_rejected(self):
        payload = {
            "payer_code": "2001", "payment_date": "1404/01/15",
            "amount": 900_000, "tracking_number": "TRK-77",
        }
        first = self.client.post("/api/v1/billing/payments/", payload, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post("/api/v1/billing/payments/", payload, format="json")
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("پیگیری", second.data["error"])

        # The balance must reflect one payment, not two.
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(payer_balance("2001")["payments"], 900_000)

    def test_persian_digits_in_the_tracking_number_still_match(self):
        self.client.post(
            "/api/v1/billing/payments/",
            {"payer_code": "2001", "payment_date": "1404/01/15", "amount": 5_000,
             "tracking_number": "12345"},
            format="json",
        )
        response = self.client.post(
            "/api/v1/billing/payments/",
            {"payer_code": "2001", "payment_date": "1404/01/15", "amount": 5_000,
             "tracking_number": " ۱۲۳۴۵ "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Payment.objects.count(), 1)

    def test_same_tracking_number_for_another_payer_is_allowed(self):
        Payer.objects.create(code="2002", name="شرکت بتا")
        for code in ("2001", "2002"):
            response = self.client.post(
                "/api/v1/billing/payments/",
                {"payer_code": code, "payment_date": "1404/01/15", "amount": 7_000,
                 "tracking_number": "SHARED-1"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, code)
        self.assertEqual(Payment.objects.count(), 2)

    def test_identical_submission_within_seconds_is_throttled(self):
        payload = {"payer_code": "2001", "payment_date": "1404/01/16", "amount": 4_321_000}
        first = self.client.post("/api/v1/billing/payments/", payload, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post("/api/v1/billing/payments/", payload, format="json")
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(Payment.objects.count(), 1)

    def test_payment_records_who_registered_it(self):
        response = self.client.post(
            "/api/v1/billing/payments/",
            {"payer_code": "2001", "payment_date": "1404/01/17", "amount": 1_500},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payment = Payment.objects.get()
        self.assertEqual(payment.created_by, self.admin)
        self.assertEqual(response.data["created_by_name"], "kkt_admin")

    def test_invoice_row_payment_lowers_balance_and_keeps_the_invoice(self):
        """The ثبت پرداخت action on an invoice row must hit the same ledger."""
        invoice = Invoice.objects.create(
            letter_number="1404/2001/00009",
            payer="شرکت آلفا",
            payer_code="2001",
            invoice_type="پرواز",
            amount=2_000_000,
            issue_date=dt.date(2025, 4, 1),
        )
        self.assertEqual(payer_balance("2001")["balance"], 2_000_000)

        paid = self.client.post(
            "/api/v1/billing/payments/",
            {
                "payer_code": "2001",
                "payment_date": "1404/01/20",
                "amount": 750_000,
                "tracking_number": invoice.letter_number,
                "description": "ثبت از ردیف صورت‌حساب",
            },
            format="json",
        )
        self.assertEqual(paid.status_code, status.HTTP_201_CREATED)

        balance = payer_balance("2001")
        self.assertEqual(balance["payments"], 750_000)
        self.assertEqual(balance["balance"], 1_250_000)

        # The same figure the performance/customer screens read.
        payers = self.client.get("/api/v1/billing/payers/").data
        row = next(item for item in payers if item["code"] == "2001")
        self.assertEqual(row["balance"]["balance"], 1_250_000)
        self.assertEqual(row["balance"]["payments"], 750_000)
        self.assertEqual(
            self.client.get("/api/v1/billing/payers/2001/balance/").data["balance"], 1_250_000
        )

        # A paid invoice is still part of the ledger/history.
        invoices = self.client.get("/api/v1/billing/invoices/").data
        self.assertTrue(any(item["letter_number"] == "1404/2001/00009" for item in invoices))
        self.assertEqual(self.client.get(f"/api/v1/billing/invoices/{invoice.id}/").status_code, 200)

    def test_negative_payment_rejected(self):
        response = self.client.post(
            "/api/v1/billing/payments/",
            {"payer_code": "2001", "payment_date": "1404/01/15", "amount": -5},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invoice_delete_reverses_and_keeps_the_letter_number(self):
        reserved = reserve_numbers("2001", "04", 1)
        invoice = Invoice.objects.create(
            letter_number=full_letter_number("04", reserved[0], "2001"),
            payer="شرکت آلفا", payer_code="2001", invoice_type="پرواز",
            amount=2_000_000, issue_date=dt.date(2025, 4, 1),
        )
        self.assertEqual(payer_balance("2001")["balance"], 2_000_000)

        response = self.client.delete(
            f"/api/v1/billing/invoices/{invoice.id}/",
            {"reason": "اشتباه ثبت شده"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        invoice.refresh_from_db()  # the row survives
        self.assertIsNotNone(invoice.reversed_at)
        self.assertEqual(invoice.reversed_by, self.admin)
        self.assertEqual(invoice.reversal_reason, "اشتباه ثبت شده")

        self.assertEqual(payer_balance("2001")["balance"], 0)
        self.assertEqual(self.client.get("/api/v1/billing/invoices/").data, [])
        listed = self.client.get("/api/v1/billing/invoices/?include_reversed=1").data
        self.assertEqual(len(listed), 1)
        self.assertTrue(listed[0]["is_reversed"])

        # The printed number is never handed out a second time.
        self.assertEqual(peek("2001", "04"), reserved[0] + 1)
        self.assertEqual(reserve_numbers("2001", "04", 1), [reserved[0] + 1])

    def test_invoice_reversal_is_audited_with_the_actor(self):
        invoice = Invoice.objects.create(
            letter_number="1404/2001/00007", payer="شرکت آلفا", payer_code="2001",
            invoice_type="هتل", amount=500_000, issue_date=dt.date(2025, 4, 1),
        )
        self.client.delete(
            f"/api/v1/billing/invoices/{invoice.id}/", {"reason": "ابطال تست"}, format="json"
        )

        entry = BillingAuditEntry.objects.get()
        self.assertEqual(entry.entity, "invoice")
        self.assertEqual(entry.action, BillingAuditEntry.ACTION_REVERSED)
        self.assertEqual(entry.object_id, str(invoice.id))
        self.assertEqual(entry.actor, self.admin)
        self.assertEqual(entry.reason, "ابطال تست")
        self.assertEqual(entry.snapshot["letter_number"], "1404/2001/00007")
        self.assertEqual(entry.snapshot["amount"], 500_000)

    def test_bulk_delete_reverses_the_ledger_instead_of_erasing_it(self):
        for index, amount in enumerate((1_000, 2_000), start=1):
            Invoice.objects.create(
                letter_number=f"1404/2001/0000{index}", payer="شرکت آلفا",
                payer_code="2001", invoice_type="پرواز", amount=amount,
                issue_date=dt.date(2025, 4, index),
            )
        self.assertEqual(payer_balance("2001")["balance"], 3_000)

        response = self.client.delete(
            "/api/v1/billing/invoices/", {"reason": "بازسازی دفتر"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["reversed"], 2)
        self.assertEqual(Invoice.objects.count(), 2)
        self.assertFalse(Invoice.objects.filter(reversed_at__isnull=True).exists())
        self.assertEqual(payer_balance("2001")["balance"], 0)
        self.assertEqual(BillingAuditEntry.objects.filter(action="reversed").count(), 2)

    def test_deleting_a_payment_records_who_deleted_it(self):
        payment = Payment.objects.create(
            payer_code="2001", payer_name="شرکت آلفا", payment_date=dt.date(2025, 4, 2),
            amount=750_000, tracking_number="TRK-9",
        )
        response = self.client.delete(
            f"/api/v1/billing/payments/{payment.id}/",
            {"reason": "واریز تکراری"}, format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Payment.objects.exists())
        entry = BillingAuditEntry.objects.get()
        self.assertEqual(entry.entity, "payment")
        self.assertEqual(entry.action, BillingAuditEntry.ACTION_DELETED)
        self.assertEqual(entry.actor, self.admin)
        self.assertEqual(entry.reason, "واریز تکراری")
        self.assertEqual(entry.snapshot["amount"], 750_000)
        self.assertEqual(entry.snapshot["tracking_number"], "TRK-9")

    def test_multi_service_batch_gets_a_letter_and_invoice_each(self):
        payload = {
            "payer_code": "2001",
            "payer_name": "شرکت آلفا",
            "service_type": "پرواز، هتل، تور",
            "service_category": "تور",
            "letter_number": "1404001",
            "letter_date": "1404/01/15",
            "start_day": 1,
            "end_day": 31,
            "month": "فروردین",
            "year": 1404,
            "period_range": "فروردین ۱۴۰۴",
            "flight_data": [{"ردیف": 1, "قرارداد": "1", "نام مسافر": "A", "مسیر": "KER-MHD",
                             "شماره بلیط": "1", "بدهکار": 1000, "بستانکار": 0, "مانده": 1000}],
            "hotel_data": [{"ردیف": 1, "قرارداد": "2", "نام مسافر": "B", "هتل": "پارس",
                            "نوع اتاق": "دو تخته", "تعداد نفرات": 2,
                            "تاریخ ورود و خروج": "ورود: 1404/01/16 خروج: 1404/01/18",
                            "بدهکار": 2000, "بستانکار": 0, "مانده": 2000}],
            "service_data": [{"ردیف": 1, "قرارداد": "3", "نام مسافر": "C", "شرح خدمات": "تور",
                              "تاریخ": "1404/01/17", "توضیحات": "",
                              "بدهکار": 3000, "بستانکار": 0, "مانده": 3000}],
        }
        created = self.client.post("/api/v1/billing/approvals/", payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        approval_id = created.data["id"]
        approved = self.client.post(f"/api/v1/billing/approvals/{approval_id}/approve/", {}, format="json")
        self.assertEqual(approved.status_code, status.HTTP_200_OK)

        approval = ApprovalRequest.objects.get(pk=approval_id)
        self.assertEqual(len(approval.reserved_numbers), 3)
        self.assertEqual(set(approval.service_letters), {"flight", "hotel", "service"})
        self.assertEqual(len(set(approval.service_letters.values())), 3)

        # Each letter carries its own artifacts.
        self.assertEqual(
            set(approval.files.values_list("letter_number", flat=True)),
            set(approval.service_letters.values()),
        )
        # And its own invoice, typed by the service (category for services).
        invoices = Invoice.objects.filter(payer_code="2001")
        self.assertEqual(invoices.count(), 3)
        self.assertEqual(
            set(invoices.values_list("invoice_type", flat=True)), {"پرواز", "هتل", "تور"}
        )
        self.assertEqual(len(set(invoices.values_list("letter_number", flat=True))), 3)

    def test_approval_flow_approve_reserves_number_and_generates_docx(self):
        payload = {
            "payer_code": "2001",
            "payer_name": "شرکت آلفا",
            "service_type": "ویزا",
            "letter_number": "1404001",
            "letter_date": "1404/01/15",
            "start_day": 1,
            "end_day": 31,
            "month": "فروردین",
            "year": 1404,
            "period_range": "فروردین ۱۴۰۴ - ۱ تا ۳۱",
            "flight_data": [{"ردیف": 1, "قرارداد": "1", "نام مسافر": "A", "مسیر": "KER-MHD",
                             "شماره بلیط": "1", "تاریخ پرواز": "", "بدهکار": 1000,
                             "بستانکار": 0, "مانده": 1000}],
        }
        created = self.client.post("/api/v1/billing/approvals/", payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        approval_id = created.data["id"]

        approved = self.client.post(f"/api/v1/billing/approvals/{approval_id}/approve/", {}, format="json")
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        approval = ApprovalRequest.objects.get(pk=approval_id)
        self.assertEqual(approval.status, ApprovalRequest.STATUS_APPROVED)
        self.assertEqual(len(approval.reserved_numbers), 1)
        self.assertTrue(approval.letter_number.endswith("/00001"))
        self.assertEqual(approval.letter_number.split("/")[1], "2001")
        self.assertTrue(approval.files.filter(file_name__endswith=".docx").exists())
        self.assertTrue(Invoice.objects.filter(payer_code="2001").exists())

        # The letter is Word; the PDF is the invoice table rendered from HTML.
        pdf_file = approval.files.filter(file_name__endswith=".pdf").first()
        self.assertIsNotNone(pdf_file)
        self.assertTrue(bytes(pdf_file.file_data)[:5] == b"%PDF-")

    def test_cannot_approve_twice(self):
        approval = ApprovalRequest.objects.create(
            requester=self.admin, requester_name="admin", payer_code="2001", payer_name="آلفا",
            service_type="ویزا", letter_number="1404009", letter_date="1404/01/15",
            start_day=1, end_day=31, month="فروردین", year=1404, period_range="x",
            flight_data=[{"بدهکار": 1000, "بستانکار": 0}],
        )
        first = self.client.post(f"/api/v1/billing/approvals/{approval.id}/approve/", {}, format="json")
        second = self.client.post(f"/api/v1/billing/approvals/{approval.id}/approve/", {}, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_viewer_cannot_approve(self):
        approval = ApprovalRequest.objects.create(
            requester=self.admin, requester_name="admin", payer_code="2001", payer_name="آلفا",
            service_type="ویزا", letter_number="1404010", letter_date="1404/01/15",
            start_day=1, end_day=31, month="فروردین", year=1404, period_range="x",
            flight_data=[{"بدهکار": 1, "بستانکار": 0}],
        )
        self.client.force_authenticate(user=self.viewer)
        response = self.client.post(f"/api/v1/billing/approvals/{approval.id}/approve/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_template_activation_is_exclusive(self):
        old = InvoiceTemplate.objects.create(name="قدیمی", is_active=True)
        new = InvoiceTemplate.objects.create(name="جدید", is_active=True)
        old.refresh_from_db()
        self.assertFalse(old.is_active)
        self.assertTrue(new.is_active)
        self.assertEqual(InvoiceTemplate.objects.filter(is_active=True).count(), 1)

    def test_settings_singleton(self):
        first = CompanySettings.load()
        first.company_name = "شرکت تست"
        first.save()
        self.assertEqual(CompanySettings.objects.count(), 1)


class InvoicePdfLayoutTests(TestCase):
    """The invoice HTML must carry its own font and unescaped stylesheet."""

    def setUp(self):
        from apps.billing.models import ApprovalRequest

        self.request = ApprovalRequest(
            payer_code="9999", payer_name="شرکت نمونه", service_type="ویزا",
            letter_number="1404/9999/00123", letter_date="1404/03/10",
            period_range="خرداد ۱۴۰۴", service_category="ویزا",
        )
        self.rows = [
            {"ردیف": 1, "قرارداد": "1", "نام مسافر": "محمدرضا نوروزی‌پور تهرانی‌اصل",
             "مسیر": "KER-MHD", "شماره بلیط": "1", "تاریخ پرواز": "1404/03/12",
             "بدهکار": 1000, "بستانکار": 0, "مانده": 1000},
        ]

    def _html(self) -> str:
        from apps.billing.services import generation as generation_service

        context = generation_service.build_invoice_context(
            self.request, "flight", self.rows, "1404/9999/00123"
        )
        return generation_service.Environment(
            autoescape=generation_service.select_autoescape(["html", "xml"])
        ).from_string(generation_service.INVOICE_HTML).render(**context)

    def test_stylesheet_is_not_html_escaped(self):
        html = self._html()
        # Jinja used to turn the quotes into &#39;, which killed the whole
        # font-family declaration and silently fell back to Times New Roman.
        self.assertNotIn("&#39;", html)
        self.assertIn("font-family: 'KKT Vazirmatn'", html)

    def test_vazirmatn_is_embedded_with_both_weights(self):
        from apps.billing.services import generation as generation_service

        css = generation_service.INVOICE_CSS
        self.assertEqual(css.count("@font-face"), 4)  # 400/700 for arabic + latin
        self.assertEqual(css.count("data:font/woff2;base64,"), 4)
        self.assertTrue((generation_service.ASSETS_DIR / "OFL.txt").exists())
        for name in (
            "vazirmatn-arabic-400-normal.woff2",
            "vazirmatn-arabic-700-normal.woff2",
            "vazirmatn-latin-400-normal.woff2",
            "vazirmatn-latin-700-normal.woff2",
        ):
            self.assertTrue((generation_service.ASSETS_DIR / name).exists(), name)

    def test_long_passenger_names_wrap_instead_of_overflowing(self):
        html = self._html()
        # Fixed column widths plus wrapping keep an unbreakable long name inside
        # its cell instead of stretching the table past the page margins.
        self.assertIn("table-layout: fixed", html)
        self.assertIn("overflow-wrap: anywhere", html)
        # Columns now come from the saved report design, so the width is inline.
        self.assertIn('<col style="width: 16%;">', html)


class InvoicePdfContentTests(TestCase):
    """Read the rendered PDF back: an empty-but-valid file must fail the suite."""

    ROW_COUNT = 10  # more than one page (the table breaks every eight rows)
    LONG_NAME = "محمدرضا نوروزی‌پور تهرانی‌اصل"

    def setUp(self):
        from apps.billing.services.generation import _find_pdf_browser

        if _find_pdf_browser() is None:
            self.skipTest("no Chromium-family browser is installed to render the PDF")

        self.request = ApprovalRequest(
            payer_code="9999", payer_name="شرکت نمونه", service_type="پرواز",
            letter_number="1404/9999/00123", letter_date="1404/03/10",
            period_range="خرداد ۱۴۰۴", service_category="پرواز",
        )
        self.rows = self._make_rows(self.ROW_COUNT)

    def _make_rows(self, count: int) -> list[dict]:
        return [
            {
                "ردیف": index, "قرارداد": str(1000 + index),
                "نام مسافر": self.LONG_NAME if index == 2 else f"مسافر شماره {index}",
                "مسیر": "KER-MHD", "شماره بلیط": str(90000 + index),
                "تاریخ پرواز": "1404/03/12",
                "بدهکار": 1_000_000 * index, "بستانکار": 0, "مانده": 1_000_000 * index,
            }
            for index in range(1, count + 1)
        ]

    def _pages(self, rows: list[dict] | None = None) -> list[str]:
        import pymupdf

        from apps.billing.services.generation import render_invoice_pdf

        rows = self.rows if rows is None else rows
        data = render_invoice_pdf(self.request, "flight", rows, self.request.letter_number)
        self.assertTrue(data.startswith(b"%PDF-"))
        document = pymupdf.open(stream=data, filetype="pdf")
        try:
            return [page.get_text() for page in document]
        finally:
            document.close()

    def assert_words(self, text: str, phrase: str) -> None:
        """Exact phrases don't survive extraction: RTL runs come back in visual
        order and a wrapped cell inserts line breaks, so every word is asserted
        on its own against the text with ZWNJ removed."""
        flat = text.replace("\u200c", "")
        for word in phrase.replace("\u200c", " ").split():
            if len(word) > 1:
                self.assertIn(word, flat, f"{word!r} is missing from the PDF text")

    def test_more_than_eight_rows_renders_second_page(self):
        pages = self._pages()
        self.assertEqual(len(pages), 2)
        self.assertTrue(all(page.strip() for page in pages), "a page rendered blank")
        # Text exists, so a template that renders empty-but-valid PDFs fails here.
        self.assertGreater(len("".join(pages)), 200)

    def test_eight_rows_fit_on_one_page_and_nine_break_to_two(self):
        """The per-page chunk is eight rows; an off-by-one must fail here."""
        single = self._pages(self._make_rows(8))
        self.assertEqual(len(single), 1, "eight rows spilled onto a second page")
        self.assertTrue(single[0].strip(), "the single page rendered blank")

        double = self._pages(self._make_rows(9))
        self.assertEqual(len(double), 2, "nine rows did not break to a second page")
        self.assertTrue(all(page.strip() for page in double), "a page rendered blank")

    def test_pdf_contains_title_totals_and_passenger(self):
        from apps.billing.services.normalize import to_persian_digits

        pages = self._pages()
        first, last = pages[0], pages[-1]

        # Title: "صورت حساب پرواز شرکت نمونه" plus the invoice number.
        self.assert_words(first, "صورت حساب پرواز شرکت نمونه")
        self.assertIn("1404/9999/00123", first)
        # Grand totals live on the last page: 55,000,000 for rows 1..10.
        self.assertIn(to_persian_digits(f"{55_000_000:,}"), last)
        self.assert_words(last, "جمع کل نهایی بدهکار")
        # The long passenger name is present (it wraps, but stays in the text).
        self.assert_words(first, self.LONG_NAME)
        # The last row of the second page proves the page break kept its rows.
        self.assert_words(last, f"مسافر شماره {self.ROW_COUNT}")


class PdfBrowserTests(TestCase):
    """One browser launch per request, and browser failures are not hidden."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="kkt_pdf_admin", password="pass12345", role="admin",
            is_staff=True, is_superuser=True,
        )
        self.client.force_authenticate(user=self.admin)
        Payer.objects.create(code="2001", name="شرکت آلفا")

    def test_one_browser_launch_serves_every_pdf_of_a_request(self):
        from unittest import mock

        from apps.billing.services import generation

        class FakeBrowser:
            launches = 0
            renders = 0
            found = True
            launch_error = None

            def __init__(self, *args, **kwargs):
                pass

            def start(self):
                FakeBrowser.launches += 1
                return self

            def render(self, html):
                FakeBrowser.renders += 1
                return b"%PDF-1.4 fake"

            def close(self):
                pass

        payload = {
            "payer_code": "2001",
            "payer_name": "شرکت آلفا",
            "service_type": "ویزا",
            "letter_number": "1404101",
            "letter_date": "1404/01/15",
            "start_day": 1,
            "end_day": 31,
            "month": "فروردین",
            "year": 1404,
            "period_range": "فروردین ۱۴۰۴ - ۱ تا ۳۱",
            "flight_data": [{"ردیف": 1, "قرارداد": "1", "نام مسافر": "A", "مسیر": "KER-MHD",
                             "شماره بلیط": "1", "تاریخ پرواز": "", "بدهکار": 1000,
                             "بستانکار": 0, "مانده": 1000}],
            "hotel_data": [{"ردیف": 1, "قرارداد": "2", "نام مسافر": "B", "هتل": "هتل نمونه",
                            "نوع اتاق": "دبل", "تاریخ ورود و خروج": "", "تعداد نفرات": 2,
                            "بدهکار": 2000, "بستانکار": 0, "مانده": 2000}],
            "service_data": [{"ردیف": 1, "قرارداد": "3", "نام مسافر": "C", "شرح خدمات": "ویزا",
                              "تاریخ": "", "توضیحات": "", "بدهکار": 3000,
                              "بستانکار": 0, "مانده": 3000}],
        }
        created = self.client.post("/api/v1/billing/approvals/", payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        with mock.patch.object(generation, "PdfBrowser", FakeBrowser):
            approved = self.client.post(
                f"/api/v1/billing/approvals/{created.data['id']}/approve/", {}, format="json"
            )

        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        self.assertEqual(FakeBrowser.launches, 1)
        self.assertEqual(FakeBrowser.renders, 3)

    def test_browser_failure_is_reported_instead_of_falling_back(self):
        from unittest import mock

        from apps.billing.services import generation

        with mock.patch.object(generation, "PdfBrowser", BrokenBrowser), mock.patch.object(
            generation, "_weasyprint_pdf"
        ) as weasyprint_fallback:
            with self.assertRaises(generation.GenerationError) as raised:
                generation.html_to_pdf("<p>نمونه</p>")

        self.assertIn("مرورگر", str(raised.exception))
        weasyprint_fallback.assert_not_called()

    def test_root_on_linux_disables_the_chromium_sandbox(self):
        from unittest import mock

        from apps.billing.services import generation

        browser = generation.PdfBrowser()
        browser.path = "/usr/bin/chromium"
        browser._profile = "/tmp/kkt-pdf-test"

        with mock.patch("sys.platform", "linux"), mock.patch.object(
            generation.os, "geteuid", return_value=0, create=True
        ):
            self.assertIn("--no-sandbox", browser._command())

        with mock.patch("sys.platform", "linux"), mock.patch.object(
            generation.os, "geteuid", return_value=1000, create=True
        ):
            self.assertNotIn("--no-sandbox", browser._command())

        with mock.patch("sys.platform", "win32"):
            self.assertNotIn("--no-sandbox", browser._command())

    def test_second_browser_waits_for_the_first_to_close(self):
        import threading
        import time as _time
        from unittest import mock

        from apps.billing.services import generation

        order: list[str] = []
        release = threading.Event()

        def run(label: str, gate):
            browser = generation.PdfBrowser(timeout=5)
            browser.path = "/usr/bin/chromium"
            browser.start()
            order.append(label)
            gate.wait(10)
            browser.close()

        first = threading.Thread(target=run, args=("first", release))
        second = threading.Thread(target=run, args=("second", threading.Event()))
        try:
            with mock.patch.object(
                generation.subprocess, "Popen", return_value=mock.Mock(pid=1)
            ), mock.patch.object(
                generation.PdfBrowser, "_wait_for_port", return_value=1234
            ), mock.patch.object(generation, "_shutdown_tree"):
                first.start()
                deadline = _time.monotonic() + 5
                while not order and _time.monotonic() < deadline:
                    _time.sleep(0.02)
                self.assertEqual(order, ["first"])
                second.start()
                _time.sleep(0.3)
                # The second start is still blocked while the first holds the slot.
                self.assertEqual(order, ["first"])
                self.assertTrue(generation._browser_lock.locked())
                release.set()
                first.join(10)
                second.join(10)
        finally:
            release.set()
            first.join(10)
            second.join(10)
            if generation._browser_lock.locked():
                generation._browser_lock.release()

        self.assertEqual(order, ["first", "second"])
        self.assertFalse(generation._browser_lock.locked())

    def test_start_gives_up_when_the_slot_stays_busy(self):
        from apps.billing.services import generation

        self.assertTrue(generation._browser_lock.acquire(timeout=0))
        try:
            browser = generation.PdfBrowser(timeout=0.2)
            browser.path = "/usr/bin/chromium"
            browser.start()
            self.assertIsNone(browser._process)
            self.assertIn("مرورگر", browser.launch_error or "")
        finally:
            generation._browser_lock.release()
        self.assertFalse(generation._browser_lock.locked())

    def test_lock_is_released_when_the_browser_cannot_start(self):
        from unittest import mock

        from apps.billing.services import generation

        with mock.patch.object(
            generation.subprocess, "Popen", side_effect=OSError("no chromium")
        ):
            browser = generation.PdfBrowser()
            browser.path = "/usr/bin/chromium"
            browser.start()

        self.assertIn("مرورگر", browser.launch_error or "")
        self.assertFalse(generation._browser_lock.locked())

    def test_approval_records_the_pdf_failure_in_persian(self):
        from unittest import mock

        from apps.billing.services import generation

        approval = ApprovalRequest.objects.create(
            requester=self.admin, requester_name="admin", payer_code="2001", payer_name="آلفا",
            service_type="ویزا", letter_number="1404102", letter_date="1404/01/15",
            start_day=1, end_day=31, month="فروردین", year=1404, period_range="x",
            flight_data=[{"بدهکار": 1000, "بستانکار": 0}],
        )
        with mock.patch.object(generation, "PdfBrowser", BrokenBrowser):
            response = self.client.post(
                f"/api/v1/billing/approvals/{approval.id}/approve/", {}, format="json"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        approval.refresh_from_db()
        self.assertIn("مرورگر", approval.generation_error)
        self.assertFalse(approval.files.filter(file_name__endswith=".pdf").exists())
        self.assertTrue(approval.files.filter(file_name__endswith=".docx").exists())


class BrowserShutdownTests(TestCase):
    """The browser is shut down as a tree, not just by terminating the parent."""

    def test_windows_shutdown_kills_the_whole_tree(self):
        from unittest import mock

        from apps.billing.services import generation

        process = mock.Mock()
        process.pid = 4321

        with mock.patch("sys.platform", "win32"), mock.patch.object(
            generation.subprocess, "run"
        ) as run:
            generation._shutdown_tree(process)

        self.assertEqual(
            run.call_args.args[0], ["taskkill", "/F", "/T", "/PID", "4321"]
        )
        process.wait.assert_called()

    def test_posix_shutdown_signals_the_process_group(self):
        from unittest import mock

        from apps.billing.services import generation

        process = mock.Mock()
        process.pid = 987

        # getpgid/killpg only exist on POSIX, so they are created for the patch.
        with mock.patch("sys.platform", "linux"), mock.patch.object(
            generation.os, "getpgid", return_value=555, create=True
        ), mock.patch.object(generation.os, "killpg", create=True) as killpg:
            generation._shutdown_tree(process)

        self.assertEqual([call.args[0] for call in killpg.call_args_list], [555, 555])
        self.assertEqual(killpg.call_args_list[0].args[1], generation.signal.SIGTERM)
        # SIGKILL is POSIX-only as well; 9 is its value everywhere it exists.
        self.assertEqual(killpg.call_args_list[1].args[1], getattr(generation.signal, "SIGKILL", 9))
        process.wait.assert_called()

    def test_close_shuts_the_tree_down_even_if_the_parent_already_exited(self):
        from unittest import mock

        from apps.billing.services import generation

        browser = generation.PdfBrowser()
        process = mock.Mock()
        browser._process = process
        with mock.patch.object(generation, "_shutdown_tree") as shutdown:
            browser.close()

        shutdown.assert_called_once_with(process)
        self.assertIsNone(browser._process)


class TemplatePreviewTests(TestCase):
    """POST /templates/active/preview/ renders the active template as a PDF."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="kkt_preview_admin", password="pass12345", role="admin",
            is_staff=True, is_superuser=True,
        )
        self.viewer = User.objects.create_user(
            username="kkt_preview_viewer", password="pass12345", role="sales",
        )
        self.client.force_authenticate(user=self.admin)
        Payer.objects.create(code="3001", name="شرکت بتا")

    def test_preview_renders_the_active_template_through_the_pdf_path(self):
        from unittest import mock

        from apps.billing import views

        InvoiceTemplate.objects.create(
            name="قالب سفارشی",
            html_content="<div class=\"custom-preview\">{{ payer }}</div>",
            css_content=".custom-preview { color: #123456; }",
            is_active=True,
        )
        captured = {}

        def fake_pdf(html, browser=None):
            captured["html"] = html
            return b"%PDF-1.4 preview"

        with mock.patch.object(views, "html_to_pdf", fake_pdf):
            response = self.client.post(
                "/api/v1/billing/templates/active/preview/", {}, format="json"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("inline", response["Content-Disposition"])
        self.assertEqual(response.content, b"%PDF-1.4 preview")
        # The rendered body comes from the active template, not DEFAULT_HTML.
        self.assertIn("custom-preview", captured["html"])
        self.assertIn("#123456", captured["html"])
        self.assertIn("شرکت بتا", captured["html"])

    def test_preview_reports_a_pdf_failure_as_503(self):
        from unittest import mock

        from apps.billing import views
        from apps.billing.services import generation

        def boom(html, browser=None):
            raise generation.GenerationError(generation.BROWSER_LAUNCH_ERROR)

        with mock.patch.object(views, "html_to_pdf", boom):
            response = self.client.post(
                "/api/v1/billing/templates/active/preview/", {}, format="json"
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("مرورگر", response.json()["error"])

    def test_preview_requires_the_template_permission(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.post(
            "/api/v1/billing/templates/active/preview/", {}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="kkt-word-test-"))
class WordTemplateTests(TestCase):
    """The uploaded official .docx template is rendered with the letter context."""

    def _make_template(self, path):
        from docx import Document

        document = Document()
        document.add_paragraph("{{ company_name }} — نامه {{ letter_number }}")
        document.save(str(path))

    def test_uploaded_template_is_used_and_rendered(self):
        import io as _io

        from django.conf import settings as dj
        from docx import Document

        target = Path(dj.MEDIA_ROOT) / "company_assets"
        target.mkdir(parents=True, exist_ok=True)
        self._make_template(target / "word_template.docx")

        company = CompanySettings.load()
        company.word_template_path = "company_assets/word_template.docx"
        company.company_name = "کرمان خودرو"
        company.save()

        data = render_docx({"company_name": "کرمان خودرو", "letter_number": "1404012"})
        document = Document(_io.BytesIO(data))
        text = "\n".join(p.text for p in document.paragraphs)
        self.assertIn("کرمان خودرو", text)
        self.assertIn("1404012", text)
        self.assertNotIn("{{", text)

    def test_falls_back_when_template_missing(self):
        company = CompanySettings.load()
        company.word_template_path = "company_assets/does-not-exist.docx"
        company.save()
        data = render_docx({"company_name": "x", "letter_number": "1"})
        self.assertTrue(data.startswith(b"PK"))  # valid docx zip


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="kkt-letters-"))
class OfficialLetterTests(TestCase):
    """The three official letters: debt, subsidiary debt, credit note."""

    def _text(self, data: bytes) -> str:
        from docx import Document

        document = Document(io.BytesIO(data))
        return "\n".join(p.text for p in document.paragraphs)

    def test_debt_letter_matches_official_text(self):
        text = self._text(
            render_docx(
                {
                    "variant": "debt",
                    "payer": "شرکت نمونه سفر",
                    "letter_number": "1404012",
                    "letter_date": "1404/01/15",
                    "period_range": "فروردین ۱۴۰۴ ۱ تا ۳۱",
                    "service_type": "پرواز",
                    "total_debt_display": "1,500,000",
                    "company_name": "سفرهای کرمان خودرو",
                    "bank_name1": "ملت",
                    "account_number1": "78466591",
                    "shaba_number1": "IR650120000000000078466591",
                    "manager_name": "حمیدرضا فدائی",
                    "manager_position": "مدیر امور اداری و مالی",
                }
            )
        )
        self.assertIn("شرکت محترم شرکت نمونه سفر", text)
        self.assertTrue("صورت حساب" in text or "صورت‌حساب" in text or "صورتحساب" in text)
        self.assertTrue("15/01/1404" in text or "1404/01/15" in text)
        self.assertIn("1,500,000", text)
        self.assertIn("بانک ملت شماره حساب: 78466591", text)
        self.assertIn("مدیر امور اداری و مالی", text)
        self.assertIn("سامانه مودیان", text)

    def test_subsidiary_letter_mentions_subsidiary(self):
        text = self._text(
            render_docx(
                {
                    "variant": "subsidiary",
                    "payer": "هلدینگ کرمان خودرو",
                    "subsidiary": "سفرهای کرمان خودرو",
                    "letter_number": "1404013",
                    "letter_date": "1404/01/16",
                    "period_range": "فروردین ۱۴۰۴",
                    "service_type": "هتل",
                    "total_debt_display": "2,000,000",
                }
            )
        )
        self.assertIn("شرکت محترم هلدینگ کرمان خودرو", text)
        self.assertIn("مربوط به سفرهای کرمان خودرو", text)
        self.assertIn("2,000,000", text)

    def test_credit_letter_uses_credit_amount(self):
        text = self._text(
            render_docx(
                {
                    "variant": "credit",
                    "payer": "شرکت نمونه سفر",
                    "letter_number": "1404014",
                    "letter_date": "1404/01/17",
                    "period_range": "فروردین ۱۴۰۴",
                    "service_type": "ویزا",
                    "total_credit_display": "750,000",
                    "company_name": "سفرهای کرمان خودرو",
                }
            )
        )
        self.assertIn("بستانکار", text)
        self.assertIn("750,000", text)
        self.assertIn("خریدهای آینده", text)
        self.assertNotIn("مشخصات حساب بانکی", text)

    def test_variant_detection_uses_parent_and_credit(self):
        from apps.billing.services.generation import _variant

        parent = Payer.objects.create(code="9000", name="هلدینگ")
        child = Payer.objects.create(code="9001", name="زیرمجموعه", parent=parent)
        request_obj = ApprovalRequest(
            payer_code=child.code, payer_name=child.name, service_type="پرواز",
            letter_number="1404015", letter_date="1404/01/01", start_day=1, end_day=31,
            month="فروردین", year=1404, period_range="فروردین ۱۴۰۴",
            flight_data=[{"بدهکار": 1000, "بستانکار": 0}],
        )
        self.assertEqual(_variant(request_obj), "subsidiary")

        plain = Payer.objects.create(code="9002", name="عادی")
        credit_request = ApprovalRequest(
            payer_code=plain.code, payer_name=plain.name, service_type="ویزا",
            letter_number="1404016", letter_date="1404/01/01", start_day=1, end_day=31,
            month="فروردین", year=1404, period_range="فروردین ۱۴۰۴",
            flight_data=[{"بدهکار": 0, "بستانکار": 5000}],
        )
        self.assertEqual(_variant(credit_request), "credit")


class RolePermissionTests(TestCase):
    """CEO and Admin always pass the feature matrix; other users are flag-driven."""

    def test_ceo_and_admin_bypass_flags(self):
        from apps.billing.permissions import has_perm

        ceo = get_user_model().objects.create_user(
            username="ceo-x", password="x", role="ceo", can_issue=False
        )
        staff = get_user_model().objects.create_user(
            username="fin-x", password="x", role="finance", can_issue=False
        )
        self.assertTrue(has_perm(ceo, "can_issue"))
        self.assertFalse(has_perm(staff, "can_issue"))
        staff.can_issue = True
        staff.save(update_fields=["can_issue"])
        self.assertTrue(has_perm(staff, "can_issue"))


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="kkt-retention-"))
class FileRetentionTests(TestCase):
    """Files are released after 24h and reproduced on the next download."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="ret_admin", password="pass12345", role="admin",
            is_staff=True, is_superuser=True,
        )
        self.payer = Payer.objects.create(code="7001", name="شرکت نگهداری")
        self.approval = ApprovalRequest.objects.create(
            requester=self.admin, requester_name="admin", payer_code="7001",
            payer_name="شرکت نگهداری", service_type="پرواز", letter_number="1404701",
            letter_date="1404/03/01", start_day=1, end_day=31, month="3", year=1404,
            period_range="از 1404/03/01 تا 1404/03/31", status=ApprovalRequest.STATUS_APPROVED,
            flight_data=[{
                "ردیف": 1, "قرارداد": "1", "نام مسافر": "مسافر", "مسیر": "KER-MHD",
                "شماره بلیط": "1", "تاریخ پرواز": "1404/03/01",
                "بدهکار": 1000, "بستانکار": 0, "مانده": 1000,
            }],
        )

    def test_purge_and_regenerate_on_download(self):
        from datetime import timedelta

        from django.utils import timezone

        from apps.billing.models import FinalFile as FinalFileModel
        from apps.billing.services.files import purge_expired_files, save_final_file
        from apps.billing.services.generation import regenerate_file, render_docx

        final_file = save_final_file(self.approval, "flight", "flight_1404701.docx", render_docx({
            "variant": "debt", "payer": "x", "letter_number": "1",
        }))
        FinalFileModel.objects.filter(pk=final_file.pk).update(
            created_at=timezone.now() - timedelta(hours=25)
        )
        self.assertEqual(purge_expired_files(), 1)

        final_file.refresh_from_db()
        self.assertIsNone(final_file.file_data)
        self.assertEqual(final_file.file_path, "")
        self.assertIsNotNone(final_file.purged_at)

        regenerated = regenerate_file(final_file)
        self.assertTrue(regenerated.startswith(b"PK"))

        client = APIClient()
        client.force_authenticate(user=self.admin)
        response = client.get(f"/api/v1/billing/files/{final_file.pk}/download/")
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.content), 500)

        final_file.refresh_from_db()
        self.assertIsNotNone(final_file.file_data)

    def test_beat_task_purges_expired_files_and_logs_the_count(self):
        from datetime import timedelta

        from django.utils import timezone

        from apps.billing.models import FinalFile as FinalFileModel
        from apps.billing.services.files import save_final_file
        from apps.billing.tasks import purge_expired_files_task

        final_file = save_final_file(
            self.approval, "flight", "flight_beat.docx", b"PK-beat", letter_number="1404701"
        )
        FinalFileModel.objects.filter(pk=final_file.pk).update(
            created_at=timezone.now() - timedelta(hours=25)
        )

        with self.assertLogs("apps.billing.tasks", level="INFO") as logs:
            result = purge_expired_files_task()

        self.assertEqual(result, {"purged": 1, "older_than_hours": 24})
        self.assertIn("Purged 1 expired billing file(s)", logs.output[0])

        final_file.refresh_from_db()
        self.assertIsNone(final_file.file_data)
        self.assertIsNotNone(final_file.purged_at)


class AgingReportTests(TestCase):
    """Receivables aging: FIFO over open invoices, then age buckets."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="aging_admin", password="pass12345", role="admin",
            is_staff=True, is_superuser=True,
        )
        Payer.objects.create(code="8001", name="شرکت سنّی")
        Payer.objects.create(code="8002", name="شرکت بی‌صورتحساب")
        self.today = timezone.localdate()
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _invoice(self, days_ago: int, amount: int, code: str = "8001") -> Invoice:
        return Invoice.objects.create(
            letter_number=f"1404/8001/{days_ago:05d}",
            payer="شرکت سنّی",
            payer_code=code,
            invoice_type="پرواز",
            amount=amount,
            issue_date=self.today - dt.timedelta(days=days_ago),
        )

    def test_payments_are_applied_fifo_before_bucketing(self):
        from apps.billing.services.aging import aging_report

        self._invoice(100, 1_000_000)
        self._invoice(75, 2_000_000)
        self._invoice(45, 3_000_000)
        self._invoice(10, 4_000_000)
        Invoice.objects.create(
            letter_number="1404/8001/reversed",
            payer="شرکت سنّی",
            payer_code="8001",
            invoice_type="پرواز",
            amount=9_000_000,
            issue_date=self.today - dt.timedelta(days=200),
            reversed_at=timezone.now(),
        )
        Payment.objects.create(
            payer_code="8001", payer_name="شرکت سنّی",
            payment_date=self.today, amount=1_500_000,
        )
        Credit.objects.create(
            payer_code="8001", credit_date=self.today, amount=500_000
        )

        report = aging_report(as_of=self.today)

        self.assertEqual(report["as_of"], self.today.isoformat())
        # Only the payer with an outstanding invoice is listed.
        self.assertEqual([row["payer_code"] for row in report["rows"]], ["8001"])
        row = report["rows"][0]
        self.assertEqual(row["payer_name"], "شرکت سنّی")
        self.assertEqual(row["d0_30"], 4_000_000)
        self.assertEqual(row["d31_60"], 3_000_000)
        # 2M settled FIFO: the 100-day invoice is cleared, 1M is left on the 75-day one.
        self.assertEqual(row["d61_90"], 1_000_000)
        self.assertEqual(row["d90_plus"], 0)
        self.assertEqual(row["total_open"], 8_000_000)
        self.assertEqual(report["totals"]["total_open"], 8_000_000)
        self.assertEqual(report["totals"]["d90_plus"], 0)

    def test_bucket_boundaries_and_a_fully_paid_payer(self):
        from apps.billing.services.aging import aging_report, bucket_key

        self.assertEqual(bucket_key(0), "d0_30")
        self.assertEqual(bucket_key(30), "d0_30")
        self.assertEqual(bucket_key(31), "d31_60")
        self.assertEqual(bucket_key(60), "d31_60")
        self.assertEqual(bucket_key(61), "d61_90")
        self.assertEqual(bucket_key(90), "d61_90")
        self.assertEqual(bucket_key(91), "d90_plus")

        Invoice.objects.create(
            letter_number="1404/8002/00001",
            payer="شرکت بی‌صورتحساب",
            payer_code="8002",
            invoice_type="پرواز",
            amount=2_000_000,
            issue_date=dt.date(2026, 1, 1),
        )
        Payment.objects.create(
            payer_code="8002", payer_name="شرکت بی‌صورتحساب",
            payment_date=dt.date(2026, 1, 5), amount=2_000_000,
        )

        report = aging_report(as_of=dt.date(2026, 2, 15))
        self.assertEqual(report["rows"], [])
        self.assertEqual(report["totals"]["total_open"], 0)

    def test_endpoint_returns_the_buckets_and_requires_can_view(self):
        self._invoice(120, 7_500_000)

        response = self.client.get("/api/v1/billing/aging/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["rows"][0]["d90_plus"], 7_500_000)
        self.assertEqual(response.data["totals"]["total_open"], 7_500_000)

        viewer = User.objects.create_user(
            username="aging_viewer", password="pass12345", role="sales", can_view=False
        )
        denied = APIClient()
        denied.force_authenticate(user=viewer)
        self.assertEqual(denied.get("/api/v1/billing/aging/").status_code, 403)
        self.assertEqual(APIClient().get("/api/v1/billing/aging/").status_code, 403)


class DockerImageTests(TestCase):
    """Docker deployment: invoice PDFs need a browser and Pango in the image."""

    def test_dockerfile_installs_the_pdf_dependencies(self):
        dockerfile = (Path(__file__).resolve().parents[3] / "Dockerfile").read_text(
            encoding="utf-8"
        )
        # Chromium drives the invoice path; without it every letter falls back
        # to WeasyPrint, which in turn needs the Pango runtime.
        self.assertIn("chromium", dockerfile)
        self.assertIn("libpango-1.0-0", dockerfile)
        self.assertIn("libpangoft2-1.0-0", dockerfile)
        self.assertIn("fonts-vazirmatn", dockerfile)
        # The compiler toolchain is only needed to build wheels, so it must not
        # leak into the shipped runtime stage.
        self.assertIn("AS builder", dockerfile)
        runtime = dockerfile.rsplit("FROM python:3.11-slim", 1)[1]
        self.assertNotIn("gcc", runtime)
        self.assertNotIn("libpq-dev", runtime)
        self.assertIn("chromium", runtime)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="kkt-backup-"))
class BackupRestoreTests(TestCase):
    """Backup carries every table; restore repairs the letter numbering."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="backup_admin", password="pass12345", role="admin",
            is_staff=True, is_superuser=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.payer = Payer.objects.create(code="7001", name="شرکت پشتیبان")
        self.approval = ApprovalRequest.objects.create(
            requester=self.admin, requester_name="backup_admin", payer_code="7001",
            payer_name="شرکت پشتیبان", service_type="پرواز", letter_number="1404/7001/00012",
            letter_date="1404/03/01", start_day=1, end_day=31, month="3", year=1404,
            period_range="از 1404/03/01 تا 1404/03/31",
            status=ApprovalRequest.STATUS_APPROVED,
            flight_data=[{"ردیف": 1, "نام مسافر": "مسافر", "بدهکار": 1000}],
        )
        self.invoice = Invoice.objects.create(
            letter_number="1404/7001/00012", payer="شرکت پشتیبان", payer_code="7001",
            invoice_type="پرواز", amount=2_500_000, issue_date=dt.date(2025, 6, 1),
        )

    def _snapshot(self) -> dict:
        import json

        # The endpoint is a POST so a GET never leaks a full ledger dump.
        response = self.client.post("/api/v1/billing/admin/backup/")
        self.assertEqual(response.status_code, 200)
        return json.loads(response.content)

    def _restore(self, payload: dict, confirm: str = "true"):
        import json

        from django.core.files.uploadedfile import SimpleUploadedFile

        return self.client.post(
            "/api/v1/billing/admin/restore/",
            {
                "confirm": confirm,
                "file": SimpleUploadedFile(
                    "kkt-backup.json",
                    json.dumps(payload).encode("utf-8"),
                    content_type="application/json",
                ),
            },
            format="multipart",
        )

    def test_snapshot_contains_requests_files_and_numbering(self):
        from apps.billing.services.files import save_final_file

        save_final_file(
            self.approval, "flight", "flight_1404.docx", b"PK-backup",
            letter_number="1404/7001/00012",
        )
        LetterSequence.objects.create(payer_code="7001", year="04", last_number=12)
        AvailableLetterNumber.objects.create(payer_code="7001", year="04", number=12)

        payload = self._snapshot()

        for table in (
            "approval_requests", "final_files", "letter_sequences", "available_letter_numbers"
        ):
            self.assertIn(table, payload["tables"])
        self.assertEqual(len(payload["tables"]["approval_requests"]), 1)
        self.assertEqual(len(payload["tables"]["letter_sequences"]), 1)
        file_row = payload["tables"]["final_files"][0]
        self.assertNotIn("file_data", file_row)
        import base64

        self.assertEqual(base64.b64decode(file_row["file_data_b64"]), b"PK-backup")

    def test_restore_keeps_payments_whose_creator_is_missing_here(self):
        # A snapshot from another installation points at user ids that do not
        # exist in this one; the payment must still come back, just unsigned.
        payload = self._snapshot()
        base = {
            "payment_code": "", "payer_code": "7001", "payer_name": "شرکت پشتیبان",
            "payment_date": "2025-07-01", "description": "",
            "created_at": "2025-07-01T10:00:00Z", "idempotency_key": None,
        }
        payload["tables"]["payments"] = [
            {**base, "id": 4242, "amount": 900_000, "tracking_number": "TRK-OLD",
             "created_by_id": 987_654},
            {**base, "id": 4243, "amount": 100_000, "tracking_number": "TRK-NEW",
             "created_by_id": self.admin.pk},
        ]

        response = self._restore(payload)

        self.assertEqual(response.status_code, 200, response.content)
        # The unknown creator is dropped instead of failing the whole restore.
        old_payment = Payment.objects.get(tracking_number="TRK-OLD")
        self.assertEqual(old_payment.amount, 900_000)
        self.assertIsNone(old_payment.created_by_id)
        # A creator that does exist in this installation keeps the attribution.
        new_payment = Payment.objects.get(tracking_number="TRK-NEW")
        self.assertEqual(new_payment.created_by_id, self.admin.pk)

    def test_restore_rolls_back_and_reports_a_conflicting_snapshot(self):
        payload = self._snapshot()
        row = {
            "id": 5151, "payment_code": "", "payer_code": "7001",
            "payer_name": "شرکت پشتیبان", "payment_date": "2025-07-01",
            "amount": 1_000, "tracking_number": "TRK-DUP", "description": "",
            "created_at": "2025-07-01T10:00:00Z", "created_by_id": None,
            "idempotency_key": None,
        }
        payload["tables"]["payments"] = [row, dict(row)]
        live = Payment.objects.create(
            payer_code="7001", payer_name="شرکت پشتیبان",
            payment_date=dt.date(2025, 8, 1), amount=555_000, tracking_number="TRK-LIVE",
        )

        response = self._restore(payload)

        self.assertEqual(response.status_code, 400, response.content)
        # The transaction rolled back, so the ledger still holds what it had.
        self.assertEqual(list(Payment.objects.values_list("tracking_number", flat=True)), ["TRK-LIVE"])
        self.assertEqual(Payment.objects.get().pk, live.pk)

    def test_restore_repairs_a_stale_sequence_so_numbers_are_not_reissued(self):
        from apps.billing.services.files import save_final_file
        from apps.billing.services.numbers import peek, reserve_numbers

        save_final_file(
            self.approval, "flight", "flight_1404.docx", b"PK-backup",
            letter_number="1404/7001/00012",
        )
        # A subsidiary whose code sorts before its parent: the restore must
        # still be able to create both in one pass.
        Payer.objects.create(code="7000", name="زیرمجموعه", parent=self.payer)
        LetterSequence.objects.filter(payer_code="7001", year="04").delete()
        LetterSequence.objects.create(payer_code="7001", year="04", last_number=3)
        AvailableLetterNumber.objects.create(payer_code="7001", year="04", number=12)
        AvailableLetterNumber.objects.create(payer_code="7001", year="04", number=13)

        payload = self._snapshot()
        # Lose everything after the snapshot was taken.
        Invoice.objects.all().delete()
        FinalFile.objects.all().delete()
        ApprovalRequest.objects.all().delete()
        LetterSequence.objects.all().delete()
        AvailableLetterNumber.objects.all().delete()

        response = self._restore(payload)

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(Invoice.objects.count(), 1)
        self.assertEqual(ApprovalRequest.objects.count(), 1)
        self.assertEqual(bytes(FinalFile.objects.get().file_data), b"PK-backup")
        self.assertEqual(Payer.objects.get(code="7000").parent_id, "7001")
        # The printed number 12 is owned by the invoice again and never reissued.
        self.assertEqual(peek("7001", "04"), 13)
        self.assertEqual(reserve_numbers("7001", "04", 1), [13])
        self.assertFalse(
            AvailableLetterNumber.objects.filter(payer_code="7001", year="04", number=12).exists()
        )

    def test_restore_requires_an_explicit_confirmation(self):
        payload = self._snapshot()
        self.assertEqual(self._restore(payload, confirm="no").status_code, 400)
        self.assertEqual(Invoice.objects.count(), 1)


class ApprovalNotificationTests(TestCase):
    """Approve/reject must reach the requester's bell, not just the DB."""

    def setUp(self):
        self.approver = User.objects.create_user(
            username="notif_approver", password="pass12345", role="admin",
            is_staff=True, is_superuser=True,
        )
        self.requester = User.objects.create_user(
            username="notif_requester", password="pass12345", role="sales",
            can_submit=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.approver)
        self.approval = ApprovalRequest.objects.create(
            requester=self.requester, requester_name="notif_requester", payer_code="9001",
            payer_name="شرکت اعلان", service_type="پرواز", letter_number="",
            letter_date="1404/04/01", start_day=1, end_day=31, month="4", year=1404,
            period_range="از 1404/04/01 تا 1404/04/31",
            flight_data=[{"ردیف": 1, "نام مسافر": "مسافر", "بدهکار": 500_000}],
        )

    def _bell(self, user):
        from apps.dashboards.models import Notification

        return Notification.objects.filter(recipient=user)

    def test_approval_notifies_the_requester_with_the_letter_number(self):
        from unittest import mock

        from apps.billing import views

        with mock.patch.object(views, "_enqueue_generation", lambda _id: "inline"):
            response = self.client.post(
                f"/api/v1/billing/approvals/{self.approval.pk}/approve/", {}, format="json"
            )
        self.assertEqual(response.status_code, 200)

        self.approval.refresh_from_db()
        note = self._bell(self.requester).get()
        self.assertIn("تأیید شد", note.title)
        self.assertIn(self.approval.letter_number, note.message)
        self.assertEqual(note.target_type, "billing_request")
        self.assertEqual(note.target_id, str(self.approval.pk))
        self.assertFalse(note.is_read)
        # The bell is per-user: the approver does not get their own action.
        self.assertFalse(self._bell(self.approver).exists())

        requester_client = APIClient()
        requester_client.force_authenticate(user=self.requester)
        bell = requester_client.get("/api/v1/dashboards/notifications/").data
        self.assertEqual(bell["unread_count"], 1)
        self.assertEqual(bell["notifications"][0]["title"], note.title)

    def test_rejection_notifies_the_requester_with_the_reason(self):
        response = self.client.post(
            f"/api/v1/billing/approvals/{self.approval.pk}/reject/",
            {"reason": "مدارک ناقص است"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        note = self._bell(self.requester).get()
        self.assertIn("رد شد", note.title)
        self.assertIn("مدارک ناقص است", note.message)
        self.assertEqual(note.target_id, str(self.approval.pk))


class PaymentIdempotencyTests(TestCase):
    """A retried payment POST must return the first row, never book it twice."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="idem_admin", password="pass12345", role="admin",
            is_staff=True, is_superuser=True,
        )
        Payer.objects.create(code="2001", name="شرکت ایدمپوتنت")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_same_idempotency_key_returns_the_original_payment(self):
        payload = {
            "payer_code": "2001",
            "payment_date": "1404/05/01",
            "amount": 1_200_000,
            "tracking_number": "TRK-9",
        }

        first = self.client.post(
            "/api/v1/billing/payments/", payload, format="json",
            HTTP_IDEMPOTENCY_KEY="retry-1",
        )
        second = self.client.post(
            "/api/v1/billing/payments/", payload, format="json",
            HTTP_IDEMPOTENCY_KEY="retry-1",
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["id"], first.data["id"])
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(Payment.objects.get().created_by, self.admin)
        # The derived balance saw the transfer exactly once.
        self.assertEqual(payer_balance("2001")["payments"], 1_200_000)

    def test_replay_with_a_different_payload_is_rejected(self):
        stored = Payment.objects.create(
            payer_code="2001", payer_name="شرکت ایدمپوتنت",
            payment_date=dt.date(2025, 7, 1), amount=750_000,
            created_by=self.admin, idempotency_key="race-1",
        )

        # Same key, corrected amount/date: it must not look saved while the
        # stored row still holds the old figures.
        response = self.client.post(
            "/api/v1/billing/payments/",
            {"payer_code": "2001", "payment_date": "1404/05/02", "amount": 800_000},
            format="json",
            HTTP_IDEMPOTENCY_KEY="race-1",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.content)
        self.assertIn("کلید یکتایی", response.data["error"])
        stored.refresh_from_db()
        self.assertEqual(stored.amount, 750_000)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(payer_balance("2001")["payments"], 750_000)

    def test_replay_of_the_same_payload_after_a_race_still_returns_it(self):
        from apps.billing.services.normalize import persian_date_to_gregorian

        stored = Payment.objects.create(
            payer_code="2001", payer_name="شرکت ایدمپوتنت",
            payment_date=persian_date_to_gregorian("1404/04/11"), amount=750_000,
            created_by=self.admin, idempotency_key="race-2",
        )

        response = self.client.post(
            "/api/v1/billing/payments/",
            {"payer_code": "2001", "payment_date": "1404/04/11", "amount": 750_000},
            format="json",
            HTTP_IDEMPOTENCY_KEY="race-2",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertEqual(response.data["id"], stored.pk)
        self.assertEqual(Payment.objects.count(), 1)

    def test_body_key_is_honoured_too(self):
        payload = {
            "payer_code": "2001",
            "payment_date": "1404/05/03",
            "amount": 400_000,
            "idempotency_key": "body-key-1",
        }
        first = self.client.post("/api/v1/billing/payments/", payload, format="json")
        second = self.client.post("/api/v1/billing/payments/", payload, format="json")

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(payer_balance("2001")["payments"], 400_000)


class PaymentDeletionAuditTests(TestCase):
    """A delete through the API must be attributed to the signed-in actor."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="audit_admin", password="pass12345", role="admin",
            is_staff=True, is_superuser=True,
        )
        Payer.objects.create(code="2001", name="شرکت حسابرسی")
        self.payment = Payment.objects.create(
            payer_code="2001", payer_name="شرکت حسابرسی",
            payment_date=dt.date(2025, 7, 1), amount=850_000,
            tracking_number="TRK-AUD", created_by=self.admin,
        )
        from apps.accounts.authentication import JWTAuthentication
        self.client = APIClient()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {JWTAuthentication.generate_token(self.admin)}"
        )

    def test_payment_delete_is_attributed_to_the_actor(self):
        from django.contrib.contenttypes.models import ContentType
        from apps.audit_log.models import AuditLog

        pk = self.payment.pk
        response = self.client.delete(
            f"/api/v1/billing/payments/{pk}/", {"reason": "ثبت اشتباه"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        ct = ContentType.objects.get_for_model(Payment)
        entry = AuditLog.objects.get(action="delete", content_type=ct, object_id=str(pk))
        # The middleware stores its context before DRF verifies the JWT; the
        # authentication class must hand the actor to the signal afterwards.
        self.assertEqual(entry.user, self.admin)
        self.assertEqual(entry.ip_address, "127.0.0.1")
        self.assertEqual(entry.old_values["amount"], 850_000)
        self.assertEqual(entry.old_values["tracking_number"], "TRK-AUD")
        self.assertEqual(BillingAuditEntry.objects.get(entity="payment").actor, self.admin)


class ApprovalSubmissionNotificationTests(TestCase):
    """A new request must land in the bell of everyone who can approve it."""

    def setUp(self):
        self.submitter = User.objects.create_user(
            username="submit_notify", password="pass12345", role="sales", can_submit=True,
        )
        self.flagged_approver = User.objects.create_user(
            username="flagged_approver", password="pass12345", role="finance",
            can_approve=True,
        )
        self.ceo = User.objects.create_user(
            username="ceo_notify", password="pass12345", role="ceo",
        )
        self.bystander = User.objects.create_user(
            username="finance_bystander", password="pass12345", role="finance",
        )
        Payer.objects.create(code="9101", name="شرکت اعلان تأیید")
        self.client = APIClient()
        self.client.force_authenticate(user=self.submitter)

    def _submit(self):
        payload = {
            "payer_code": "9101",
            "payer_name": "شرکت اعلان تأیید",
            "service_type": "پرواز",
            "letter_number": "1404/9101/00001",
            "letter_date": "1404/04/01",
            "start_day": 1,
            "end_day": 31,
            "month": "4",
            "year": 1404,
            "period_range": "از 1404/04/01 تا 1404/04/31",
            "flight_data": [{"ردیف": 1, "نام مسافر": "مسافر", "بدهکار": 500_000}],
        }
        response = self.client.post("/api/v1/billing/approvals/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        return ApprovalRequest.objects.get(pk=response.data["id"])

    def test_every_approver_is_notified_once(self):
        from apps.dashboards.models import Notification

        approval = self._submit()

        for approver in (self.flagged_approver, self.ceo):
            notes = Notification.objects.filter(recipient=approver)
            self.assertEqual(notes.count(), 1, approver.username)
            note = notes.get()
            self.assertIn("در انتظار تأیید", note.message)
            self.assertEqual(note.target_type, "billing_request")
            self.assertEqual(note.target_id, str(approval.pk))
            self.assertFalse(note.is_read)

        # The submitter knows they submitted, and a user without the flag is
        # not an approver.
        self.assertFalse(Notification.objects.filter(recipient=self.submitter).exists())
        self.assertFalse(Notification.objects.filter(recipient=self.bystander).exists())

    def test_inactive_approver_is_skipped(self):
        from apps.dashboards.models import Notification

        self.flagged_approver.is_active = False
        self.flagged_approver.save(update_fields=["is_active"])

        self._submit()

        self.assertFalse(Notification.objects.filter(recipient=self.flagged_approver).exists())
        self.assertEqual(Notification.objects.filter(recipient=self.ceo).count(), 1)
