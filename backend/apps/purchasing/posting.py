"""
Purchasing Posting Integration — Auto-journal entries for purchasing.

Per ACCOUNTING_MODULE.md §10: Purchase Accounting.
Per TRADING_MODULE.md §16: Accounting Integration.

Accounting entries:
- Goods Receipt:   Debit Inventory (111), Credit Goods Received Not Invoiced (231)
- Supplier Invoice: Debit Inventory/Expense (111), Debit Input VAT (133), Credit Supplier Payable (231)
- Purchase Return: Debit Supplier Payable (231), Credit Inventory (111), Credit VAT Adjustment
"""

import logging
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.finance.posting import PostingEngine
from apps.finance.models import JournalVoucher, JournalEntry
from apps.finance.exceptions import ValidationError

logger = logging.getLogger(__name__)


class PurchasingPostingEngine:
    """
    Accounting integration for purchasing transactions.
    Per ACCOUNTING_MODULE.md §10: Purchase Accounting.
    """

    @staticmethod
    @transaction.atomic
    def post_goods_receipt(receipt, user: Any) -> JournalVoucher:
        """
        Post goods receipt to the general ledger.

        Per ACCOUNTING_MODULE.md §10:
        Goods Receipt:
            Debit:  Inventory (111)
            Credit: Goods Received Not Invoiced (231)
        """
        if receipt.journal_voucher:
            return receipt.journal_voucher

        company = receipt.company
        fy = PostingEngine.get_open_fiscal_year(company)
        if not fy:
            raise ValidationError("No open fiscal year found.")

        total_cost = receipt.quantity_received * receipt.unit_cost

        voucher = JournalVoucher.objects.create(
            company=company,
            fiscal_year=fy,
            number=PostingEngine._next_voucher_number(company, fy.id),
            date_jalali=timezone.now().strftime("%Y/%m/%d"),
            date=timezone.now().date(),
            description=f"رسید کالا: {receipt.item_name} × {receipt.quantity_received} — سفارش {receipt.purchase_order.order_number}",
            source_type="goods_receipt",
            source_id=receipt.id,
            status="confirmed",
            created_by=user,
            confirmed_by=user,
        )

        # Debit: Inventory (111)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "111"),
            description=f"ورود کالا: {receipt.item_name}",
            debit=total_cost,
            credit=0,
        )

        # Credit: Goods Received Not Invoiced (231)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "231"),
            description=f"بدهی بابت دریافت کالا: {receipt.item_name}",
            debit=0,
            credit=total_cost,
        )

        receipt.journal_voucher = voucher
        receipt.save(update_fields=["journal_voucher"])

        logger.info(f"Goods receipt posted: {receipt.receipt_number} as voucher #{voucher.number}")
        return voucher

    @staticmethod
    @transaction.atomic
    def post_purchase_return(purchase_return, user: Any) -> JournalVoucher:
        """
        Post purchase return to the general ledger.

        Per TRADING_MODULE.md §14:
        Purchase Return:
            Debit:  Supplier Payable (231)
            Credit: Inventory (111)
        """
        if purchase_return.journal_voucher:
            return purchase_return.journal_voucher

        company = purchase_return.company
        fy = PostingEngine.get_open_fiscal_year(company)
        if not fy:
            raise ValidationError("No open fiscal year found.")

        total_value = purchase_return.total_value or (
            purchase_return.quantity_returned * purchase_return.unit_cost
        )

        voucher = JournalVoucher.objects.create(
            company=company,
            fiscal_year=fy,
            number=PostingEngine._next_voucher_number(company, fy.id),
            date_jalali=timezone.now().strftime("%Y/%m/%d"),
            date=timezone.now().date(),
            description=f"برگشت کالا: {purchase_return.item_name} × {purchase_return.quantity_returned}",
            source_type="purchase_return",
            source_id=purchase_return.id,
            status="confirmed",
            created_by=user,
            confirmed_by=user,
        )

        # Debit: Supplier Payable (231)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "231"),
            description=f"کاهش بدهی بابت برگشت: {purchase_return.item_name}",
            debit=total_value,
            credit=0,
        )

        # Credit: Inventory (111)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "111"),
            description=f"کاهش موجودی بابت برگشت: {purchase_return.item_name}",
            debit=0,
            credit=total_value,
        )

        purchase_return.journal_voucher = voucher
        purchase_return.save(update_fields=["journal_voucher"])

        logger.info(f"Purchase return posted: {purchase_return.return_number} as voucher #{voucher.number}")
        return voucher
