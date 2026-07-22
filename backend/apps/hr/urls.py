"""HR URL Patterns."""
from django.urls import path
from . import views

urlpatterns = [
    path("departments/", views.department_list, name="hr-department-list"),
    path("departments/<int:pk>/", views.department_detail, name="hr-department-detail"),
    path("employees/", views.employee_list, name="hr-employee-list"),
    path("employees/<int:pk>/", views.employee_detail, name="hr-employee-detail"),
    path("attendance/", views.attendance_list, name="hr-attendance-list"),
    path("leave-types/", views.leave_type_list, name="hr-leave-type-list"),
    path("leave-requests/", views.leave_request_list, name="hr-leave-request-list"),
    path("leave-requests/<int:pk>/approve/", views.leave_approve, name="hr-leave-approve"),
    path("leave-requests/<int:pk>/reject/", views.leave_reject, name="hr-leave-reject"),
    path("payroll-periods/", views.payroll_period_list, name="hr-payroll-period-list"),
    path("payroll-periods/<int:pk>/generate/", views.payroll_generate, name="hr-payroll-generate"),
    path("payroll-records/", views.payroll_record_list, name="hr-payroll-record-list"),
    path("evaluations/", views.evaluation_list, name="hr-evaluation-list"),
    path("recruitments/", views.recruitment_list, name="hr-recruitment-list"),
    path("recruitments/<int:recruitment_id>/candidates/", views.candidate_list, name="hr-candidate-list"),
    path("summary/", views.hr_summary, name="hr-summary"),
]
