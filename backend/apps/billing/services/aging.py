"""Receivables aging (spec §5.3): which invoices are still open, by age.

The ledger keeps one net balance per payer, so a ten-day invoice and a
four-month one look identical. Payments and credits are applied FIFO to the
oldest invoice first; whatever is left on each invoice lands in its age
bucket. Reversed invoices carry no debt, so they are ignored.
"""

from __future__ import annotations

from datetime import date

from django.db.models import Sum
from django.utils import timezone

from ..models import Credit, Payer, Payment
from .balance import active_invoices

# (field, inclusive upper bound in days); the last bucket is everything else.
BUCKETS = (
    ("d0_30", 30),
    ("d31_60", 60),
    ("d61_90", 90),
    ("d90_plus", None),
)

BUCKET_KEYS = tuple(key for key, _ in BUCKETS)


def bucket_key(days: int) -> str:
    """Age in days -> bucket field; future-dated invoices count as current."""
    for key, limit in BUCKETS:
        if limit is None or days <= limit:
            return key
    return BUCKETS[-1][0]


def _settled_by_payer() -> dict[str, int]:
    """Money already received per payer, ready to be consumed FIFO."""
    settled: dict[str, int] = {}
    for model in (Payment, Credit):
        rows = model.objects.values("payer_code").annotate(total=Sum("amount"))
        for row in rows:
            code = row["payer_code"]
            settled[code] = settled.get(code, 0) + int(row["total"] or 0)
    return settled


def _empty_row(code: str, name: str) -> dict:
    row = {"payer_code": code, "payer_name": name, "total_open": 0}
    row.update({key: 0 for key in BUCKET_KEYS})
    return row


def aging_report(as_of: date | None = None) -> dict:
    """Open invoice amounts per payer, split into 0-30/31-60/61-90/over-90."""
    as_of = as_of or timezone.localdate()
    settled = _settled_by_payer()
    rows: dict[str, dict] = {}

    invoices = (
        active_invoices()
        .order_by("payer_code", "issue_date", "id")
        .values("payer_code", "payer", "amount", "issue_date")
    )
    for invoice in invoices:
        code = invoice["payer_code"]
        row = rows.setdefault(code, _empty_row(code, invoice["payer"]))
        open_amount = int(invoice["amount"])

        available = settled.get(code, 0)
        if available > 0:
            applied = min(available, open_amount)
            settled[code] = available - applied
            open_amount -= applied

        if open_amount > 0:
            row[bucket_key((as_of - invoice["issue_date"]).days)] += open_amount
            row["total_open"] += open_amount

    # The stored payer name is authoritative; the invoice copy is a snapshot.
    names = dict(Payer.objects.filter(code__in=rows).values_list("code", "name"))
    result = []
    for code, row in rows.items():
        row["payer_name"] = names.get(code) or row["payer_name"]
        if row["total_open"] > 0:
            result.append(row)
    result.sort(key=lambda row: (-row["total_open"], row["payer_code"]))

    totals = {key: sum(row[key] for row in result) for key in BUCKET_KEYS}
    totals["total_open"] = sum(row["total_open"] for row in result)
    return {"as_of": as_of.isoformat(), "rows": result, "totals": totals}
