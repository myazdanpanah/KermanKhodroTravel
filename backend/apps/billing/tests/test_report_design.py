"""گزارش‌ساز (invoice PDF design) and Excel statement exports."""

from __future__ import annotations

import datetime as dt
import io

from django.contrib.auth import get_user_model
from django.test import TestCase
from openpyxl import load_workbook
from rest_framework import status
from rest_framework.test import APIClient

from apps.billing.models import Invoice, Payer, Payment, ReportDesign
from apps.billing.services import generation
from apps.billing.services.report_design import default_design, normalize_design

User = get_user_model()


class ReportDesignApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="design_admin", password="pass12345", role="admin", is_staff=True, is_superuser=True
        )
        self.viewer = User.objects.create_user(username="design_viewer", password="pass12345", role="sales")
        self.client.force_authenticate(user=self.admin)

    def test_default_design_is_returned_and_valid(self):
        response = self.client.get("/api/v1/billing/report-design/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["design"]["design_version"], 2)
        table = next(el for el in response.data["design"]["elements"] if el["type"] == "table")
        self.assertEqual(table["rows_per_page"], 8)
        self.assertEqual(len(table["columns"]), 9)
        self.assertIn("rows", response.data["sample"])
        self.assertIn("values", response.data["sample"])

    def test_admin_can_save_and_reset_design(self):
        payload = {
            "name": "طراحی اداری",
            "design": {
                "title_template": "صورت حساب {buyer_name}",
                "rows_per_page": 5,
                "accent_color": "#123456",
                "columns": [
                    {"key": "rank", "label": "ردیف", "visible": True},
                    {"key": "passenger", "label": "مسافر", "visible": True},
                    {"key": "notes", "label": "توضیح", "visible": False},
                ],
            },
        }
        response = self.client.put("/api/v1/billing/report-design/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        saved = ReportDesign.load().design_json
        table = next(el for el in saved["elements"] if el["type"] == "table")
        title = next(el for el in saved["elements"] if el["type"] == "text" and el["id"] == "title")
        self.assertEqual(table["rows_per_page"], 5)
        self.assertEqual(title["text"], "صورت حساب {buyer_name}")
        self.assertEqual(saved["accent_color"], "#123456")
        self.assertFalse(next(el for el in table["columns"] if el["key"] == "notes")["visible"])

        reset = self.client.post("/api/v1/billing/report-design/reset/")
        self.assertEqual(reset.status_code, status.HTTP_200_OK)
        reset_table = next(el for el in ReportDesign.load().design_json["elements"] if el["type"] == "table")
        self.assertEqual(reset_table["rows_per_page"], 8)

    def test_non_admin_cannot_change_design(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.put(
            "/api/v1/billing/report-design/", {"design": {"rows_per_page": 3}}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_values_fall_back_safely(self):
        design = normalize_design(
            {
                "accent_color": "url(javascript:alert(1))",
                "font_family": "<script>",
                "elements": [
                    {"id": "table", "type": "table", "rows_per_page": 999, "columns": "not-a-list"},
                    {"id": "bad", "type": "iframe", "x": 10, "y": 10},
                ],
            }
        )
        table = next(el for el in design["elements"] if el["type"] == "table")
        self.assertEqual(table["rows_per_page"], 20)
        self.assertFalse(any(el["type"] == "iframe" for el in design["elements"]))
        self.assertEqual(design["accent_color"], default_design()["accent_color"])
        self.assertEqual(design["font_family"], default_design()["font_family"])
        self.assertEqual(len(table["columns"]), 9)

    def test_qr_and_barcode_elements_render_images(self):
        design = normalize_design(
            {
                "elements": [
                    {"id": "table", "type": "table", "x": 10, "y": 40, "w": 200, "h": 100, "rows_per_page": 2},
                    {"id": "q", "type": "qr", "x": 220, "y": 10, "w": 30, "h": 30, "data": "{number}"},
                    {"id": "b", "type": "barcode", "x": 220, "y": 45, "w": 50, "h": 15, "data": "{number}"},
                    {"id": "l", "type": "line", "x": 10, "y": 38, "w": 200, "h": 1, "thickness": 0.5},
                ]
            }
        )
        ReportDesign.objects.create(pk=1, design_json=design)

        class FakeRequest:
            payer_name = "شرکت نمونه"
            letter_date = "1404/03/01"
            service_category = ""

        context = generation.build_invoice_context(
            FakeRequest(), "flight", [{"قرارداد": "1", "نام مسافر": "الف", "بدهکار": 100}], "1404/9999/1"
        )
        page = context["pages"][0]
        qr = next(el for el in page["elements"] if el["id"] == "q")
        barcode_el = next(el for el in page["elements"] if el["id"] == "b")
        self.assertTrue(qr["src"].startswith("data:image/png;base64,"))
        self.assertTrue(barcode_el["src"].startswith("data:image/svg+xml;base64,"))


class InvoiceDesignRenderTests(TestCase):
    def test_saved_design_drives_title_columns_and_rows_per_page(self):
        ReportDesign.objects.create(
            pk=1,
            design_json=normalize_design(
                {
                    "title_template": "صورت حساب ویژه {buyer_name}",
                    "rows_per_page": 1,
                    "columns": [
                        {"key": "rank", "label": "ردیف", "visible": True},
                        {"key": "contract", "label": "شماره قرارداد", "visible": False},
                        {"key": "passenger", "label": "مسافر", "visible": True},
                        {"key": "description", "label": "شرح", "visible": False},
                        {"key": "date", "label": "تاریخ", "visible": False},
                        {"key": "notes", "label": "توضیح", "visible": False},
                        {"key": "debit", "label": "مبلغ", "visible": True},
                        {"key": "credit", "label": "بستانکار", "visible": False},
                        {"key": "balance", "label": "مانده", "visible": False},
                    ],
                }
            ),
        )

        class FakeRequest:
            payer_name = "شرکت نمونه"
            letter_date = "1404/03/01"
            service_category = ""

        rows = [
            {"قرارداد": "1", "نام مسافر": "الف", "مسیر": "A-B", "بدهکار": 100, "بستانکار": 0},
            {"قرارداد": "2", "نام مسافر": "ب", "مسیر": "B-A", "بدهکار": 200, "بستانکار": 0},
        ]
        context = generation.build_invoice_context(FakeRequest(), "flight", rows, "1404/9999/1")
        self.assertEqual(context["title"], "صورت حساب ویژه شرکت نمونه")
        self.assertEqual([column["label"] for column in context["columns"]], ["ردیف", "مسافر", "مبلغ"])
        self.assertEqual(len(context["pages"]), 2)  # rows_per_page = 1

        html = generation.Environment(
            autoescape=generation.select_autoescape(["html", "xml"])
        ).from_string(generation.INVOICE_HTML).render(**context)
        self.assertIn("صورت حساب ویژه شرکت نمونه", html)
        self.assertIn("مبلغ", html)
        self.assertNotIn("شماره قرارداد", html)


class AdvancedLayoutRenderTests(TestCase):
    def test_layout_repeater_labels_and_subreport_render_in_pdf_html(self):
        ReportDesign.objects.create(
            pk=1,
            design_json=normalize_design(
                {
                    "rows_per_page": 3,
                    "elements": [
                        {"id": "table", "type": "table", "x": 10, "y": 40, "w": 200, "h": 60, "rows_per_page": 3},
                        {"id": "frame", "type": "frame", "variant": "grid", "title": "چیدمان", "x": 10, "y": 10, "w": 100, "h": 25},
                        {"id": "rep", "type": "repeater", "template": "{passenger} — {debit} ریال", "max_rows": 2, "x": 10, "y": 105, "w": 100, "h": 15},
                        {"id": "labels", "type": "labels", "template": "{passenger}", "cols": 2, "rows": 2, "x": 120, "y": 105, "w": 80, "h": 20},
                        {"id": "sub", "type": "subreport", "source": "invoices", "title": "جمع", "x": 10, "y": 125, "w": 100, "h": 20},
                    ],
                }
            ),
        )

        class FakeRequest:
            payer_name = "شرکت نمونه"
            payer_code = "3001"
            letter_date = "1404/03/01"
            service_category = ""

        rows = [
            {"قرارداد": "1", "نام مسافر": "الف", "مسیر": "A-B", "بدهکار": 100, "بستانکار": 0},
            {"قرارداد": "2", "نام مسافر": "ب", "مسیر": "B-A", "بدهکار": 200, "بستانکار": 0},
        ]
        context = generation.build_invoice_context(FakeRequest(), "flight", rows, "1404/9999/1")
        page = context["pages"][0]
        repeater = next(el for el in page["elements"] if el["id"] == "rep")
        labels = next(el for el in page["elements"] if el["id"] == "labels")
        subreport = next(el for el in page["elements"] if el["id"] == "sub")
        self.assertEqual(len(repeater["lines"]), 2)
        self.assertEqual(len(labels["cells"]), 2)
        self.assertTrue(subreport["lines"])

        html = generation.Environment(
            autoescape=generation.select_autoescape(["html", "xml"])
        ).from_string(generation.INVOICE_HTML).render(**context)
        self.assertIn("frame-grid", html)
        self.assertIn("چیدمان", html)
        self.assertIn("repeater-line", html)
        self.assertIn("label-cell", html)
        self.assertIn("subreport-title", html)
        self.assertIn("الف", html)


class StatementExcelTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="stmt_admin", password="pass12345", role="admin", is_staff=True, is_superuser=True
        )
        self.client.force_authenticate(user=self.admin)
        self.payer = Payer.objects.create(code="3001", name="شرکت آلفا")
        Invoice.objects.create(
            letter_number="1404/3001/00001",
            payer="شرکت آلفا",
            payer_code="3001",
            invoice_type="پرواز",
            amount=1_000_000,
            issue_date=dt.date(2025, 5, 1),
        )
        Payment.objects.create(
            payer_code="3001",
            payer_name="شرکت آلفا",
            payment_date=dt.date(2025, 5, 2),
            amount=400_000,
        )

    def test_workbook_has_summary_and_per_company_sheets_with_totals(self):
        response = self.client.get("/api/v1/billing/statements/excel/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml", response["Content-Type"])

        workbook = load_workbook(io.BytesIO(response.content))
        self.assertIn("خلاصه شرکت‌ها", workbook.sheetnames)
        summary = workbook["خلاصه شرکت‌ها"]
        self.assertEqual(summary["A2"].value, "3001")
        self.assertEqual(summary["C2"].value, 1_000_000)  # صورتحساب
        self.assertEqual(summary["F2"].value, 400_000)  # پرداخت
        self.assertEqual(summary["H2"].value, 600_000)  # مانده
        detail = workbook[workbook.sheetnames[1]]
        self.assertEqual(detail.cell(row=2, column=1).value, "جمع بدهی (صورتحساب + بدهی دستی)")
        self.assertEqual(detail.cell(row=3, column=1).value, "جمع پرداخت‌ها")
        header_row = next(row for row in range(1, detail.max_row + 1) if detail.cell(row=row, column=1).value == "تاریخ")
        types = [detail.cell(row=row, column=2).value for row in range(header_row + 1, header_row + 3)]
        self.assertEqual(types, ["صورتحساب", "پرداخت"])

        self.assertIn("ریز کل تراکنش‌ها", workbook.sheetnames)
        all_sheet = workbook["ریز کل تراکنش‌ها"]
        self.assertEqual(all_sheet["A2"].value, "3001")
        self.assertEqual(all_sheet["D2"].value, "صورتحساب")
        self.assertEqual(all_sheet["G2"].value, 1_000_000)

    def test_single_company_export_and_unknown_company(self):
        response = self.client.get("/api/v1/billing/statements/excel/?payer=3001")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        missing = self.client.get("/api/v1/billing/statements/excel/?payer=9999")
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)
