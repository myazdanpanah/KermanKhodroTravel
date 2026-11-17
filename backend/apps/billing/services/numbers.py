"""
Letter numbering (spec §5.1).

Format: YYYYNNN where YYYY is the 4-digit Jalali year and NNN is a
per-payer, per-year sequence. Deleted invoices release their number into
``available_letter_numbers`` and the lowest free number is reused first.

Reservation runs inside a single transaction and locks the sequence row, so
two concurrent approvals can never receive the same number.
"""

from __future__ import annotations

import datetime as dt
import re

import jdatetime
from django.db import IntegrityError, transaction
from django.db.models import Min

from ..models import AvailableLetterNumber, Invoice, LetterSequence

_LAST_INT_RE = re.compile(r"(\d+)(?!.*\d)")
_FIRST_YEAR_RE = re.compile(r"(\d{4})")


class NumberingError(RuntimeError):
    pass


def jalali_century_prefix() -> str:
    """First two digits of the current Jalali year (e.g. '۱۴' برای ۱۴۰۴)."""
    return str(jdatetime.date.today().year)[:2]


def full_letter_number(year_two: str, number: int) -> str:
    """('04', 12) -> '1404012' (spec format YYYYNNN)."""
    year_two = str(year_two).zfill(2)
    century = jalali_century_prefix()
    # A two-digit year in the 90s belongs to the previous century (1370s).
    if int(year_two) >= 50 and century == "14":
        century = "13"
    return f"{century}{year_two}{int(number):03d}"


def peek(payer_code: str, year: str) -> int:
    """Read-only preview: lowest recycled number, else last + 1, else 1."""
    free = (
        AvailableLetterNumber.objects.filter(payer_code=payer_code, year=year)
        .aggregate(lowest=Min("number"))
        .get("lowest")
    )
    if free is not None:
        return int(free)

    last = (
        LetterSequence.objects.filter(payer_code=payer_code, year=year)
        .values_list("last_number", flat=True)
        .first()
    )
    if last is not None:
        return int(last) + 1
    return 1


@transaction.atomic
def reserve_numbers(payer_code: str, year: str, count: int = 1) -> list[int]:
    """
    Atomically reserve ``count`` numbers for a payer/year.

    Locks the sequence row for the whole transaction; recycled numbers are
    removed from ``available_letter_numbers`` as they are handed out.
    """
    if count < 1:
        return []

    sequence = _locked_sequence(payer_code, year)
    reserved: list[int] = []

    for _ in range(count):
        free = (
            AvailableLetterNumber.objects.select_for_update()
            .filter(payer_code=payer_code, year=year)
            .order_by("number")
            .first()
        )
        if free is not None:
            number = free.number
            free.delete()
        else:
            number = sequence.last_number + 1
            sequence.last_number = number
            sequence.save(update_fields=["last_number"])
        reserved.append(number)

    return reserved


def _locked_sequence(payer_code: str, year: str) -> LetterSequence:
    """Return the sequence row locked FOR UPDATE, creating it if needed."""
    try:
        with transaction.atomic():
            return (
                LetterSequence.objects.select_for_update()
                .get(payer_code=payer_code, year=year)
            )
    except LetterSequence.DoesNotExist:
        pass

    try:
        with transaction.atomic():
            return LetterSequence.objects.create(payer_code=payer_code, year=year)
    except IntegrityError:
        # Another transaction created it first; take the lock now.
        return LetterSequence.objects.select_for_update().get(payer_code=payer_code, year=year)


@transaction.atomic
def release_numbers(payer_code: str, year: str, numbers: list[int]) -> None:
    """Return numbers to the recyclable pool (spec: ON CONFLICT DO NOTHING)."""
    AvailableLetterNumber.objects.bulk_create(
        [
            AvailableLetterNumber(payer_code=payer_code, year=year, number=int(n))
            for n in numbers
        ],
        ignore_conflicts=True,
    )


def year_from_invoice(invoice: Invoice) -> str:
    """Derive the two-digit Jalali year of an invoice (spec §5.1)."""
    if invoice.issue_date:
        return f"{jdatetime.date.fromgregorian(date=invoice.issue_date).year % 100:02d}"

    match = _FIRST_YEAR_RE.search(invoice.letter_number or "")
    if match:
        return match.group(1)[-2:]

    return f"{jdatetime.date.today().year % 100:02d}"


def number_from_letter(letter_number: str) -> int | None:
    """
    Sequence part of a letter number: '1404012' -> 12.

    Our letter format is fixed (YYYYNNN), so the sequence is the last three
    digits; anything shorter is treated as a bare number. Falls back to the
    last integer run for legacy values that contain separators.
    """
    digits = re.sub(r"\D", "", letter_number or "")
    if not digits:
        return None
    if len(digits) >= 7:
        return int(digits[-3:])
    if len(digits) > 3:
        return int(digits[-3:])
    return int(digits)


def release_invoice_number(invoice: Invoice) -> None:
    """Recycle the number of a deleted invoice (no-op when unparsable)."""
    number = number_from_letter(invoice.letter_number)
    if number is None:
        return
    release_numbers(invoice.payer_code, year_from_invoice(invoice), [number])


def peek_letter(payer_code: str, date: dt.date | None = None) -> str:
    """Preview the next full letter number (does not reserve it)."""
    date = date or dt.date.today()
    year_two = f"{jdatetime.date.fromgregorian(date=date).year % 100:02d}"
    return full_letter_number(year_two, peek(payer_code, year_two))
