"""
CRM Views — REST API endpoints.
Per IMPLEMENTATION_ROADMAP.md §18: CRM APIs.
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.accounts.permissions import RequireModule
from apps.core.responses import (
    success_response, error_response, business_rule_error,
    not_found_response, forbidden_response,
)

from .models import Lead, Opportunity, Activity, Campaign, CRMTask, CustomerTimeline
from .serializers import (
    LeadSerializer, LeadCreateSerializer,
    OpportunitySerializer, OpportunityCreateSerializer,
    ActivitySerializer, CampaignSerializer,
    CRMTaskSerializer, CustomerTimelineSerializer,
)

logger = logging.getLogger(__name__)

_CRMPerm = RequireModule.for_module("crm")()


def _check_crm(request):
    if not _CRMPerm.has_permission(request, None):
        return forbidden_response("Module 'crm' is not enabled")
    return None


def _linked_opportunity(data, company):
    """Take `opportunity_id` out of the payload and scope it to the company.

    Raw FK fields are dropped: a client must not be able to attach a record to
    another company's lead, customer or opportunity.
    """
    for field in ("lead", "opportunity", "customer", "assigned_to", "campaign"):
        data.pop(field, None)
    opportunity_id = data.pop("opportunity_id", None)
    if opportunity_id in (None, ""):
        return None, None
    opportunity = Opportunity.objects.filter(pk=opportunity_id, company=company).first()
    if opportunity is None:
        return None, not_found_response("Opportunity not found")
    return opportunity, None


# ─── Leads ────────────────────────────────────────────────────

@api_view(["GET", "POST"])
def lead_list(request):
    gate = _check_crm(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = Lead.objects.filter(company=company)
        lead_status = request.query_params.get("status")
        if lead_status:
            qs = qs.filter(status=lead_status)
        return success_response(data=LeadSerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = LeadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import LeadService
        lead = LeadService.create_lead(company=company, user=request.user, **serializer.validated_data)
        return success_response(data=LeadSerializer(lead).data, message="Lead created", http_status_code=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def lead_detail(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    try:
        lead = Lead.objects.get(pk=pk, company=request.user.company)
    except Lead.DoesNotExist:
        return not_found_response("Lead not found")
    if request.method == "GET":
        return success_response(data=LeadSerializer(lead).data)
    elif request.method == "PUT":
        for field in ["name", "company_name", "email", "phone", "mobile", "status", "source", "priority", "industry", "notes"]:
            if field in request.data:
                setattr(lead, field, request.data[field])
        lead.save()
        return success_response(data=LeadSerializer(lead).data)
    elif request.method == "DELETE":
        lead.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def lead_convert(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    from .services import LeadService
    try:
        result = LeadService.convert_lead(request.user.company, pk, user=request.user)
        return success_response(data={
            "lead": LeadSerializer(result["lead"]).data,
            "customer_id": result["customer"].id,
            "opportunity_id": result["opportunity"].id,
        }, message="Lead converted to customer + opportunity")
    except Exception as e:
        return business_rule_error(str(e))


# ─── Opportunities ────────────────────────────────────────────

@api_view(["GET", "POST"])
def opportunity_list(request):
    gate = _check_crm(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = Opportunity.objects.filter(company=company)
        opp_status = request.query_params.get("status")
        if opp_status:
            qs = qs.filter(status=opp_status)
        return success_response(data=OpportunitySerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = OpportunityCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import OpportunityService
        opp = OpportunityService.create_opportunity(company=company, user=request.user, **serializer.validated_data)
        return success_response(data=OpportunitySerializer(opp).data, message="Opportunity created", http_status_code=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def opportunity_detail(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    try:
        opp = Opportunity.objects.get(pk=pk, company=request.user.company)
    except Opportunity.DoesNotExist:
        return not_found_response("Opportunity not found")
    if request.method == "GET":
        return success_response(data=OpportunitySerializer(opp).data)
    elif request.method == "PUT":
        # Lifecycle fields have their own endpoints (move/close-won/close-lost);
        # editing them here would skip the close date and probability rules.
        for field in ("status", "stage"):
            if field in request.data:
                return business_rule_error(
                    "Use the move or close endpoints to change an opportunity's status"
                )
        for field in ["name", "priority", "estimated_value", "probability", "description"]:
            if field in request.data:
                setattr(opp, field, request.data[field])
        opp.save()
        return success_response(data=OpportunitySerializer(opp).data)
    elif request.method == "DELETE":
        opp.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def opportunity_move(request, pk):
    """Move a card between pipeline stages (open statuses only)."""
    gate = _check_crm(request)
    if gate:
        return gate
    from apps.finance.exceptions import ValidationError as BusinessRuleError
    from .services import OpportunityService

    status_value = str(request.data.get("status") or "").strip()
    try:
        opp = OpportunityService.move_status(
            request.user.company, pk, status_value, user=request.user
        )
    except Opportunity.DoesNotExist:
        return not_found_response("Opportunity not found")
    except BusinessRuleError as exc:
        return business_rule_error(str(exc))
    return success_response(data=OpportunitySerializer(opp).data, message="Opportunity moved")


@api_view(["POST"])
def opportunity_close_won(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    from .services import OpportunityService
    try:
        opp = OpportunityService.close_won(request.user.company, pk, user=request.user)
        return success_response(data=OpportunitySerializer(opp).data, message="Opportunity closed won")
    except Exception as e:
        return business_rule_error(str(e))


@api_view(["POST"])
def opportunity_close_lost(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    from .services import OpportunityService
    reason = request.data.get("reason", "")
    try:
        opp = OpportunityService.close_lost(request.user.company, pk, reason=reason, user=request.user)
        return success_response(data=OpportunitySerializer(opp).data, message="Opportunity closed lost")
    except Exception as e:
        return business_rule_error(str(e))


# ─── Activities ───────────────────────────────────────────────

@api_view(["GET", "POST"])
def activity_list(request):
    gate = _check_crm(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = Activity.objects.filter(company=company)
        activity_type = request.query_params.get("type")
        if activity_type:
            qs = qs.filter(activity_type=activity_type)
        opportunity_id = request.query_params.get("opportunity")
        if opportunity_id:
            qs = qs.filter(opportunity_id=opportunity_id)
        return success_response(data=ActivitySerializer(qs, many=True).data)
    elif request.method == "POST":
        data = request.data.copy()
        opportunity, error = _linked_opportunity(data, company)
        if error:
            return error
        serializer = ActivitySerializer(data=data)
        serializer.is_valid(raise_exception=True)
        from .services import ActivityService
        activity = ActivityService.create_activity(
            company=company, user=request.user,
            opportunity_id=opportunity.id if opportunity else None,
            **serializer.validated_data,
        )
        return success_response(data=ActivitySerializer(activity).data, message="Activity created", http_status_code=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def activity_detail(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    try:
        activity = Activity.objects.get(pk=pk, company=request.user.company)
    except Activity.DoesNotExist:
        return not_found_response("Activity not found")
    if request.method == "GET":
        return success_response(data=ActivitySerializer(activity).data)
    elif request.method == "PUT":
        for field in ["activity_type", "subject", "description", "status", "priority", "due_date", "outcome"]:
            if field in request.data:
                setattr(activity, field, request.data[field])
        activity.save()
        return success_response(data=ActivitySerializer(activity).data)
    elif request.method == "DELETE":
        activity.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def activity_complete(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    from .services import ActivityService
    outcome = request.data.get("outcome", "")
    activity = ActivityService.complete_activity(request.user.company, pk, outcome=outcome)
    return success_response(data=ActivitySerializer(activity).data, message="Activity completed")


# ─── Campaigns ────────────────────────────────────────────────

@api_view(["GET", "POST"])
def campaign_list(request):
    gate = _check_crm(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = Campaign.objects.filter(company=company)
        return success_response(data=CampaignSerializer(qs, many=True).data)
    elif request.method == "POST":
        serializer = CampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services import CampaignService
        campaign = CampaignService.create_campaign(company=company, user=request.user, **serializer.validated_data)
        return success_response(data=CampaignSerializer(campaign).data, message="Campaign created", http_status_code=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def campaign_detail(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    try:
        campaign = Campaign.objects.get(pk=pk, company=request.user.company)
    except Campaign.DoesNotExist:
        return not_found_response("Campaign not found")
    if request.method == "GET":
        return success_response(data=CampaignSerializer(campaign).data)
    elif request.method == "PUT":
        for field in ["name", "status", "description", "budget", "actual_cost", "expected_leads", "actual_leads"]:
            if field in request.data:
                setattr(campaign, field, request.data[field])
        campaign.save()
        return success_response(data=CampaignSerializer(campaign).data)
    elif request.method == "DELETE":
        campaign.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Tasks ────────────────────────────────────────────────────

@api_view(["GET", "POST"])
def task_list(request):
    gate = _check_crm(request)
    if gate:
        return gate
    company = request.user.company
    if request.method == "GET":
        qs = CRMTask.objects.filter(company=company)
        task_status = request.query_params.get("status")
        if task_status:
            qs = qs.filter(status=task_status)
        opportunity_id = request.query_params.get("opportunity")
        if opportunity_id:
            qs = qs.filter(opportunity_id=opportunity_id)
        return success_response(data=CRMTaskSerializer(qs, many=True).data)
    elif request.method == "POST":
        data = request.data.copy()
        opportunity, error = _linked_opportunity(data, company)
        if error:
            return error
        serializer = CRMTaskSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        from .services import CRMTaskService
        task = CRMTaskService.create_task(
            company=company, user=request.user,
            opportunity_id=opportunity.id if opportunity else None,
            **serializer.validated_data,
        )
        return success_response(data=CRMTaskSerializer(task).data, message="Task created", http_status_code=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def task_detail(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    try:
        task = CRMTask.objects.get(pk=pk, company=request.user.company)
    except CRMTask.DoesNotExist:
        return not_found_response("Task not found")
    if request.method == "GET":
        return success_response(data=CRMTaskSerializer(task).data)
    elif request.method == "PUT":
        for field in ["title", "description", "priority", "status", "due_date"]:
            if field in request.data:
                setattr(task, field, request.data[field])
        task.save()
        return success_response(data=CRMTaskSerializer(task).data)
    elif request.method == "DELETE":
        task.soft_delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def task_complete(request, pk):
    gate = _check_crm(request)
    if gate:
        return gate
    from .services import CRMTaskService
    task = CRMTaskService.complete_task(request.user.company, pk)
    return success_response(data=CRMTaskSerializer(task).data, message="Task completed")


# ─── Timeline ─────────────────────────────────────────────────

@api_view(["GET"])
def customer_timeline(request, customer_id):
    gate = _check_crm(request)
    if gate:
        return gate
    events = CustomerTimeline.objects.filter(
        company=request.user.company, customer_id=customer_id
    )
    return success_response(data=CustomerTimelineSerializer(events, many=True).data)


# ─── Pipeline / Summary ───────────────────────────────────────

@api_view(["GET"])
def crm_summary(request):
    gate = _check_crm(request)
    if gate:
        return gate
    from .services import LeadService, OpportunityService
    company = request.user.company
    lead_summary = LeadService.get_summary(company)
    pipeline = OpportunityService.get_pipeline(company)
    return success_response(data={"leads": lead_summary, "pipeline": pipeline})
