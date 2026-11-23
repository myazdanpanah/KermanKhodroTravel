"""
CRM Module Tests — Lead conversion, Opportunity lifecycle, Activities, Campaigns.
Per IMPLEMENTATION_ROADMAP.md §18: CRM completion criteria.
"""

import datetime
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone

from apps.accounts.tests_helpers import create_test_company, create_test_user
from apps.finance.models import Customer, AccountGroup, KolAccount

from .models import Lead, Opportunity, Activity, Campaign, CRMTask, CustomerTimeline
from .services import (
    LeadService, OpportunityService, ActivityService,
    CampaignService, CRMTaskService,
)


class CRMTestBase(TestCase):
    """Shared fixtures for CRM tests."""

    def setUp(self):
        self.company = create_test_company()
        self.user = create_test_user(username="crm_tester", company=self.company, role="ceo")
        self.group = AccountGroup.objects.create(company=self.company, code="1", name="Assets")
        self.kol = KolAccount.objects.create(company=self.company, group=self.group, code="131", name="Customer Receivable", account_type="asset")
        self.customer = Customer.objects.create(company=self.company, name="Test Customer")
        self.company.enable_module("crm")


# ─── Lead Tests ───────────────────────────────────────────────

class LeadTests(CRMTestBase):

    def test_create_lead(self):
        lead = LeadService.create_lead(
            company=self.company,
            name="Acme Corp",
            email="contact@acme.com",
            phone="021-1234",
            source="website",
            priority="high",
        )
        self.assertEqual(lead.name, "Acme Corp")
        self.assertEqual(lead.status, "new")
        self.assertEqual(lead.source, "website")

    def test_convert_lead_to_customer(self):
        lead = LeadService.create_lead(
            company=self.company,
            name="Globex Corp",
            email="info@globex.com",
        )
        result = LeadService.convert_lead(self.company, lead.id, user=self.user)

        self.assertIsNotNone(result["customer"])
        self.assertIsNotNone(result["opportunity"])
        lead.refresh_from_db()
        self.assertEqual(lead.status, "converted")
        self.assertIsNotNone(lead.converted_customer)
        self.assertIsNotNone(lead.converted_at)

        # Verify customer was created
        self.assertEqual(Customer.objects.filter(company=self.company).count(), 2)

        # Verify opportunity was created
        self.assertEqual(
            Opportunity.objects.filter(company=self.company, lead=lead).count(), 1
        )

    def test_convert_already_converted_lead(self):
        lead = LeadService.create_lead(company=self.company, name="Already Done")
        LeadService.convert_lead(self.company, lead.id)
        with self.assertRaises(Exception):
            LeadService.convert_lead(self.company, lead.id)

    def test_lead_summary(self):
        for name, status in [("A", "new"), ("B", "contacted"), ("C", "qualified"), ("D", "converted")]:
            LeadService.create_lead(company=self.company, name=name)
            Lead.objects.filter(name=name, company=self.company).update(status=status)
        summary = LeadService.get_summary(self.company)
        self.assertEqual(summary["total"], 4)
        self.assertEqual(summary["new"], 1)
        self.assertEqual(summary["converted"], 1)

    def test_lead_timeline_on_conversion(self):
        lead = LeadService.create_lead(company=self.company, name="Timeline Test")
        LeadService.convert_lead(self.company, lead.id, user=self.user)
        timeline = CustomerTimeline.objects.filter(company=self.company, entity_type="lead")
        self.assertEqual(timeline.count(), 1)
        self.assertEqual(timeline.first().event_type, "converted")


# ─── Opportunity Tests ────────────────────────────────────────

class OpportunityTests(CRMTestBase):

    def test_create_opportunity(self):
        opp = OpportunityService.create_opportunity(
            company=self.company,
            name="Big Deal",
            customer_id=self.customer.id,
            estimated_value=Decimal("10000000"),
            probability=50,
        )
        self.assertEqual(opp.name, "Big Deal")
        self.assertEqual(opp.weighted_value, Decimal("5000000"))

    def test_close_won(self):
        opp = OpportunityService.create_opportunity(
            company=self.company,
            name="Won Deal",
            customer_id=self.customer.id,
            estimated_value=Decimal("5000000"),
            probability=80,
        )
        opp = OpportunityService.close_won(self.company, opp.id)
        self.assertEqual(opp.status, "closed_won")
        self.assertEqual(opp.stage, "closed")
        self.assertIsNotNone(opp.actual_close_date)
        event = CustomerTimeline.objects.get(
            company=self.company, entity_type="opportunity", entity_id=opp.id
        )
        self.assertEqual(event.event_type, "closed_won")

    def test_close_lost(self):
        opp = OpportunityService.create_opportunity(
            company=self.company,
            name="Lost Deal",
            estimated_value=Decimal("3000000"),
            probability=30,
        )
        opp = OpportunityService.close_lost(self.company, opp.id, reason="Too expensive")
        self.assertEqual(opp.status, "closed_lost")
        self.assertEqual(opp.loss_reason, "Too expensive")

    def test_close_already_closed(self):
        opp = OpportunityService.create_opportunity(company=self.company, name="Done")
        OpportunityService.close_won(self.company, opp.id)
        with self.assertRaises(Exception):
            OpportunityService.close_won(self.company, opp.id)

    def test_pipeline_summary(self):
        for name, stage in [("A", "lead"), ("B", "qualified"), ("C", "proposal_sent")]:
            OpportunityService.create_opportunity(
                company=self.company, name=name,
                estimated_value=Decimal("1000000"), probability=50,
            )
            Opportunity.objects.filter(name=name, company=self.company).update(stage=stage)
        pipeline = OpportunityService.get_pipeline(self.company)
        self.assertEqual(pipeline["total_opportunities"], 3)
        self.assertEqual(pipeline["by_stage"]["lead"], 1)


# ─── Activity Tests ───────────────────────────────────────────

class ActivityTests(CRMTestBase):

    def test_create_activity(self):
        activity = ActivityService.create_activity(
            company=self.company,
            activity_type="call",
            subject="Follow up call",
            description="Discussed pricing",
            lead_id=None,
        )
        self.assertEqual(activity.activity_type, "call")
        self.assertEqual(activity.status, "planned")

    def test_complete_activity(self):
        activity = ActivityService.create_activity(
            company=self.company,
            activity_type="email",
            subject="Intro email",
        )
        activity = ActivityService.complete_activity(self.company, activity.id, outcome="Response received")
        self.assertEqual(activity.status, "completed")
        self.assertIsNotNone(activity.completed_at)
        self.assertEqual(activity.outcome, "Response received")


# ─── Campaign Tests ───────────────────────────────────────────

class CampaignTests(CRMTestBase):

    def test_create_campaign(self):
        campaign = CampaignService.create_campaign(
            company=self.company,
            name="Q3 Newsletter",
            campaign_type="email",
            budget=Decimal("5000000"),
            expected_leads=100,
            expected_revenue=Decimal("50000000"),
        )
        self.assertEqual(campaign.name, "Q3 Newsletter")
        self.assertEqual(campaign.status, "draft")
        self.assertEqual(campaign.budget, Decimal("5000000"))

    def test_activate_campaign(self):
        campaign = CampaignService.create_campaign(
            company=self.company,
            name="Summer Sale",
            campaign_type="social_media",
        )
        campaign = CampaignService.activate_campaign(self.company, campaign.id)
        self.assertEqual(campaign.status, "active")

    def test_activate_non_draft_campaign(self):
        campaign = CampaignService.create_campaign(
            company=self.company, name="Already Active",
        )
        campaign.status = "active"
        campaign.save()
        with self.assertRaises(Exception):
            CampaignService.activate_campaign(self.company, campaign.id)

    def test_campaign_roi(self):
        campaign = CampaignService.create_campaign(
            company=self.company, name="ROI Test",
            budget=Decimal("1000000"),
        )
        campaign.actual_cost = Decimal("1000000")
        campaign.actual_revenue = Decimal("3000000")
        campaign.save()
        self.assertAlmostEqual(campaign.roi, 200.0)


# ─── Task Tests ───────────────────────────────────────────────

class CRMTaskTests(CRMTestBase):

    def test_create_task(self):
        task = CRMTaskService.create_task(
            company=self.company,
            title="Follow up with Acme",
            priority="high",
            due_date=datetime.date.today() + datetime.timedelta(days=7),
        )
        self.assertEqual(task.title, "Follow up with Acme")
        self.assertEqual(task.priority, "high")
        self.assertEqual(task.status, "todo")

    def test_complete_task(self):
        task = CRMTaskService.create_task(
            company=self.company,
            title="Send proposal",
        )
        task = CRMTaskService.complete_task(self.company, task.id)
        self.assertEqual(task.status, "completed")
        self.assertIsNotNone(task.completed_at)


class OpportunityPipelineMoveTests(CRMTestBase):
    """The pipeline board moves open cards, never closes them."""

    def setUp(self):
        super().setUp()
        from rest_framework.test import APIClient

        self.opp = OpportunityService.create_opportunity(
            company=self.company,
            name="Board Deal",
            customer_id=self.customer.id,
            estimated_value=Decimal("1000000"),
            probability=40,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _move(self, status_value, opp=None):
        target = opp or self.opp
        return self.client.post(
            f"/api/v1/crm/opportunities/{target.id}/move/",
            {"status": status_value},
            format="json",
        )

    def test_moving_an_open_card_updates_status_and_timeline(self):
        response = self._move("proposal")

        self.assertEqual(response.status_code, 200, response.content)
        self.opp.refresh_from_db()
        self.assertEqual(self.opp.status, "proposal")
        event = CustomerTimeline.objects.get(
            company=self.company, entity_type="opportunity", entity_id=self.opp.id
        )
        self.assertEqual(event.event_type, "status_changed")
        self.assertIn("proposal", event.description)

    def test_moving_keeps_stage_in_sync(self):
        response = self._move("negotiation")

        self.assertEqual(response.status_code, 200, response.content)
        self.opp.refresh_from_db()
        self.assertEqual(self.opp.stage, "verbal_agreement")

    def test_editing_puts_cannot_change_lifecycle_fields(self):
        response = self.client.put(
            f"/api/v1/crm/opportunities/{self.opp.id}/",
            {"name": "Renamed", "status": "closed_won", "stage": "closed"},
            format="json",
        )

        self.assertEqual(response.status_code, 422, response.content)
        self.opp.refresh_from_db()
        self.assertEqual(self.opp.name, "Board Deal")
        self.assertEqual(self.opp.status, "prospecting")

    def test_closing_through_move_is_rejected(self):
        response = self._move("closed_won")

        self.assertEqual(response.status_code, 422)
        self.opp.refresh_from_db()
        self.assertEqual(self.opp.status, "prospecting")

    def test_closed_opportunity_cannot_be_moved(self):
        OpportunityService.close_won(self.company, self.opp.id, user=self.user)

        response = self._move("qualification")

        self.assertEqual(response.status_code, 422)

    def test_unknown_status_is_rejected(self):
        response = self._move("teleported")

        self.assertEqual(response.status_code, 422)
        self.opp.refresh_from_db()
        self.assertEqual(self.opp.status, "prospecting")

    def test_other_company_opportunity_is_not_found(self):
        other_company = create_test_company(name="Other Co")
        other_company.enable_module("crm")
        other = OpportunityService.create_opportunity(
            company=other_company, name="Theirs", estimated_value=Decimal("5"),
        )

        response = self._move("qualification", opp=other)

        self.assertEqual(response.status_code, 404)


class OpportunityRecordActivityTests(CRMTestBase):
    """Activities and tasks attached to one opportunity from its record panel."""

    def setUp(self):
        super().setUp()
        from rest_framework.test import APIClient

        self.opp = OpportunityService.create_opportunity(
            company=self.company, name="Record Deal", customer_id=self.customer.id,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_activity_can_be_logged_against_an_opportunity(self):
        response = self.client.post(
            "/api/v1/crm/activities/",
            {"activity_type": "call", "subject": "Kickoff call", "opportunity_id": self.opp.id},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["data"]["opportunity"], self.opp.id)

    def test_activities_can_be_filtered_by_opportunity(self):
        other = OpportunityService.create_opportunity(company=self.company, name="Other Deal")
        ActivityService.create_activity(
            company=self.company, activity_type="note", subject="In deal",
            opportunity_id=self.opp.id,
        )
        ActivityService.create_activity(
            company=self.company, activity_type="note", subject="Elsewhere",
            opportunity_id=other.id,
        )

        response = self.client.get(f"/api/v1/crm/activities/?opportunity={self.opp.id}")

        subjects = [row["subject"] for row in response.json()["data"]]
        self.assertEqual(subjects, ["In deal"])

    def test_task_can_be_created_against_an_opportunity(self):
        response = self.client.post(
            "/api/v1/crm/tasks/",
            {"title": "Send proposal", "opportunity_id": self.opp.id, "priority": "high"},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["data"]["opportunity"], self.opp.id)

    def test_attaching_to_another_companys_opportunity_is_refused(self):
        other_company = create_test_company(name="Other Co")
        other_company.enable_module("crm")
        foreign = OpportunityService.create_opportunity(company=other_company, name="Theirs")

        response = self.client.post(
            "/api/v1/crm/activities/",
            {"activity_type": "call", "subject": "Sneaky", "opportunity_id": foreign.id},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

    def test_raw_foreign_keys_are_ignored(self):
        response = self.client.post(
            "/api/v1/crm/activities/",
            {"activity_type": "call", "subject": "No link", "opportunity": self.opp.id},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertIsNone(response.json()["data"]["opportunity"])


# ─── SMS Routes ───────────────────────────────────────────────

from unittest.mock import patch  # noqa: E402

from django.urls import reverse  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from .models import SmsMessage, SmsSettings  # noqa: E402
from .sms import SmsError  # noqa: E402


class SmsApiTests(CRMTestBase):
    """Access control, admin settings, input validation and gateway errors."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.admin = create_test_user(
            username="sms_admin", company=self.company, role="admin",
        )
        self.sales = create_test_user(
            username="sms_sales", company=self.company, role="sales",
        )

    def _settings_payload(self, **overrides):
        payload = {
            "provider": "kavenegar",
            "sender": "10004346",
            "api_key": "test-api-key",
            "enabled": True,
        }
        payload.update(overrides)
        return payload

    # ── Access ──────────────────────────────────────────────

    def test_anonymous_cannot_read_or_send(self):
        for name in ("crm-sms-settings", "crm-sms-messages"):
            response = self.client.get(reverse(name))
            self.assertIn(response.status_code, (401, 403), name)
        response = self.client.post(
            reverse("crm-sms-send"), {"phone": "09123456789", "message": "سلام"}, format="json",
        )
        self.assertIn(response.status_code, (401, 403))

    def test_non_admin_cannot_save_settings(self):
        self.client.force_authenticate(self.sales)
        response = self.client.put(
            reverse("crm-sms-settings"), self._settings_payload(), format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(SmsSettings.objects.filter(company=self.company, enabled=True).exists())

    def test_admin_saves_settings_and_secret_is_not_echoed(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            reverse("crm-sms-settings"),
            self._settings_payload(provider="niksms", username="panel-user", password="panel-pass"),
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertTrue(data["enabled"])
        self.assertTrue(data["has_api_key"])
        self.assertTrue(data["has_password"])
        self.assertNotIn("api_key", data)
        self.assertNotIn("password", data)

        stored = SmsSettings.objects.get(company=self.company)
        self.assertEqual(stored.provider, "niksms")
        self.assertEqual(stored.api_key, "test-api-key")
        self.assertEqual(stored.sender, "10004346")

    # ── Validation ──────────────────────────────────────────

    def _enabled_settings(self):
        SmsSettings.objects.create(
            company=self.company, provider="kavenegar", api_key="key",
            sender="1000", enabled=True,
        )

    def test_invalid_phone_rejected(self):
        self._enabled_settings()
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("crm-sms-send"), {"phone": "12345", "message": "سلام"}, format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("موبایل", response.data["error"])
        self.assertEqual(SmsMessage.objects.count(), 0)

    def test_empty_and_too_long_message_rejected(self):
        self._enabled_settings()
        self.client.force_authenticate(self.admin)
        empty = self.client.post(
            reverse("crm-sms-send"), {"phone": "09123456789", "message": "   "}, format="json",
        )
        self.assertEqual(empty.status_code, 400)
        long_body = "ا" * 1001
        too_long = self.client.post(
            reverse("crm-sms-send"), {"phone": "09123456789", "message": long_body}, format="json",
        )
        self.assertEqual(too_long.status_code, 400)
        self.assertEqual(SmsMessage.objects.count(), 0)

    def test_disabled_gateway_rejected(self):
        SmsSettings.objects.create(company=self.company, provider="kavenegar", enabled=False)
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("crm-sms-send"), {"phone": "09123456789", "message": "سلام"}, format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("فعال نیست", response.data["error"])

    # ── Provider failure ────────────────────────────────────

    def test_provider_error_is_reported_and_logged_as_failed(self):
        self._enabled_settings()
        self.client.force_authenticate(self.admin)
        with patch("apps.crm.sms_views.send_sms", side_effect=SmsError("اعتبار کلید کافی نیست")):
            response = self.client.post(
                reverse("crm-sms-send"),
                {"phone": "0912 345 6789", "message": "پیام آزمایشی"},
                format="json",
            )
        self.assertEqual(response.status_code, 502)
        self.assertIn("اعتبار کلید", response.data["error"])
        message = SmsMessage.objects.get()
        self.assertEqual(message.status, "failed")
        self.assertEqual(message.phone, "09123456789")
        self.assertIn("اعتبار کلید", message.error)

    def test_successful_send_is_logged(self):
        self._enabled_settings()
        self.client.force_authenticate(self.admin)
        with patch("apps.crm.sms_views.send_sms", return_value="provider-42"):
            response = self.client.post(
                reverse("crm-sms-send"),
                {"phone": "09123456789", "message": "سلام"},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        message = SmsMessage.objects.get()
        self.assertEqual(message.status, "sent")
        self.assertEqual(message.provider_message_id, "provider-42")

    def test_bulk_send_dry_run(self):
        self._enabled_settings()
        self.client.force_authenticate(self.admin)
        payload = {
            "template": "سلام {نام} عزیز، مبلغ بدهی شما {مبلغ} ریال است.",
            "recipients": [
                {"phone": "09123456789", "variables": {"نام": "حمیدرضا", "مبلغ": "۱,۰۰۰,۰۰۰"}},
                {"phone": "invalid-phone", "variables": {"نام": "علی"}},
            ],
            "dry_run": True,
        }
        response = self.client.post(reverse("crm-sms-bulk-send"), payload, format="json")
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertTrue(data["dry_run"])
        self.assertEqual(data["total"], 2)
        # Verify first item interpolation
        first = data["results"][0]
        self.assertEqual(first["phone"], "09123456789")
        self.assertEqual(first["body"], "سلام حمیدرضا عزیز، مبلغ بدهی شما ۱,۰۰۰,۰۰۰ ریال است.")
        self.assertTrue(first["valid"])
        # Verify second item validation
        second = data["results"][1]
        self.assertFalse(second["valid"])
        self.assertIn("شمارهٔ موبایل نامعتبر است", second["error"])
        # No DB messages created on dry run
        self.assertEqual(SmsMessage.objects.count(), 0)

    def test_bulk_send_execution_and_logging(self):
        self._enabled_settings()
        self.client.force_authenticate(self.admin)
        payload = {
            "template": "جناب {نام}، صورت‌حساب {شماره} صادر شد.",
            "recipients": [
                {"phone": "09123456789", "variables": {"نام": "حمیدرضا", "شماره": "1405/01"}},
                {"phone": "99999", "variables": {"نام": "مهران"}},
            ],
        }
        with patch("apps.crm.sms_views.send_sms", return_value="prov-99"):
            response = self.client.post(reverse("crm-sms-bulk-send"), payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["sent"], 1)
        self.assertEqual(response.data["failed"], 1)

        # 1 valid message was created and sent
        sent_msg = SmsMessage.objects.filter(status="sent").first()
        self.assertIsNotNone(sent_msg)
        self.assertEqual(sent_msg.phone, "09123456789")
        self.assertEqual(sent_msg.body, "جناب حمیدرضا، صورت‌حساب 1405/01 صادر شد.")
        self.assertEqual(sent_msg.provider_message_id, "prov-99")

    def test_bulk_send_empty_recipients_rejected(self):
        self._enabled_settings()
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse("crm-sms-bulk-send"), {"recipients": []}, format="json")
        self.assertEqual(response.status_code, 400)
