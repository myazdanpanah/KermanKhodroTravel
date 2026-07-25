"""
Inventory Module Tests — per IMPLEMENTATION_ROADMAP.md §6: Inventory Management.
Tests: models, services, posting integration, API views.
"""

import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests_helpers import create_test_company, create_test_user
from apps.finance.models import FiscalYear, AccountGroup, KolAccount
from .models import (
    Warehouse, Location, StockLedger, StockMovement,
    InventoryReservation, CycleCount, CycleCountLine, StockAdjustment,
)
from .services import (
    InventoryService, StockMovementService,
    ReservationService, ValuationEngine,
)

User = get_user_model()


class InventoryTestBase(TestCase):
    """Shared setUp for inventory tests."""

    def setUp(self):
        self.company = create_test_company(name="InvTestCo")
        self.user = create_test_user(username="invuser", company=self.company, role="ceo")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.company.enable_module("inventory")

        # Fiscal year
        self.fy = FiscalYear.objects.create(
            company=self.company, name="1404",
            start_date_jalali="1403/01/01", end_date_jalali="1404/01/01",
            start_date=datetime.date(2024, 3, 20),
            end_date=datetime.date(2025, 3, 19),
        )

        # Chart of accounts
        self.group1 = AccountGroup.objects.create(company=self.company, code="1", name="Assets")
        self.kol_111 = KolAccount.objects.create(
            company=self.company, group=self.group1, code="111",
            name="Inventory", account_type="asset",
            normal_balance="debit", is_balance_sheet=True,
        )
        self.kol_501 = KolAccount.objects.create(
            company=self.company, group=self.group1, code="501",
            name="COGS", account_type="expense",
            normal_balance="debit", is_balance_sheet=False,
        )

        # Warehouse
        self.warehouse = Warehouse.objects.create(
            company=self.company, code="WH-01", name="Main Warehouse",
            warehouse_type="main",
        )


class WarehouseTests(InventoryTestBase):
    """Tests for Warehouse CRUD."""

    def test_create_warehouse(self):
        resp = self.client.post("/api/v1/inventory/warehouses/", {
            "code": "WH-02",
            "name": "Branch Warehouse",
            "warehouse_type": "branch",
        }, format="json")
        self.assertIn(resp.status_code, [200, 201])
        data = resp.data.get("data", resp.data)
        self.assertEqual(data["code"], "WH-02")

    def test_list_warehouses(self):
        resp = self.client.get("/api/v1/inventory/warehouses/")
        self.assertEqual(resp.status_code, 200)
        data = resp.data.get("data", resp.data)
        self.assertGreaterEqual(len(data), 1)

    def test_delete_warehouse_soft(self):
        resp = self.client.delete(f"/api/v1/inventory/warehouses/{self.warehouse.id}/")
        self.assertEqual(resp.status_code, 200)
        self.warehouse.refresh_from_db()
        self.assertTrue(self.warehouse.is_deleted)


class StockMovementTests(InventoryTestBase):
    """Tests for Stock Receipt, Issue, and Transfer."""

    def test_create_receipt(self):
        resp = self.client.post("/api/v1/inventory/movements/", {
            "movement_type": "receipt",
            "warehouse": self.warehouse.id,
            "product_name": "Steel Sheet",
            "product_code": "STL-001",
            "quantity": "100.0000",
            "unit_cost": "50000.00",
            "unit": "kg",
            "description": "Initial stock",
        }, format="json")
        self.assertIn(resp.status_code, [200, 201])

        # Verify ledger updated
        ledger = StockLedger.objects.get(
            company=self.company, product_code="STL-001",
            warehouse=self.warehouse,
        )
        self.assertEqual(ledger.quantity_on_hand, Decimal("100.0000"))
        self.assertEqual(ledger.unit_cost, Decimal("50000.00"))
        self.assertEqual(ledger.total_value, Decimal("5000000.00"))

    def test_create_issue(self):
        # First, receive some stock
        StockMovementService.create_receipt(
            company=self.company, warehouse_id=self.warehouse.id,
            product_name="Bolt", product_code="BLT-001",
            quantity=Decimal("50"), unit_cost=Decimal("1000"),
            user=self.user,
        )

        # Then issue some
        movement = StockMovementService.create_issue(
            company=self.company, warehouse_id=self.warehouse.id,
            product_name="Bolt", product_code="BLT-001",
            quantity=Decimal("20"), unit_cost=Decimal("1000"),
            user=self.user,
        )
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity, Decimal("-20"))

        ledger = StockLedger.objects.get(
            company=self.company, product_code="BLT-001",
            warehouse=self.warehouse,
        )
        self.assertEqual(ledger.quantity_on_hand, Decimal("30"))

    def test_issue_insufficient_stock_fails(self):
        # No stock → issue should fail
        from apps.finance.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            StockMovementService.create_issue(
                company=self.company, warehouse_id=self.warehouse.id,
                product_name="Nothing", product_code="NOTHING",
                quantity=Decimal("10"), unit_cost=Decimal("1000"),
                user=self.user,
            )

    def test_create_transfer(self):
        # Receive at source warehouse
        StockMovementService.create_receipt(
            company=self.company, warehouse_id=self.warehouse.id,
            product_name="Widget", product_code="WDG-001",
            quantity=Decimal("100"), unit_cost=Decimal("500"),
            user=self.user,
        )

        # Create destination warehouse
        dest = Warehouse.objects.create(
            company=self.company, code="WH-02", name="Destination",
            warehouse_type="branch",
        )

        # Transfer
        result = StockMovementService.create_transfer(
            company=self.company,
            from_warehouse_id=self.warehouse.id,
            to_warehouse_id=dest.id,
            product_name="Widget", product_code="WDG-001",
            quantity=Decimal("30"),
            unit_cost=Decimal("500"),
            user=self.user,
        )

        # Verify source depleted
        src_ledger = StockLedger.objects.get(
            company=self.company, product_code="WDG-001",
            warehouse=self.warehouse,
        )
        self.assertEqual(src_ledger.quantity_on_hand, Decimal("70"))

        # Verify destination received
        dest_ledger = StockLedger.objects.get(
            company=self.company, product_code="WDG-001",
            warehouse=dest,
        )
        self.assertEqual(dest_ledger.quantity_on_hand, Decimal("30"))


class InventoryServiceTests(InventoryTestBase):
    """Tests for InventoryService operations."""

    def setUp(self):
        super().setUp()
        # Seed some stock
        StockMovementService.create_receipt(
            company=self.company, warehouse_id=self.warehouse.id,
            product_name="Widget", product_code="WDG-001",
            quantity=Decimal("100"), unit_cost=Decimal("5000"),
            user=self.user,
        )

    def test_get_stock_balance(self):
        balance = InventoryService.get_stock_balance(
            self.company, "WDG-001", self.warehouse.id,
        )
        self.assertEqual(balance["quantity_on_hand"], Decimal("100"))

    def test_check_availability_sufficient(self):
        result = InventoryService.check_availability(
            self.company, "WDG-001", self.warehouse.id, Decimal("50"),
        )
        self.assertTrue(result["is_available"])
        self.assertIsInstance(result["available"], Decimal)  # backward compat: quantity

    def test_check_availability_insufficient(self):
        result = InventoryService.check_availability(
            self.company, "WDG-001", self.warehouse.id, Decimal("200"),
        )
        self.assertFalse(result["is_available"])
        self.assertGreater(result["shortage"], Decimal("0"))

    def test_low_stock_items(self):
        # Set reorder level above current stock
        ledger = StockLedger.objects.get(
            company=self.company, product_code="WDG-001",
            warehouse=self.warehouse,
        )
        ledger.reorder_level = Decimal("200")
        ledger.save(update_fields=["reorder_level"])

        low_stock = InventoryService.get_low_stock_items(self.company)
        self.assertEqual(len(low_stock), 1)
        self.assertEqual(low_stock[0]["product_code"], "WDG-001")


class ReservationTests(InventoryTestBase):
    """Tests for Inventory Reservations."""

    def setUp(self):
        super().setUp()
        StockMovementService.create_receipt(
            company=self.company, warehouse_id=self.warehouse.id,
            product_name="Widget", product_code="WDG-001",
            quantity=Decimal("100"), unit_cost=Decimal("5000"),
            user=self.user,
        )

    def test_reserve_stock(self):
        reservation = ReservationService.reserve_stock(
            company=self.company,
            product_name="Widget", product_code="WDG-001",
            warehouse_id=self.warehouse.id,
            quantity=Decimal("30"),
            reference_type="sales_order",
            reference_id=1,
            user=self.user,
        )
        self.assertEqual(reservation.quantity, Decimal("30"))
        self.assertEqual(reservation.status, "active")

        # Check available decreased
        balance = InventoryService.get_stock_balance(
            self.company, "WDG-001", self.warehouse.id,
        )
        self.assertEqual(balance["quantity_available"], Decimal("70"))

    def test_reserve_insufficient_stock(self):
        from apps.finance.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            ReservationService.reserve_stock(
                company=self.company,
                product_name="Widget", product_code="WDG-001",
                warehouse_id=self.warehouse.id,
                quantity=Decimal("200"),
                reference_type="sales_order",
                reference_id=1,
                user=self.user,
            )

    def test_release_reservation(self):
        reservation = ReservationService.reserve_stock(
            company=self.company,
            product_name="Widget", product_code="WDG-001",
            warehouse_id=self.warehouse.id,
            quantity=Decimal("30"),
            reference_type="sales_order",
            reference_id=1,
            user=self.user,
        )

        ReservationService.release_reservation(
            self.company, reservation.id, self.user,
        )

        # Check available restored
        balance = InventoryService.get_stock_balance(
            self.company, "WDG-001", self.warehouse.id,
        )
        self.assertEqual(balance["quantity_available"], Decimal("100"))

    def test_fulfill_reservation(self):
        reservation = ReservationService.reserve_stock(
            company=self.company,
            product_name="Widget", product_code="WDG-001",
            warehouse_id=self.warehouse.id,
            quantity=Decimal("30"),
            reference_type="sales_order",
            reference_id=1,
            user=self.user,
        )

        ReservationService.fulfill_reservation(
            self.company, reservation.id, Decimal("20"),
        )

        reservation.refresh_from_db()
        self.assertEqual(reservation.quantity_fulfilled, Decimal("20"))
        self.assertEqual(reservation.status, "active")

        # Stock should be issued: 100 - 20 = 80
        balance = InventoryService.get_stock_balance(
            self.company, "WDG-001", self.warehouse.id,
        )
        self.assertEqual(balance["quantity_on_hand"], Decimal("80"))


class ValuationEngineTests(InventoryTestBase):
    """Tests for FIFO and Average valuation."""

    def setUp(self):
        super().setUp()
        # Multiple receipts at different costs
        StockMovementService.create_receipt(
            company=self.company, warehouse_id=self.warehouse.id,
            product_name="Widget", product_code="WDG-001",
            quantity=Decimal("50"), unit_cost=Decimal("1000"),
            user=self.user,
        )
        StockMovementService.create_receipt(
            company=self.company, warehouse_id=self.warehouse.id,
            product_name="Widget", product_code="WDG-001",
            quantity=Decimal("50"), unit_cost=Decimal("2000"),
            user=self.user,
        )

    def test_average_cost(self):
        result = ValuationEngine.calculate_average_cost(
            self.company, "WDG-001", self.warehouse.id,
        )
        # (50*1000 + 50*2000) / 100 = 1500
        self.assertEqual(result["weighted_average_cost"], Decimal("1500"))

    def test_fifo_cost(self):
        result = ValuationEngine.calculate_fifo_cost(
            self.company, "WDG-001", self.warehouse.id, Decimal("70"),
        )
        # 50 @ 1000 + 20 @ 2000 = 90000
        self.assertEqual(result["total_cost"], Decimal("90000"))
        self.assertTrue(result["fully_satisfied"])

    def test_inventory_valuation(self):
        result = ValuationEngine.get_inventory_valuation(self.company)
        self.assertGreater(result["total_value"], Decimal("0"))
        self.assertEqual(len(result["items"]), 1)


class InventoryViewTests(InventoryTestBase):
    """Tests for REST API views."""

    def test_summary(self):
        resp = self.client.get("/api/v1/inventory/summary/")
        self.assertEqual(resp.status_code, 200)
        data = resp.data.get("data", resp.data)
        self.assertEqual(data["total_warehouses"], 1)
        self.assertEqual(data["total_products"], 0)

    def test_stock_balances_empty(self):
        resp = self.client.get("/api/v1/inventory/balances/")
        self.assertEqual(resp.status_code, 200)

    def test_check_availability_endpoint(self):
        StockMovementService.create_receipt(
            company=self.company, warehouse_id=self.warehouse.id,
            product_name="Widget", product_code="WDG-001",
            quantity=Decimal("50"), unit_cost=Decimal("1000"),
            user=self.user,
        )
        resp = self.client.get(
            f"/api/v1/inventory/check-availability/"
            f"?product_code=WDG-001&warehouse_id={self.warehouse.id}&quantity=30"
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.data.get("data", resp.data)
        self.assertTrue(data["is_available"])

    def test_low_stock_endpoint(self):
        resp = self.client.get("/api/v1/inventory/low-stock/")
        self.assertEqual(resp.status_code, 200)

    def test_movements_list(self):
        resp = self.client.get("/api/v1/inventory/movements/")
        self.assertEqual(resp.status_code, 200)

    def test_reservations_list(self):
        resp = self.client.get("/api/v1/inventory/reservations/")
        self.assertEqual(resp.status_code, 200)

    def test_valuation_endpoint(self):
        resp = self.client.get("/api/v1/inventory/valuation/")
        self.assertEqual(resp.status_code, 200)
