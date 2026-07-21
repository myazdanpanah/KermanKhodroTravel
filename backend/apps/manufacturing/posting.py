"""
Manufacturing Posting Integration — Auto-journal entries for production.

Per ACCOUNTING_MODULE.md §12: Manufacturing Accounting.
Per MANUFACTURING_MODULE.md §27: Accounting Integration.

Accounting entries:
- Material Consumption:   Debit Production WIP (151), Credit Raw Material Inventory (111)
- Finished Goods Receipt: Debit Finished Goods Inventory (112), Credit Production WIP (151)
- Production Variance:    Debit/Credit Variance Account
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


class ManufacturingPostingEngine:
    """
    Accounting integration for manufacturing transactions.
    Per ACCOUNTING_MODULE.md §12: Manufacturing Accounting.
    Per MANUFACTURING_MODULE.md §27: Accounting Integration.
    """

    @staticmethod
    @transaction.atomic
    def post_material_consumption(consumption, user: Any) -> JournalVoucher:
        """
        Post material consumption to the general ledger.

        Per ACCOUNTING_MODULE.md §12:
        Material Consumption:
            Debit:  Production WIP (151)
            Credit: Raw Material Inventory (111)

        Per MANUFACTURING_MODULE.md §13:
        Inventory Transaction: RAW_MATERIAL_ISSUE
        """
        if consumption.journal_voucher:
            return consumption.journal_voucher

        company = consumption.company
        fy = PostingEngine.get_open_fiscal_year(company)
        if not fy:
            raise ValidationError("No open fiscal year found.")

        total_cost = consumption.total_cost or (consumption.quantity_consumed * consumption.unit_cost)

        voucher = JournalVoucher.objects.create(
            company=company,
            fiscal_year=fy,
            number=PostingEngine._next_voucher_number(company, fy.id),
            date_jalali=timezone.now().strftime("%Y/%m/%d"),
            date=timezone.now().date(),
            description=f"مصرف مواد: {consumption.component_name} × {consumption.quantity_consumed} — دستور تولید {consumption.production_order.number}",
            source_type="material_consumption",
            source_id=consumption.id,
            status="confirmed",
            created_by=user,
            confirmed_by=user,
        )

        # Debit: Production WIP (151)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "151"),
            description=f"هزینه مواد مصرفی: {consumption.component_name}",
            debit=total_cost,
            credit=0,
        )

        # Credit: Raw Material Inventory (111)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "111"),
            description=f"خروج مواد اولیه: {consumption.component_name}",
            debit=0,
            credit=total_cost,
        )

        # Link voucher to consumption record
        consumption.journal_voucher = voucher
        consumption.save(update_fields=["journal_voucher"])

        logger.info(
            f"Material consumption posted: {consumption.component_name} "
            f"× {consumption.quantity_consumed} as voucher #{voucher.number}"
        )
        return voucher

    @staticmethod
    @transaction.atomic
    def post_finished_goods_receipt(receipt, user: Any) -> JournalVoucher:
        """
        Post finished goods receipt to the general ledger.

        Per ACCOUNTING_MODULE.md §12:
        Finished Goods Receipt:
            Debit:  Finished Goods Inventory (112)
            Credit: Production WIP (151)

        Per MANUFACTURING_MODULE.md §14:
        Accounting: Debit Finished Goods Inventory, Credit Production WIP.
        """
        if receipt.journal_voucher:
            return receipt.journal_voucher

        company = receipt.company
        fy = PostingEngine.get_open_fiscal_year(company)
        if not fy:
            raise ValidationError("No open fiscal year found.")

        total_cost = receipt.total_cost or (receipt.quantity_received * receipt.unit_cost)

        voucher = JournalVoucher.objects.create(
            company=company,
            fiscal_year=fy,
            number=PostingEngine._next_voucher_number(company, fy.id),
            date_jalali=timezone.now().strftime("%Y/%m/%d"),
            date=timezone.now().date(),
            description=f"ورود کالای تولیدی: {receipt.product_name} × {receipt.quantity_received} — دستور تولید {receipt.production_order.number}",
            source_type="finished_goods_receipt",
            source_id=receipt.id,
            status="confirmed",
            created_by=user,
            confirmed_by=user,
        )

        # Debit: Finished Goods Inventory (112)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "112"),
            description=f"ورود کالای نهایی: {receipt.product_name}",
            debit=total_cost,
            credit=0,
        )

        # Credit: Production WIP (151)
        JournalEntry.objects.create(
            voucher=voucher,
            kol=PostingEngine._get_kol_account(company, "151"),
            description=f"تکمیل تولید: {receipt.product_name} — دستور تولید {receipt.production_order.number}",
            debit=0,
            credit=total_cost,
        )

        # Link voucher to receipt
        receipt.journal_voucher = voucher
        receipt.save(update_fields=["journal_voucher"])

        logger.info(
            f"Finished goods receipt posted: {receipt.product_name} "
            f"× {receipt.quantity_received} as voucher #{voucher.number}"
        )
        return voucher

    @staticmethod
    @transaction.atomic
    def post_production_completion(production_order, user: Any) -> JournalVoucher:
        """
        Post production order completion — aggregate all costs.
        Only posts if no finished goods receipt has already posted for this order.
        Per ACCOUNTING_MODULE.md §12:
        Manufacturing Cost Allocation:
            Debit:  Production Cost
            Credit: Cost Allocation Accounts
        """
        if production_order.journal_voucher:
            return production_order.journal_voucher

        # Check if a finished goods receipt already posted for this order
        from apps.manufacturing.models import FinishedGoodsReceipt
        if FinishedGoodsReceipt.objects.filter(
            production_order=production_order,
            journal_voucher__isnull=False,
        ).exists():
            logger.info(
                f"Production completion skipped for {production_order.number} — "
                f"finished goods receipt already posted"
            )
            return None

        company = production_order.company
        fy = PostingEngine.get_open_fiscal_year(company)
        if not fy:
            raise ValidationError("No open fiscal year found.")

        total_cost = production_order.total_cost

        voucher = JournalVoucher.objects.create(
            company=company,
            fiscal_year=fy,
            number=PostingEngine._next_voucher_number(company, fy.id),
            date_jalali=timezone.now().strftime("%Y/%m/%d"),
            date=timezone.now().date(),
            description=f"تکمیل تولید: {production_order.product_name} × {production_order.quantity} — هزینه کل {total_cost:,.0f} ریال",
            source_type="production_completion",
            source_id=production_order.id,
            status="confirmed",
            created_by=user,
            confirmed_by=user,
        )

        # Per ACCOUNTING_MODULE.md §12:
        # Production Completion:
        #   Debit:  Finished Goods Inventory (112)
        #   Credit: Production WIP (151)
        if total_cost > 0:
            # Debit: Finished Goods Inventory (112)
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "112"),
                description=f"ورود کالای نهایی: {production_order.product_name} × {production_order.quantity}",
                debit=total_cost,
                credit=0,
            )
            # Credit: Production WIP (151)
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "151"),
                description=f"تکمیل تولید: {production_order.product_name} — مواد: {production_order.material_cost:,.0f} + کارگری: {production_order.labor_cost:,.0f} + ماشین: {production_order.machine_cost:,.0f} + سربار: {production_order.overhead_cost:,.0f}",
                debit=0,
                credit=total_cost,
            )

        # Link voucher to production order
        production_order.journal_voucher = voucher
        production_order.save(update_fields=["journal_voucher"])

        logger.info(
            f"Production completion posted: {production_order.product_name} "
            f"× {production_order.quantity} as voucher #{voucher.number} "
            f"(total cost: {total_cost:,.0f} Rial)"
        )
        return voucher

    @staticmethod
    @transaction.atomic
    def post_production_variance(production_order, variance_data: dict, user: Any) -> JournalVoucher:
        """
        Post production variance to the general ledger.

        Per MANUFACTURING_MODULE.md §17:
        Variance Types: Material, Labor, Overhead, Efficiency.
        Debit/Credit: Production Variance Account.
        """
        company = production_order.company
        fy = PostingEngine.get_open_fiscal_year(company)
        if not fy:
            raise ValidationError("No open fiscal year found.")

        total_variance = variance_data.get("total_variance", Decimal("0"))
        if total_variance == 0:
            return None  # No variance to post

        is_unfavorable = total_variance > 0
        abs_variance = abs(total_variance)

        voucher = JournalVoucher.objects.create(
            company=company,
            fiscal_year=fy,
            number=PostingEngine._next_voucher_number(company, fy.id),
            date_jalali=timezone.now().strftime("%Y/%m/%d"),
            date=timezone.now().date(),
            description=f"انحراف هزینه تولید: {production_order.product_name} ({'ناfavorable' if is_unfavorable else 'favorable'})",
            source_type="production_variance",
            source_id=production_order.id,
            status="confirmed",
            created_by=user,
            confirmed_by=user,
        )

        if is_unfavorable:
            # Unfavorable: Debit Variance Expense, Credit WIP
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "509"),
                description=f"انحراف هزینه تولید: {production_order.product_name}",
                debit=abs_variance,
                credit=0,
            )
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "151"),
                description=f="تعدیل موجودی در حال تولید: {production_order.product_name}",
                debit=0,
                credit=abs_variance,
            )
        else:
            # Favorable: Debit WIP, Credit Variance Income
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "151"),
                description=f"افزایش موجودی در حال تولید: {production_order.product_name}",
                debit=abs_variance,
                credit=0,
            )
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "409"),
                description=f"درآمد انحراف هزینه تولید: {production_order.product_name}",
                debit=0,
                credit=abs_variance,
            )

        logger.info(
            f"Production variance posted: {production_order.product_name} "
            f"variance={total_variance:,.0f} Rial as voucher #{voucher.number}"
        )
        return voucher
