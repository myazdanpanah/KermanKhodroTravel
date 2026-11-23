import os
from pathlib import Path
from django.conf import settings
from django.core.files.storage import FileSystemStorage


class MessagingAttachmentStorage(FileSystemStorage):
    """Private filesystem storage for Orbit messaging attachments.
    Files have no public URL and can only be served via authenticated permission-checked streaming endpoints.
    """

    def __init__(self):
        super().__init__(base_url=None)

    @property
    def base_location(self):
        return str(getattr(settings, "MESSAGING_ATTACHMENT_ROOT", None) or (
            Path(settings.BASE_DIR) / "private_media" / "messaging"
        ))

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    def url(self, name):
        raise ValueError("Messaging attachments are private and have no public URL")


messaging_attachment_storage = MessagingAttachmentStorage()
