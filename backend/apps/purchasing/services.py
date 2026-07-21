"""
Purchasing Module Services — Enterprise ERP Procurement.

Per IMPLEMENTATION_ROADMAP.md §7: Purchasing.
Per TRADING_MODULE.md §9-§11: Purchase Lifecycle.
Per DJANGO_BACKEND.md §23: Service Layer Pattern.
"""

import logging
from decimal import Decimal
from typing import Dict, Optional

from django.db import transaction
from django.utils import timezone

from apps.finance.exceptions import ValidationError
from .models import (
    PurchaseRequest, PurchaseOrder, GoodsReceipt, PurchaseReturn,
)

logger = logging.getLogger(__name__)


class PurchasingService:
    """
    Core purchasing operations.
    Per TRADING_MODULE.md §9: Purchase Lifecycle.
    """

    @staticmethod
    @transaction.atomic
    def approve_purchase_request(
        purchase_request: PurchaseRequest,
        user,
        notes: str = "",
    ) -> PurchaseRequest:
        """Approve a purchase request."""
        if purchase_request.status != "submitted":
            raise ValidationError(
                f"Cannot approve request in status '{purchase_request.status}'. "
                f"Must be 'submitted'."
            )

        purchase_request.status = "approved"
        purchase_request.approved_by = user
        purchase_request.approved_at = timezone.now()
        purchase_request.save(update_fields=[
            "status", "approved_by", "approved_at", "updated_at",
        ])

        logger.info(f"Purchase request {purchase_request.request_number} approved by {user.username}")
        return purchase_request

    @staticmethod
    @transaction.atomic
    def reject_purchase_request(
        purchase_request: PurchaseRequest,
        user,
        reason: str = "",
    ) -> PurchaseRequest:
        """Reject a purchase request."""
        if purchase_request.status not in ("draft", "submitted"):
            raise ValidationError(
                f"Cannot reject request in status '{purchase_request.status}'"
            )

        purchase_request.status = "rejected"
        purchase_request.rejection_reason = reason
        purchase_request.save(update_fields=[
            "status", "rejection_reason", "updated_at",
        ])

        logger.info(f"Purchase request {purchase_request.request_number} rejected by {user.username}")
        return purchase_request

    @staticmethod
    @transaction.atomic
    def approve_purchase_order(
        purchase_order: PurchaseOrder,
        user,
    ) -> PurchaseOrder:
        """Approve a purchase order."""
        if purchase_order.status != "submitted":
            raise ValidationError(
                f"Cannot approve order in status '{purchase_order.status}'. "
                f"Must be 'submitted'."
            )

        purchase_order.status = "approved"
        purchase_order.approved_by = user
        purchase_order.approved_at = timezone.now()
        purchase_order.save(update_fields=[
            "status", "approved_by", "approved_at", "updated_at",
        ])

        logger.info(f"Purchase order {purchase_order.order_number} approved by {user.username}")
        return purchase_order

    @staticmethod
    @transaction.atomic
    def close_purchase_order(
        purchase_order: PurchaseOrder,
        user,
    ) -> PurchaseOrder:
        """Close a purchase order (all goods received)."""
        if purchase_order.status not in ("approved", "confirmed", "partially_received"):
            raise ValidationError(
                f"Cannot close order in status '{purchase_order.status}'. "
                f"Order must be approved, confirmed, or partially received."
            )

        purchase_order.status = "closed"
        purchase_order.save(update_fields=["status", "updated_at"])

        logger.info(f"Purchase order {purchase_order.order_number} closed")
        return purchase_order


class GoodsReceiptService:
    """
    Goods receipt operations.
    Per TRADING_MODULE.md §11: Goods Receipt.
    """

    @staticmethod
    @transaction.atomic
    def receive_goods(
        receipt: GoodsReceipt,
        user,
    ) -> GoodsReceipt:
        """
        Process goods receipt — update PO status and link to inventory.
        Per TRADING_MODULE.md §11: When goods arrive.
        """
        if receipt.status != "draft":
            raise ValidationError(f"Cannot receive goods in status '{receipt.status}'")

        # Update PO status
        po = receipt.purchase_order
        total_received = sum(
            r.quantity_received
            for r in po.goods_receipts.filter(status__in=("approved", "posted"))
        )
        total_received += receipt.quantity_received

        if total_received >= po.quantity:
            po.status = "received"
        elif total_received > 0:
            po.status = "partially_received"
        po.save(update_fields=["status", "updated_at"])

        receipt.status = "inspected"
        receipt.received_by = user
        receipt.save(update_fields=["status", "received_by", "updated_at"])

        logger.info(
            f"Goods received: {receipt.item_name} × {receipt.quantity_received} "
            f"for PO {po.order_number}"
        )
        return receipt

    @staticmethod
    @transaction.atomic
    def approve_goods_receipt(
        receipt: GoodsReceipt,
        user,
    ) -> GoodsReceipt:
        """Approve a goods receipt after inspection."""
        if receipt.status != "inspected":
            raise ValidationError(f"Cannot approve receipt in status '{receipt.status}'")

        receipt.status = "approved"
        receipt.save(update_fields=["status", "updated_at"])

        logger.info(f"Goods receipt {receipt.receipt_number} approved")
        return receipt
