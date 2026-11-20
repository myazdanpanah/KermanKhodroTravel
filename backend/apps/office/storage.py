"""Private storage for Office attachments.

Files are written outside MEDIA_ROOT so the development web server (and any
production web server pointed at MEDIA_ROOT) can never serve them directly.
Every download goes through an authenticated view that checks office-module
access, company scope and letter visibility first.
"""

import os
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage


class OfficeAttachmentStorage(FileSystemStorage):
    """Filesystem storage with no public URL."""

    def __init__(self):
        super().__init__(base_url=None)

    @property
    def base_location(self):
        # Resolved lazily so tests can point the storage at a temporary root.
        return str(getattr(settings, "OFFICE_ATTACHMENT_ROOT", None) or (
            Path(settings.BASE_DIR) / "private_media" / "office"
        ))

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    def url(self, name):
        raise ValueError("Office attachments are private and have no public URL")


attachment_storage = OfficeAttachmentStorage()
