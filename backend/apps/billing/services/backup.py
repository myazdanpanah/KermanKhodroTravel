"""Backup and restore of the billing tables (spec §6.14).

A snapshot is a JSON document holding every billing row, including the
approval requests, generated files and letter-numbering tables. Those last
tables are what makes a restore safe: an invoice keeps its printed letter
number forever, so the sequence of every payer/year is raised to at least the
highest number found in the restored invoices and any recycled number that
collides with one is dropped. Without that, a restore would hand out numbers
that are already on paper.
"""

from __future__ import annotations

import base64
import re

from django.contrib.auth import get_user_model
from django.db import transaction

from ..models import (
    ApprovalRequest,
    AvailableLetterNumber,
    Credit,
    FinalFile,
    Invoice,
    InvoiceTemplate,
    LetterSequence,
    ManualDebt,
    Payer,
    Payment,
    ServiceCategory,
)

# Every table the snapshot carries. Older snapshots simply lack the newer keys
# and those tables are then left untouched instead of being wiped.
BACKUP_TABLES = (
    ("payers", Payer),
    ("invoices", Invoice),
    ("payments", Payment),
    ("debts", ManualDebt),
    ("credits", Credit),
    ("service_categories", ServiceCategory),
    ("templates", InvoiceTemplate),
    ("approval_requests", ApprovalRequest),
    ("final_files", FinalFile),
    ("letter_sequences", LetterSequence),
    ("available_letter_numbers", AvailableLetterNumber),
)

# Child tables first so the foreign keys never block a delete.
RESTORE_DELETE_ORDER = (
    "final_files",
    "approval_requests",
    "invoices",
    "payments",
    "debts",
    "credits",
    "available_letter_numbers",
    "letter_sequences",
    "payers",
    "service_categories",
)

# Templates are versioned: a restore adds rows but never removes history.
RESTORE_KEEP = {"templates"}

MODEL_BY_NAME = dict(BACKUP_TABLES)

# '1404/7001/00012' -> ('7001', '04', 12); legacy shapes are left alone.
_LETTER_RE = re.compile(r"^\s*(\d{4})\s*/\s*([^/\s]+)\s*/\s*(\d+)\s*$")


class RestoreError(ValueError):
    """The snapshot cannot be applied without corrupting the ledger."""


def serialize_tables() -> dict[str, list[dict]]:
    """Every row of every backed-up table, JSON-safe."""
    tables: dict[str, list[dict]] = {}
    for name, model in BACKUP_TABLES:
        rows = list(model.objects.all().values())
        if model is FinalFile:
            for row in rows:
                payload = row.pop("file_data", None)
                if payload:
                    row["file_data_b64"] = base64.b64encode(bytes(payload)).decode("ascii")
        tables[name] = rows
    return tables


def _existing_user_ids() -> set[int]:
    return set(get_user_model().objects.values_list("pk", flat=True))


def _sanitize_user_links(model, row: dict, user_ids: set[int]) -> None:
    """Drop foreign keys to users that do not exist in this installation."""
    for field in model._meta.fields:
        if not field.is_relation or not field.null:
            continue
        if field.related_model is not get_user_model():
            continue
        value = row.get(field.attname)
        if value is not None and value not in user_ids:
            row[field.attname] = None


def _required_user_link(model, row: dict, user_ids: set[int]) -> None:
    for field in model._meta.fields:
        if not field.is_relation or field.null:
            continue
        if field.related_model is not get_user_model():
            continue
        value = row.get(field.attname)
        if value is not None and value not in user_ids:
            raise RestoreError(
                f"{model.__name__}.{field.name} به کاربر {value} اشاره می‌کند که در این نصب وجود ندارد."
            )


def _rows_for(model, rows: list[dict], user_ids: set[int]) -> list:
    prepared = []
    for raw in rows:
        row = dict(raw)
        if model is FinalFile:
            encoded = row.pop("file_data_b64", None)
            row["file_data"] = base64.b64decode(encoded) if encoded else None
        _required_user_link(model, row, user_ids)
        _sanitize_user_links(model, row, user_ids)
        prepared.append(model(**row))
    return prepared


def _restore_payers(rows: list[dict], user_ids: set[int]) -> int:
    """Create payers parent-less, then link parents in a second pass.

    ``Payer.parent`` points at another payer, so a single bulk insert fails
    whenever a subsidiary sorts before its parent. Two phases keep the foreign
    key satisfied without relying on row order.
    """
    parents: dict[str, str | None] = {}
    payers = []
    for raw in rows:
        row = dict(raw)
        parents[row["code"]] = row.pop("parent_id", None) or row.pop("parent", None)
        payers.append(Payer(**row))
    if payers:
        Payer.objects.bulk_create(payers)
        for payer in payers:
            payer.parent_id = parents.get(payer.pk)
        Payer.objects.bulk_update(payers, ["parent"])
    return len(payers)


def restore_tables(tables: dict[str, list[dict]]) -> dict[str, int]:
    """Replace the tables present in ``tables`` and repair the numbering."""
    known = {name for name, _ in BACKUP_TABLES}
    unknown = set(tables) - known
    if unknown:
        raise RestoreError(f"جدول‌های ناشناخته در فایل پشتیبان: {', '.join(sorted(unknown))}")

    user_ids = _existing_user_ids()
    restored: dict[str, int] = {}
    with transaction.atomic():
        for name in RESTORE_DELETE_ORDER:
            if name in tables and name not in RESTORE_KEEP:
                MODEL_BY_NAME[name].objects.all().delete()

        for name, model in BACKUP_TABLES:
            if name in RESTORE_KEEP or name not in tables:
                continue
            if model is Payer:
                restored[name] = _restore_payers(tables[name] or [], user_ids)
                continue
            rows = _rows_for(model, tables[name] or [], user_ids)
            if rows:
                model.objects.bulk_create(rows)
            restored[name] = len(rows)

        restored.update(sync_letter_numbering())

    return restored


def letter_number_parts(letter_number: str) -> tuple[str, str, int] | None:
    match = _LETTER_RE.match(letter_number or "")
    if not match:
        return None
    return match.group(2), match.group(1)[-2:], int(match.group(3))


def sync_letter_numbering() -> dict[str, int]:
    """Make the counters agree with the invoices that are actually restored.

    Raises every payer/year sequence to the highest invoice number in the
    database and removes recycled numbers an existing invoice already owns, so
    the next approval can never be handed a number that was already printed.
    """
    used: dict[tuple[str, str], set[int]] = {}
    for letter_number in Invoice.objects.values_list("letter_number", flat=True):
        parts = letter_number_parts(letter_number)
        if parts is None:
            continue
        code, year, number = parts
        used.setdefault((code, year), set()).add(number)

    bumped = 0
    for (code, year), numbers in used.items():
        top = max(numbers)
        sequence, created = LetterSequence.objects.get_or_create(
            payer_code=code, year=year, defaults={"last_number": top}
        )
        if not created and sequence.last_number < top:
            sequence.last_number = top
            sequence.save(update_fields=["last_number"])
            bumped += 1

    recycled = 0
    for (code, year), numbers in used.items():
        recycled += (
            AvailableLetterNumber.objects.filter(
                payer_code=code, year=year, number__in=numbers
            ).delete()[0]
        )

    return {"sequences_bumped": bumped, "recycled_numbers_removed": recycled}
