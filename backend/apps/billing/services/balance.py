"""Payer balance (spec §5.3) — always derived, never stored."""

from __future__ import annotations

from django.db.models import Sum

from ..models import Credit, Invoice, ManualDebt, Payment


def active_invoices():
    """Invoices still on the ledger; a reversed one keeps its row but not its debt."""
    return Invoice.objects.filter(reversed_at__isnull=True)


def _sum(queryset, field: str = "amount") -> int:
    value = queryset.aggregate(total=Sum(field)).get("total")
    return int(value or 0)


def payer_balance(payer_code: str) -> dict:
    """
    balance = SUM(invoices) + SUM(manual_debts) - SUM(payments) - SUM(credits)

    Positive means the customer owes us; negative means we owe the customer.
    """
    invoices = _sum(active_invoices().filter(payer_code=payer_code))
    debts = _sum(ManualDebt.objects.filter(payer_code=payer_code))
    payments = _sum(Payment.objects.filter(payer_code=payer_code))
    credits = _sum(Credit.objects.filter(payer_code=payer_code))

    return {
        "payer_code": payer_code,
        "invoices": invoices,
        "manual_debts": debts,
        "payments": payments,
        "credits": credits,
        "balance": invoices + debts - payments - credits,
    }


def balances_for(queryset) -> dict[str, dict]:
    """Bulk variant: one query per table, mapped by payer_code."""
    def grouped(queryset):
        rows = queryset.values("payer_code").annotate(total=Sum("amount"))
        return {row["payer_code"]: int(row["total"] or 0) for row in rows}

    invoices = grouped(active_invoices())
    debts = grouped(ManualDebt.objects.all())
    payments = grouped(Payment.objects.all())
    credits = grouped(Credit.objects.all())

    result = {}
    for payer in queryset:
        inv = invoices.get(payer.code, 0)
        debt = debts.get(payer.code, 0)
        pay = payments.get(payer.code, 0)
        cred = credits.get(payer.code, 0)
        result[payer.code] = {
            "payer_code": payer.code,
            "invoices": inv,
            "manual_debts": debt,
            "payments": pay,
            "credits": cred,
            "balance": inv + debt - pay - cred,
        }
    return result


def total_outstanding() -> dict:
    return {
        "invoices": _sum(active_invoices()),
        "manual_debts": _sum(ManualDebt.objects.all()),
        "payments": _sum(Payment.objects.all()),
        "credits": _sum(Credit.objects.all()),
    }
