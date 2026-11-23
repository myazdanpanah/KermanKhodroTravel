import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Company
from apps.messaging.models import Conversation, ConversationMembership, Message
from apps.billing.models import Invoice, Payment
from apps.office.models import Correspondence

User = get_user_model()


class EntityIntegrationTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name="شرکت کرمان خودرو")
        self.user = User.objects.create_user(
            username="testuser",
            password="password123",
            company=self.company,
            first_name="علی",
            last_name="محمدی",
            last_seen_at=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Seed an invoice
        self.invoice = Invoice.objects.create(
            letter_number="1404/1018/1/0001",
            payer="شرکت تست ۱",
            payer_code="101",
            invoice_type="اقامت",
            amount=50000000,
            issue_date=timezone.now().date(),
            period_range="از 1404/01/01 تا 1404/01/31",
        )

        # Seed a payment
        self.payment = Payment.objects.create(
            payment_code="PAY-101",
            payer_name="شرکت تست ۱",
            payer_code="101",
            amount=20000000,
            payment_date=timezone.now().date(),
            tracking_number="TRK-987654",
        )

        # Seed a correspondence
        self.letter = Correspondence.objects.create(
            company=self.company,
            correspondence_type="outgoing",
            registration_status="registered",
            registration_number="1404/01/ص/0005",
            subject="ارسال صورت‌حساب فروردین",
            body="احتراما صورت‌حساب به پیوست ارسال می‌گردد.",
            sender_name="امور مالی",
        )

        # Create conversation
        self.conv = Conversation.objects.create(
            company=self.company,
            kind="GROUP",
            title="گروه هماهنگی مالی",
            created_by=self.user,
        )
        ConversationMembership.objects.create(
            company=self.company,
            conversation=self.conv,
            user=self.user,
            role="OWNER",
            state="ACTIVE",
        )

    def test_search_correspondence_entities(self):
        resp = self.client.get("/api/v1/messaging/entities/search/", {"type": "correspondence", "q": "صورت‌حساب"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(len(data), 1)
        self.assertEqual(data[0]["entity_type"], "correspondence")
        self.assertEqual(data[0]["code"], "1404/01/ص/0005")

    def test_search_invoice_entities(self):
        resp = self.client.get("/api/v1/messaging/entities/search/", {"type": "invoice", "q": "1404/1018"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(len(data), 1)
        self.assertEqual(data[0]["entity_type"], "invoice")
        self.assertEqual(data[0]["amount"], 50000000)

    def test_search_payment_entities(self):
        resp = self.client.get("/api/v1/messaging/entities/search/", {"type": "payment", "q": "987654"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(len(data), 1)
        self.assertEqual(data[0]["entity_type"], "payment")
        self.assertEqual(data[0]["amount"], 20000000)

    def test_send_entity_link_message(self):
        payload = {
            "content": "لطفا این صورت‌حساب را بررسی کنید",
            "message_type": "ENTITY_LINK",
            "metadata": {
                "entity_type": "invoice",
                "entity_id": str(self.invoice.id),
                "title": f"صورت‌حساب اقامت - {self.invoice.payer}",
                "code": self.invoice.letter_number,
                "amount": self.invoice.amount,
                "badge": "صورت‌حساب مالی",
            },
        }
        resp = self.client.post(f"/api/v1/messaging/conversations/{self.conv.id}/messages/", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        msg_data = resp.json()
        self.assertEqual(msg_data["message_type"], "ENTITY_LINK")
        self.assertIn("metadata", msg_data)
        self.assertEqual(msg_data["metadata"]["code"], "1404/1018/1/0001")
        self.assertEqual(msg_data["metadata"]["amount"], 50000000)

    def test_entity_preview_endpoint(self):
        resp = self.client.get(f"/api/v1/messaging/entities/preview/correspondence/{self.letter.id}/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["subject"], "ارسال صورت‌حساب فروردین")
        self.assertEqual(data["registration_number"], "1404/01/ص/0005")
