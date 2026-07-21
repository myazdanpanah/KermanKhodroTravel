"""
Service Sales Posting Engine — Accounting integration.

Per SERVICE_SALES_MODULE.md §14: Accounting Integration.

Booking Invoice:
  Debit: Customer Receivable (131)
  Credit: Service Revenue (404)
  Credit: VAT Payable (221)

Supplier Cost:
  Debit: Cost of Service (503)
  Credit: Supplier Payable (201)

Refund:
  Debit: Sales Return (402)
  Credit: Customer Receivable (131)
"""

import logging
from decimal import Decimal

from django.db import transaction

from apps.finance.models import JournalVoucher, JournalEntry
from apps.finance.posting import PostingEngine

logger = logging.getLogger(__name__)


class ServiceSalesPostingEngine:
    """Accounting posting for service sales transactions."""

    @staticmethod
    @transaction.atomic
    def post_booking_invoice(company, booking, user=None) -> JournalVoucher:
        """
        Post booking invoice.
        Debit: Customer Receivable (131)
        Credit: Service Revenue (404)
        Credit: VAT Payable (221)
        """
        voucher = PostingEngine.create_voucher(
            company=company,
            description=f"صورتحساب خدمات: {booking.booking_number} — {booking.customer}",
            created_by=user,
        )

        revenue_amount = booking.subtotal - booking.discount_amount

        if booking.total > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "131"),
                description=f"مطالبات خدمات: {booking.customer} — رزرو {booking.booking_number}",
                debit=booking.total,
                credit=0,
            )

        if revenue_amount > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "404"),
                description=f"درآمد خدمات: رزرو {booking.booking_number}",
                debit=0,
                credit=revenue_amount,
            )

        if booking.tax_amount > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "221"),
                description=f"مالیات خدمات: رزرو {booking.booking_number}",
                debit=0,
                credit=booking.tax_amount,
            )

        return voucher

    @staticmethod
    @transaction.atomic
    def post_supplier_cost(company, booking, user=None) -> JournalVoucher:
        """Post supplier cost entry."""
        voucher = PostingEngine.create_voucher(
            company=company,
            description=f"هزینه تأمین‌کننده: {booking.booking_number}",
            created_by=user,
        )

        total_cost = sum(
            (line.supplier_cost * line.quantity for line in booking.lines.all()),
            Decimal("0"),
        )

        if total_cost > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "503"),
                description=f"هزینه خدمات: رزرو {booking.booking_number}",
                debit=total_cost,
                credit=0,
            )
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "201"),
                description=f"بدهی تأمین‌کننده: رزرو {booking.booking_number}",
                debit=0,
                credit=total_cost,
            )

        return voucher

    @staticmethod
    @transaction.atomic
    def post_refund(company, refund, user=None) -> JournalVoucher:
        """Post refund entry."""
        voucher = PostingEngine.create_voucher(
            company=company,
            description=f"بازپرداخت: رزرو {refund.booking.booking_number}",
            created_by=user,
        )

        if refund.net_refund > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "402"),
                description=f"بازپرداخت: {refund.booking.booking_number}",
                debit=refund.net_refund,
                credit=0,
            )
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "131"),
                description=f"کاهش مطالبات: {refund.booking.booking_number}",
                debit=0,
                credit=refund.net_refund,
            )

        return voucher
