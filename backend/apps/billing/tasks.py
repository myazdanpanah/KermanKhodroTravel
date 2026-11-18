"""Async generation job (spec §11)."""

from __future__ import annotations

import logging

from celery import shared_task

from .models import ApprovalRequest
from .services.files import RETENTION_HOURS, purge_expired_files
from .services.generation import generate_request

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0, name="billing.generate_invoice")
def generate_invoice_task(self, request_id: int) -> dict:
    """
    Idempotent generation: re-running for an already generated request only
    fills the missing (request, service_type, file_name) tuples.
    """
    try:
        request_obj = ApprovalRequest.objects.get(pk=request_id)
    except ApprovalRequest.DoesNotExist:
        return {"ok": False, "error": "request-not-found"}

    if request_obj.status != ApprovalRequest.STATUS_APPROVED:
        return {"ok": False, "error": "not-approved"}

    try:
        files = generate_request(request_obj)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Invoice generation failed for request %s", request_id)
        # Spec §10.14: roll the approval back to pending and keep the error.
        request_obj.status = ApprovalRequest.STATUS_PENDING
        request_obj.approved_at = None
        request_obj.approved_by = None
        request_obj.generation_error = str(exc)[:2000]
        request_obj.save(
            update_fields=["status", "approved_at", "approved_by", "generation_error"]
        )
        return {"ok": False, "error": str(exc)}

    return {"ok": True, "files": [f.file_name for f in files]}


@shared_task(name="billing.purge_expired_files")
def purge_expired_files_task(older_than_hours: int = RETENTION_HOURS) -> dict:
    """Scheduled release of expired generated-file payloads (spec §7)."""
    purged = purge_expired_files(older_than_hours=older_than_hours)
    logger.info(
        "Purged %s expired billing file(s) (retention window: %s h)",
        purged,
        older_than_hours,
    )
    return {"purged": purged, "older_than_hours": older_than_hours}
