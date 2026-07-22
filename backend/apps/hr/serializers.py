"""HR Serializers — REST API serialization."""
from rest_framework import serializers
from .models import (
    Department, Employee, Attendance, LeaveType, LeaveRequest,
    PayrollPeriod, PayrollRecord, PerformanceEvaluation,
    Recruitment, Candidate,
)


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code", "description", "parent", "manager", "is_active",
                  "created_at", "updated_at"]


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "employee_id", "first_name", "last_name", "full_name",
                  "national_id", "birth_date", "gender", "email", "phone", "mobile", "address",
                  "department", "position", "hire_date", "termination_date", "status",
                  "employment_type", "base_salary", "currency", "reports_to", "skills",
                  "created_at", "updated_at"]
        read_only_fields = ["termination_date"]


class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = Attendance
        fields = ["id", "employee", "employee_name", "date", "check_in", "check_out",
                  "status", "overtime_hours", "notes", "created_at"]
        read_only_fields = ["check_in", "check_out"]


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ["id", "name", "code", "default_days", "is_paid", "is_active"]


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)

    class Meta:
        model = LeaveRequest
        fields = ["id", "employee", "employee_name", "leave_type", "leave_type_name",
                  "start_date", "end_date", "days", "reason", "status",
                  "approved_by", "approved_at", "rejection_reason", "created_at"]
        read_only_fields = ["status", "approved_by", "approved_at", "rejection_reason"]


class PayrollPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollPeriod
        fields = ["id", "name", "start_date", "end_date", "status", "created_at"]


class PayrollRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = PayrollRecord
        fields = ["id", "period", "employee", "employee_name",
                  "base_salary", "overtime_pay", "bonuses", "allowances", "total_earnings",
                  "tax", "insurance", "other_deductions", "total_deductions",
                  "net_pay", "currency", "status", "notes", "created_at"]
        read_only_fields = ["total_earnings", "total_deductions", "net_pay"]


class PerformanceEvaluationSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = PerformanceEvaluation
        fields = ["id", "employee", "employee_name", "evaluation_date", "period_label",
                  "productivity_score", "quality_score", "teamwork_score",
                  "initiative_score", "communication_score", "overall_score",
                  "comments", "goals", "evaluator", "created_at"]
        read_only_fields = ["overall_score"]


class RecruitmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recruitment
        fields = ["id", "title", "department", "description", "requirements",
                  "salary_range_min", "salary_range_max", "positions_count",
                  "status", "posted_date", "deadline_date", "created_at"]
        read_only_fields = ["posted_date"]


class CandidateSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Candidate
        fields = ["id", "recruitment", "first_name", "last_name", "full_name",
                  "email", "phone", "cover_letter", "status", "notes", "created_at"]
