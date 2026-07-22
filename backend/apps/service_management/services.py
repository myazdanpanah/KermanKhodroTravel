"""
Service Management Services — Business logic for after-sales lifecycle.

Per SERVICE_MANAGEMENT_MODULE.md:
- §4: Service Request lifecycle
- §5: Warranty validation
- §9: Work Order management
- §11: Spare Parts integration
- §13: SLA enforcement
- §15: Service Costing
- §17: Accounting integration
"""

import logging
from decimal import Decimal
from datetime import timedelta
from typing import Dict, List, Optional

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.finance.exceptions import ValidationError
from .models import (
    ServiceRequest, Warranty, Technician, WorkOrder, WorkOrderOperation,
    ServiceContract, SLARule, MaintenancePlan, MaintenanceSchedule,
    ServicePart, ServiceFeedback,
)

logger = logging.getLogger(__name__)


# ─── Service Request Service ──────────────────────────────────

class ServiceRequestService:
    """
    Manage the full lifecycle of service requests.
    Per SERVICE_MANAGEMENT_MODULE.md §4.
    """

    @staticmethod
    @transaction.atomic
    def create_request(
        company,
        customer_id: int,
        product_name: str,
        problem_description: str,
        user=None,
        product_code: str = "",
        serial_number: str = "",
        priority: str = "medium",
        notes: str = "",
    ) -> ServiceRequest:
        """Create a new service request."""
        from apps.finance.models import Customer
        from django.shortcuts import get_object_or_404
        customer = get_object_or_404(Customer, pk=customer_id, company=company)

        # Auto-generate request number
        last = ServiceRequest.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        request_number = f"SR-{next_num:05d}"

        # Check warranty
        warranty = None
        if serial_number:
            warranty = Warranty.objects.filter(
                company=company,
                serial_number=serial_number,
                status="active",
            ).first()

        # Apply SLA
        sla_response_deadline = None
        sla_resolution_deadline = None
        sla = SLARule.objects.filter(
            company=company, is_active=True, priority=priority
        ).first()
        if sla:
            now = timezone.now()
            sla_response_deadline = now + timedelta(hours=sla.response_time_hours)
            sla_resolution_deadline = now + timedelta(hours=sla.resolution_time_hours)

        request = ServiceRequest.objects.create(
            company=company,
            request_number=request_number,
            customer=customer,
            product_name=product_name,
            product_code=product_code,
            serial_number=serial_number,
            problem_description=problem_description,
            priority=priority,
            notes=notes,
            warranty=warranty,
            sla_response_deadline=sla_response_deadline,
            sla_resolution_deadline=sla_resolution_deadline,
            created_by=user,
        )

        logger.info(f"Service Request #{request_number} created for {customer}")
        return request

    @staticmethod
    def assign_technician(
        company, request_id: int, technician_id: int, user=None
    ) -> ServiceRequest:
        """Assign a technician to a service request."""
        request = ServiceRequest.objects.get(pk=request_id, company=company)
        technician = Technician.objects.get(pk=technician_id, company=company)

        request.assigned_technician = technician
        request.assigned_to = technician.user
        request.status = "assigned"
        request.save(update_fields=["assigned_technician", "assigned_to", "status", "updated_at"])

        logger.info(f"SR #{request.request_number} assigned to {technician.name}")
        return request

    @staticmethod
    def update_status(
        company, request_id: int, new_status: str, user=None
    ) -> ServiceRequest:
        """Transition service request status."""
        request = ServiceRequest.objects.get(pk=request_id, company=company)
        valid_transitions = {
            "new": ["assigned", "cancelled"],
            "assigned": ["in_progress", "cancelled"],
            "in_progress": ["waiting_customer", "waiting_parts", "completed"],
            "waiting_customer": ["in_progress", "cancelled"],
            "waiting_parts": ["in_progress"],
            "completed": ["closed"],
            "closed": [],
            "cancelled": [],
        }
        if new_status not in valid_transitions.get(request.status, []):
            raise ValidationError(
                f"Cannot transition from '{request.status}' to '{new_status}'"
            )

        request.status = new_status
        update_fields = ["status", "updated_at"]

        if new_status == "completed":
            request.resolved_date = timezone.now()
            update_fields.append("resolved_date")
            # Check SLA resolution
            if request.sla_resolution_deadline:
                request.sla_resolution_met = timezone.now() <= request.sla_resolution_deadline
                update_fields.append("sla_resolution_met")
        elif new_status == "closed":
            request.closed_date = timezone.now()
            update_fields.append("closed_date")
        elif new_status == "in_progress" and not request.sla_response_met:
            # First move to in_progress means response SLA met
            if request.sla_response_deadline:
                request.sla_response_met = timezone.now() <= request.sla_response_deadline
                update_fields.append("sla_response_met")

        request.save(update_fields=update_fields)
        return request

    @staticmethod
    def get_summary(company) -> Dict:
        """Get service request summary for dashboard."""
        from django.db.models import Count
        qs = ServiceRequest.objects.filter(company=company)
        return {
            "total": qs.count(),
            "new": qs.filter(status="new").count(),
            "assigned": qs.filter(status="assigned").count(),
            "in_progress": qs.filter(status="in_progress").count(),
            "waiting_parts": qs.filter(status="waiting_parts").count(),
            "completed": qs.filter(status="completed").count(),
            "closed": qs.filter(status="closed").count(),
            "sla_breaches": qs.filter(
                sla_resolution_met=False, status__in=["in_progress", "completed"]
            ).count(),
        }


# ─── Warranty Service ─────────────────────────────────────────

class WarrantyService:
    """
    Manage warranty lifecycle.
    Per SERVICE_MANAGEMENT_MODULE.md §5-§6: Warranty Management & Validation.
    """

    @staticmethod
    def create_warranty(
        company,
        customer_id: int,
        product_name: str,
        start_date,
        end_date,
        user=None,
        product_code: str = "",
        serial_number: str = "",
        warranty_type: str = "manufacturer",
        notes: str = "",
    ) -> Warranty:
        """Register a new warranty."""
        from apps.finance.models import Customer
        from django.shortcuts import get_object_or_404
        get_object_or_404(Customer, pk=customer_id, company=company)

        warranty = Warranty.objects.create(
            company=company,
            customer_id=customer_id,
            product_name=product_name,
            product_code=product_code,
            serial_number=serial_number,
            warranty_type=warranty_type,
            start_date=start_date,
            end_date=end_date,
            notes=notes,
            created_by=user,
        )
        logger.info(f"Warranty created for {product_name} (SN: {serial_number})")
        return warranty

    @staticmethod
    def validate_warranty(company, serial_number: str) -> Dict:
        """Check if a warranty covers the product."""
        warranty = Warranty.objects.filter(
            company=company,
            serial_number=serial_number,
            status="active",
        ).first()
        if not warranty:
            return {"covered": False, "reason": "No active warranty found"}
        return warranty.validate_warranty()

    @staticmethod
    def expire_warranties(company):
        """Batch expire warranties past their end date."""
        today = timezone.now().date()
        expired = Warranty.objects.filter(
            company=company,
            status="active",
            end_date__lt=today,
        ).update(status="expired")
        return expired


# ─── Technician Service ───────────────────────────────────────

class TechnicianService:
    """
    Manage technician records.
    Per SERVICE_MANAGEMENT_MODULE.md §10: Technician Management.
    """

    @staticmethod
    def create_technician(
        company,
        name: str,
        user=None,
        employee_id: str = "",
        department: str = "",
        phone: str = "",
        skills: str = "",
        hourly_rate: Decimal = Decimal("0.00"),
    ) -> Technician:
        tech = Technician.objects.create(
            company=company,
            name=name,
            employee_id=employee_id,
            department=department,
            phone=phone,
            skills=skills,
            hourly_rate=hourly_rate,
            created_by=user,
        )
        logger.info(f"Technician {name} created")
        return tech

    @staticmethod
    def find_by_skill(company, skill: str):
        """Find technicians with a specific skill."""
        return Technician.objects.filter(
            company=company,
            is_active=True,
            skills__icontains=skill,
        )

    @staticmethod
    def get_available_technicians(company):
        """Get all active technicians."""
        return Technician.objects.filter(company=company, is_active=True)


# ─── Work Order Service ───────────────────────────────────────

class WorkOrderService:
    """
    Manage work order lifecycle.
    Per SERVICE_MANAGEMENT_MODULE.md §9: Work Order Management.
    """

    @staticmethod
    @transaction.atomic
    def create_work_order(
        company,
        service_request_id: int,
        user=None,
        technician_id: int = None,
        problem: str = "",
        estimated_cost: Decimal = Decimal("0.00"),
        estimated_hours: Decimal = Decimal("0.00"),
        notes: str = "",
    ) -> WorkOrder:
        """Create a work order for a service request."""
        service_request = ServiceRequest.objects.get(pk=service_request_id, company=company)

        last = WorkOrder.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        work_order_number = f"WO-{next_num:05d}"

        wo = WorkOrder.objects.create(
            company=company,
            work_order_number=work_order_number,
            service_request=service_request,
            technician_id=technician_id,
            problem=problem,
            estimated_cost=estimated_cost,
            estimated_hours=estimated_hours,
            notes=notes,
            created_by=user,
        )

        # Auto-update service request
        service_request.status = "in_progress"
        service_request.save(update_fields=["status", "updated_at"])

        logger.info(f"Work Order #{work_order_number} created for SR #{service_request.request_number}")
        return wo

    @staticmethod
    def start_work(company, wo_id: int) -> WorkOrder:
        wo = WorkOrder.objects.get(pk=wo_id, company=company)
        if wo.status not in ("created", "assigned"):
            raise ValidationError(f"Cannot start work order in '{wo.status}' status")
        wo.status = "started"
        wo.start_date = timezone.now()
        wo.save(update_fields=["status", "start_date", "updated_at"])
        return wo

    @staticmethod
    def complete_work(company, wo_id: int) -> WorkOrder:
        wo = WorkOrder.objects.get(pk=wo_id, company=company)
        if wo.status != "started":
            raise ValidationError("Work order must be started to complete")
        wo.status = "completed"
        wo.completed_date = timezone.now()
        wo.calculate_total_cost()
        wo.save(update_fields=["status", "completed_date", "updated_at"])

        # Complete the service request
        ServiceRequestService.update_status(
            company, wo.service_request_id, "completed"
        )
        return wo

    @staticmethod
    @transaction.atomic
    def approve_work(company, wo_id: int, user=None) -> WorkOrder:
        wo = WorkOrder.objects.get(pk=wo_id, company=company)
        if wo.status != "completed":
            raise ValidationError("Work order must be completed to approve")
        wo.status = "approved"
        wo.approved_date = timezone.now()
        wo.save(update_fields=["status", "approved_date", "updated_at"])
        return wo


# ─── Service Contract Service ─────────────────────────────────

class ServiceContractService:
    """
    Manage service contracts.
    Per SERVICE_MANAGEMENT_MODULE.md §12: Service Contract Management.
    """

    @staticmethod
    def create_contract(
        company,
        customer_id: int,
        start_date,
        end_date,
        user=None,
        contract_type: str = "maintenance",
        coverage_description: str = "",
        sla_level: str = "standard",
        price: Decimal = Decimal("0.00"),
        billing_cycle: str = "monthly",
        notes: str = "",
    ) -> ServiceContract:
        from apps.finance.models import Customer
        from django.shortcuts import get_object_or_404
        get_object_or_404(Customer, pk=customer_id, company=company)

        last = ServiceContract.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        contract_number = f"SC-{next_num:05d}"

        contract = ServiceContract.objects.create(
            company=company,
            contract_number=contract_number,
            customer_id=customer_id,
            contract_type=contract_type,
            start_date=start_date,
            end_date=end_date,
            coverage_description=coverage_description,
            sla_level=sla_level,
            price=price,
            billing_cycle=billing_cycle,
            notes=notes,
            created_by=user,
        )
        logger.info(f"Service Contract #{contract_number} created")
        return contract

    @staticmethod
    def activate_contract(company, contract_id: int) -> ServiceContract:
        contract = ServiceContract.objects.get(pk=contract_id, company=company)
        if contract.status != "draft":
            raise ValidationError("Only draft contracts can be activated")
        contract.status = "active"
        contract.save(update_fields=["status", "updated_at"])
        return contract

    @staticmethod
    def expire_contracts(company):
        """Batch expire contracts past their end date."""
        today = timezone.now().date()
        return ServiceContract.objects.filter(
            company=company, status="active", end_date__lt=today,
        ).update(status="expired")


# ─── SLA Service ──────────────────────────────────────────────

class SLAService:
    """Manage SLA rules and check compliance."""

    @staticmethod
    def create_rule(
        company,
        name: str,
        priority: str = "medium",
        response_time_hours: int = 24,
        resolution_time_hours: int = 72,
        working_hours_start: int = 8,
        working_hours_end: int = 17,
        escalate_after_hours: int = None,
        user=None,
    ) -> SLARule:
        rule = SLARule.objects.create(
            company=company,
            name=name,
            priority=priority,
            response_time_hours=response_time_hours,
            resolution_time_hours=resolution_time_hours,
            working_hours_start=working_hours_start,
            working_hours_end=working_hours_end,
            escalate_after_hours=escalate_after_hours,
            created_by=user,
        )
        return rule

    @staticmethod
    def check_compliance(company) -> Dict:
        """Check SLA compliance for all open requests."""
        open_requests = ServiceRequest.objects.filter(
            company=company,
            status__in=["new", "assigned", "in_progress", "waiting_parts", "waiting_customer"],
        )
        now = timezone.now()
        breaches = []
        for req in open_requests:
            if req.sla_response_deadline and not req.sla_response_met:
                if now > req.sla_response_deadline:
                    breaches.append({
                        "type": "response",
                        "request": req.request_number,
                        "deadline": req.sla_response_deadline,
                    })
            if req.sla_resolution_deadline and not req.sla_resolution_met:
                if now > req.sla_resolution_deadline:
                    breaches.append({
                        "type": "resolution",
                        "request": req.request_number,
                        "deadline": req.sla_resolution_deadline,
                    })
        return {
            "total_open": open_requests.count(),
            "breaches": breaches,
            "breach_count": len(breaches),
        }


# ─── Maintenance Service ──────────────────────────────────────

class MaintenanceService:
    """
    Preventive maintenance management.
    Per SERVICE_MANAGEMENT_MODULE.md §14: Preventive Maintenance.
    """

    @staticmethod
    def create_plan(
        company,
        name: str,
        maintenance_type: str = "time_based",
        interval_days: int = 90,
        user=None,
        product_name: str = "",
        product_code: str = "",
        checklist: str = "",
        estimated_cost: Decimal = Decimal("0.00"),
        assigned_technician_id: int = None,
    ) -> MaintenancePlan:
        from django.utils import timezone as tz
        today = tz.now().date()
        from datetime import timedelta

        plan = MaintenancePlan.objects.create(
            company=company,
            name=name,
            product_name=product_name,
            product_code=product_code,
            maintenance_type=maintenance_type,
            interval_days=interval_days,
            last_maintenance_date=today,
            next_maintenance_date=today + timedelta(days=interval_days),
            checklist=checklist,
            estimated_cost=estimated_cost,
            assigned_technician_id=assigned_technician_id,
            created_by=user,
        )
        return plan

    @staticmethod
    def generate_schedules(company):
        """Generate upcoming maintenance schedules for all active plans."""
        plans = MaintenancePlan.objects.filter(company=company, status="active")
        created = 0
        for plan in plans:
            if plan.next_maintenance_date:
                exists = MaintenanceSchedule.objects.filter(
                    plan=plan, scheduled_date=plan.next_maintenance_date
                ).exists()
                if not exists:
                    MaintenanceSchedule.objects.create(
                        company=company,
                        plan=plan,
                        scheduled_date=plan.next_maintenance_date,
                    )
                    created += 1
        return created

    @staticmethod
    def complete_maintenance(company, schedule_id: int, user=None) -> MaintenanceSchedule:
        schedule = MaintenanceSchedule.objects.get(pk=schedule_id, company=company)
        schedule.status = "completed"
        schedule.completed_date = timezone.now().date()
        schedule.save(update_fields=["status", "completed_date", "updated_at"])

        # Update plan
        plan = schedule.plan
        plan.last_maintenance_date = schedule.completed_date
        from datetime import timedelta
        plan.next_maintenance_date = schedule.completed_date + timedelta(days=plan.interval_days)
        plan.save(update_fields=["last_maintenance_date", "next_maintenance_date", "updated_at"])

        return schedule


# ─── Service Part Service ─────────────────────────────────────

class ServicePartService:
    """Manage spare parts consumption for work orders."""

    @staticmethod
    def record_parts_usage(
        company,
        work_order_id: int,
        parts_data: List[Dict],
        user=None,
    ) -> List[ServicePart]:
        """Record parts consumed in a work order."""
        wo = WorkOrder.objects.get(pk=work_order_id, company=company)
        parts = []
        for p_data in parts_data:
            part = ServicePart.objects.create(
                company=company,
                work_order=wo,
                product_name=p_data["product_name"],
                product_code=p_data.get("product_code", ""),
                quantity=Decimal(str(p_data["quantity"])),
                unit=p_data.get("unit", "عدد"),
                unit_cost=Decimal(str(p_data.get("unit_cost", 0))),
                notes=p_data.get("notes", ""),
                created_by=user,
            )
            parts.append(part)

        # Update work order parts cost
        wo.actual_parts_cost = sum(p.total_cost for p in parts)
        wo.save(update_fields=["actual_parts_cost", "updated_at"])

        return parts


# ─── Service Feedback Service ─────────────────────────────────

class ServiceFeedbackService:
    """Capture customer feedback on completed service."""

    @staticmethod
    def submit_feedback(
        company,
        work_order_id: int,
        rating: int,
        comment: str = "",
    ) -> ServiceFeedback:
        wo = WorkOrder.objects.get(pk=work_order_id, company=company)
        if wo.status not in ("completed", "approved", "closed"):
            raise ValidationError("Work order must be completed to receive feedback")
        if rating < 1 or rating > 5:
            raise ValidationError("Rating must be between 1 and 5")

        feedback, created = ServiceFeedback.objects.update_or_create(
            work_order=wo,
            defaults={"company": wo.company, "rating": rating, "comment": comment},
        )
        return feedback
