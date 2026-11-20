"""Draft editing tests: PATCH validation, recipient replacement and access."""

from rest_framework.test import APIClient

from .services import register_correspondence
from .tests import OfficeTestBase


class DraftEditTests(OfficeTestBase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.ceo)
        self.letter = self.draft(recipients=[{
            "recipient_type": "user", "recipient_user_id": self.finance.id,
            "delivery_type": "action_required",
        }])

    def patch(self, payload, letter=None):
        letter = letter or self.letter
        return self.client.patch(f"/api/v1/office/correspondence/{letter.id}/", payload, format="json")

    def test_creator_updates_fields_and_recipients(self):
        response = self.patch({
            "subject": "موضوع اصلاح‌شده",
            "body": "متن تازه",
            "priority": "urgent",
            "due_at": "2026-01-20T10:00:00Z",
            "recipients": [
                {"recipient_type": "user", "recipient_user_id": self.finance.id, "delivery_type": "cc"},
                {"recipient_type": "user", "recipient_user_id": self.sales.id, "delivery_type": "information"},
            ],
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.letter.refresh_from_db()
        self.assertEqual(self.letter.subject, "موضوع اصلاح‌شده")
        self.assertEqual(self.letter.body, "متن تازه")
        self.assertEqual(self.letter.priority, "urgent")
        self.assertIsNotNone(self.letter.due_at)
        self.assertEqual(self.letter.recipients.count(), 2)
        self.assertEqual(
            set(self.letter.recipients.values_list("recipient_user_id", "delivery_type")),
            {(self.finance.id, "cc"), (self.sales.id, "information")},
        )
        self.assertEqual(self.letter.updated_by, self.ceo)
        self.assertTrue(
            self.letter.actions.filter(action="updated").exists(),
        )

    def test_recipients_can_be_cleared_and_due_date_removed(self):
        response = self.patch({"recipients": [], "due_at": None})
        self.assertEqual(response.status_code, 200, response.data)
        self.letter.refresh_from_db()
        self.assertEqual(self.letter.recipients.count(), 0)
        self.assertIsNone(self.letter.due_at)

    def test_rejects_invalid_priority_and_due_date(self):
        self.assertEqual(self.patch({"priority": "someday"}).status_code, 400)
        self.assertEqual(self.patch({"due_at": "not-a-date"}).status_code, 400)
        self.assertEqual(self.patch({"subject": "   "}).status_code, 400)
        self.letter.refresh_from_db()
        self.assertEqual(self.letter.priority, "normal")

    def test_rejects_recipient_from_another_company(self):
        response = self.patch({"recipients": [
            {"recipient_type": "user", "recipient_user_id": self.other_user.id},
        ]})
        self.assertEqual(response.status_code, 422)
        self.letter.refresh_from_db()
        self.assertEqual(self.letter.recipients.count(), 1)
        self.assertEqual(self.letter.recipients.first().recipient_user_id, self.finance.id)

    def test_registered_letter_is_not_editable(self):
        register_correspondence(self.letter, self.ceo)
        response = self.patch({"subject": "دیر شده"})
        self.assertEqual(response.status_code, 422)
        self.letter.refresh_from_db()
        self.assertEqual(self.letter.subject, "نامه آزمایشی")

    def test_archived_draft_is_not_editable(self):
        self.letter.archived_at = self.letter.updated_at
        self.letter.save(update_fields=["archived_at"])
        self.assertEqual(self.patch({"subject": "تغییر"}).status_code, 422)

    def test_recipient_cannot_edit_someone_elses_draft(self):
        client = APIClient()
        client.force_authenticate(self.finance)
        response = client.patch(
            f"/api/v1/office/correspondence/{self.letter.id}/", {"subject": "تغییر"}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.letter.refresh_from_db()
        self.assertEqual(self.letter.subject, "نامه آزمایشی")

    def test_can_edit_flag_follows_creator_and_registration(self):
        detail = self.client.get(f"/api/v1/office/correspondence/{self.letter.id}/")
        self.assertTrue(detail.data["data"]["can_edit"])

        finance_client = APIClient()
        finance_client.force_authenticate(self.finance)
        detail = finance_client.get(f"/api/v1/office/correspondence/{self.letter.id}/")
        self.assertFalse(detail.data["data"]["can_edit"])

        register_correspondence(self.letter, self.ceo)
        detail = self.client.get(f"/api/v1/office/correspondence/{self.letter.id}/")
        self.assertFalse(detail.data["data"]["can_edit"])


class VisibilityRegressionTests(OfficeTestBase):
    def test_user_without_team_does_not_see_unrelated_recipients(self):
        letter = self.draft(recipients=[{
            "recipient_type": "user", "recipient_user_id": self.finance.id,
        }])
        self.assertIsNone(self.sales.team_id)
        self.assertIsNone(self.sales.division_id)
        client = APIClient()
        client.force_authenticate(self.sales)
        response = client.get(f"/api/v1/office/correspondence/{letter.id}/")
        self.assertEqual(response.status_code, 404)
