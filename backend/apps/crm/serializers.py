"""
CRM Serializers — REST API serialization.
"""

from rest_framework import serializers
from .models import (
    Lead, Opportunity, Activity, Campaign, CRMTask, CustomerTimeline,
)


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            "id", "name", "company_name", "email", "phone", "mobile", "website", "address",
            "status", "source", "priority", "industry", "employees_count", "annual_revenue",
            "currency", "assigned_to", "converted_customer", "converted_at", "score", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["converted_customer", "converted_at"]


class LeadCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    company_name = serializers.CharField(max_length=200, required=False, default="")
    email = serializers.EmailField(required=False, default="")
    phone = serializers.CharField(max_length=20, required=False, default="")
    mobile = serializers.CharField(max_length=20, required=False, default="")
    website = serializers.URLField(required=False, default="")
    address = serializers.CharField(required=False, default="")
    source = serializers.ChoiceField(choices=Lead.SOURCE_CHOICES, default="other")
    industry = serializers.CharField(max_length=100, required=False, default="")
    priority = serializers.ChoiceField(choices=Lead.PRIORITY_CHOICES, default="medium")
    notes = serializers.CharField(required=False, default="")
    assigned_to_id = serializers.IntegerField(required=False, allow_null=True)


class OpportunitySerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True, default="")

    class Meta:
        model = Opportunity
        fields = [
            "id", "name", "customer", "customer_name", "lead",
            "status", "stage", "priority",
            "estimated_value", "probability", "weighted_value", "currency",
            "expected_close_date", "actual_close_date",
            "assigned_to", "source", "campaign",
            "description", "loss_reason",
            "created_at", "updated_at",
        ]
        read_only_fields = ["weighted_value", "actual_close_date"]


class OpportunityCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    lead_id = serializers.IntegerField(required=False, allow_null=True)
    estimated_value = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    probability = serializers.IntegerField(default=0)
    expected_close_date = serializers.DateField(required=False, allow_null=True)
    source = serializers.ChoiceField(choices=Lead.SOURCE_CHOICES, default="other")
    description = serializers.CharField(required=False, default="")
    assigned_to_id = serializers.IntegerField(required=False, allow_null=True)


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = [
            "id", "activity_type", "subject", "description",
            "status", "priority",
            "lead", "opportunity", "customer",
            "due_date", "completed_at", "duration_minutes",
            "assigned_to", "outcome",
            "created_at", "updated_at",
        ]
        read_only_fields = ["completed_at"]


class CampaignSerializer(serializers.ModelSerializer):
    roi = serializers.FloatField(read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "campaign_type", "status", "description", "target_audience",
            "budget", "actual_cost", "currency",
            "start_date", "end_date",
            "expected_leads", "actual_leads",
            "expected_opportunities", "actual_opportunities",
            "expected_revenue", "actual_revenue",
            "assigned_to", "notes", "roi",
            "created_at", "updated_at",
        ]
        read_only_fields = ["roi"]


class CRMTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = CRMTask
        fields = [
            "id", "title", "description", "priority", "status",
            "lead", "opportunity", "customer",
            "due_date", "completed_at",
            "assigned_to",
            "created_at", "updated_at",
        ]
        read_only_fields = ["completed_at"]


class CustomerTimelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerTimeline
        fields = [
            "id", "customer", "entity_type", "entity_id", "entity_label",
            "event_type", "description", "performed_by",
            "created_at",
        ]
        read_only_fields = ["created_at"]
