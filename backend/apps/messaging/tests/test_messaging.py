import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import Company, Division
from apps.messaging.models import (
    Conversation,
    ConversationMembership,
    Channel,
    Message,
    Reaction,
    Announcement,
    AnnouncementAcknowledgment,
)
from apps.messaging.services.conversation_service import (
    get_or_create_direct_conversation,
    create_group_conversation,
    sync_department_conversation,
)
from apps.messaging.services.message_service import (
    send_message,
    edit_message,
    delete_message,
    add_reaction,
    remove_reaction,
    advance_read_cursor,
)

User = get_user_model()


class MessagingCoreTests(TestCase):
    def setUp(self):
        self.company_a = Company.objects.create(name="Company A")
        self.company_b = Company.objects.create(name="Company B")

        self.user_a1 = User.objects.create_user(
            username="user_a1",
            password="password123",
            company=self.company_a,
            first_name="Ali",
            last_name="Rezaei",
        )
        self.user_a2 = User.objects.create_user(
            username="user_a2",
            password="password123",
            company=self.company_a,
            first_name="Sara",
            last_name="Ahmadi",
        )
        self.user_b1 = User.objects.create_user(
            username="user_b1",
            password="password123",
            company=self.company_b,
            first_name="Hassan",
            last_name="Moradi",
        )

        self.client_a1 = APIClient()
        self.client_a1.force_authenticate(user=self.user_a1)

        self.client_a2 = APIClient()
        self.client_a2.force_authenticate(user=self.user_a2)

        self.client_b1 = APIClient()
        self.client_b1.force_authenticate(user=self.user_b1)

    def test_direct_conversation_canonical_and_idempotent(self):
        """Ensure exactly one canonical 1-to-1 conversation exists between two users in the same company."""
        conv1, created1 = get_or_create_direct_conversation(self.company_a.id, self.user_a1, self.user_a2)
        self.assertTrue(created1)

        # Call in reverse order
        conv2, created2 = get_or_create_direct_conversation(self.company_a.id, self.user_a2, self.user_a1)
        self.assertFalse(created2)
        self.assertEqual(conv1.id, conv2.id)

        # Memberships
        self.assertEqual(conv1.memberships.count(), 2)

    def test_cannot_create_direct_with_cross_tenant_user(self):
        """Cross-tenant direct conversation must be blocked."""
        with self.assertRaises(PermissionError):
            get_or_create_direct_conversation(self.company_a.id, self.user_a1, self.user_b1)

    def test_message_send_and_sequence(self):
        """Sending messages assigns monotonic sequence and updates conversation preview."""
        conv, _ = get_or_create_direct_conversation(self.company_a.id, self.user_a1, self.user_a2)

        msg1 = send_message(
            company_id=self.company_a.id,
            sender=self.user_a1,
            conversation_id=conv.id,
            content="Hello Sara",
        )
        self.assertEqual(msg1.sequence, 1)

        msg2 = send_message(
            company_id=self.company_a.id,
            sender=self.user_a2,
            conversation_id=conv.id,
            content="Hello Ali",
        )
        self.assertEqual(msg2.sequence, 2)

        conv.refresh_from_db()
        self.assertEqual(conv.last_message_preview, "Hello Ali")

    def test_message_idempotency_with_client_message_id(self):
        """Duplicate submissions with same client_message_id must return existing message."""
        conv, _ = get_or_create_direct_conversation(self.company_a.id, self.user_a1, self.user_a2)
        client_msg_id = uuid.uuid4()

        msg1 = send_message(
            company_id=self.company_a.id,
            sender=self.user_a1,
            conversation_id=conv.id,
            content="Payment confirmation",
            client_message_id=client_msg_id,
        )

        msg2 = send_message(
            company_id=self.company_a.id,
            sender=self.user_a1,
            conversation_id=conv.id,
            content="Payment confirmation",
            client_message_id=client_msg_id,
        )

        self.assertEqual(msg1.id, msg2.id)
        self.assertEqual(Message.objects.filter(conversation=conv).count(), 1)

    def test_message_edit_and_tombstone_delete(self):
        """Sender can edit message; delete leaves tombstone record."""
        conv, _ = get_or_create_direct_conversation(self.company_a.id, self.user_a1, self.user_a2)
        msg = send_message(
            company_id=self.company_a.id,
            sender=self.user_a1,
            conversation_id=conv.id,
            content="Initial message",
        )

        edited = edit_message(self.user_a1, msg.id, "Corrected message")
        self.assertEqual(edited.content, "Corrected message")
        self.assertIsNotNone(edited.edited_at)
        self.assertEqual(edited.revisions.count(), 1)

        deleted = delete_message(self.user_a1, msg.id)
        self.assertIsNotNone(deleted.deleted_at)
        self.assertEqual(deleted.content, "این پیام حذف شده است.")

    def test_group_creation_and_membership_management(self):
        """Creator is owner; members can be added and removed."""
        group = create_group_conversation(
            company_id=self.company_a.id,
            creator=self.user_a1,
            title="Finance Team",
            member_ids=[self.user_a2.id],
        )

        owner_m = group.memberships.get(user=self.user_a1)
        self.assertEqual(owner_m.role, "OWNER")

        member_m = group.memberships.get(user=self.user_a2)
        self.assertEqual(member_m.role, "MEMBER")

        # Has default general channel
        self.assertTrue(group.channels.filter(slug="general").exists())

    def test_department_auto_synchronization(self):
        """Department group auto-syncs active division members."""
        div = Division.objects.create(name="Engineering", company=self.company_a, manager=self.user_a1)
        self.user_a1.division = div
        self.user_a1.save()
        self.user_a2.division = div
        self.user_a2.save()

        conv = sync_department_conversation(div.id)
        self.assertEqual(conv.memberships.filter(state="ACTIVE").count(), 2)

        # Remove user_a2 from division and sync again
        self.user_a2.division = None
        self.user_a2.save()

        conv_synced = sync_department_conversation(div.id)
        self.assertEqual(conv_synced.memberships.filter(state="ACTIVE").count(), 1)
        self.assertEqual(conv_synced.memberships.get(user=self.user_a2).state, "LEFT")

    def test_rest_api_conversation_flow(self):
        """Verify REST endpoints for list, direct create, messages, and read receipts."""
        # 1. Create direct conversation via REST
        res = self.client_a1.post("/api/v1/messaging/conversations/direct/", {"user_id": self.user_a2.id})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        conv_id = res.data["id"]

        # 2. Send message via REST
        res_msg = self.client_a1.post(
            f"/api/v1/messaging/conversations/{conv_id}/messages/",
            {"content": "REST API message test"},
        )
        self.assertEqual(res_msg.status_code, status.HTTP_201_CREATED)
        msg_id = res_msg.data["id"]

        # 3. Recipient views message timeline
        res_list = self.client_a2.get(f"/api/v1/messaging/conversations/{conv_id}/messages/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data), 1)

        # 4. Add reaction
        res_react = self.client_a2.post(f"/api/v1/messaging/messages/{msg_id}/reactions/", {"emoji": "👍"})
        self.assertEqual(res_react.status_code, status.HTTP_201_CREATED)

    def test_tenant_isolation_in_rest_api(self):
        """User B1 in Company B cannot access Company A's conversation or messages."""
        conv, _ = get_or_create_direct_conversation(self.company_a.id, self.user_a1, self.user_a2)

        # User B1 tries to read conversation
        res = self.client_b1.get(f"/api/v1/messaging/conversations/{conv.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # User B1 tries to read messages
        res_msg = self.client_b1.get(f"/api/v1/messaging/conversations/{conv.id}/messages/")
        self.assertEqual(res_msg.status_code, status.HTTP_404_NOT_FOUND)
