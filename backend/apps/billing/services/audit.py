"""Audit trail for money rows: who reversed or deleted what.

Invoices are reversed in place (their letter number is never freed), while
payments, manual debts and credits are still removed — before the row goes, its
full contents are written to ``BillingAuditEntry`` together with the actor.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.utils import timezone

from ..models import BillingAuditEntry


def _json_safe(value):
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return value


def snapshot(instance) -> dict:
    """Every stored field of the row, as JSON-safe values."""
    return {
        field.name: _json_safe(getattr(instance, field.attname, None))
        for field in instance._meta.fields
    }


def record_deletion(actor, entity: str, instance, reason: str = "") -> BillingAuditEntry:
    """Write the row's contents to the audit trail before deleting it."""
    return BillingAuditEntry.objects.create(
        entity=entity,
        object_id=str(instance.pk),
        object_label=str(instance)[:200],
        action=BillingAuditEntry.ACTION_DELETED,
        reason=(reason or "")[:500],
        snapshot=snapshot(instance),
        actor=actor,
    )


def reverse_invoice(invoice, actor, reason: str = ""):
    """Void an issued invoice without removing it or recycling its number."""
    if invoice.reversed_at is not None:
        return invoice
    invoice.reversed_at = timezone.now()
    invoice.reversed_by = actor
    invoice.reversal_reason = (reason or "")[:500]
    invoice.save(update_fields=["reversed_at", "reversed_by", "reversal_reason"])
    BillingAuditEntry.objects.create(
        entity="invoice",
        object_id=str(invoice.pk),
        object_label=str(invoice)[:200],
        action=BillingAuditEntry.ACTION_REVERSED,
        reason=invoice.reversal_reason,
        snapshot=snapshot(invoice),
        actor=actor,
    )
    return invoice
