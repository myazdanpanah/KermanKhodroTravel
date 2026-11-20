"""
End-to-end Office tests — the secretariat journey through the public API.

These tests use the same HTTP endpoints the UI calls, switch between users with
different roles, and assert the state each participant sees.
"""

import datetime
from concurrent.futures import ThreadPoolExecutor

from django.db import connections
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from apps.accounts.tests_helpers import create_test_company, create_test_user
from apps.finance.models import Customer, FiscalYear, Invoice

from .models import Correspondence, OfficeBusinessLink, Secretariat, SecretariatMember
from .services import create_correspondence, register_correspondence


class OfficeE2EBase(TestCase):
    def setUp(self):
        self.company = create_test_company()
        self.company.enable_module("office")
        self.ceo = create_test_user(username="e2e_ceo", company=self.company, role="ceo")
        self.secretary = create_test_user(username="e2e_secretary", company=self.company, role="sales")
        self.sales = create_test_user(username="e2e_sales", company=self.company, role="sales")
        self.finance = create_test_user(username="e2e_finance", company=self.company, role="finance")
        self.outsider = create_test_user(username="e2e_outsider", company=create_test_company(name="Elsewhere"),
                                        role="ceo")

        self.secretariat = Secretariat.objects.create(company=self.company, name="دبیرخانه مرکزی", code="CEN")
        self.incoming = Secretariat.objects.create(company=self.company, name="دبیرخانه وارده", code="INC")
        SecretariatMember.objects.create(secretariat=self.secretariat, user=self.secretary, can_register=True)

        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user=user)
        return self.client

    def create_draft(self, user, **overrides):
        payload = {
            "subject": "درخواست تسویه صورتحساب",
            "body": "متن نامه",
            "correspondence_type": "outgoing",
            "secretariat_id": self.secretariat.id,
            "letter_date_jalali": "1404/09/01",
            "priority": "high",
            "recipients": [{
                "recipient_type": "user", "recipient_user_id": self.finance.id,
                "delivery_type": "action_required",
            }],
        }
        payload.update(overrides)
        response = self.as_user(user).post("/api/v1/office/correspondence/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["data"]["id"]


class SecretariatJourneyTests(OfficeE2EBase):
    def test_full_secretariat_journey(self):
        letter_id = self.create_draft(self.sales)

        # The drafter is not a secretariat member: registration is refused.
        response = self.as_user(self.sales).post(f"/api/v1/office/correspondence/{letter_id}/register/", {}, format="json")
        self.assertEqual(response.status_code, 403)

        # A CEO grants the secretary membership; now registration succeeds.
        response = self.as_user(self.ceo).post(
            f"/api/v1/office/secretariats/{self.secretariat.id}/members/",
            {"user_id": self.secretary.id, "can_register": True}, format="json")
        self.assertEqual(response.status_code, 201)
        response = self.as_user(self.secretary).post(
            f"/api/v1/office/correspondence/{letter_id}/register/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["registration_number"], "1404/CEN/O/000001")
        self.assertEqual(response.data["data"]["registered_by"], self.secretary.id)

        # Refer to finance with an instruction.
        response = self.as_user(self.secretary).post(
            f"/api/v1/office/correspondence/{letter_id}/refer/",
            {"target_type": "user", "user_id": self.finance.id, "route_type": "action",
             "instruction": "لطفاً وضعیت پرداخت را بررسی کنید"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["current_status"], "in_progress")

        # Finance sees it in the action bucket and opens it.
        response = self.as_user(self.finance).get("/api/v1/office/workbench/")
        self.assertEqual(response.data["data"]["buckets"]["action"], 1)
        self.assertEqual(response.data["data"]["buckets"]["inbox"], 1)
        response = self.as_user(self.finance).get(f"/api/v1/office/correspondence/{letter_id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["recipients"]), 1)

        # Timeline: created, registered, referral.
        response = self.as_user(self.finance).get(f"/api/v1/office/correspondence/{letter_id}/timeline/")
        timeline = response.data["data"]
        self.assertEqual([event["kind"] for event in timeline], ["action", "action", "route"])
        self.assertEqual([event["action"] for event in timeline[:2]], ["created", "registered"])

        # Reply and archive; the number stays.
        response = self.as_user(self.finance).post(
            f"/api/v1/office/correspondence/{letter_id}/reply/", {"body": "بررسی شد"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        reply_id = response.data["data"]["id"]
        response = self.as_user(self.ceo).post(
            f"/api/v1/office/correspondence/{letter_id}/archive/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["registration_number"], "1404/CEN/O/000001")
        self.assertIsNotNone(response.data["data"]["archived_at"])

        # The reply is linked and archived letters stay locked.
        self.assertEqual(Correspondence.objects.get(pk=reply_id).parent_correspondence_id, letter_id)
        response = self.as_user(self.secretary).post(
            f"/api/v1/office/correspondence/{letter_id}/register/", {}, format="json")
        self.assertEqual(response.status_code, 409)

        # Other companies never see the thread.
        response = self.as_user(self.outsider).get(f"/api/v1/office/correspondence/{letter_id}/")
        self.assertEqual(response.status_code, 404)

    def test_number_books_are_per_type_and_secretariat(self):
        outgoing = self.create_draft(self.sales)
        incoming = self.create_draft(self.sales, correspondence_type="incoming",
                                     secretariat_id=self.incoming.id, subject="نامه وارده")
        register_correspondence(Correspondence.objects.get(pk=outgoing), self.ceo)
        register_correspondence(Correspondence.objects.get(pk=incoming), self.ceo)
        outgoing = Correspondence.objects.get(pk=outgoing)
        incoming = Correspondence.objects.get(pk=incoming)
        self.assertEqual(outgoing.registration_number, "1404/CEN/O/000001")
        # Different secretariat and different type book → starts at 1, no collision.
        self.assertEqual(incoming.registration_number, "1404/INC/I/000001")

    def test_registration_year_is_jalali_even_without_jalali_text(self):
        letter = create_correspondence(self.ceo, {
            "subject": "نامه بدون تاریخ شمسی",
            "secretariat_id": self.secretariat.id,
            "letter_date": datetime.date(2026, 2, 10),  # 1404/11/21
        })
        register_correspondence(letter, self.ceo)
        letter.refresh_from_db()
        self.assertEqual(letter.registration_year, 1404)
        self.assertEqual(letter.registration_number, "1404/CEN/N/000001")

    def test_member_without_register_right_is_refused(self):
        SecretariatMember.objects.filter(secretariat=self.secretariat, user=self.secretary).update(
            can_register=False)
        letter_id = self.create_draft(self.secretary)
        response = self.as_user(self.secretary).post(
            f"/api/v1/office/correspondence/{letter_id}/register/", {}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_secretariat_membership_is_company_scoped(self):
        response = self.as_user(self.outsider).post(
            f"/api/v1/office/secretariats/{self.secretariat.id}/members/",
            {"user_id": self.outsider.id}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertFalse(SecretariatMember.objects.filter(
            secretariat=self.secretariat, user=self.outsider).exists())

    def test_business_link_resolves_live_values(self):
        fiscal_year = FiscalYear.objects.create(
            company=self.company, name="1404", start_date_jalali="1404/01/01",
            end_date_jalali="1404/12/29", start_date=datetime.date(2025, 3, 21),
            end_date=datetime.date(2026, 3, 20),
        )
        customer = Customer.objects.create(company=self.company, name="مسافر نمونه", balance=120000)
        invoice = Invoice.objects.create(
            company=self.company, fiscal_year=fiscal_year, number=7, type="sales",
            date_jalali="1404/08/01", date=datetime.date(2025, 10, 23), customer=customer,
            subtotal=500000, total=500000, status="confirmed",
        )
        letter_id = self.create_draft(self.sales)
        response = self.as_user(self.finance).post(
            f"/api/v1/office/correspondence/{letter_id}/business-links/",
            {"entity_type": "invoice", "source_record_id": str(invoice.id),
             "relationship_type": "invoice_for"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        invoice.total = 650000
        invoice.save(update_fields=["total"])
        response = self.as_user(self.finance).get(
            f"/api/v1/office/correspondence/{letter_id}/business-links/")
        self.assertEqual(response.data["data"][0]["record"]["display"]["total_amount"], 650000)
        self.assertEqual(OfficeBusinessLink.objects.filter(office_object_id=str(letter_id)).count(), 1)


class SecretariatConcurrencyTests(TransactionTestCase):
    """Registration is the one operation that must never duplicate a number."""

    reset_sequences = True

    def setUp(self):
        self.company = create_test_company()
        self.company.enable_module("office")
        self.ceo = create_test_user(username="race_ceo", company=self.company, role="ceo")
        self.secretariat = Secretariat.objects.create(company=self.company, name="Race", code="RCE")
        self.letters = [
            create_correspondence(self.ceo, {
                "subject": f"نامه {index}",
                "correspondence_type": "outgoing",
                "secretariat_id": self.secretariat.id,
                "letter_date_jalali": "1404/10/01",
            })
            for index in range(4)
        ]

    def _register(self, letter_id):
        try:
            register_correspondence(Correspondence.objects.get(pk=letter_id), self.ceo)
            return letter_id
        finally:
            connections.close_all()

    def test_parallel_registration_never_reuses_a_number(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(self._register, [letter.id for letter in self.letters]))

        numbers = sorted(
            Correspondence.objects.filter(pk__in=[letter.id for letter in self.letters])
            .values_list("registration_number", flat=True)
        )
        self.assertEqual(numbers, [f"1404/RCE/O/{index:06d}" for index in range(1, 5)])
