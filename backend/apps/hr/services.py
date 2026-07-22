"""
HR Services — Business logic for human resources management.
Per IMPLEMENTATION_ROADMAP.md §19.
"""

import logging
from decimal import Decimal
from typing import Dict, List

from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone

from apps.finance.exceptions import ValidationError
from .models import (
    Department, Employee, Attendance, LeaveType, LeaveRequest,
    PayrollPeriod, PayrollRecord, PerformanceEvaluation,
    Recruitment, Candidate,
)

logger = logging.getLogger(__name__)


# ─── Department Service ───────────────────────────────────────

class DepartmentService:
    @staticmethod
    def create_department(company, name: str, user=None, code: str = "",
                           description: str = "", parent_id: int = None,
                           manager_id: int = None) -> Department:
        dept = Department.objects.create(
            company=company, name=name, code=code, description=description,
            parent_id=parent_id, manager_id=manager_id, created_by=user,
        )
        return dept


# ─── Employee Service ─────────────────────────────────────────

class EmployeeService:
    @staticmethod
    def create_employee(
        company, first_name: str, last_name: str, employee_id: str,
        hire_date, user=None, department_id: int = None, position: str = "",
        email: str = "", phone: str = "", base_salary: Decimal = Decimal("0"),
        employment_type: str = "full_time", reports_to_id: int = None,
    ) -> Employee:
        emp = Employee.objects.create(
            company=company, first_name=first_name, last_name=last_name,
            employee_id=employee_id, hire_date=hire_date,
            department_id=department_id, position=position,
            email=email, phone=phone, base_salary=base_salary,
            employment_type=employment_type, reports_to_id=reports_to_id,
            created_by=user,
        )
        return emp

    @staticmethod
    def terminate_employee(company, employee_id: int, termination_date=None) -> Employee:
        emp = Employee.objects.get(pk=employee_id, company=company)
        if emp.status == "terminated":
            raise ValidationError("Employee is already terminated")
        emp.status = "terminated"
        emp.termination_date = termination_date or timezone.now().date()
        emp.save(update_fields=["status", "termination_date", "updated_at"])
        return emp

    @staticmethod
    def get_summary(company) -> Dict:
        qs = Employee.objects.filter(company=company)
        return {
            "total": qs.count(),
            "active": qs.filter(status="active").count(),
            "on_leave": qs.filter(status="on_leave").count(),
            "terminated": qs.filter(status="terminated").count(),
            "departments": Department.objects.filter(company=company, is_active=True).count(),
        }


# ─── Attendance Service ───────────────────────────────────────

class AttendanceService:
    @staticmethod
    def check_in(company, employee_id: int, user=None) -> Attendance:
        from django.utils import timezone as tz
        now = tz.now()
        attendance, created = Attendance.objects.get_or_create(
            company=company, employee_id=employee_id, date=now.date(),
            defaults={"check_in": now, "status": "present", "created_by": user},
        )
        if not created and not attendance.check_in:
            attendance.check_in = now
            attendance.status = "present"
            attendance.save(update_fields=["check_in", "status", "updated_at"])
        return attendance

    @staticmethod
    def check_out(company, employee_id: int) -> Attendance:
        from django.utils import timezone as tz
        now = tz.now()
        try:
            attendance = Attendance.objects.get(
                company=company, employee_id=employee_id, date=now.date()
            )
        except Attendance.DoesNotExist:
            raise ValidationError("No check-in record found for today")
        if attendance.check_out:
            raise ValidationError("Already checked out today")
        attendance.check_out = now
        attendance.save(update_fields=["check_out", "updated_at"])
        return attendance


# ─── Leave Service ────────────────────────────────────────────

class LeaveService:
    @staticmethod
    def request_leave(
        company, employee_id: int, leave_type_id: int,
        start_date, end_date, reason: str = "", user=None,
    ) -> LeaveRequest:
        leave_type = LeaveType.objects.get(pk=leave_type_id, company=company)
        from datetime import timedelta
        days = (end_date - start_date).days + 1
        lr = LeaveRequest.objects.create(
            company=company, employee_id=employee_id, leave_type=leave_type,
            start_date=start_date, end_date=end_date, days=days,
            reason=reason, created_by=user,
        )
        return lr

    @staticmethod
    def approve_leave(company, leave_id: int, approver) -> LeaveRequest:
        lr = LeaveRequest.objects.get(pk=leave_id, company=company)
        if lr.status != "pending":
            raise ValidationError("Only pending requests can be approved")
        lr.status = "approved"
        lr.approved_by = approver
        lr.approved_at = timezone.now()
        lr.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
        return lr

    @staticmethod
    def reject_leave(company, leave_id: int, reason: str = "") -> LeaveRequest:
        lr = LeaveRequest.objects.get(pk=leave_id, company=company)
        if lr.status != "pending":
            raise ValidationError("Only pending requests can be rejected")
        lr.status = "rejected"
        lr.rejection_reason = reason
        lr.save(update_fields=["status", "rejection_reason", "updated_at"])
        return lr


# ─── Payroll Service ──────────────────────────────────────────

class PayrollService:
    @staticmethod
    def create_period(company, name: str, start_date, end_date, user=None) -> PayrollPeriod:
        period = PayrollPeriod.objects.create(
            company=company, name=name, start_date=start_date,
            end_date=end_date, created_by=user,
        )
        return period

    @staticmethod
    def generate_payroll(company, period_id: int, user=None) -> List[PayrollRecord]:
        """Generate payroll records for all active employees."""
        period = PayrollPeriod.objects.get(pk=period_id, company=company)
        employees = Employee.objects.filter(company=company, status="active")
        records = []
        for emp in employees:
            record, created = PayrollRecord.objects.get_or_create(
                period=period, employee=emp,
                defaults={
                    "company": company, "base_salary": emp.base_salary,
                    "created_by": user,
                },
            )
            if created:
                record.calculate_totals()
                records.append(record)
        return records


# ─── Performance Service ──────────────────────────────────────

class PerformanceService:
    @staticmethod
    def create_evaluation(
        company, employee_id: int, evaluation_date,
        period_label: str, user=None,
        productivity_score: int = 3, quality_score: int = 3,
        teamwork_score: int = 3, initiative_score: int = 3,
        communication_score: int = 3, comments: str = "",
        goals: str = "",
    ) -> PerformanceEvaluation:
        eval_obj = PerformanceEvaluation.objects.create(
            company=company, employee_id=employee_id,
            evaluation_date=evaluation_date, period_label=period_label,
            productivity_score=productivity_score, quality_score=quality_score,
            teamwork_score=teamwork_score, initiative_score=initiative_score,
            communication_score=communication_score,
            comments=comments, goals=goals, evaluator=user,
            created_by=user,
        )
        eval_obj.calculate_overall()
        return eval_obj


# ─── Recruitment Service ──────────────────────────────────────

class RecruitmentService:
    @staticmethod
    def create_job(
        company, title: str, user=None,
        department_id: int = None, description: str = "",
        requirements: str = "", positions_count: int = 1,
    ) -> Recruitment:
        from django.utils import timezone as tz
        job = Recruitment.objects.create(
            company=company, title=title, department_id=department_id,
            description=description, requirements=requirements,
            positions_count=positions_count, posted_date=tz.now().date(),
            created_by=user,
        )
        return job

    @staticmethod
    def add_candidate(
        company, recruitment_id: int,
        first_name: str, last_name: str, user=None,
        email: str = "", phone: str = "",
    ) -> Candidate:
        candidate = Candidate.objects.create(
            company=company, recruitment_id=recruitment_id,
            first_name=first_name, last_name=last_name,
            email=email, phone=phone, created_by=user,
        )
        return candidate

    @staticmethod
    def advance_candidate(company, candidate_id: int, new_status: str) -> Candidate:
        valid = ["new", "screening", "interview", "offer", "hired", "rejected"]
        if new_status not in valid:
            raise ValidationError(f"Invalid status: {new_status}")
        candidate = Candidate.objects.get(pk=candidate_id, company=company)
        candidate.status = new_status
        candidate.save(update_fields=["status", "updated_at"])
        return candidate
