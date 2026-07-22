"""
Service Management Serializers — REST API serialization.
Per API_SPECIFICATION.md §6-§8: Standard response format.
"""

from rest_framework import serializers
from .models import (
    ServiceRequest, Warranty, Technician, WorkOrder, WorkOrderOperation,
    ServiceContract, SLARule, MaintenancePlan, MaintenanceSchedule,
    ServicePart, ServiceFeedback,
)


# ─── Service Request ──────────────────────────────────────────

class ServiceRequestSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    assigned_technician_name = serializers.CharField(source="assigned_technician.name", read_only=True, default="")
    warranty_status = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = [
            "id", "request_number", "customer", "customer_name",
            "product_name", "product_code", "serial_number",
            "problem_description", "priority", "status",
            "assigned_to", "assigned_technician", "assigned_technician_name",
            "warranty", "warranty_status",
            "received_date", "resolved_date", "closed_date",
            "sla_response_deadline", "sla_resolution_deadline",
            "sla_response_met", "sla_resolution_met",
            "is_chargeable", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "request_number", "sla_response_deadline", "sla_resolution_deadline",
            "sla_response_met", "sla_resolution_met",
            "resolved_date", "closed_date",
        ]

    def get_warranty_status(self, obj):
        if obj.warranty:
            return "active" if obj.warranty.is_active else "expired"
        return None


class ServiceRequestCreateSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    product_name = serializers.CharField(max_length=200)
    product_code = serializers.CharField(max_length=50, required=False, default="")
    serial_number = serializers.CharField(max_length=100, required=False, default="")
    problem_description = serializers.CharField()
    priority = serializers.ChoiceField(choices=ServiceRequest.PRIORITY_CHOICES, default="medium")
    notes = serializers.CharField(required=False, default="")


# ─── Warranty ─────────────────────────────────────────────────

class WarrantySerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Warranty
        fields = [
            "id", "customer", "customer_name",
            "product_name", "product_code", "serial_number",
            "warranty_type", "status",
            "start_date", "end_date", "is_active", "notes",
            "created_at", "updated_at",
        ]


class WarrantyCreateSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    product_name = serializers.CharField(max_length=200)
    product_code = serializers.CharField(max_length=50, required=False, default="")
    serial_number = serializers.CharField(max_length=100, required=False, default="")
    warranty_type = serializers.ChoiceField(choices=Warranty.TYPE_CHOICES, default="manufacturer")
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    notes = serializers.CharField(required=False, default="")


# ─── Technician ───────────────────────────────────────────────

class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technician
        fields = [
            "id", "name", "employee_id", "department", "phone",
            "skills", "hourly_rate", "is_active", "performance_score",
            "created_at", "updated_at",
        ]


# ─── Work Order ───────────────────────────────────────────────

class WorkOrderOperationSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkOrderOperation
        fields = [
            "id", "sequence", "name", "description",
            "labor_hours", "parts_used", "status", "completed_at",
        ]


class WorkOrderSerializer(serializers.ModelSerializer):
    service_request_number = serializers.CharField(
        source="service_request.request_number", read_only=True
    )
    technician_name = serializers.CharField(source="technician.name", read_only=True, default="")
    operations = WorkOrderOperationSerializer(many=True, read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            "id", "work_order_number", "service_request", "service_request_number",
            "technician", "technician_name",
            "problem", "diagnosis", "resolution", "required_parts",
            "estimated_cost", "actual_labor_cost", "actual_parts_cost",
            "actual_external_cost", "actual_overhead", "actual_total_cost",
            "estimated_hours", "actual_hours",
            "status", "start_date", "completed_date", "approved_date",
            "operations", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "work_order_number", "actual_total_cost",
            "start_date", "completed_date", "approved_date",
        ]


class WorkOrderCreateSerializer(serializers.Serializer):
    service_request_id = serializers.IntegerField()
    technician_id = serializers.IntegerField(required=False, allow_null=True)
    problem = serializers.CharField(required=False, default="")
    estimated_cost = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    estimated_hours = serializers.DecimalField(max_digits=8, decimal_places=2, default=0)
    notes = serializers.CharField(required=False, default="")


# ─── Service Contract ─────────────────────────────────────────

class ServiceContractSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = ServiceContract
        fields = [
            "id", "contract_number", "customer", "customer_name",
            "contract_type", "status",
            "start_date", "end_date",
            "coverage_description", "sla_level",
            "price", "billing_cycle", "currency",
            "notes", "created_at", "updated_at",
        ]
        read_only_fields = ["contract_number"]


class ServiceContractCreateSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    contract_type = serializers.ChoiceField(choices=ServiceContract.TYPE_CHOICES, default="maintenance")
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    coverage_description = serializers.CharField(required=False, default="")
    sla_level = serializers.CharField(max_length=20, default="standard")
    price = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    billing_cycle = serializers.ChoiceField(choices=ServiceContract.BILLING_CHOICES, default="monthly")
    notes = serializers.CharField(required=False, default="")


# ─── SLA Rule ─────────────────────────────────────────────────

class SLARuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLARule
        fields = [
            "id", "name", "priority",
            "response_time_hours", "resolution_time_hours",
            "working_hours_start", "working_hours_end",
            "escalate_after_hours", "is_active",
            "created_at", "updated_at",
        ]


class SLARuleCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    priority = serializers.ChoiceField(choices=SLARule.PRIORITY_CHOICES, default="medium")
    response_time_hours = serializers.IntegerField(default=24)
    resolution_time_hours = serializers.IntegerField(default=72)
    working_hours_start = serializers.IntegerField(default=8)
    working_hours_end = serializers.IntegerField(default=17)
    escalate_after_hours = serializers.IntegerField(required=False, allow_null=True)


# ─── Maintenance ──────────────────────────────────────────────

class MaintenancePlanSerializer(serializers.ModelSerializer):
    assigned_technician_name = serializers.CharField(
        source="assigned_technician.name", read_only=True, default=""
    )

    class Meta:
        model = MaintenancePlan
        fields = [
            "id", "name", "product_name", "product_code",
            "maintenance_type", "status",
            "interval_days", "last_maintenance_date", "next_maintenance_date",
            "checklist", "estimated_cost",
            "assigned_technician", "assigned_technician_name",
            "created_at", "updated_at",
        ]


class MaintenanceScheduleSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source="plan.name", read_only=True)

    class Meta:
        model = MaintenanceSchedule
        fields = [
            "id", "plan", "plan_name",
            "scheduled_date", "completed_date", "status",
            "created_at", "updated_at",
        ]


# ─── Service Part ─────────────────────────────────────────────

class ServicePartSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServicePart
        fields = [
            "id", "work_order", "product_name", "product_code",
            "quantity", "unit", "unit_cost", "total_cost", "notes",
            "created_at",
        ]
        read_only_fields = ["total_cost"]


# ─── Service Feedback ─────────────────────────────────────────

class ServiceFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceFeedback
        fields = [
            "id", "work_order", "rating", "comment", "created_date",
        ]
