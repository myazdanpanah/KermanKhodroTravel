"""HR Admin Registration."""
from django.contrib import admin
from .models import (
    Department, Employee, Attendance, LeaveType, LeaveRequest,
    PayrollPeriod, PayrollRecord, PerformanceEvaluation,
    Recruitment, Candidate,
)

admin.site.register(Department)
admin.site.register(Employee)
admin.site.register(Attendance)
admin.site.register(LeaveType)
admin.site.register(LeaveRequest)
admin.site.register(PayrollPeriod)
admin.site.register(PayrollRecord)
admin.site.register(PerformanceEvaluation)
admin.site.register(Recruitment)
admin.site.register(Candidate)
