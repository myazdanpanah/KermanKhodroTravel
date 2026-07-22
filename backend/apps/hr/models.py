"""
HR Module Models — Human Resources Management.

Per IMPLEMENTATION_ROADMAP.md §19: Phase 14 HR.
- Employees
- Departments
- Attendance
- Leave Management
- Payroll
- Recruitment
- Performance Evaluation
"""

from decimal import Decimal
from django.db import models
from django.conf import settings

from apps.core.models import BaseModel


# ─── Department ───────────────────────────────────────────────

class Department(BaseModel):
    """
    HR Department — organizational unit for employees.
    Per IMPLEMENTATION_ROADMAP.md §19: Departments.
    """
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, blank=True, default="")
    description = models.TextField(blank=True, default="")
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="sub_departments",
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="managed_hr_departments",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("company", "code")]
        ordering = ["name"]

    def __str__(self):
        return self.name


# ─── Employee ─────────────────────────────────────────────────

class Employee(BaseModel):
    """
    Employee — HR employee record.
    Per IMPLEMENTATION_ROADMAP.md §19: Employees.
    """
    STATUS_CHOICES = [
        ("active", "Active"),
        ("on_leave", "On Leave"),
        ("terminated", "Terminated"),
        ("retired", "Retired"),
    ]
    GENDER_CHOICES = [
        ("male", "Male"),
        ("female", "Female"),
        ("other", "Other"),
    ]

    # Identity
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="hr_employee",
    )
    employee_id = models.CharField(max_length=50)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    national_id = models.CharField(max_length=20, blank=True, default="", help_text="National ID number")
    birth_date = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, default="")

    # Contact
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    mobile = models.CharField(max_length=20, blank=True, default="")
    address = models.TextField(blank=True, default="")

    # Employment
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="employees",
    )
    position = models.CharField(max_length=200, blank=True, default="", help_text="Job title/position")
    hire_date = models.DateField()
    termination_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    employment_type = models.CharField(
        max_length=20, default="full_time",
        choices=[("full_time", "Full Time"), ("part_time", "Part Time"),
                 ("contract", "Contract"), ("intern", "Intern")],
    )

    # Compensation
    base_salary = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=10, default="IRR")

    # Reporting
    reports_to = models.ForeignKey(
        "self", on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="direct_reports_hr",
    )

    # Skills
    skills = models.CharField(max_length=500, blank=True, default="",
                               help_text="Comma-separated skills")

    class Meta:
        unique_together = [("company", "employee_id")]
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.employee_id})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


# ─── Attendance ───────────────────────────────────────────────

class Attendance(BaseModel):
    """
    Attendance — daily attendance record.
    Per IMPLEMENTATION_ROADMAP.md §19: Attendance.
    """
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="attendances")
    date = models.DateField()
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, default="present",
        choices=[("present", "Present"), ("absent", "Absent"),
                 ("late", "Late"), ("half_day", "Half Day"),
                 ("holiday", "Holiday"), ("weekend", "Weekend")],
    )
    overtime_hours = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    notes = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        unique_together = [("company", "employee", "date")]
        ordering = ["-date"]

    def __str__(self):
        return f"{self.employee} — {self.date} ({self.status})"


# ─── Leave Type ───────────────────────────────────────────────

class LeaveType(BaseModel):
    """
    Leave Type — defines types of leave available.
    Per IMPLEMENTATION_ROADMAP.md §19: Leave Management.
    """
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True, default="")
    default_days = models.IntegerField(default=0, help_text="Default annual allocation")
    is_paid = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("company", "code")]
        ordering = ["name"]

    def __str__(self):
        return self.name


# ─── Leave Request ────────────────────────────────────────────

class LeaveRequest(BaseModel):
    """
    Leave Request — employee leave application.
    Per IMPLEMENTATION_ROADMAP.md §19: Leave Management.
    """
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("cancelled", "Cancelled"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="requests")
    start_date = models.DateField()
    end_date = models.DateField()
    days = models.IntegerField(default=1)
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="approved_leaves",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.employee} — {self.leave_type} ({self.start_date} to {self.end_date})"


# ─── Payroll Period ───────────────────────────────────────────

class PayrollPeriod(BaseModel):
    """
    Payroll Period — monthly/weekly pay period.
    Per IMPLEMENTATION_ROADMAP.md §19: Payroll.
    """
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20, default="open",
        choices=[("open", "Open"), ("processing", "Processing"),
                 ("closed", "Closed")],
    )

    class Meta:
        unique_together = [("company", "name")]
        ordering = ["-start_date"]

    def __str__(self):
        return self.name


# ─── Payroll Record ───────────────────────────────────────────

class PayrollRecord(BaseModel):
    """
    Payroll Record — individual employee pay record.
    Per IMPLEMENTATION_ROADMAP.md §19: Payroll.
    """
    period = models.ForeignKey(PayrollPeriod, on_delete=models.CASCADE, related_name="records")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="payroll_records")

    # Earnings
    base_salary = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    overtime_pay = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    bonuses = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    allowances = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    total_earnings = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))

    # Deductions
    tax = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    insurance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    other_deductions = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    total_deductions = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))

    # Net
    net_pay = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=10, default="IRR")

    # Status
    status = models.CharField(
        max_length=20, default="draft",
        choices=[("draft", "Draft"), ("approved", "Approved"),
                 ("paid", "Paid")],
    )

    notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("period", "employee")]
        ordering = ["-period__start_date"]

    def __str__(self):
        return f"{self.employee} — {self.period}"

    def calculate_totals(self):
        self.total_earnings = self.base_salary + self.overtime_pay + self.bonuses + self.allowances
        self.total_deductions = self.tax + self.insurance + self.other_deductions
        self.net_pay = self.total_earnings - self.total_deductions
        self.save(update_fields=[
            "total_earnings", "total_deductions", "net_pay", "updated_at"
        ])


# ─── Performance Evaluation ───────────────────────────────────

class PerformanceEvaluation(BaseModel):
    """
    Performance Evaluation — periodic employee assessment.
    Per IMPLEMENTATION_ROADMAP.md §19: Performance Evaluation.
    """
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="evaluations")
    evaluation_date = models.DateField()
    period_label = models.CharField(max_length=50, help_text="e.g. Q1 2026, 2025 Annual")

    # Scores (1-5 scale)
    productivity_score = models.IntegerField(default=3, help_text="1-5")
    quality_score = models.IntegerField(default=3, help_text="1-5")
    teamwork_score = models.IntegerField(default=3, help_text="1-5")
    initiative_score = models.IntegerField(default=3, help_text="1-5")
    communication_score = models.IntegerField(default=3, help_text="1-5")

    overall_score = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal("3.0"))
    comments = models.TextField(blank=True, default="")
    goals = models.TextField(blank=True, default="", help_text="Goals for next period")

    evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="conducted_evaluations",
    )

    class Meta:
        ordering = ["-evaluation_date"]

    def __str__(self):
        return f"Evaluation: {self.employee} — {self.period_label}"

    def calculate_overall(self):
        scores = [
            self.productivity_score, self.quality_score,
            self.teamwork_score, self.initiative_score, self.communication_score,
        ]
        self.overall_score = Decimal(str(sum(scores) / len(scores)))
        self.save(update_fields=["overall_score", "updated_at"])


# ─── Recruitment ──────────────────────────────────────────────

class Recruitment(BaseModel):
    """
    Recruitment — job opening and candidate tracking.
    Per IMPLEMENTATION_ROADMAP.md §19: Recruitment.
    """
    STATUS_CHOICES = [
        ("open", "Open"),
        ("on_hold", "On Hold"),
        ("closed", "Closed"),
        ("cancelled", "Cancelled"),
    ]
    CANDIDATE_STATUS_CHOICES = [
        ("new", "New"),
        ("screening", "Screening"),
        ("interview", "Interview"),
        ("offer", "Offer"),
        ("hired", "Hired"),
        ("rejected", "Rejected"),
    ]

    # Job details
    title = models.CharField(max_length=200)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="recruitments")
    description = models.TextField(blank=True, default="")
    requirements = models.TextField(blank=True, default="")
    salary_range_min = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    salary_range_max = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    positions_count = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")

    # Dates
    posted_date = models.DateField(null=True, blank=True)
    deadline_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-posted_date"]

    def __str__(self):
        return f"Recruitment: {self.title} ({self.get_status_display()})"


class Candidate(BaseModel):
    """
    Candidate — job applicant.
    Per IMPLEMENTATION_ROADMAP.md §19: Recruitment.
    """
    recruitment = models.ForeignKey(Recruitment, on_delete=models.CASCADE, related_name="candidates")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    resume = models.FileField(upload_to="resumes/", blank=True, null=True)
    cover_letter = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Recruitment.CANDIDATE_STATUS_CHOICES, default="new")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
