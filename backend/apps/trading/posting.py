"""
Trading Posting Engine — Accounting integration for import/export.

Per TRADING_MODULE.md §16: Accounting Integration.

Import Goods Receipt:
  Debit: Inventory (111) — total including duties
  Credit: Import Payable (232)

Customs Duty:
  Debit: Customs Duty Expense (512)
  Credit: Customs Payable (233)

Export Invoice:
  Debit: Export Receivable (132)
  Credit: Export Revenue (403)
"""

import logging
from decimal import Decimal

from django.db import transaction

from apps.finance.models import JournalVoucher, JournalEntry
from apps.finance.posting import PostingEngine

logger = logging.getLogger(__name__)


class TradingPostingEngine:
    """Accounting posting for trading transactions."""

    @staticmethod
    @transaction.atomic
    def post_import_receipt(company, import_order, user=None) -> JournalVoucher:
        """
        Post import goods receipt.
        Debit: Inventory (111) — total IRR value + duties
        Credit: Import Payable (232) — total IRR value
        """
        voucher = PostingEngine.create_voucher(
            company=company,
            description=f"دریافت کالای وارداتی: {import_order.order_number} — {import_order.supplier}",
            created_by=user,
        )

        inventory_value = import_order.total_price_irr + import_order.customs_duty_amount + import_order.customs_vat_amount

        if inventory_value > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "111"),
                description=f"موجودی وارداتی: {import_order.product_name}",
                debit=inventory_value,
                credit=0,
            )

        if import_order.total_price_irr > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "232"),
                description=f"بدهی واردات: {import_order.supplier}",
                debit=0,
                credit=import_order.total_price_irr,
            )

        logger.info(f"Import receipt #{import_order.order_number} posted")
        return voucher

    @staticmethod
    @transaction.atomic
    def post_customs_duty(company, import_order, user=None) -> JournalVoucher:
        """Post customs duty entry."""
        voucher = PostingEngine.create_voucher(
            company=company,
            description=f"حقوق گمرکی: {import_order.order_number}",
            created_by=user,
        )

        if import_order.customs_duty_amount > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "512"),
                description=f"حقوق گمرکی: {import_order.order_number}",
                debit=import_order.customs_duty_amount,
                credit=0,
            )
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "233"),
                description=f"بدهی گمرک: {import_order.order_number}",
                debit=0,
                credit=import_order.customs_duty_amount,
            )

        return voucher

    @staticmethod
    @transaction.atomic
    def post_export_invoice(company, export_order, user=None) -> JournalVoucher:
        """Post export invoice."""
        voucher = PostingEngine.create_voucher(
            company=company,
            description=f"صورتحساب صادراتی: {export_order.order_number} — {export_order.customer}",
            created_by=user,
        )

        if export_order.total_price_irr > 0:
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "132"),
                description=f"مطالبات صادراتی: {export_order.customer}",
                debit=export_order.total_price_irr,
                credit=0,
            )
            JournalEntry.objects.create(
                voucher=voucher,
                kol=PostingEngine._get_kol_account(company, "403"),
                description=f"درآمد صادرات: {export_order.order_number}",
                debit=0,
                credit=export_order.total_price_irr,
            )

        return voucher
