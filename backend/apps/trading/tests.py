"""
Trading Module Tests — comprehensive test suite.
"""

from decimal import Decimal
from datetime import date

from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.accounts.models import Company
from apps.finance.models import Customer, Supplier

from .models import (
    ImportOrder, ExportOrder, Container,
    Shipment, CustomsDocument, InternationalCost,
)
from .services import ImportService, ExportService, ShipmentService, TradingSummaryService
from .posting import TradingPostingEngine
from apps.finance.models import JournalVoucher

User = get_user_model()


class TradingTestBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name="TradingTestCo", code="TT")
        cls.user = User.objects.create_user(username="trader", password="pass123", company=cls.company)
        cls.supplier = Supplier.objects.create(company=cls.company, name="Foreign Supplier Co")
        cls.customer = Customer.objects.create(company=cls.company, name="Export Customer", customer_type="corporate")


class ImportTests(TradingTestBase):

    def test_create_import_order(self):
        order = ImportService.create_import_order(
            company=self.company,
            supplier_id=self.supplier.id,
            product_name="Electronic Components",
            quantity=Decimal("1000"),
            unit_price_foreign=Decimal("5.50"),
            foreign_currency="USD",
            exchange_rate=Decimal("42000"),
            user=self.user,
        )
        self.assertEqual(order.status, "draft")
        self.assertEqual(order.total_price_foreign, Decimal("5500.00"))
        self.assertEqual(order.total_price_irr, Decimal("231000000.00"))

    def test_import_lifecycle(self):
        order = ImportService.create_import_order(
            company=self.company, supplier_id=self.supplier.id,
            product_name="Widget", quantity=Decimal("100"),
            unit_price_foreign=Decimal("10"), user=self.user,
        )
        order = ImportService.confirm_import(self.company, order.id)
        self.assertEqual(order.status, "confirmed")
        order = ImportService.mark_shipped(self.company, order.id)
        self.assertEqual(order.status, "shipped")
        order = ImportService.clear_customs(self.company, order.id, declaration_number="CD-001")
        self.assertEqual(order.status, "customs_cleared")
        order = ImportService.receive_at_warehouse(self.company, order.id)
        self.assertEqual(order.status, "warehouse_received")
        order = ImportService.complete_import(self.company, order.id)
        self.assertEqual(order.status, "completed")


class ExportTests(TradingTestBase):

    def test_create_export_order(self):
        order = ExportService.create_export_order(
            company=self.company, customer_id=self.customer.id,
            product_name="Finished Widget", quantity=Decimal("500"),
            unit_price_foreign=Decimal("15"), user=self.user,
        )
        self.assertEqual(order.status, "draft")
        self.assertEqual(order.total_price_foreign, Decimal("7500.00"))

    def test_export_lifecycle(self):
        order = ExportService.create_export_order(
            company=self.company, customer_id=self.customer.id,
            product_name="Widget", quantity=Decimal("100"),
            unit_price_foreign=Decimal("20"), user=self.user,
        )
        order = ExportService.confirm_export(self.company, order.id)
        self.assertEqual(order.status, "confirmed")
        order = ExportService.mark_shipped(self.company, order.id)
        self.assertEqual(order.status, "shipped")


class ShipmentTests(TradingTestBase):

    def test_create_shipment(self):
        shipment = ShipmentService.create_shipment(
            company=self.company,
            shipment_type="sea",
            origin="Shanghai, China",
            destination="Bandar Abbas, Iran",
        )
        self.assertIsNotNone(shipment.shipment_number)
        self.assertEqual(shipment.status, "preparing")

    def test_update_status(self):
        shipment = ShipmentService.create_shipment(company=self.company, origin="A", destination="B")
        shipment = ShipmentService.update_status(self.company, shipment.id, "in_transit")
        self.assertEqual(shipment.status, "in_transit")


class SummaryTests(TradingTestBase):

    def test_summary_empty(self):
        data = TradingSummaryService.get_summary(self.company)
        self.assertEqual(data["total_imports"], 0)
        self.assertEqual(data["total_exports"], 0)
