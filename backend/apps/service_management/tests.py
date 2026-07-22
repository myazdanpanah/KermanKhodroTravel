"""
Service Management Module Tests.
Per SERVICE_MANAGEMENT_MODULE.md §23: Completion Criteria.
"""

import datetime
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.accounts.tests_helpers import create_test_company, create_test_user
from apps.finance.models import Customer, AccountGroup, KolAccount

from .models import (
    ServiceRequest, Warranty, Technician, WorkOrder,
    ServiceContract, SLARule, MaintenancePlan, MaintenanceSchedule,
    ServicePart, ServiceFeedback,
)
from .services import (
    ServiceRequestService, WarrantyService, TechnicianService,
    WorkOrderService, ServiceContractService, SLAService,
    MaintenanceService, ServicePartService, ServiceFeedbackService,
)


class ServiceManagementTestBase(TestCase):
    """Shared fixtures for service management tests."""

    def setUp(self):
        self.company = create_test_company()
        self.user = create_test_user(
            username="sm_tester", company=self.company, role="ceo"
        )
        # Create accounting prerequisites
        self.group = AccountGroup.objects.create(
            company=self.company, code="1", name="Assets"
        )
        self.kol = KolAccount.objects.create(
            company=self.company, group=self.group, code="131",
            name="Customer Receivable", account_type="asset"
        )
        self.customer = Customer.objects.create(
            company=self.company, name="Test Customer"
        )
        # Enable service_management module for test company
        self.company.enable_module("service_management")


# ─── Service Request Tests ─────────────────────────────────────

class ServiceRequestTests(ServiceManagementTestBase):

    def test_create_service_request(self):
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        self.assertEqual(sr.status, "new")
        self.assertTrue(sr.request_number.startswith("SR-"))
        self.assertEqual(sr.customer, self.customer)

    def test_assign_technician(self):
        tech = Technician.objects.create(
            company=self.company, name="Ali",
            employee_id="T001", skills="electrical"
        )
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        sr = ServiceRequestService.assign_technician(
            self.company, sr.id, tech.id
        )
        self.assertEqual(sr.status, "assigned")
        self.assertEqual(sr.assigned_technician, tech)

    def test_transition_to_in_progress(self):
        # Create SLA rule so response tracking activates
        SLARule.objects.create(
            company=self.company, name="Standard", priority="medium",
            response_time_hours=24, resolution_time_hours=72,
        )
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        sr = ServiceRequestService.update_status(
            self.company, sr.id, "assigned"
        )
        sr = ServiceRequestService.update_status(
            self.company, sr.id, "in_progress"
        )
        self.assertEqual(sr.status, "in_progress")
        self.assertIsNotNone(sr.sla_response_met)

    def test_transition_to_completed(self):
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        for status in ["assigned", "in_progress", "completed"]:
            sr = ServiceRequestService.update_status(
                self.company, sr.id, status
            )
        self.assertEqual(sr.status, "completed")
        self.assertIsNotNone(sr.resolved_date)

    def test_invalid_transition_rejected(self):
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        with self.assertRaises(Exception):
            ServiceRequestService.update_status(
                self.company, sr.id, "completed"
            )

    def test_summary(self):
        ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        summary = ServiceRequestService.get_summary(self.company)
        self.assertEqual(summary["total"], 1)
        self.assertEqual(summary["new"], 1)


# ─── Warranty Tests ────────────────────────────────────────────

class WarrantyTests(ServiceManagementTestBase):

    def test_create_warranty(self):
        w = WarrantyService.create_warranty(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            start_date=datetime.date.today(),
            end_date=datetime.date.today() + datetime.timedelta(days=365),
            serial_number="SN12345",
            user=self.user,
        )
        self.assertEqual(w.status, "active")
        self.assertTrue(w.is_active)

    def test_validate_active_warranty(self):
        WarrantyService.create_warranty(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            start_date=datetime.date.today(),
            end_date=datetime.date.today() + datetime.timedelta(days=365),
            serial_number="SN99999",
            user=self.user,
        )
        result = WarrantyService.validate_warranty(self.company, "SN99999")
        self.assertTrue(result["covered"])

    def test_validate_no_warranty(self):
        result = WarrantyService.validate_warranty(self.company, "NONEXISTENT")
        self.assertFalse(result["covered"])

    def test_expire_warranties(self):
        w = WarrantyService.create_warranty(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            start_date=datetime.date(2020, 1, 1),
            end_date=datetime.date(2020, 12, 31),
            serial_number="SN_EXPIRED",
            user=self.user,
        )
        WarrantyService.expire_warranties(self.company)
        w.refresh_from_db()
        self.assertEqual(w.status, "expired")


# ─── Technician Tests ──────────────────────────────────────────

class TechnicianTests(ServiceManagementTestBase):

    def test_create_technician(self):
        tech = TechnicianService.create_technician(
            company=self.company,
            name="Reza",
            employee_id="T002",
            skills="mechanical,electrical",
            hourly_rate=Decimal("500000"),
        )
        self.assertEqual(tech.name, "Reza")
        self.assertEqual(tech.hourly_rate, Decimal("500000"))

    def test_find_by_skill(self):
        TechnicianService.create_technician(
            company=self.company,
            name="Reza",
            employee_id="T003",
            skills="mechanical",
        )
        found = TechnicianService.find_by_skill(self.company, "mechanical")
        self.assertEqual(found.count(), 1)


# ─── Work Order Tests ──────────────────────────────────────────

class WorkOrderTests(ServiceManagementTestBase):

    def test_create_work_order(self):
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        wo = WorkOrderService.create_work_order(
            company=self.company,
            service_request_id=sr.id,
            user=self.user,
            problem="Diagnose screen issue",
        )
        self.assertTrue(wo.work_order_number.startswith("WO-"))
        self.assertEqual(wo.status, "created")
        sr.refresh_from_db()
        self.assertEqual(sr.status, "in_progress")

    def test_start_work_order(self):
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        wo = WorkOrderService.create_work_order(
            company=self.company, service_request_id=sr.id, user=self.user
        )
        wo = WorkOrderService.start_work(self.company, wo.id)
        self.assertEqual(wo.status, "started")
        self.assertIsNotNone(wo.start_date)

    def test_complete_work_order(self):
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        wo = WorkOrderService.create_work_order(
            company=self.company, service_request_id=sr.id, user=self.user
        )
        wo = WorkOrderService.start_work(self.company, wo.id)
        wo = WorkOrderService.complete_work(self.company, wo.id)
        self.assertEqual(wo.status, "completed")
        self.assertIsNotNone(wo.completed_date)
        sr.refresh_from_db()
        self.assertEqual(sr.status, "completed")

    def test_cost_calculation(self):
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        wo = WorkOrderService.create_work_order(
            company=self.company, service_request_id=sr.id, user=self.user
        )
        wo.actual_labor_cost = Decimal("200000")
        wo.actual_parts_cost = Decimal("300000")
        wo.actual_external_cost = Decimal("50000")
        wo.actual_overhead = Decimal("100000")
        wo.calculate_total_cost()
        self.assertEqual(wo.actual_total_cost, Decimal("650000"))


# ─── Service Contract Tests ────────────────────────────────────

class ServiceContractTests(ServiceManagementTestBase):

    def test_create_contract(self):
        contract = ServiceContractService.create_contract(
            company=self.company,
            customer_id=self.customer.id,
            start_date=datetime.date.today(),
            end_date=datetime.date.today() + datetime.timedelta(days=365),
            price=Decimal("1200000"),
            user=self.user,
        )
        self.assertTrue(contract.contract_number.startswith("SC-"))
        self.assertEqual(contract.status, "draft")

    def test_activate_contract(self):
        contract = ServiceContractService.create_contract(
            company=self.company,
            customer_id=self.customer.id,
            start_date=datetime.date.today(),
            end_date=datetime.date.today() + datetime.timedelta(days=365),
            user=self.user,
        )
        contract = ServiceContractService.activate_contract(
            self.company, contract.id
        )
        self.assertEqual(contract.status, "active")


# ─── SLA Tests ─────────────────────────────────────────────────

class SLATests(ServiceManagementTestBase):

    def test_create_sla_rule(self):
        rule = SLAService.create_rule(
            company=self.company,
            name="Critical Response",
            priority="critical",
            response_time_hours=2,
            resolution_time_hours=24,
        )
        self.assertEqual(rule.response_time_hours, 2)

    def test_check_compliance(self):
        SLAService.create_rule(
            company=self.company, name="High Priority",
            priority="high", response_time_hours=24, resolution_time_hours=72,
        )
        result = SLAService.check_compliance(self.company)
        self.assertEqual(result["total_open"], 0)
        self.assertEqual(result["breach_count"], 0)


# ─── Maintenance Tests ─────────────────────────────────────────

class MaintenanceTests(ServiceManagementTestBase):

    def test_create_maintenance_plan(self):
        plan = MaintenanceService.create_plan(
            company=self.company,
            name="Quarterly HVAC Check",
            interval_days=90,
            user=self.user,
        )
        self.assertEqual(plan.status, "draft")
        self.assertIsNotNone(plan.next_maintenance_date)

    def test_generate_schedules(self):
        plan = MaintenanceService.create_plan(
            company=self.company,
            name="Monthly Filter Change",
            interval_days=30,
            user=self.user,
        )
        plan.status = "active"
        plan.save(update_fields=["status"])
        created = MaintenanceService.generate_schedules(self.company)
        self.assertEqual(created, 1)


# ─── Service Feedback Tests ───────────────────────────────────

class ServiceFeedbackTests(ServiceManagementTestBase):

    def test_submit_feedback(self):
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        wo = WorkOrderService.create_work_order(
            company=self.company, service_request_id=sr.id, user=self.user
        )
        wo = WorkOrderService.start_work(self.company, wo.id)
        wo = WorkOrderService.complete_work(self.company, wo.id)

        fb = ServiceFeedbackService.submit_feedback(
            company=self.company,
            work_order_id=wo.id,
            rating=5,
            comment="Excellent service",
        )
        self.assertEqual(fb.rating, 5)

    def test_invalid_rating_rejected(self):
        sr = ServiceRequestService.create_request(
            company=self.company,
            customer_id=self.customer.id,
            product_name="Laptop HP",
            problem_description="Screen flickering",
            user=self.user,
        )
        wo = WorkOrderService.create_work_order(
            company=self.company, service_request_id=sr.id, user=self.user
        )
        wo = WorkOrderService.start_work(self.company, wo.id)
        wo = WorkOrderService.complete_work(self.company, wo.id)

        with self.assertRaises(Exception):
            ServiceFeedbackService.submit_feedback(
                company=self.company,
                work_order_id=wo.id,
                rating=10,
            )
