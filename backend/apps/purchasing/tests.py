"""
Purchasing Module Tests — per IMPLEMENTATION_ROADMAP.md §7.
Tests: models, services, API views.
"""

import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests_helpers import create_test_company, create_test_user
from apps.finance.models import FiscalYear, AccountGroup, KolAccount
from .models import (
    PurchaseRequest, PurchaseOrder, GoodsReceipt, PurchaseReturn,
)
from .services import PurchasingService, GoodsReceiptService

User = get_user_model()


class PurchasingTestBase(TestCase):
    """Shared setUp for purchasing tests."""

    def setUp(self):
        self.company = create_test_company(name="PurchTestCo")
        self.user = create_test_user(username="purchuser", company=self.company, role="ceo")
        self.user2 = create_test_user(username="purchuser2", company=self.company, role="finance")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.company.enable_module("purchasing")

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
        self.kol_231 = KolAccount.objects.create(
            company=self.company, group=self.group1, code="231",
            name="Supplier Payable", account_type="liability",
            normal_balance="credit", is_balance_sheet=True,
        )


class PurchaseRequestTests(PurchasingTestBase):
    """Tests for Purchase Request CRUD and workflow."""

    def test_create_purchase_request(self):
        resp = self.client.post("/api/v1/purchasing/requests/", {
            "request_number": "PR-001",
            "title": "Need steel sheets",
            "item_name": "Steel Sheet",
            "quantity": "100.00",
            "unit": "kg",
            "estimated_unit_cost": "50000.00",
            "priority": 3,
        }, format="json")
        self.assertIn(resp.status_code, [200, 201])
        data = resp.data.get("data", resp.data)
        self.assertEqual(data["request_number"], "PR-001")
        self.assertEqual(Decimal(data["estimated_total"]), Decimal("5000000.00"))

    def test_list_purchase_requests(self):
        PurchaseRequest.objects.create(
            company=self.company, request_number="PR-100",
            title="Test", item_name="Widget",
            quantity=Decimal("10"), estimated_unit_cost=Decimal("1000"),
            requested_by=self.user,
        )
        resp = self.client.get("/api/v1/purchasing/requests/")
        self.assertEqual(resp.status_code, 200)

    def test_approve_purchase_request(self):
        pr = PurchaseRequest.objects.create(
            company=self.company, request_number="PR-200",
            title="Test", item_name="Widget",
            quantity=Decimal("10"), estimated_unit_cost=Decimal("1000"),
            status="submitted", requested_by=self.user,
        )
        resp = self.client.post(f"/api/v1/purchasing/requests/{pr.id}/approve/")
        self.assertEqual(resp.status_code, 200)
        pr.refresh_from_db()
        self.assertEqual(pr.status, "approved")
        self.assertEqual(pr.approved_by, self.user)

    def test_reject_purchase_request(self):
        pr = PurchaseRequest.objects.create(
            company=self.company, request_number="PR-300",
            title="Test", item_name="Widget",
            quantity=Decimal("10"), estimated_unit_cost=Decimal("1000"),
            status="submitted", requested_by=self.user,
        )
        resp = self.client.post(
            f"/api/v1/purchasing/requests/{pr.id}/reject/",
            {"reason": "Budget exceeded"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        pr.refresh_from_db()
        self.assertEqual(pr.status, "rejected")
        self.assertEqual(pr.rejection_reason, "Budget exceeded")

    def test_approve_non_submitted_fails(self):
        pr = PurchaseRequest.objects.create(
            company=self.company, request_number="PR-400",
            title="Test", item_name="Widget",
            quantity=Decimal("10"), estimated_unit_cost=Decimal("1000"),
            status="draft", requested_by=self.user,
        )
        resp = self.client.post(f"/api/v1/purchasing/requests/{pr.id}/approve/")
        self.assertEqual(resp.status_code, 422)


class PurchaseOrderTests(PurchasingTestBase):
    """Tests for Purchase Order CRUD and workflow."""

    def test_create_purchase_order(self):
        resp = self.client.post("/api/v1/purchasing/orders/", {
            "order_number": "PO-001",
            "item_name": "Steel Sheet",
            "quantity": "100.00",
            "unit_price": "50000.00",
            "supplier_name": "Steel Corp",
        }, format="json")
        self.assertIn(resp.status_code, [200, 201])
        data = resp.data.get("data", resp.data)
        self.assertEqual(Decimal(data["tax_amount"]), Decimal("500000.00"))

    def test_list_purchase_orders(self):
        PurchaseOrder.objects.create(
            company=self.company, order_number="PO-100",
            item_name="Widget", quantity=Decimal("10"),
            unit_price=Decimal("1000"),
        )
        resp = self.client.get("/api/v1/purchasing/orders/")
        self.assertEqual(resp.status_code, 200)

    def test_approve_purchase_order(self):
        po = PurchaseOrder.objects.create(
            company=self.company, order_number="PO-200",
            item_name="Widget", quantity=Decimal("10"),
            unit_price=Decimal("1000"), status="submitted",
        )
        resp = self.client.post(f"/api/v1/purchasing/orders/{po.id}/approve/")
        self.assertEqual(resp.status_code, 200)
        po.refresh_from_db()
        self.assertEqual(po.status, "approved")
        self.assertEqual(po.approved_by, self.user)

    def test_close_purchase_order(self):
        po = PurchaseOrder.objects.create(
            company=self.company, order_number="PO-300",
            item_name="Widget", quantity=Decimal("10"),
            unit_price=Decimal("1000"), status="approved",
        )
        resp = self.client.post(f"/api/v1/purchasing/orders/{po.id}/close/")
        self.assertEqual(resp.status_code, 200)
        po.refresh_from_db()
        self.assertEqual(po.status, "closed")


class GoodsReceiptTests(PurchasingTestBase):
    """Tests for Goods Receipt workflow."""

    def setUp(self):
        super().setUp()
        self.po = PurchaseOrder.objects.create(
            company=self.company, order_number="PO-GR-001",
            item_name="Steel Sheet", quantity=Decimal("100"),
            unit_price=Decimal("50000"), status="approved",
        )

    def test_create_goods_receipt(self):
        resp = self.client.post("/api/v1/purchasing/receipts/", {
            "receipt_number": "GR-001",
            "purchase_order": self.po.id,
            "item_name": "Steel Sheet",
            "quantity_ordered": "100.00",
            "quantity_received": "95.00",
            "quantity_rejected": "5.00",
            "unit": "kg",
            "unit_cost": "50000.00",
        }, format="json")
        self.assertIn(resp.status_code, [200, 201])

    def test_receive_goods(self):
        receipt = GoodsReceipt.objects.create(
            company=self.company, receipt_number="GR-002",
            purchase_order=self.po,
            item_name="Steel Sheet",
            quantity_ordered=Decimal("100"),
            quantity_received=Decimal("100"),
            unit_cost=Decimal("50000"),
        )
        resp = self.client.post(f"/api/v1/purchasing/receipts/{receipt.id}/receive/")
        self.assertEqual(resp.status_code, 200)
        receipt.refresh_from_db()
        self.assertEqual(receipt.status, "inspected")
        self.assertEqual(receipt.received_by, self.user)

        # PO status should update
        self.po.refresh_from_db()
        self.assertEqual(self.po.status, "received")

    def test_approve_goods_receipt(self):
        receipt = GoodsReceipt.objects.create(
            company=self.company, receipt_number="GR-003",
            purchase_order=self.po,
            item_name="Steel Sheet",
            quantity_ordered=Decimal("100"),
            quantity_received=Decimal("100"),
            unit_cost=Decimal("50000"),
            status="inspected",
        )
        resp = self.client.post(f"/api/v1/purchasing/receipts/{receipt.id}/approve/")
        self.assertEqual(resp.status_code, 200)
        receipt.refresh_from_db()
        self.assertEqual(receipt.status, "approved")


class PurchaseReturnTests(PurchasingTestBase):
    """Tests for Purchase Return."""

    def setUp(self):
        super().setUp()
        self.po = PurchaseOrder.objects.create(
            company=self.company, order_number="PO-RET-001",
            item_name="Steel Sheet", quantity=Decimal("100"),
            unit_price=Decimal("50000"), status="received",
        )

    def test_create_purchase_return(self):
        resp = self.client.post("/api/v1/purchasing/returns/", {
            "return_number": "RET-001",
            "purchase_order": self.po.id,
            "item_name": "Steel Sheet",
            "quantity_returned": "10.00",
            "unit_cost": "50000.00",
            "reason": "Defective material",
        }, format="json")
        self.assertIn(resp.status_code, [200, 201])
        data = resp.data.get("data", resp.data)
        self.assertEqual(Decimal(data["total_value"]), Decimal("500000.00"))

    def test_list_purchase_returns(self):
        PurchaseReturn.objects.create(
            company=self.company, return_number="RET-100",
            purchase_order=self.po,
            item_name="Steel Sheet",
            quantity_returned=Decimal("5"),
            unit_cost=Decimal("50000"),
        )
        resp = self.client.get("/api/v1/purchasing/returns/")
        self.assertEqual(resp.status_code, 200)


class PurchasingSummaryTests(PurchasingTestBase):
    """Tests for purchasing summary endpoint."""

    def test_summary_empty(self):
        resp = self.client.get("/api/v1/purchasing/summary/")
        self.assertEqual(resp.status_code, 200)
        data = resp.data.get("data", resp.data)
        self.assertEqual(data["total_purchase_requests"], 0)

    def test_summary_with_data(self):
        PurchaseRequest.objects.create(
            company=self.company, request_number="PR-S1",
            title="Test", item_name="Widget",
            quantity=Decimal("10"), estimated_unit_cost=Decimal("1000"),
            status="submitted", requested_by=self.user,
        )
        PurchaseOrder.objects.create(
            company=self.company, order_number="PO-S1",
            item_name="Widget", quantity=Decimal("10"),
            unit_price=Decimal("1000"), status="approved",
        )
        resp = self.client.get("/api/v1/purchasing/summary/")
        self.assertEqual(resp.status_code, 200)
        data = resp.data.get("data", resp.data)
        self.assertEqual(data["total_purchase_requests"], 1)
        self.assertEqual(data["active_purchase_orders"], 1)
