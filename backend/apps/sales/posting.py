"""
Sales Posting Engine — Accounting integration for Sales module.

Per TRADING_MODULE.md §16: Sales Invoice Accounting.
Per TRADING_MODULE.md §14: Sales Return Accounting.
Per ACCOUNTING_MODULE.md §10: Posting Engine.

Journal Entries:

Sales Invoice:
  Debit:  Customer Receivable (131)
  Credit: Sales Revenue (401)
  Credit: VAT Payable (221)

Sales Return:
  Debit:  Sales Return (402)
  Credit: Customer Receivable (131)
"""

import logging
from decimal import Decimal

from django.db import transaction

from apps.finance.models import JournalVoucher, JournalEntry
from apps.finance.posting import PostingEngine
from apps.finance.exceptions import ValidationError

logger = logging.getLogger(__name__)


class SalesPostingEngine:
    """
    Accounting posting for sales transactions.
    Integrates with the core PostingEngine.
    """

    @staticmethod
    @transaction.atomic
    def post_sales_invoice(company, invoice, user=None) -> JournalVoucher:
        """
        Post sales invoice accounting entries.
        Per TRADING_MODULE.md §16:
          Debit:  Customer Receivable (131) — total amount
          Credit: Sales Revenue (401) — subtotal - discount
          Credit: VAT Payable (221) — tax amount
        """
        voucher = PostingEngine.create_voucher(
            company=company,
            description=f"صدور فاکتور فروش: {invoice.invoice_number} — {invoice.customer}",
            created_by=user,
        )

        # Debit: Customer Receivable (131)
        if invoice.total > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "131"),
                description=f"مطالبات فروش: {invoice.customer} — فاکتور {invoice.invoice_number}",
                debit=invoice.total,
                credit=0,
            )

        # Credit: Sales Revenue (401) — net sales
        revenue_amount = invoice.subtotal - invoice.discount_amount
        if revenue_amount > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "401"),
                description=f"درآمد فروش: فاکتور {invoice.invoice_number}",
                debit=0,
                credit=revenue_amount,
            )

        # Credit: VAT Payable (221) — tax
        if invoice.tax_amount > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "221"),
                description=f"مالیات ارزش افزوده: فاکتور {invoice.invoice_number}",
                debit=0,
                credit=invoice.tax_amount,
            )

        # Validate balanced entries
        total_debit = invoice.total
        total_credit = revenue_amount + invoice.tax_amount
        if abs(total_debit - total_credit) > Decimal("0.01"):
            raise ValidationError(
                f"Unbalanced entry: debit={total_debit:,.0f} ≠ credit={total_credit:,.0f}"
            )

        logger.info(
            f"Sales invoice #{invoice.invoice_number} posted: "
            f"Dr 131={invoice.total:,.0f} / Cr 401={revenue_amount:,.0f} + Cr 221={invoice.tax_amount:,.0f}"
        )
        return voucher

    @staticmethod
    @transaction.atomic
    def post_sales_return(company, return_order, user=None) -> JournalVoucher:
        """
        Post sales return accounting entries.
        Per TRADING_MODULE.md §14:
          Debit:  Sales Return (402) — return amount
          Credit: Customer Receivable (131) — return amount
        """
        voucher = PostingEngine.create_voucher(
            company=company,
            description=f"برگشت فروش: {return_order.return_number} — {return_order.customer}",
            created_by=user,
        )

        return_amount = return_order.net_amount

        # Debit: Sales Return (402)
        if return_amount > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "402"),
                description=f"برگشت فروش: {return_order.customer} — رسید {return_order.return_number}",
                debit=return_amount,
                credit=0,
            )

            # Credit: Customer Receivable (131)
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "131"),
                description=f"کاهش مطالبات: {return_order.customer} — رسید {return_order.return_number}",
                debit=0,
                credit=return_amount,
            )

        logger.info(
            f"Sales return #{return_order.return_number} posted: "
            f"Dr 402={return_amount:,.0f} / Cr 131={return_amount:,.0f}"
        )
        return voucher
