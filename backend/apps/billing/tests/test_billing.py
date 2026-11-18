"""Tests for the billing domain (spec §12 acceptance scenarios)."""

from __future__ import annotations

import datetime as dt
import io
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.billing.models import (
    ApprovalRequest,
    CompanySettings,
    Invoice,
    InvoiceTemplate,
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
        self.assertIn('<col class="c-passenger">', html)


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
        self.rows = [
            {
                "ردیف": index, "قرارداد": str(1000 + index),
                "نام مسافر": self.LONG_NAME if index == 2 else f"مسافر شماره {index}",
                "مسیر": "KER-MHD", "شماره بلیط": str(90000 + index),
                "تاریخ پرواز": "1404/03/12",
                "بدهکار": 1_000_000 * index, "بستانکار": 0, "مانده": 1_000_000 * index,
            }
            for index in range(1, self.ROW_COUNT + 1)
        ]

    def _pages(self) -> list[str]:
        import pymupdf

        from apps.billing.services.generation import render_invoice_pdf

        data = render_invoice_pdf(self.request, "flight", self.rows, self.request.letter_number)
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
        self.assertIn("صورت‌حساب", text)
        self.assertIn("1404/01/15", text)
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
