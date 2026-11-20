"""Office attachment tests: private storage, limits, permissions and download."""

import hashlib
import os
import shutil
import tempfile
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient

from .models import CorrespondenceAttachment
from .services import archive_correspondence
from .tests import OfficeTestBase


def upload_file(name="contract.pdf", content=b"%PDF-1.4 private", content_type="application/pdf"):
    return SimpleUploadedFile(name, content, content_type=content_type)


class AttachmentTestBase(OfficeTestBase):
    def setUp(self):
        super().setUp()
        self.root = tempfile.mkdtemp(prefix="office-attachments-")
        self.override = override_settings(OFFICE_ATTACHMENT_ROOT=self.root)
        self.override.enable()
        self.addCleanup(shutil.rmtree, self.root, True)
        self.addCleanup(self.override.disable)
        self.client = APIClient()
        self.client.force_authenticate(self.ceo)

    def upload(self, letter, user=None, **kwargs):
        client = self.client
        if user is not None:
            client = APIClient()
            client.force_authenticate(user)
        return client.post(
            f"/api/v1/office/correspondence/{letter.id}/attachments/",
            {"file": upload_file(**kwargs)},
            format="multipart",
        )

    def download(self, letter, attachment, user=None):
        client = self.client
        if user is not None:
            client = APIClient()
            client.force_authenticate(user)
        return client.get(
            f"/api/v1/office/correspondence/{letter.id}/attachments/{attachment.id}/download/",
        )


class AttachmentUploadTests(AttachmentTestBase):
    def test_upload_is_stored_privately_and_listed(self):
        letter = self.draft()
        response = self.upload(letter)
        self.assertEqual(response.status_code, 201, response.data)
        attachment = CorrespondenceAttachment.objects.get(pk=response.data["data"]["id"])
        self.assertEqual(attachment.original_name, "contract.pdf")
        self.assertEqual(attachment.size_bytes, len(b"%PDF-1.4 private"))
        self.assertEqual(attachment.checksum, hashlib.sha256(b"%PDF-1.4 private").hexdigest())
        self.assertTrue(attachment.file.path.startswith(self.root))
        self.assertNotIn("media", attachment.file.name.split("/")[0])
        with self.assertRaises(ValueError):
            attachment.file.url

        detail = self.client.get(f"/api/v1/office/correspondence/{letter.id}/")
        attachments = detail.data["data"]["attachments"]
        self.assertEqual(len(attachments), 1)
        self.assertEqual(attachments[0]["original_name"], "contract.pdf")

        timeline = self.client.get(f"/api/v1/office/correspondence/{letter.id}/timeline/")
        self.assertTrue(any(e["action"] == "attachment_added" for e in timeline.data["data"]))

    def test_rejects_disallowed_extension(self):
        letter = self.draft()
        response = self.upload(letter, name="setup.exe", content=b"MZ", content_type="application/pdf")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(letter.attachments.count(), 0)

    def test_rejects_content_type_mismatch(self):
        letter = self.draft()
        response = self.upload(letter, content_type="text/plain")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(letter.attachments.count(), 0)

    def test_rejects_empty_and_oversized_files(self):
        letter = self.draft()
        empty = SimpleUploadedFile("contract.pdf", b"", content_type="application/pdf")
        response = self.client.post(
            f"/api/v1/office/correspondence/{letter.id}/attachments/",
            {"file": empty}, format="multipart",
        )
        self.assertEqual(response.status_code, 422)
        with patch("apps.office.services.ATTACHMENT_MAX_BYTES", 4):
            response = self.upload(letter, content=b"12345")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(letter.attachments.count(), 0)

    def test_caps_attachments_per_letter(self):
        letter = self.draft()
        self.assertEqual(self.upload(letter).status_code, 201)
        with patch("apps.office.services.ATTACHMENT_MAX_PER_LETTER", 1):
            response = self.upload(letter, name="second.pdf")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(letter.attachments.count(), 1)

    def test_archived_letter_rejects_upload(self):
        letter = self.draft()
        archive_correspondence(letter, self.ceo)
        letter.refresh_from_db()
        self.assertEqual(self.upload(letter).status_code, 422)
        self.assertEqual(letter.attachments.count(), 0)


class AttachmentAccessTests(AttachmentTestBase):
    def test_recipient_can_download_but_unrelated_users_cannot(self):
        letter = self.draft(recipients=[{
            "recipient_type": "user", "recipient_user_id": self.finance.id,
            "delivery_type": "action_required",
        }])
        upload = self.upload(letter)
        attachment = CorrespondenceAttachment.objects.get(pk=upload.data["data"]["id"])

        response = self.download(letter, attachment, user=self.finance)
        self.assertEqual(response.status_code, 200)
        body = b"".join(response.streaming_content)
        self.assertEqual(body, b"%PDF-1.4 private")
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertIn("contract.pdf", response["Content-Disposition"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["Cache-Control"], "private, no-store")

        # A same-company user not attached to the letter cannot see it.
        self.assertEqual(self.download(letter, attachment, user=self.sales).status_code, 404)
        # Another company can never reach it, even with the same id pair.
        self.assertEqual(self.download(letter, attachment, user=self.other_user).status_code, 404)
        anonymous = APIClient().get(
            f"/api/v1/office/correspondence/{letter.id}/attachments/{attachment.id}/download/",
        )
        self.assertIn(anonymous.status_code, (401, 403))

    def test_confidential_letter_attachment_is_hidden(self):
        letter = self.draft(confidentiality="highly_confidential", recipients=[{
            "recipient_type": "user", "recipient_user_id": self.finance.id,
        }])
        upload = self.upload(letter)
        attachment = CorrespondenceAttachment.objects.get(pk=upload.data["data"]["id"])
        self.assertEqual(self.download(letter, attachment, user=self.finance).status_code, 200)
        self.assertEqual(self.download(letter, attachment, user=self.sales).status_code, 404)

    def test_delete_removes_file_and_requires_authority(self):
        letter = self.draft(recipients=[{
            "recipient_type": "user", "recipient_user_id": self.finance.id,
        }])
        upload = self.upload(letter)
        attachment = CorrespondenceAttachment.objects.get(pk=upload.data["data"]["id"])
        path = attachment.file.path
        self.assertTrue(attachment.file.storage.exists(attachment.file.name))

        finance_client = APIClient()
        finance_client.force_authenticate(self.finance)
        denied = finance_client.delete(
            f"/api/v1/office/correspondence/{letter.id}/attachments/{attachment.id}/",
        )
        self.assertEqual(denied.status_code, 403)
        self.assertTrue(attachment.file.storage.exists(attachment.file.name))

        deleted = self.client.delete(
            f"/api/v1/office/correspondence/{letter.id}/attachments/{attachment.id}/",
        )
        self.assertEqual(deleted.status_code, 200)
        self.assertFalse(CorrespondenceAttachment.objects.filter(pk=attachment.id).exists())
        self.assertFalse(attachment.file.storage.exists(attachment.file.name))
        self.assertFalse(os.path.exists(path))
