"""
Inventory Posting Integration — Auto-journal entries for inventory movements.

Per ACCOUNTING_MODULE.md §11: Inventory Accounting.
Per ACCOUNTING_MODULE.md §8: Posting Engine — all modules create accounting
entries through posting rules.

Accounting entries:
- Stock Receipt:  Debit Inventory (111), Credit Goods Received (231)
- Stock Issue:    Debit COGS (501), Credit Inventory (111)
- Stock Adjustment (surplus):  Debit Inventory (111), Credit Adjustment Income (409)
- Stock Adjustment (shortage): Debit Adjustment Expense (509), Credit Inventory (111)
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


class InventoryPostingEngine:
    """
    Accounting integration for inventory movements.
    Per ACCOUNTING_MODULE.md §11: Inventory Accounting.
    """

    @staticmethod
    @transaction.atomic
    def post_stock_receipt(movement, user: Any) -> JournalVoucher:
        """
        Post a stock receipt to the general ledger.

        Per ACCOUNTING_MODULE.md §11:
        Stock Receipt:
            Debit:  Inventory (111)
            Credit: Goods Received Not Invoiced (231)
        """
        if hasattr(movement, 'journal_voucher') and movement.journal_voucher:
            return movement.journal_voucher

        company = movement.company
        fy = PostingEngine.get_open_fiscal_year(company)
        if not fy:
            raise ValidationError("No open fiscal year found.")

        total_cost = abs(movement.quantity) * movement.unit_cost

        voucher = JournalVoucher.objects.create(
            company=company,
            fiscal_year=fy,
            number=PostingEngine._next_voucher_number(company, fy.id),
            date_jalali=timezone.now().strftime("%Y/%m/%d"),
            date=timezone.now().date(),
            description=f"ورود کالا: {movement.product_name} × {abs(movement.quantity)}",
            source_type="inventory_receipt",
            source_id=movement.id,
            status="confirmed",
            created_by=user,
            confirmed_by=user,
        )

        # Debit: Inventory (111)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "111"),
            description=f"ورود کالا: {movement.product_name}",
            debit=total_cost,
            credit=0,
        )

        # Credit: context-dependent account
        # Purchase receipt → Supplier Payable (231)
        # Production receipt → Production WIP (151)
        # Transfer receipt → no accounting (handled by transfer posting)
        credit_account = "231"
        if movement.reference_type == "production":
            credit_account = "151"
        elif movement.reference_type == "transfer":
            credit_account = "151"  # Transfer in = debit from WIP perspective
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, credit_account),
            description=f"بدهی بابت ورود کالا: {movement.product_name}",
            debit=0,
            credit=total_cost,
        )

        logger.info(f"Inventory receipt posted: {movement.product_name} as voucher #{voucher.number}")
        return voucher

    @staticmethod
    @transaction.atomic
    def post_stock_issue(movement, user: Any) -> JournalVoucher:
        """
        Post a stock issue to the general ledger.

        Per ACCOUNTING_MODULE.md §11:
        Stock Issue:
            Debit:  COGS (501)
            Credit: Inventory (111)
        """
        if hasattr(movement, 'journal_voucher') and movement.journal_voucher:
            return movement.journal_voucher

        company = movement.company
        fy = PostingEngine.get_open_fiscal_year(company)
        if not fy:
            raise ValidationError("No open fiscal year found.")

        total_cost = abs(movement.quantity) * movement.unit_cost

        voucher = JournalVoucher.objects.create(
            company=company,
            fiscal_year=fy,
            number=PostingEngine._next_voucher_number(company, fy.id),
            date_jalali=timezone.now().strftime("%Y/%m/%d"),
            date=timezone.now().date(),
            description=f"خروج کالا: {movement.product_name} × {abs(movement.quantity)}",
            source_type="inventory_issue",
            source_id=movement.id,
            status="confirmed",
            created_by=user,
            confirmed_by=user,
        )

        # Debit: COGS (501)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "501"),
            description=f"بهای تمام شده کالای فروش رفته: {movement.product_name}",
            debit=total_cost,
            credit=0,
        )

        # Credit: Inventory (111)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "111"),
            description=f"خروج از انبار: {movement.product_name}",
            debit=0,
            credit=total_cost,
        )

        logger.info(f"Inventory issue posted: {movement.product_name} as voucher #{voucher.number}")
        return voucher

    @staticmethod
    @transaction.atomic
    def post_stock_adjustment(adjustment, user: Any) -> JournalVoucher:
        """
        Post a stock adjustment to the general ledger.

        Per ACCOUNTING_MODULE.md §11:
        Adjustment (surplus):  Debit Inventory (111), Credit Adjustment Income (409)
        Adjustment (shortage): Debit Adjustment Expense (509), Credit Inventory (111)
        """
        if adjustment.journal_voucher:
            return adjustment.journal_voucher

        company = adjustment.company
        fy = PostingEngine.get_open_fiscal_year(company)
        if not fy:
            raise ValidationError("No open fiscal year found.")

        is_surplus = adjustment.quantity_adjustment > 0
        adjustment_value = abs(adjustment.adjustment_value)

        voucher = JournalVoucher.objects.create(
            company=company,
            fiscal_year=fy,
            number=PostingEngine._next_voucher_number(company, fy.id),
            date_jalali=timezone.now().strftime("%Y/%m/%d"),
            date=timezone.now().date(),
            description=f"اصلاح موجودی: {adjustment.product_name} ({adjustment.quantity_adjustment:+})",
            source_type="inventory_adjustment",
            source_id=adjustment.id,
            status="confirmed",
            created_by=user,
            confirmed_by=user,
        )

        if is_surplus:
            # Surplus: Debit Inventory, Credit Adjustment Income
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "111"),
                description=f"افزایش موجودی: {adjustment.product_name}",
                debit=adjustment_value,
                credit=0,
            )
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "409"),
                description=f"درآمد اصلاح موجودی: {adjustment.product_name}",
                debit=0,
                credit=adjustment_value,
            )
        else:
            # Shortage: Debit Adjustment Expense, Credit Inventory
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "509"),
                description=f"هزینه کسری موجودی: {adjustment.product_name}",
                debit=adjustment_value,
                credit=0,
            )
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "111"),
                description=f"کاهش موجودی: {adjustment.product_name}",
                debit=0,
                credit=adjustment_value,
            )

        adjustment.journal_voucher = voucher
        adjustment.save(update_fields=["journal_voucher"])

        logger.info(f"Inventory adjustment posted: {adjustment.product_name} as voucher #{voucher.number}")
        return voucher
