"""
Service Management Views — REST API endpoints.
Per API_SPECIFICATION.md §6-§8: Standard response format.
Per SERVICE_MANAGEMENT_MODULE.md §22: AI Agent rules.
"""

import logging
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.accounts.permissions import RequireModule
from apps.core.responses import (
    success_response, error_response, business_rule_error,
    not_found_response, forbidden_response,
)

from .models import (
    ServiceRequest, Warranty, Technician, WorkOrder,
    ServiceContract, SLARule, MaintenancePlan, MaintenanceSchedule,
    ServicePart, ServiceFeedback,
)
from .serializers import (
    ServiceRequestSerializer, ServiceRequestCreateSerializer,
    WarrantySerializer, WarrantyCreateSerializer,
    TechnicianSerializer,
    WorkOrderSerializer, WorkOrderCreateSerializer,
    ServiceContractSerializer, ServiceContractCreateSerializer,
    SLARuleSerializer, SLARuleCreateSerializer,
    MaintenancePlanSerializer, MaintenanceScheduleSerializer,
    ServicePartSerializer, ServiceFeedbackSerializer,
)

logger = logging.getLogger(__name__)

# ─── Module gate ──────────────────────────────────────────────
_SMPerm = RequireModule.for_module("service_management")()


def _check_module(request):
    if not _SMPerm.has_permission(request, None):
        return forbidden_response("Module 'service_management' is not enabled for your company")
    return None


# ─── Service Requests ─────────────────────────────────────────

@api_view(["GET", "POST"])
def service_request_list(request):
    gate = _check_module(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = ServiceRequest.objects.filter(company=company)
        req_status = request.query_params.get("status")
        priority = request.query_params.get("priority")
        if req_status:
            qs = qs.filter(status=req_status)
        if priority:
            qs = qs.filter(priority=priority)
        return success_response(data=ServiceRequestSerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = ServiceRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import ServiceRequestService
        sr = ServiceRequestService.create_request(
            company=company,
            user=request.user,
            **serializer.validated_data,
        )
        return success_response(
            data=ServiceRequestSerializer(sr).data,
            message="Service request created",
            http_status_code=status.HTTP_201_CREATED,
        )


@api_view(["GET", "PUT", "DELETE"])
def service_request_detail(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    try:
        sr = ServiceRequest.objects.get(pk=pk, company=request.user.company)
    except ServiceRequest.DoesNotExist:
        return not_found_response("Service request not found")
    if request.method == "GET":
        return success_response(data=ServiceRequestSerializer(sr).data)
    elif request.method == "PUT":
        for field in ["problem_description", "priority", "notes", "is_chargeable"]:
            if field in request.data:
                setattr(sr, field, request.data[field])
        sr.save()
        return success_response(data=ServiceRequestSerializer(sr).data)
    elif request.method == "DELETE":
        sr.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def service_request_assign(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    technician_id = request.data.get("technician_id")
    if not technician_id:
        return error_response("technician_id is required")
    from .services import ServiceRequestService
    try:
        sr = ServiceRequestService.assign_technician(
            company=request.user.company,
            request_id=pk,
            technician_id=technician_id,
            user=request.user,
        )
        return success_response(data=ServiceRequestSerializer(sr).data, message="Technician assigned")
    except Exception as e:
        return business_rule_error(str(e))


@api_view(["POST"])
def service_request_transition(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    new_status = request.data.get("status")
    if not new_status:
        return error_response("status is required")
    from .services import ServiceRequestService
    try:
        sr = ServiceRequestService.update_status(
            company=request.user.company,
            request_id=pk,
            new_status=new_status,
            user=request.user,
        )
        return success_response(data=ServiceRequestSerializer(sr).data, message=f"Status → {new_status}")
    except Exception as e:
        return business_rule_error(str(e))


# ─── Warranties ───────────────────────────────────────────────

@api_view(["GET", "POST"])
def warranty_list(request):
    gate = _check_module(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = Warranty.objects.filter(company=company)
        warranty_status = request.query_params.get("status")
        if warranty_status:
            qs = qs.filter(status=warranty_status)
        return success_response(data=WarrantySerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = WarrantyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import WarrantyService
        w = WarrantyService.create_warranty(
            company=company, user=request.user, **serializer.validated_data
        )
        return success_response(
            data=WarrantySerializer(w).data,
            message="Warranty registered",
            http_status_code=status.HTTP_201_CREATED,
        )


@api_view(["GET", "PUT", "DELETE"])
def warranty_detail(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    try:
        w = Warranty.objects.get(pk=pk, company=request.user.company)
    except Warranty.DoesNotExist:
        return not_found_response("Warranty not found")
    if request.method == "GET":
        return success_response(data=WarrantySerializer(w).data)
    elif request.method == "PUT":
        for field in ["warranty_type", "status", "end_date", "notes"]:
            if field in request.data:
                setattr(w, field, request.data[field])
        w.save()
        return success_response(data=WarrantySerializer(w).data)
    elif request.method == "DELETE":
        w.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def warranty_validate(request):
    gate = _check_module(request)
    if gate:
        return gate
    serial_number = request.data.get("serial_number", "")
    if not serial_number:
        return error_response("serial_number is required")
    from .services import WarrantyService
    result = WarrantyService.validate_warranty(
        company=request.user.company, serial_number=serial_number
    )
    return success_response(data=result)


# ─── Technicians ──────────────────────────────────────────────

@api_view(["GET", "POST"])
def technician_list(request):
    gate = _check_module(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = Technician.objects.filter(company=company)
        skill = request.query_params.get("skill")
        if skill:
            qs = qs.filter(skills__icontains=skill)
        return success_response(data=TechnicianSerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = TechnicianSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import TechnicianService
        tech = TechnicianService.create_technician(
            company=company, user=request.user, **serializer.validated_data
        )
        return success_response(
            data=TechnicianSerializer(tech).data,
            message="Technician created",
            http_status_code=status.HTTP_201_CREATED,
        )


@api_view(["GET", "PUT", "DELETE"])
def technician_detail(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    try:
        tech = Technician.objects.get(pk=pk, company=request.user.company)
    except Technician.DoesNotExist:
        return not_found_response("Technician not found")
    if request.method == "GET":
        return success_response(data=TechnicianSerializer(tech).data)
    elif request.method == "PUT":
        for field in ["name", "department", "phone", "skills", "hourly_rate", "is_active"]:
            if field in request.data:
                setattr(tech, field, request.data[field])
        tech.save()
        return success_response(data=TechnicianSerializer(tech).data)
    elif request.method == "DELETE":
        tech.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Work Orders ──────────────────────────────────────────────

@api_view(["GET", "POST"])
def work_order_list(request):
    gate = _check_module(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = WorkOrder.objects.filter(company=company)
        wo_status = request.query_params.get("status")
        if wo_status:
            qs = qs.filter(status=wo_status)
        return success_response(data=WorkOrderSerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = WorkOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import WorkOrderService
        wo = WorkOrderService.create_work_order(
            company=company, user=request.user, **serializer.validated_data
        )
        return success_response(
            data=WorkOrderSerializer(wo).data,
            message="Work order created",
            http_status_code=status.HTTP_201_CREATED,
        )


@api_view(["GET", "PUT", "DELETE"])
def work_order_detail(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    try:
        wo = WorkOrder.objects.get(pk=pk, company=request.user.company)
    except WorkOrder.DoesNotExist:
        return not_found_response("Work order not found")
    if request.method == "GET":
        return success_response(data=WorkOrderSerializer(wo).data)
    elif request.method == "PUT":
        for field in ["problem", "diagnosis", "resolution", "required_parts", "notes"]:
            if field in request.data:
                setattr(wo, field, request.data[field])
        for field in ["actual_labor_cost", "actual_external_cost", "actual_overhead", "actual_hours"]:
            if field in request.data:
                setattr(wo, field, Decimal(str(request.data[field])))
        wo.save()
        return success_response(data=WorkOrderSerializer(wo).data)
    elif request.method == "DELETE":
        wo.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def work_order_start(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    from .services import WorkOrderService
    try:
        wo = WorkOrderService.start_work(request.user.company, pk)
        return success_response(data=WorkOrderSerializer(wo).data, message="Work started")
    except Exception as e:
        return business_rule_error(str(e))


@api_view(["POST"])
def work_order_complete(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    from .services import WorkOrderService
    try:
        wo = WorkOrderService.complete_work(request.user.company, pk)
        return success_response(data=WorkOrderSerializer(wo).data, message="Work completed")
    except Exception as e:
        return business_rule_error(str(e))


@api_view(["POST"])
def work_order_approve(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    from .services import WorkOrderService
    try:
        wo = WorkOrderService.approve_work(request.user.company, pk, user=request.user)
        return success_response(data=WorkOrderSerializer(wo).data, message="Work approved")
    except Exception as e:
        return business_rule_error(str(e))


# ─── Service Contracts ────────────────────────────────────────

@api_view(["GET", "POST"])
def contract_list(request):
    gate = _check_module(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = ServiceContract.objects.filter(company=company)
        return success_response(data=ServiceContractSerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = ServiceContractCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import ServiceContractService
        contract = ServiceContractService.create_contract(
            company=company, user=request.user, **serializer.validated_data
        )
        return success_response(
            data=ServiceContractSerializer(contract).data,
            message="Contract created",
            http_status_code=status.HTTP_201_CREATED,
        )


@api_view(["GET", "PUT", "DELETE"])
def contract_detail(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    try:
        contract = ServiceContract.objects.get(pk=pk, company=request.user.company)
    except ServiceContract.DoesNotExist:
        return not_found_response("Contract not found")
    if request.method == "GET":
        return success_response(data=ServiceContractSerializer(contract).data)
    elif request.method == "PUT":
        for field in ["contract_type", "status", "coverage_description", "sla_level", "price", "notes"]:
            if field in request.data:
                setattr(contract, field, request.data[field])
        contract.save()
        return success_response(data=ServiceContractSerializer(contract).data)
    elif request.method == "DELETE":
        contract.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def contract_activate(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    from .services import ServiceContractService
    try:
        c = ServiceContractService.activate_contract(request.user.company, pk)
        return success_response(data=ServiceContractSerializer(c).data, message="Contract activated")
    except Exception as e:
        return business_rule_error(str(e))


# ─── SLA Rules ────────────────────────────────────────────────

@api_view(["GET", "POST"])
def sla_rule_list(request):
    gate = _check_module(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = SLARule.objects.filter(company=company)
        return success_response(data=SLARuleSerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = SLARuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import SLAService
        rule = SLAService.create_rule(
            company=company, user=request.user, **serializer.validated_data
        )
        return success_response(
            data=SLARuleSerializer(rule).data,
            message="SLA rule created",
            http_status_code=status.HTTP_201_CREATED,
        )


@api_view(["GET", "PUT", "DELETE"])
def sla_rule_detail(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    try:
        rule = SLARule.objects.get(pk=pk, company=request.user.company)
    except SLARule.DoesNotExist:
        return not_found_response("SLA rule not found")
    if request.method == "GET":
        return success_response(data=SLARuleSerializer(rule).data)
    elif request.method == "PUT":
        for field in ["name", "priority", "response_time_hours", "resolution_time_hours",
                       "working_hours_start", "working_hours_end", "escalate_after_hours", "is_active"]:
            if field in request.data:
                setattr(rule, field, request.data[field])
        rule.save()
        return success_response(data=SLARuleSerializer(rule).data)
    elif request.method == "DELETE":
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Maintenance ──────────────────────────────────────────────

@api_view(["GET", "POST"])
def maintenance_plan_list(request):
    gate = _check_module(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = MaintenancePlan.objects.filter(company=company)
        return success_response(data=MaintenancePlanSerializer(qs, many=True).data)
    elif request.method == "POST":
        data = request.data.copy()
        assigned = data.pop("assigned_technician", None)
        serializer = MaintenancePlanSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        plan = MaintenancePlan.objects.create(
            company=company,
            assigned_technician_id=assigned,
            created_by=request.user,
            **serializer.validated_data,
        )
        return success_response(
            data=MaintenancePlanSerializer(plan).data,
            message="Maintenance plan created",
            http_status_code=status.HTTP_201_CREATED,
        )


@api_view(["GET", "PUT", "DELETE"])
def maintenance_plan_detail(request, pk):
    gate = _check_module(request)
    if gate:
        return gate
    try:
        plan = MaintenancePlan.objects.get(pk=pk, company=request.user.company)
    except MaintenancePlan.DoesNotExist:
        return not_found_response("Maintenance plan not found")
    if request.method == "GET":
        return success_response(data=MaintenancePlanSerializer(plan).data)
    elif request.method == "PUT":
        for field in ["name", "status", "interval_days", "checklist", "estimated_cost"]:
            if field in request.data:
                setattr(plan, field, request.data[field])
        plan.save()
        return success_response(data=MaintenancePlanSerializer(plan).data)
    elif request.method == "DELETE":
        plan.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
def maintenance_schedule_list(request):
    gate = _check_module(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = MaintenanceSchedule.objects.filter(company=company)
        return success_response(data=MaintenanceScheduleSerializer(qs, many=True).data)
    elif request.method == "POST":
        plan_id = request.data.get("plan_id")
        scheduled_date = request.data.get("scheduled_date")
        if not plan_id or not scheduled_date:
            return error_response("plan_id and scheduled_date are required")
        schedule = MaintenanceSchedule.objects.create(
            company=company,
            plan_id=plan_id,
            scheduled_date=scheduled_date,
        )
        return success_response(
            data=MaintenanceScheduleSerializer(schedule).data,
            message="Schedule created",
            http_status_code=status.HTTP_201_CREATED,
        )


# ─── Service Parts ────────────────────────────────────────────

@api_view(["GET", "POST"])
def service_part_list(request):
    gate = _check_module(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        wo_id = request.query_params.get("work_order")
        qs = ServicePart.objects.filter(company=company)
        if wo_id:
            qs = qs.filter(work_order_id=wo_id)
        return success_response(data=ServicePartSerializer(qs, many=True).data)
    elif request.method == "POST":
        wo_id = request.data.get("work_order_id")
        parts_data = request.data.get("parts", [])
        if not wo_id or not parts_data:
            return error_response("work_order_id and parts list are required")
        from .services import ServicePartService
        parts = ServicePartService.record_parts_usage(
            company=company, work_order_id=wo_id,
            parts_data=parts_data, user=request.user,
        )
        return success_response(
            data=ServicePartSerializer(parts, many=True).data,
            message=f"{len(parts)} parts recorded",
            http_status_code=status.HTTP_201_CREATED,
        )


# ─── Feedback ─────────────────────────────────────────────────

@api_view(["POST"])
def feedback_submit(request):
    gate = _check_module(request)
    if gate:
        return gate
    wo_id = request.data.get("work_order_id")
    rating = request.data.get("rating")
    comment = request.data.get("comment", "")
    if not wo_id or not rating:
        return error_response("work_order_id and rating are required")
    from .services import ServiceFeedbackService
    try:
        fb = ServiceFeedbackService.submit_feedback(
            company=request.user.company,
            work_order_id=wo_id,
            rating=int(rating),
            comment=comment,
        )
        return success_response(
            data=ServiceFeedbackSerializer(fb).data,
            message="Feedback submitted",
            http_status_code=status.HTTP_201_CREATED,
        )
    except Exception as e:
        return business_rule_error(str(e))


# ─── Summary / Dashboard ──────────────────────────────────────

@api_view(["GET"])
def service_summary(request):
    gate = _check_module(request)
    if gate:
        return gate
    from .services import ServiceRequestService, SLAService
    company = request.user.company
    summary = ServiceRequestService.get_summary(company)
    sla = SLAService.check_compliance(company)
    return success_response(data={**summary, "sla": sla})
