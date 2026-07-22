"""
HR Module Tests — Employee, Attendance, Leave, Payroll, Performance, Recruitment.
Per IMPLEMENTATION_ROADMAP.md §19: HR completion criteria.
"""

import datetime
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone

from apps.accounts.tests_helpers import create_test_company, create_test_user
from apps.finance.models import Customer, AccountGroup, KolAccount

from .models import (
    Department, Employee, Attendance, LeaveType, LeaveRequest,
    PayrollPeriod, PayrollRecord, PerformanceEvaluation,
    Recruitment, Candidate,
)
from .services import (
    DepartmentService, EmployeeService, AttendanceService,
    LeaveService, PayrollService, PerformanceService, RecruitmentService,
)


class HRTestBase(TestCase):
    """Shared fixtures for HR tests."""

    def setUp(self):
        self.company = create_test_company()
        self.user = create_test_user(username="hr_tester", company=self.company, role="ceo")
        self.group = AccountGroup.objects.create(company=self.company, code="1", name="Assets")
        self.kol = KolAccount.objects.create(company=self.company, group=self.group, code="131", name="Customer Receivable", account_type="asset")
        self.customer = Customer.objects.create(company=self.company, name="Test Customer")
        self.company.enable_module("hr")


# ─── Department Tests ─────────────────────────────────────────

class DepartmentTests(HRTestBase):

    def test_create_department(self):
        dept = DepartmentService.create_department(
            company=self.company, name="Engineering", code="ENG",
        )
        self.assertEqual(dept.name, "Engineering")
        self.assertEqual(dept.code, "ENG")

    def test_nested_departments(self):
        parent = DepartmentService.create_department(company=self.company, name="Tech", code="TECH")
        child = DepartmentService.create_department(
            company=self.company, name="Backend", code="BE", parent_id=parent.id,
        )
        self.assertEqual(child.parent, parent)


# ─── Employee Tests ───────────────────────────────────────────

class EmployeeTests(HRTestBase):

    def test_create_employee(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Ali", last_name="Rezaei",
            employee_id="EMP001", hire_date=datetime.date(2025, 1, 1),
        )
        self.assertEqual(emp.full_name, "Ali Rezaei")
        self.assertEqual(emp.status, "active")

    def test_terminate_employee(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Sara", last_name="Ahmadi",
            employee_id="EMP002", hire_date=datetime.date(2024, 6, 1),
        )
        emp = EmployeeService.terminate_employee(self.company, emp.id)
        self.assertEqual(emp.status, "terminated")
        self.assertIsNotNone(emp.termination_date)

    def test_double_termination(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Reza", last_name="Karimi",
            employee_id="EMP003", hire_date=datetime.date(2024, 1, 1),
        )
        EmployeeService.terminate_employee(self.company, emp.id)
        with self.assertRaises(Exception):
            EmployeeService.terminate_employee(self.company, emp.id)

    def test_employee_summary(self):
        for i in range(3):
            EmployeeService.create_employee(
                company=self.company, first_name=f"Emp{i}", last_name="Test",
                employee_id=f"EMP{i:03d}", hire_date=datetime.date(2024, 1, 1),
            )
        summary = EmployeeService.get_summary(self.company)
        self.assertEqual(summary["total"], 3)
        self.assertEqual(summary["active"], 3)


# ─── Attendance Tests ─────────────────────────────────────────

class AttendanceTests(HRTestBase):

    def test_check_in(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Check", last_name="In",
            employee_id="ATT001", hire_date=datetime.date(2025, 1, 1),
        )
        att = AttendanceService.check_in(self.company, emp.id, user=self.user)
        self.assertIsNotNone(att.check_in)
        self.assertEqual(att.status, "present")

    def test_check_out(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Check", last_name="Out",
            employee_id="ATT002", hire_date=datetime.date(2025, 1, 1),
        )
        AttendanceService.check_in(self.company, emp.id)
        att = AttendanceService.check_out(self.company, emp.id)
        self.assertIsNotNone(att.check_out)

    def test_check_out_without_check_in(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="No", last_name="CheckIn",
            employee_id="ATT003", hire_date=datetime.date(2025, 1, 1),
        )
        with self.assertRaises(Exception):
            AttendanceService.check_out(self.company, emp.id)

    def test_double_check_out(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Double", last_name="Out",
            employee_id="ATT004", hire_date=datetime.date(2025, 1, 1),
        )
        AttendanceService.check_in(self.company, emp.id)
        AttendanceService.check_out(self.company, emp.id)
        with self.assertRaises(Exception):
            AttendanceService.check_out(self.company, emp.id)


# ─── Leave Tests ──────────────────────────────────────────────

class LeaveTests(HRTestBase):

    def setUp(self):
        super().setUp()
        self.leave_type = LeaveType.objects.create(
            company=self.company, name="Annual Leave", code="AL",
            default_days=20, is_paid=True,
        )

    def test_request_leave(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Leave", last_name="User",
            employee_id="LV001", hire_date=datetime.date(2025, 1, 1),
        )
        lr = LeaveService.request_leave(
            company=self.company, employee_id=emp.id,
            leave_type_id=self.leave_type.id,
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 1, 5),
        )
        self.assertEqual(lr.status, "pending")
        self.assertEqual(lr.days, 5)

    def test_approve_leave(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Approve", last_name="Test",
            employee_id="LV002", hire_date=datetime.date(2025, 1, 1),
        )
        lr = LeaveService.request_leave(
            company=self.company, employee_id=emp.id,
            leave_type_id=self.leave_type.id,
            start_date=datetime.date(2026, 2, 1),
            end_date=datetime.date(2026, 2, 3),
        )
        lr = LeaveService.approve_leave(self.company, lr.id, approver=self.user)
        self.assertEqual(lr.status, "approved")
        self.assertEqual(lr.approved_by, self.user)

    def test_reject_leave(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Reject", last_name="Test",
            employee_id="LV003", hire_date=datetime.date(2025, 1, 1),
        )
        lr = LeaveService.request_leave(
            company=self.company, employee_id=emp.id,
            leave_type_id=self.leave_type.id,
            start_date=datetime.date(2026, 3, 1),
            end_date=datetime.date(2026, 3, 2),
        )
        lr = LeaveService.reject_leave(self.company, lr.id, reason="Busy period")
        self.assertEqual(lr.status, "rejected")
        self.assertEqual(lr.rejection_reason, "Busy period")

    def test_approve_non_pending_leave(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Already", last_name="Approved",
            employee_id="LV004", hire_date=datetime.date(2025, 1, 1),
        )
        lr = LeaveService.request_leave(
            company=self.company, employee_id=emp.id,
            leave_type_id=self.leave_type.id,
            start_date=datetime.date(2026, 4, 1),
            end_date=datetime.date(2026, 4, 1),
        )
        LeaveService.approve_leave(self.company, lr.id, approver=self.user)
        with self.assertRaises(Exception):
            LeaveService.approve_leave(self.company, lr.id, approver=self.user)


# ─── Payroll Tests ────────────────────────────────────────────

class PayrollTests(HRTestBase):

    def test_create_period(self):
        period = PayrollService.create_period(
            company=self.company, name="January 2026",
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 1, 31),
        )
        self.assertEqual(period.name, "January 2026")
        self.assertEqual(period.status, "open")

    def test_generate_payroll(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Pay", last_name="Roll",
            employee_id="PR001", hire_date=datetime.date(2025, 1, 1),
            base_salary=Decimal("50000000"),
        )
        period = PayrollService.create_period(
            company=self.company, name="Feb 2026",
            start_date=datetime.date(2026, 2, 1),
            end_date=datetime.date(2026, 2, 28),
        )
        records = PayrollService.generate_payroll(self.company, period.id, user=self.user)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].base_salary, Decimal("50000000"))
        self.assertEqual(records[0].net_pay, Decimal("50000000"))


# ─── Performance Tests ────────────────────────────────────────

class PerformanceTests(HRTestBase):

    def test_create_evaluation(self):
        emp = EmployeeService.create_employee(
            company=self.company, first_name="Eval", last_name="Test",
            employee_id="EV001", hire_date=datetime.date(2025, 1, 1),
        )
        eval_obj = PerformanceService.create_evaluation(
            company=self.company, employee_id=emp.id,
            evaluation_date=datetime.date(2026, 3, 1),
            period_label="Q1 2026",
            productivity_score=5, quality_score=4,
            teamwork_score=3, initiative_score=4,
            communication_score=5,
        )
        self.assertEqual(eval_obj.overall_score, Decimal("4.2"))
        self.assertEqual(eval_obj.period_label, "Q1 2026")


# ─── Recruitment Tests ────────────────────────────────────────

class RecruitmentTests(HRTestBase):

    def test_create_job(self):
        job = RecruitmentService.create_job(
            company=self.company, title="Software Engineer",
            description="Python/Django developer",
        )
        self.assertEqual(job.title, "Software Engineer")
        self.assertEqual(job.status, "open")

    def test_add_candidate(self):
        job = RecruitmentService.create_job(
            company=self.company, title="DevOps Engineer",
        )
        candidate = RecruitmentService.add_candidate(
            company=self.company, recruitment_id=job.id,
            first_name="New", last_name="Candidate",
        )
        self.assertEqual(candidate.full_name, "New Candidate")
        self.assertEqual(candidate.status, "new")

    def test_advance_candidate(self):
        job = RecruitmentService.create_job(
            company=self.company, title="Data Scientist",
        )
        candidate = RecruitmentService.add_candidate(
            company=self.company, recruitment_id=job.id,
            first_name="Data", last_name="Science",
        )
        candidate = RecruitmentService.advance_candidate(self.company, candidate.id, "interview")
        self.assertEqual(candidate.status, "interview")

    def test_invalid_status(self):
        job = RecruitmentService.create_job(
            company=self.company, title="PM",
        )
        candidate = RecruitmentService.add_candidate(
            company=self.company, recruitment_id=job.id,
            first_name="Project", last_name="Manager",
        )
        with self.assertRaises(Exception):
            RecruitmentService.advance_candidate(self.company, candidate.id, "invalid_status")
