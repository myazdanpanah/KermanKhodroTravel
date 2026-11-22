"""
CRM Services — Business logic for customer relationship management.
Per IMPLEMENTATION_ROADMAP.md §18.
"""

import logging
from decimal import Decimal
from datetime import timedelta
from typing import Dict, List, Optional

from django.db import transaction
from django.db.models import Q, Sum, Count
from django.utils import timezone

from apps.finance.exceptions import ValidationError
from .models import (
    Lead, Opportunity, Activity, Campaign, CRMTask, CustomerTimeline,
)

logger = logging.getLogger(__name__)


# ─── Lead Service ─────────────────────────────────────────────

class LeadService:
    """Manage lead lifecycle."""

    @staticmethod
    def create_lead(
        company, name: str, user=None,
        email: str = "", phone: str = "", mobile: str = "",
        company_name: str = "", source: str = "other",
        industry: str = "", priority: str = "medium",
        notes: str = "", assigned_to_id: int = None,
        website: str = "", address: str = "",
    ) -> Lead:
        lead = Lead.objects.create(
            company=company,
            name=name,
            email=email,
            phone=phone,
            mobile=mobile,
            website=website,
            address=address,
            company_name=company_name,
            source=source,
            industry=industry,
            priority=priority,
            notes=notes,
            assigned_to_id=assigned_to_id,
            created_by=user,
        )
        logger.info(f"Lead '{name}' created")
        return lead

    @staticmethod
    def convert_lead(company, lead_id: int, user=None) -> Dict:
        """Convert a lead to customer + opportunity."""
        from apps.finance.models import Customer

        lead = Lead.objects.get(pk=lead_id, company=company)
        if lead.status == "converted":
            raise ValidationError("Lead is already converted")

        with transaction.atomic():
            # Create customer
            customer = Customer.objects.create(
                company=company,
                name=lead.name,
            )

            # Create opportunity
            opportunity = Opportunity.objects.create(
                company=company,
                name=f"Deal: {lead.name}",
                customer=customer,
                lead=lead,
                source=lead.source,
                assigned_to=lead.assigned_to,
                created_by=user,
            )

            # Update lead
            lead.status = "converted"
            lead.converted_customer = customer
            lead.converted_at = timezone.now()
            lead.save(update_fields=[
                "status", "converted_customer", "converted_at", "updated_at"
            ])

            # Timeline
            CustomerTimeline.objects.create(
                company=company,
                customer=customer,
                entity_type="lead",
                entity_id=lead.id,
                entity_label=lead.name,
                event_type="converted",
                description=f"Lead '{lead.name}' converted to customer",
                performed_by=user,
            )

        return {"customer": customer, "opportunity": opportunity, "lead": lead}

    @staticmethod
    def get_summary(company) -> Dict:
        qs = Lead.objects.filter(company=company)
        return {
            "total": qs.count(),
            "new": qs.filter(status="new").count(),
            "contacted": qs.filter(status="contacted").count(),
            "qualified": qs.filter(status="qualified").count(),
            "converted": qs.filter(status="converted").count(),
            "lost": qs.filter(status="lost").count(),
        }


# ─── Opportunity Service ──────────────────────────────────────

# `status` is the funnel the pipeline board moves cards through; `stage` is
# the legacy reporting funnel. Keep them derived from one another so the board
# and the CRM dashboard cannot disagree.
STATUS_TO_STAGE = {
    "prospecting": "lead",
    "qualification": "qualified",
    "proposal": "proposal_sent",
    "negotiation": "verbal_agreement",
    "closed_won": "closed",
    "closed_lost": "closed",
}


class OpportunityService:
    """Manage opportunity lifecycle."""

    @staticmethod
    def create_opportunity(
        company, name: str, user=None,
        customer_id: int = None, lead_id: int = None,
        estimated_value: Decimal = Decimal("0"),
        probability: int = 0,
        expected_close_date=None,
        source: str = "other",
        description: str = "",
        assigned_to_id: int = None,
    ) -> Opportunity:
        opp = Opportunity.objects.create(
            company=company,
            name=name,
            customer_id=customer_id,
            lead_id=lead_id,
            estimated_value=estimated_value,
            probability=probability,
            expected_close_date=expected_close_date,
            source=source,
            description=description,
            assigned_to_id=assigned_to_id,
            created_by=user,
        )
        logger.info(f"Opportunity '{name}' created")
        return opp

    @staticmethod
    def close_won(company, opp_id: int, user=None) -> Opportunity:
        opp = Opportunity.objects.get(pk=opp_id, company=company)
        if opp.status in ("closed_won", "closed_lost"):
            raise ValidationError("Opportunity is already closed")
        opp.status = "closed_won"
        opp.stage = STATUS_TO_STAGE["closed_won"]
        opp.actual_close_date = timezone.now().date()
        opp.probability = 100
        opp.save()
        OpportunityService._log_status_event(
            company, opp, "closed_won", "Opportunity closed won", user
        )
        return opp

    @staticmethod
    def close_lost(company, opp_id: int, reason: str = "", user=None) -> Opportunity:
        opp = Opportunity.objects.get(pk=opp_id, company=company)
        if opp.status in ("closed_won", "closed_lost"):
            raise ValidationError("Opportunity is already closed")
        opp.status = "closed_lost"
        opp.stage = STATUS_TO_STAGE["closed_lost"]
        opp.actual_close_date = timezone.now().date()
        opp.loss_reason = reason
        opp.probability = 0
        opp.save()
        OpportunityService._log_status_event(
            company, opp, "closed_lost", "Opportunity closed lost", user
        )
        return opp

    # Statuses a pipeline board may move a card between. Closing a deal is a
    # different operation (close_won/close_lost) because it stamps dates and
    # revenue, so a plain move must never reach those two states.
    OPEN_STATUSES = ("prospecting", "qualification", "proposal", "negotiation")

    @staticmethod
    def move_status(company, opp_id: int, status_value: str, user=None) -> Opportunity:
        """Move an open opportunity to another open funnel stage."""
        opp = Opportunity.objects.get(pk=opp_id, company=company)
        if opp.status in ("closed_won", "closed_lost"):
            raise ValidationError("Opportunity is already closed")
        if status_value in ("closed_won", "closed_lost"):
            raise ValidationError("Use close-won or close-lost to close an opportunity")
        if status_value not in OpportunityService.OPEN_STATUSES:
            raise ValidationError(f"Unknown opportunity status: {status_value}")
        if status_value == opp.status:
            return opp

        previous = opp.status
        opp.status = status_value
        opp.stage = STATUS_TO_STAGE[status_value]
        opp.save(update_fields=["status", "stage", "weighted_value", "updated_at"])
        OpportunityService._log_status_event(
            company, opp, "status_changed",
            f"Opportunity moved from {previous} to {status_value}", user,
        )
        return opp

    @staticmethod
    def _log_status_event(company, opp: Opportunity, event_type: str, description: str, user=None):
        """The customer's history keeps lifecycle changes, like lead conversion."""
        if not opp.customer_id:
            return
        CustomerTimeline.objects.create(
            company=company,
            customer_id=opp.customer_id,
            entity_type="opportunity",
            entity_id=opp.id,
            entity_label=opp.name,
            event_type=event_type,
            description=description,
            performed_by=user,
        )

    @staticmethod
    def get_pipeline(company) -> Dict:
        opps = Opportunity.objects.filter(company=company).exclude(
            status__in=("closed_won", "closed_lost")
        )
        return {
            "total_opportunities": opps.count(),
            "total_value": opps.aggregate(total=Sum("estimated_value"))["total"] or Decimal("0"),
            "weighted_value": opps.aggregate(total=Sum("weighted_value"))["total"] or Decimal("0"),
            "by_stage": {
                stage: opps.filter(stage=stage).count()
                for stage, _ in Opportunity.STAGE_CHOICES
            },
            "won_count": Opportunity.objects.filter(company=company, status="closed_won").count(),
            "won_value": Opportunity.objects.filter(
                company=company, status="closed_won"
            ).aggregate(total=Sum("estimated_value"))["total"] or Decimal("0"),
            "lost_count": Opportunity.objects.filter(company=company, status="closed_lost").count(),
        }


# ─── Activity Service ─────────────────────────────────────────

class ActivityService:
    """Manage CRM activities."""

    @staticmethod
    def create_activity(
        company, activity_type: str, subject: str, user=None,
        description: str = "", status: str = "planned", priority: str = "medium",
        lead_id: int = None, opportunity_id: int = None,
        customer_id: int = None, due_date=None,
        assigned_to_id: int = None,
    ) -> Activity:
        activity = Activity.objects.create(
            company=company,
            activity_type=activity_type,
            subject=subject,
            description=description,
            status=status,
            priority=priority,
            lead_id=lead_id,
            opportunity_id=opportunity_id,
            customer_id=customer_id,
            due_date=due_date,
            assigned_to_id=assigned_to_id,
            created_by=user,
        )
        return activity

    @staticmethod
    def complete_activity(company, activity_id: int, outcome: str = "") -> Activity:
        activity = Activity.objects.get(pk=activity_id, company=company)
        activity.status = "completed"
        activity.completed_at = timezone.now()
        activity.outcome = outcome
        activity.save()
        return activity


# ─── Campaign Service ─────────────────────────────────────────

class CampaignService:
    """Manage marketing campaigns."""

    @staticmethod
    def create_campaign(
        company, name: str, user=None,
        campaign_type: str = "email",
        description: str = "",
        budget: Decimal = Decimal("0"),
        start_date=None, end_date=None,
        expected_leads: int = 0,
        expected_revenue: Decimal = Decimal("0"),
        assigned_to_id: int = None,
    ) -> Campaign:
        campaign = Campaign.objects.create(
            company=company,
            name=name,
            campaign_type=campaign_type,
            description=description,
            budget=budget,
            start_date=start_date,
            end_date=end_date,
            expected_leads=expected_leads,
            expected_revenue=expected_revenue,
            assigned_to_id=assigned_to_id,
            created_by=user,
        )
        return campaign

    @staticmethod
    def activate_campaign(company, campaign_id: int) -> Campaign:
        campaign = Campaign.objects.get(pk=campaign_id, company=company)
        if campaign.status != "draft":
            raise ValidationError("Only draft campaigns can be activated")
        campaign.status = "active"
        campaign.save(update_fields=["status", "updated_at"])
        return campaign


# ─── Task Service ─────────────────────────────────────────────

class CRMTaskService:
    """Manage CRM tasks."""

    @staticmethod
    def create_task(
        company, title: str, user=None,
        description: str = "", priority: str = "medium", status: str = "todo",
        lead_id: int = None, opportunity_id: int = None,
        customer_id: int = None, due_date=None,
        assigned_to_id: int = None,
    ) -> CRMTask:
        task = CRMTask.objects.create(
            company=company,
            title=title,
            description=description,
            priority=priority,
            status=status,
            lead_id=lead_id,
            opportunity_id=opportunity_id,
            customer_id=customer_id,
            due_date=due_date,
            assigned_to_id=assigned_to_id,
            created_by=user,
        )
        return task

    @staticmethod
    def complete_task(company, task_id: int) -> CRMTask:
        task = CRMTask.objects.get(pk=task_id, company=company)
        task.status = "completed"
        task.completed_at = timezone.now()
        task.save()
        return task
