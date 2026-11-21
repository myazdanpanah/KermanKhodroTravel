"""Nexivo Office tests — numbering, access control, workbench, business links."""

import datetime

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.tests_helpers import create_test_company, create_test_user
from apps.finance.models import Customer, FiscalYear, Invoice, Receipt

from .business import links_for, resolve
from .models import Correspondence, CorrespondenceRecipient, Secretariat
from .services import (
    OfficeError,
    archive_correspondence,
    can_open,
    create_correspondence,
    refer_correspondence,
    register_correspondence,
    reply_to_correspondence,
    visible_correspondence,
)


class OfficeTestBase(TestCase):
    def setUp(self):
        self.company = create_test_company()
        self.company.enable_module("office")
        self.ceo = create_test_user(username="office_ceo", company=self.company, role="ceo")
        self.sales = create_test_user(username="office_sales", company=self.company, role="sales")
        self.finance = create_test_user(username="office_finance", company=self.company, role="finance")
        self.other_company = create_test_company(name="Other Co")
        self.other_user = create_test_user(username="office_other", company=self.other_company, role="ceo")
        self.secretariat = Secretariat.objects.create(
            company=self.company, name="دبیرخانه مرکزی", code="OUT",
        )
        self.customer = Customer.objects.create(company=self.company, name="آژانس نمونه", balance=250000)
        self.fiscal_year = FiscalYear.objects.create(
            company=self.company, name="1404", start_date_jalali="1404/01/01",
            end_date_jalali="1404/12/29", start_date=datetime.date(2025, 3, 21),
            end_date=datetime.date(2026, 3, 20),
        )

    def draft(self, user=None, **kwargs):
        user = user or self.ceo
        data = {
            "subject": "نامه آزمایشی",
            "body": "متن",
            "correspondence_type": "outgoing",
            "secretariat_id": self.secretariat.id,
            "letter_date_jalali": "1404/09/01",
        }
        data.update(kwargs)
        recipients = data.pop("recipients", [])
        return create_correspondence(user, data, recipients=recipients)


class CorrespondenceTests(OfficeTestBase):
    def test_create_draft_and_recipients(self):
        letter = self.draft(recipients=[{
            "recipient_type": "user", "recipient_user_id": self.finance.id, "delivery_type": "action_required",
        }])
        self.assertEqual(letter.registration_status, "draft")
        self.assertIsNone(letter.registration_number)
        self.assertEqual(letter.recipients.count(), 1)

    def test_rejects_recipient_from_another_company(self):
        with self.assertRaises(OfficeError):
            self.draft(recipients=[{"recipient_type": "user", "recipient_user_id": self.other_user.id}])

    def test_registration_numbers_are_sequential_and_immutable(self):
        first = self.draft()
        second = self.draft(subject="نامه دوم")
        register_correspondence(first, self.ceo)
        register_correspondence(second, self.ceo)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.registration_number, "1404/OUT/O/000001")
        self.assertEqual(second.registration_number, "1404/OUT/O/000002")
        self.assertEqual(first.registered_by, self.ceo)

        with self.assertRaises(OfficeError):
            register_correspondence(first, self.ceo)

    def test_registration_requires_secretariat(self):
        letter = create_correspondence(self.ceo, {"subject": "بدون دبیرخانه"})
        with self.assertRaises(OfficeError):
            register_correspondence(letter, self.ceo)

    def test_referral_creates_route_and_notifies(self):
        letter = self.draft()
        register_correspondence(letter, self.ceo)
        refer_correspondence(letter, self.ceo, {
            "target_type": "user", "user_id": self.finance.id,
            "route_type": "action", "instruction": "بررسی و پاسخ",
        })
        letter.refresh_from_db()
        self.assertEqual(letter.routes.count(), 1)
        self.assertEqual(letter.current_status, "in_progress")
        self.assertTrue(letter.recipients.filter(recipient_user=self.finance).exists())
        self.assertEqual(self.finance.notifications.filter(target_type="office_correspondence").count(), 1)

    def test_referral_rejects_foreign_user(self):
        letter = self.draft()
        with self.assertRaises(OfficeError):
            refer_correspondence(letter, self.ceo, {"target_type": "user", "user_id": self.other_user.id})

    def test_reply_threads_and_marks_answered(self):
        letter = self.draft(sender_type="external", sender_name="شرکت الف")
        letter.sender_user = self.sales
        letter.save(update_fields=["sender_user"])
        reply = reply_to_correspondence(letter, self.finance, "پاسخ داده شد")
        letter.refresh_from_db()
        self.assertEqual(letter.current_status, "answered")
        self.assertEqual(reply.parent_correspondence_id, letter.id)
        self.assertTrue(reply.recipients.filter(recipient_user=self.sales).exists())

    def test_archive_keeps_number(self):
        letter = self.draft()
        register_correspondence(letter, self.ceo)
        archive_correspondence(letter, self.ceo)
        letter.refresh_from_db()
        self.assertEqual(letter.current_status, "closed")
        self.assertIsNotNone(letter.archived_at)
        self.assertEqual(letter.registration_number, "1404/OUT/O/000001")

    def test_tenant_and_participant_access(self):
        letter = self.draft(user=self.sales)
        self.assertTrue(can_open(self.ceo, letter))
        self.assertTrue(can_open(self.sales, letter))  # sender + owner
        self.assertFalse(can_open(self.other_user, letter))
        self.assertEqual(visible_correspondence(self.other_user).count(), 0)

    def test_highly_confidential_hidden_from_non_participants(self):
        letter = self.draft(user=self.sales, confidentiality="highly_confidential")
        self.assertTrue(can_open(self.sales, letter))  # creator
        outsider = create_test_user(username="office_sales2", company=self.company, role="sales")
        self.assertFalse(can_open(outsider, letter))
        self.assertNotIn(letter, visible_correspondence(outsider))
        self.assertIn(letter, visible_correspondence(self.ceo))


class WorkbenchAPITests(OfficeTestBase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(user=self.ceo)

    def test_workbench_counts_action_items(self):
        letter = self.draft(recipients=[{
            "recipient_type": "user", "recipient_user_id": self.finance.id, "delivery_type": "action_required",
        }])
        register_correspondence(letter, self.ceo)
        self.client.force_authenticate(user=self.finance)
        response = self.client.get("/api/v1/office/workbench/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["buckets"]["action"], 1)
        self.assertEqual(response.data["data"]["buckets"]["inbox"], 1)

    def test_workbench_reports_type_books_and_unread(self):
        incoming = self.draft(correspondence_type="incoming", recipients=[{
            "recipient_type": "user", "recipient_user_id": self.finance.id,
        }])
        outgoing = self.draft(correspondence_type="outgoing", subject="نامه صادره")
        register_correspondence(incoming, self.ceo)
        register_correspondence(outgoing, self.ceo)

        self.client.force_authenticate(user=self.finance)
        data = self.client.get("/api/v1/office/workbench/").data["data"]
        self.assertEqual(data["types"]["incoming"], 1)
        self.assertEqual(data["types"]["outgoing"], 0)
        self.assertEqual(data["unread"], 1)

        # Opening the letter marks it read, so the dashboard counter drops.
        self.client.get(f"/api/v1/office/correspondence/{incoming.id}/")
        data = self.client.get("/api/v1/office/workbench/").data["data"]
        self.assertEqual(data["unread"], 0)

    def test_overdue_bucket(self):
        letter = self.draft(due_at=timezone.now() - datetime.timedelta(days=2))
        register_correspondence(letter, self.ceo)
        response = self.client.get("/api/v1/office/workbench/")
        self.assertEqual(response.data["data"]["buckets"]["overdue"], 1)

    def test_create_and_register_through_api(self):
        response = self.client.post("/api/v1/office/correspondence/", {
            "subject": "درخواست تسویه", "correspondence_type": "outgoing",
            "secretariat_id": self.secretariat.id, "letter_date_jalali": "1404/09/02",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        letter_id = response.data["data"]["id"]
        response = self.client.post(f"/api/v1/office/correspondence/{letter_id}/register/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["registration_number"], "1404/OUT/O/000001")

    def test_api_hides_other_company_letter(self):
        letter = self.draft()
        self.client.force_authenticate(user=self.other_user)
        response = self.client.get(f"/api/v1/office/correspondence/{letter.id}/")
        self.assertEqual(response.status_code, 404)

    def test_module_gate(self):
        company = create_test_company(name="No Office Co", enabled_modules=["crm"])
        user = create_test_user(username="no_office", company=company, role="sales")
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/v1/office/workbench/")
        self.assertEqual(response.status_code, 403)


class BusinessLinkTests(OfficeTestBase):
    def setUp(self):
        super().setUp()
        self.invoice = Invoice.objects.create(
            company=self.company, fiscal_year=self.fiscal_year, number=128, type="sales",
            date_jalali="1404/08/12", date=datetime.date(2025, 11, 3), customer=self.customer,
            subtotal=850000000, total=850000000, status="confirmed",
        )

    def test_invoice_resolution_for_finance(self):
        dto = resolve(self.company, "invoice", self.invoice.id, self.finance)
        self.assertEqual(dto["display"]["total_amount"], 850000000)
        self.assertEqual(dto["display"]["outstanding_amount"], 850000000)
        self.assertEqual(dto["links"]["invoice"], f"/erp/billing/invoices?invoice={self.invoice.id}")

    def test_sales_user_gets_no_amounts(self):
        dto = resolve(self.company, "invoice", self.invoice.id, self.sales)
        self.assertNotIn("total_amount", dto["display"])
        self.assertEqual(dto["display"]["invoice_number"], f"INV-{self.fiscal_year.id}-00128")

    def test_foreign_company_cannot_resolve(self):
        with self.assertRaises(OfficeError):
            resolve(self.other_company, "invoice", self.invoice.id, self.other_user)

    def test_letter_links_customer_and_invoice(self):
        letter = self.draft(recipients=[{
            "recipient_type": "user", "recipient_user_id": self.finance.id,
        }])
        client = APIClient()
        client.force_authenticate(user=self.finance)
        for entity_type, record_id in (("customer", self.customer.id), ("invoice", self.invoice.id)):
            response = client.post(f"/api/v1/office/correspondence/{letter.id}/business-links/", {
                "entity_type": entity_type, "source_record_id": str(record_id),
                "relationship_type": "concerns",
            }, format="json")
            self.assertEqual(response.status_code, 201)
        links = links_for(self.company, "correspondence", letter.id, self.finance)
        self.assertEqual(len(links), 2)
        self.assertTrue(all(link["state"] == "ok" for link in links))

    def test_link_to_missing_record_is_rejected(self):
        letter = self.draft()
        client = APIClient()
        client.force_authenticate(user=self.finance)
        response = client.post(f"/api/v1/office/correspondence/{letter.id}/business-links/", {
            "entity_type": "invoice", "source_record_id": "999999",
        }, format="json")
        self.assertEqual(response.status_code, 404)


class SecretariatNumberingTests(OfficeTestBase):
    """Admins and secretariat managers can shape the official number."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        from .models import SecretariatMember

        self.manager = create_test_user(
            username="office_manager", company=self.company, role="sales",
        )
        SecretariatMember.objects.create(secretariat=self.secretariat, user=self.manager)
        self.url = f"/api/v1/office/secretariats/{self.secretariat.id}/"

    def test_manager_sets_persian_numbering_and_registers(self):
        self.client.force_authenticate(self.manager)
        response = self.client.patch(self.url, {
            "number_pattern": "{year}/{type}-{seq}/{code}",
            "sequence_padding": 4,
            "persian_digits": True,
            "type_letters": {"outgoing": "ص"},
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)

        letter = self.draft()
        register_correspondence(letter, self.manager)
        letter.refresh_from_db()
        self.assertEqual(letter.registration_number, "۱۴۰۴/ص-۰۰۰۱/OUT")

    def test_non_member_cannot_change_numbering(self):
        self.client.force_authenticate(self.sales)
        response = self.client.patch(self.url, {"persian_digits": True}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_pattern_must_contain_sequence(self):
        self.client.force_authenticate(self.ceo)
        response = self.client.patch(self.url, {"number_pattern": "{year}/{code}"}, format="json")
        self.assertEqual(response.status_code, 400)


class ContractTests(OfficeTestBase):
    """Contracts are registered with an automatically issued letter."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.ceo)
        self.url = "/api/v1/office/contracts/"

    def payload(self, **kwargs):
        data = {
            "title": "حمل بار",
            "counterparty": "شرکت نمونه",
            "contract_number": "CN-101",
            "amount": "2500000",
            "currency": "IRR",
            "start_date_jalali": "1404/02/01",
            "end_date_jalali": "1404/12/01",
            "secretariat_id": self.secretariat.id,
        }
        data.update(kwargs)
        return data

    def test_contract_issues_registered_letter(self):
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        data = response.data["data"]
        self.assertEqual(data["registration_status"], "registered")
        self.assertEqual(data["letter_number"], "1404/OUT/C/000001")

        letter = Correspondence.objects.get(pk=data["letter_id"])
        self.assertEqual(letter.correspondence_type, "contract")
        self.assertEqual(letter.subject, "قرارداد حمل بار")
        self.assertIn("شرکت نمونه", letter.body)
        self.assertIn("2,500,000", letter.body)

    def test_contract_requires_core_fields(self):
        response = self.client.post(self.url, {"title": "", "counterparty": ""}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_contracts_are_company_scoped(self):
        self.client.post(self.url, self.payload(title="قرارداد من"), format="json")
        self.client.force_authenticate(self.other_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], [])

    def test_contracts_are_searchable(self):
        self.client.post(self.url, self.payload(), format="json")
        response = self.client.get(self.url, {"q": "نمونه"})
        self.assertEqual(len(response.data["data"]), 1)
