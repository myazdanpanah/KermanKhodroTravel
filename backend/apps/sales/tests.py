"""
Sales Module Tests — comprehensive test suite.
Per IMPLEMENTATION_ROADMAP.md §13: Sales Phase acceptance criteria.
"""

from decimal import Decimal
from datetime import date, timedelta

from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model

from apps.accounts.models import Company
from apps.core.models import BaseModel
from apps.finance.models import Customer, JournalVoucher, JournalEntry, Account, FiscalYear

from .models import (
    SalesQuotation, SalesQuotationLine,
    SalesOrder, SalesOrderLine,
    SalesInvoice, SalesInvoiceLine,
    SalesReturn, SalesReturnLine,
)
from .services import QuotationService, SalesService, InvoiceService, ReturnService
from .posting import SalesPostingEngine

User = get_user_model()


class SalesTestBase(TestCase):
    """Shared test fixtures for sales tests."""

    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name="Test Co", code="TC")
        cls.user = User.objects.create_user(
            username="sales_user", password="pass123",
            company=cls.company,
        )
        cls.customer = Customer.objects.create(
            company=cls.company,
            name="Test Customer",
            customer_type="wholesale",
        )

        # Create accounts for posting tests
        cls.ar_account = Account.objects.create(
            company=cls.company, code="131", name="Customer Receivable",
            account_type="asset",
        )
        cls.revenue_account = Account.objects.create(
            company=cls.company, code="401", name="Sales Revenue",
            account_type="revenue",
        )
        cls.vat_account = Account.objects.create(
            company=cls.company, code="221", name="VAT Payable",
            account_type="liability",
        )
        cls.return_account = Account.objects.create(
            company=cls.company, code="402", name="Sales Return",
            account_type="revenue",
        )
        cls.fiscal_year = FiscalYear.objects.create(
            company=cls.company,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_current=True,
        )


class QuotationTests(SalesTestBase):

    def test_create_quotation(self):
        quotation = QuotationService.create_quotation(
            company=self.company,
            customer_id=self.customer.id,
            quotation_date=date.today(),
            valid_until=date.today() + timedelta(days=30),
            lines_data=[
                {
                    "product_name": "Widget A",
                    "product_code": "W001",
                    "quantity": 10,
                    "unit_price": 100000,
                    "tax_percent": 10,
                },
            ],
            user=self.user,
        )
        self.assertEqual(quotation.status, "draft")
        self.assertEqual(quotation.lines.count(), 1)
        self.assertTrue(quotation.total > 0)

    def test_send_quotation(self):
        quotation = QuotationService.create_quotation(
            company=self.company,
            customer_id=self.customer.id,
            quotation_date=date.today(),
            valid_until=date.today() + timedelta(days=30),
            lines_data=[
                {"product_name": "Widget A", "quantity": 5, "unit_price": 50000},
            ],
        )
        result = QuotationService.send_quotation(self.company, quotation.id)
        self.assertEqual(result.status, "sent")

    def test_convert_to_order(self):
        quotation = QuotationService.create_quotation(
            company=self.company,
            customer_id=self.customer.id,
            quotation_date=date.today(),
            valid_until=date.today() + timedelta(days=30),
            lines_data=[
                {"product_name": "Widget A", "quantity": 10, "unit_price": 100000},
            ],
            user=self.user,
        )
        order = QuotationService.convert_to_order(
            self.company, quotation.id, user=self.user,
        )
        self.assertIsNotNone(order)
        self.assertEqual(order.lines.count(), 1)
        quotation.refresh_from_db()
        self.assertEqual(quotation.status, "converted")


class OrderTests(SalesTestBase):

    def test_create_order(self):
        order = SalesService.create_order(
            company=self.company,
            customer_id=self.customer.id,
            order_date=date.today(),
            lines_data=[
                {"product_name": "Widget A", "quantity": 20, "unit_price": 100000},
                {"product_name": "Widget B", "quantity": 5, "unit_price": 200000},
            ],
            user=self.user,
        )
        self.assertEqual(order.status, "draft")
        self.assertEqual(order.lines.count(), 2)
        self.assertEqual(order.total, Decimal("2000000") + Decimal("1000000"))  # 2M + 1M

    def test_order_with_discount(self):
        order = SalesService.create_order(
            company=self.company,
            customer_id=self.customer.id,
            order_date=date.today(),
            lines_data=[
                {
                    "product_name": "Widget A",
                    "quantity": 10,
                    "unit_price": 100000,
                    "discount_percent": 10,
                },
            ],
            user=self.user,
        )
        line = order.lines.first()
        self.assertEqual(line.discount_amount, Decimal("100000"))  # 10% of 1M
        self.assertEqual(line.line_total, Decimal("900000") + line.tax_amount)

    def test_cancel_order(self):
        order = SalesService.create_order(
            company=self.company,
            customer_id=self.customer.id,
            order_date=date.today(),
            lines_data=[{"product_name": "Widget A", "quantity": 1, "unit_price": 100000}],
            user=self.user,
        )
        result = SalesService.cancel_order(self.company, order.id)
        self.assertEqual(result.status, "cancelled")

    def test_order_summary(self):
        SalesService.create_order(
            company=self.company,
            customer_id=self.customer.id,
            order_date=date.today(),
            lines_data=[{"product_name": "A", "quantity": 1, "unit_price": 100000}],
        )
        summary = SalesService.get_order_summary(self.company)
        self.assertEqual(summary["total_orders"], 1)
        self.assertEqual(summary["draft"], 1)


class InvoiceTests(SalesTestBase):

    def test_create_invoice(self):
        invoice = InvoiceService.create_invoice(
            company=self.company,
            customer_id=self.customer.id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            lines_data=[
                {"product_name": "Widget A", "quantity": 10, "unit_price": 100000, "tax_percent": 10},
            ],
            user=self.user,
        )
        self.assertEqual(invoice.status, "draft")
        self.assertTrue(invoice.total > 0)

    def test_issue_invoice(self):
        invoice = InvoiceService.create_invoice(
            company=self.company,
            customer_id=self.customer.id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            lines_data=[
                {"product_name": "Widget A", "quantity": 10, "unit_price": 100000, "tax_percent": 10},
            ],
            user=self.user,
        )
        result = InvoiceService.issue_invoice(self.company, invoice.id, user=self.user)
        self.assertEqual(result.status, "issued")
        self.assertIsNotNone(result.journal_voucher)

    def test_record_payment(self):
        invoice = InvoiceService.create_invoice(
            company=self.company,
            customer_id=self.customer.id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            lines_data=[{"product_name": "A", "quantity": 1, "unit_price": 100000}],
        )
        InvoiceService.issue_invoice(self.company, invoice.id)
        result = InvoiceService.record_payment(self.company, invoice.id, Decimal("50000"))
        self.assertEqual(result.status, "partial")
        result = InvoiceService.record_payment(self.company, invoice.id, Decimal("50000"))
        self.assertEqual(result.status, "paid")

    def test_receivables(self):
        invoice = InvoiceService.create_invoice(
            company=self.company,
            customer_id=self.customer.id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            lines_data=[{"product_name": "A", "quantity": 1, "unit_price": 100000}],
        )
        InvoiceService.issue_invoice(self.company, invoice.id)
        data = InvoiceService.get_receivables(self.company)
        self.assertEqual(data["outstanding_invoices"], 1)
        self.assertTrue(data["balance"] > 0)


class ReturnTests(SalesTestBase):

    def test_create_return(self):
        return_order = ReturnService.create_return(
            company=self.company,
            customer_id=self.customer.id,
            return_date=date.today(),
            lines_data=[
                {"product_name": "Widget A", "quantity": 2, "unit_price": 100000},
            ],
            reason="Defective",
        )
        self.assertEqual(return_order.status, "draft")
        self.assertEqual(return_order.total_amount, Decimal("200000"))

    def test_receive_return(self):
        return_order = ReturnService.create_return(
            company=self.company,
            customer_id=self.customer.id,
            return_date=date.today(),
            lines_data=[
                {"product_name": "Widget A", "quantity": 1, "unit_price": 100000},
            ],
            user=self.user,
        )
        result = ReturnService.receive_return(self.company, return_order.id, user=self.user)
        self.assertEqual(result.status, "received")
        self.assertIsNotNone(result.journal_voucher)


class PostingTests(SalesTestBase):

    def test_post_sales_invoice(self):
        invoice = InvoiceService.create_invoice(
            company=self.company,
            customer_id=self.customer.id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            lines_data=[
                {"product_name": "Widget A", "quantity": 10, "unit_price": 100000, "tax_percent": 10},
            ],
            user=self.user,
        )
        voucher = SalesPostingEngine.post_sales_invoice(self.company, invoice, self.user)
        entries = voucher.entries.all()
        self.assertEqual(entries.count(), 3)  # Dr 131, Cr 401, Cr 221

        debits = entries.filter(debit__gt=0)
        credits = entries.filter(credit__gt=0)
        self.assertEqual(debits.count(), 1)
        self.assertEqual(credits.count(), 2)

        total_debit = sum(e.debit for e in debits)
        total_credit = sum(e.credit for e in credits)
        self.assertEqual(total_debit, total_credit)

    def test_post_sales_return(self):
        return_order = ReturnService.create_return(
            company=self.company,
            customer_id=self.customer.id,
            return_date=date.today(),
            lines_data=[
                {"product_name": "Widget A", "quantity": 2, "unit_price": 100000},
            ],
        )
        voucher = SalesPostingEngine.post_sales_return(self.company, return_order, self.user)
        entries = voucher.entries.all()
        self.assertEqual(entries.count(), 2)  # Dr 402, Cr 131

        total_debit = sum(e.debit for e in entries.filter(debit__gt=0))
        total_credit = sum(e.credit for e in entries.filter(credit__gt=0))
        self.assertEqual(total_debit, total_credit)
