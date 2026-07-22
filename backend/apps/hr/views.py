"""HR Views — REST API endpoints."""
import logging
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from apps.accounts.permissions import RequireModule
from apps.core.responses import (
    success_response, error_response, business_rule_error,
    not_found_response, forbidden_response,
)
from .models import (
    Department, Employee, Attendance, LeaveType, LeaveRequest,
    PayrollPeriod, PayrollRecord, PerformanceEvaluation,
    Recruitment, Candidate,
)
from .serializers import (
    DepartmentSerializer, EmployeeSerializer, AttendanceSerializer,
    LeaveTypeSerializer, LeaveRequestSerializer,
    PayrollPeriodSerializer, PayrollRecordSerializer,
    PerformanceEvaluationSerializer, RecruitmentSerializer, CandidateSerializer,
)
logger = logging.getLogger(__name__)
_HRPerm = RequireModule.for_module("hr")()

def _check_hr(request):
    if not _HRPerm.has_permission(request, None):
        return forbidden_response("Module 'hr' is not enabled")
    return None

# ─── Departments ──────────────────────────────────────────────
@api_view(["GET", "POST"])
def department_list(request):
    gate = _check_hr(request)
    if gate: return gate
    company = request.user.company
    if request.method == "GET":
        qs = Department.objects.filter(company=company)
        return success_response(data=DepartmentSerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = DepartmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import DepartmentService
        dept = DepartmentService.create_department(company=company, user=request.user, **serializer.validated_data)
        return success_response(data=DepartmentSerializer(dept).data, message="Department created", http_status_code=status.HTTP_201_CREATED)

@api_view(["GET", "PUT", "DELETE"])
def department_detail(request, pk):
    gate = _check_hr(request)
    if gate: return gate
    try:
        dept = Department.objects.get(pk=pk, company=request.user.company)
    except Department.DoesNotExist:
        return not_found_response("Department not found")
    if request.method == "GET":
        return success_response(data=DepartmentSerializer(dept).data)
    elif request.method == "PUT":
        for field in ["name", "code", "description", "parent", "manager", "is_active"]:
            if field in request.data: setattr(dept, field, request.data[field])
        dept.save()
        return success_response(data=DepartmentSerializer(dept).data)
    elif request.method == "DELETE":
        dept.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

# ─── Employees ────────────────────────────────────────────────
@api_view(["GET", "POST"])
def employee_list(request):
    gate = _check_hr(request)
    if gate: return gate
    company = request.user.company
    if request.method == "GET":
        qs = Employee.objects.filter(company=company)
        emp_status = request.query_params.get("status")
        if emp_status: qs = qs.filter(status=emp_status)
        dept = request.query_params.get("department")
        if dept: qs = qs.filter(department_id=dept)
        return success_response(data=EmployeeSerializer(qs, many=True).data)
    elif request.method == "POST":
        from .services import EmployeeService
        from django.utils import timezone
        hire_date = request.data.get("hire_date", timezone.now().date())
        emp = EmployeeService.create_employee(
            company=company, first_name=request.data.get("first_name", ""),
            last_name=request.data.get("last_name", ""),
            employee_id=request.data.get("employee_id", ""),
            hire_date=hire_date, user=request.user,
            department_id=request.data.get("department"),
            position=request.data.get("position", ""),
            email=request.data.get("email", ""),
            phone=request.data.get("phone", ""),
            base_salary=request.data.get("base_salary", 0),
            employment_type=request.data.get("employment_type", "full_time"),
            reports_to_id=request.data.get("reports_to"),
        )
        return success_response(data=EmployeeSerializer(emp).data, message="Employee created", http_status_code=status.HTTP_201_CREATED)

@api_view(["GET", "PUT", "DELETE"])
def employee_detail(request, pk):
    gate = _check_hr(request)
    if gate: return gate
    try:
        emp = Employee.objects.get(pk=pk, company=request.user.company)
    except Employee.DoesNotExist:
        return not_found_response("Employee not found")
    if request.method == "GET":
        return success_response(data=EmployeeSerializer(emp).data)
    elif request.method == "PUT":
        for field in ["first_name", "last_name", "position", "department", "status", "email", "phone", "base_salary", "reports_to", "skills"]:
            if field in request.data: setattr(emp, field, request.data[field])
        emp.save()
        return success_response(data=EmployeeSerializer(emp).data)
    elif request.method == "DELETE":
        emp.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

# ─── Attendance ───────────────────────────────────────────────
@api_view(["GET", "POST"])
def attendance_list(request):
    gate = _check_hr(request)
    if gate: return gate
    company = request.user.company
    if request.method == "GET":
        qs = Attendance.objects.filter(company=company)
        emp_id = request.query_params.get("employee")
        if emp_id: qs = qs.filter(employee_id=emp_id)
        return success_response(data=AttendanceSerializer(qs, many=True).data)
    elif request.method == "POST":
        from .services import AttendanceService
        emp_id = request.data.get("employee_id")
        action = request.data.get("action", "check_in")
        try:
            if action == "check_in":
                att = AttendanceService.check_in(company, emp_id, user=request.user)
            else:
                att = AttendanceService.check_out(company, emp_id)
            return success_response(data=AttendanceSerializer(att).data, message=f"Attendance {action} successful")
        except Exception as e:
            return business_rule_error(str(e))

# ─── Leave ────────────────────────────────────────────────────
@api_view(["GET", "POST"])
def leave_type_list(request):
    gate = _check_hr(request)
    if gate: return gate
    company = request.user.company
    if request.method == "GET":
        qs = LeaveType.objects.filter(company=company)
        return success_response(data=LeaveTypeSerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = LeaveTypeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lt = LeaveType.objects.create(company=company, **serializer.validated_data)
        return success_response(data=LeaveTypeSerializer(lt).data, message="Leave type created", http_status_code=status.HTTP_201_CREATED)

@api_view(["GET", "POST"])
def leave_request_list(request):
    gate = _check_hr(request)
    if gate: return gate
    company = request.user.company
    if request.method == "GET":
        qs = LeaveRequest.objects.filter(company=company)
        lr_status = request.query_params.get("status")
        if lr_status: qs = qs.filter(status=lr_status)
        return success_response(data=LeaveRequestSerializer(qs, many=True).data)
    elif request.method == "POST":
        from .services import LeaveService
        try:
            lr = LeaveService.request_leave(
                company=company, employee_id=request.data.get("employee_id"),
                leave_type_id=request.data.get("leave_type_id"),
                start_date=request.data.get("start_date"),
                end_date=request.data.get("end_date"),
                reason=request.data.get("reason", ""),
                user=request.user,
            )
            return success_response(data=LeaveRequestSerializer(lr).data, message="Leave request created", http_status_code=status.HTTP_201_CREATED)
        except Exception as e:
            return business_rule_error(str(e))

@api_view(["POST"])
def leave_approve(request, pk):
    gate = _check_hr(request)
    if gate: return gate
    from .services import LeaveService
    try:
        lr = LeaveService.approve_leave(request.user.company, pk, approver=request.user)
        return success_response(data=LeaveRequestSerializer(lr).data, message="Leave approved")
    except Exception as e:
        return business_rule_error(str(e))

@api_view(["POST"])
def leave_reject(request, pk):
    gate = _check_hr(request)
    if gate: return gate
    from .services import LeaveService
    try:
        lr = LeaveService.reject_leave(request.user.company, pk, reason=request.data.get("reason", ""))
        return success_response(data=LeaveRequestSerializer(lr).data, message="Leave rejected")
    except Exception as e:
        return business_rule_error(str(e))

# ─── Payroll ──────────────────────────────────────────────────
@api_view(["GET", "POST"])
def payroll_period_list(request):
    gate = _check_hr(request)
    if gate: return gate
    company = request.user.company
    if request.method == "GET":
        qs = PayrollPeriod.objects.filter(company=company)
        return success_response(data=PayrollPeriodSerializer(qs, many=True).data)
    elif request.method == "POST":
        from .services import PayrollService
        period = PayrollService.create_period(
            company=company, name=request.data.get("name", ""),
            start_date=request.data.get("start_date"),
            end_date=request.data.get("end_date"),
            user=request.user,
        )
        return success_response(data=PayrollPeriodSerializer(period).data, message="Payroll period created", http_status_code=status.HTTP_201_CREATED)

@api_view(["POST"])
def payroll_generate(request, pk):
    gate = _check_hr(request)
    if gate: return gate
    from .services import PayrollService
    try:
        records = PayrollService.generate_payroll(request.user.company, pk, user=request.user)
        return success_response(data={"count": len(records)}, message=f"Generated {len(records)} payroll records")
    except Exception as e:
        return business_rule_error(str(e))

@api_view(["GET"])
def payroll_record_list(request):
    gate = _check_hr(request)
    if gate: return gate
    qs = PayrollRecord.objects.filter(company=request.user.company)
    period_id = request.query_params.get("period")
    if period_id: qs = qs.filter(period_id=period_id)
    return success_response(data=PayrollRecordSerializer(qs, many=True).data)

# ─── Performance ──────────────────────────────────────────────
@api_view(["GET", "POST"])
def evaluation_list(request):
    gate = _check_hr(request)
    if gate: return gate
    company = request.user.company
    if request.method == "GET":
        qs = PerformanceEvaluation.objects.filter(company=company)
        return success_response(data=PerformanceEvaluationSerializer(qs, many=True).data)
    elif request.method == "POST":
        from .services import PerformanceService
        from django.utils import timezone
        eval_obj = PerformanceService.create_evaluation(
            company=company, employee_id=request.data.get("employee_id"),
            evaluation_date=request.data.get("evaluation_date", timezone.now().date()),
            period_label=request.data.get("period_label", ""),
            user=request.user,
            productivity_score=int(request.data.get("productivity_score", 3)),
            quality_score=int(request.data.get("quality_score", 3)),
            teamwork_score=int(request.data.get("teamwork_score", 3)),
            initiative_score=int(request.data.get("initiative_score", 3)),
            communication_score=int(request.data.get("communication_score", 3)),
            comments=request.data.get("comments", ""),
            goals=request.data.get("goals", ""),
        )
        return success_response(data=PerformanceEvaluationSerializer(eval_obj).data, message="Evaluation created", http_status_code=status.HTTP_201_CREATED)

# ─── Recruitment ──────────────────────────────────────────────
@api_view(["GET", "POST"])
def recruitment_list(request):
    gate = _check_hr(request)
    if gate: return gate
    company = request.user.company
    if request.method == "GET":
        qs = Recruitment.objects.filter(company=company)
        return success_response(data=RecruitmentSerializer(qs, many=True).data)
    elif request.method == "POST":
        from .services import RecruitmentService
        job = RecruitmentService.create_job(
            company=company, title=request.data.get("title", ""),
            user=request.user, department_id=request.data.get("department"),
            description=request.data.get("description", ""),
            requirements=request.data.get("requirements", ""),
            positions_count=int(request.data.get("positions_count", 1)),
        )
        return success_response(data=RecruitmentSerializer(job).data, message="Job posted", http_status_code=status.HTTP_201_CREATED)

@api_view(["GET", "POST"])
def candidate_list(request, recruitment_id):
    gate = _check_hr(request)
    if gate: return gate
    company = request.user.company
    if request.method == "GET":
        qs = Candidate.objects.filter(company=company, recruitment_id=recruitment_id)
        return success_response(data=CandidateSerializer(qs, many=True).data)
    elif request.method == "POST":
        from .services import RecruitmentService
        candidate = RecruitmentService.add_candidate(
            company=company, recruitment_id=recruitment_id,
            first_name=request.data.get("first_name", ""),
            last_name=request.data.get("last_name", ""),
            user=request.user,
            email=request.data.get("email", ""),
            phone=request.data.get("phone", ""),
        )
        return success_response(data=CandidateSerializer(candidate).data, message="Candidate added", http_status_code=status.HTTP_201_CREATED)

# ─── Summary ──────────────────────────────────────────────────
@api_view(["GET"])
def hr_summary(request):
    gate = _check_hr(request)
    if gate: return gate
    from .services import EmployeeService
    summary = EmployeeService.get_summary(request.user.company)
    return success_response(data=summary)
