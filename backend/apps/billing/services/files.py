"""
Dual storage for generated documents (spec §7).

Every artifact is written twice: ``FinalFile.file_data`` (BLOB, transactional
and backup-safe) and a disk file under ``{base}/{letter_number}/{type}_{name}``.
If the disk copy disappears, download re-creates it from the BLOB.
"""

from __future__ import annotations

import re
from pathlib import Path

from django.conf import settings as django_settings
from django.utils import timezone

from ..models import CompanySettings, FinalFile

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.\u0600-\u06FF\-]+")


def safe_name(name: str) -> str:
    cleaned = _SAFE_NAME_RE.sub("_", (name or "file").strip())
    return cleaned[:180] or "file"


def safe_letter_dir(letter_number: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-]", "_", letter_number or "unknown")


def storage_root() -> Path:
    configured = (CompanySettings.load().approved_output_path or "").strip()
    base = Path(configured) if configured else Path(django_settings.MEDIA_ROOT) / "approved"
    base.mkdir(parents=True, exist_ok=True)
    return base


def relative_path(letter_number: str, service_type: str, file_name: str) -> str:
    return f"{safe_letter_dir(letter_number)}/{service_type}_{safe_name(file_name)}"


def save_final_file(
    request_obj,
    service_type: str,
    file_name: str,
    data: bytes,
    letter_number: str | None = None,
) -> FinalFile:
    """Write the artifact to disk and to the BLOB column (idempotent)."""
    letter_number = letter_number or request_obj.letter_number
    rel_path = relative_path(letter_number, service_type, file_name)
    absolute = storage_root() / rel_path
    absolute.parent.mkdir(parents=True, exist_ok=True)
    absolute.write_bytes(data)

    obj, created = FinalFile.objects.get_or_create(
        request=request_obj,
        service_type=service_type,
        file_name=file_name,
        defaults={
            "letter_number": letter_number,
            "file_path": rel_path,
            "file_data": data,
            "is_deleted_from_disk": False,
        },
    )
    if not created:
        obj.letter_number = letter_number
        obj.file_path = rel_path
        obj.file_data = data
        obj.is_deleted_from_disk = False
        obj.save(update_fields=["letter_number", "file_path", "file_data", "is_deleted_from_disk"])
    return obj


def ensure_on_disk(final_file: FinalFile) -> Path:
    """
    Return a readable path for the file, restoring it from the BLOB when the
    disk copy is missing or empty (spec §7 recovery flow).
    """
    rel_path = final_file.file_path or relative_path(
        final_file.letter_number, final_file.service_type, final_file.file_name
    )
    absolute = storage_root() / rel_path

    if not absolute.exists() or absolute.stat().st_size == 0:
        if not final_file.file_data:
            raise FileNotFoundError(f"فایلی برای {final_file.file_name} موجود نیست.")
        absolute.parent.mkdir(parents=True, exist_ok=True)
        absolute.write_bytes(bytes(final_file.file_data))
        final_file.file_path = rel_path
        final_file.is_deleted_from_disk = False
        final_file.save(update_fields=["file_path", "is_deleted_from_disk"])

    return absolute


def read_bytes(final_file: FinalFile) -> bytes:
    absolute = ensure_on_disk(final_file)
    data = absolute.read_bytes()
    final_file.last_accessed = timezone.now()
    final_file.save(update_fields=["last_accessed"])
    return data


def delete_disk_copy(final_file: FinalFile) -> None:
    rel_path = final_file.file_path or relative_path(
        final_file.letter_number, final_file.service_type, final_file.file_name
    )
    absolute = storage_root() / rel_path
    if absolute.exists():
        absolute.unlink()
    final_file.is_deleted_from_disk = True
    final_file.save(update_fields=["is_deleted_from_disk"])
