"""
Inventory Module Services — Enterprise ERP Inventory Management.

Per IMPLEMENTATION_ROADMAP.md §6: Inventory Management.
Per ACCOUNTING_MODULE.md §11: Inventory Accounting.
Per DJANGO_BACKEND.md §23: Service Layer Pattern.

Services:
- InventoryService: Core inventory operations
- StockMovementService: Create and process stock movements
- ReservationService: Reserve and release stock
- ValuationEngine: FIFO/Average cost calculation
"""

import logging
from decimal import Decimal
from typing import Dict, List, Optional

from django.db import transaction
from django.db.models import Sum, F
from django.utils import timezone

from apps.finance.exceptions import ValidationError
from .models import (
    Warehouse, Location, StockLedger, StockMovement,
    InventoryReservation, CycleCount, CycleCountLine, StockAdjustment,
)

logger = logging.getLogger(__name__)


class InventoryService:
    """
    Core inventory operations.
    Per IMPLEMENTATION_ROADMAP.md §6: Inventory Ledger, Stock Movements.
    """

    @staticmethod
    def get_stock_balance(company, product_code: str, warehouse_id: int = None) -> Dict:
        """Get current stock balance for a product."""
        qs = StockLedger.objects.filter(
            company=company, product_code=product_code
        )
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)

        totals = qs.aggregate(
            on_hand=Sum("quantity_on_hand"),
            reserved=Sum("quantity_reserved"),
            available=Sum("quantity_available"),
            value=Sum("total_value"),
        )

        return {
            "product_code": product_code,
            "quantity_on_hand": totals["on_hand"] or Decimal("0"),
            "quantity_reserved": totals["reserved"] or Decimal("0"),
            "quantity_available": totals["available"] or Decimal("0"),
            "total_value": totals["value"] or Decimal("0"),
            "warehouse_count": qs.values("warehouse").distinct().count(),
        }

    @staticmethod
    def get_warehouse_stock(company, warehouse_id: int) -> List[Dict]:
        """Get all stock balances for a specific warehouse."""
        ledgers = StockLedger.objects.filter(
            company=company, warehouse_id=warehouse_id
        ).select_related("warehouse").order_by("product_code")

        return [
            {
                "product_name": lb.product_name,
                "product_code": lb.product_code,
                "quantity_on_hand": lb.quantity_on_hand,
                "quantity_reserved": lb.quantity_reserved,
                "quantity_available": lb.quantity_available,
                "unit_cost": lb.unit_cost,
                "total_value": lb.total_value,
                "reorder_level": lb.reorder_level,
                "is_low_stock": lb.quantity_on_hand <= lb.reorder_level and lb.reorder_level > 0,
            }
            for lb in ledgers
        ]

    @staticmethod
    def check_availability(company, product_code: str, warehouse_id: int, quantity: Decimal) -> Dict:
        """Check if sufficient stock is available."""
        try:
            ledger = StockLedger.objects.get(
                company=company,
                product_code=product_code,
                warehouse_id=warehouse_id,
            )
        except StockLedger.DoesNotExist:
            return {
                "available": False,
                "on_hand": Decimal("0"),
                "requested": quantity,
                "shortage": quantity,
                "message": f"Product {product_code} not found in warehouse",
            }

        available = ledger.quantity_available
        return {
            "available": available >= quantity,
            "on_hand": ledger.quantity_on_hand,
            "reserved": ledger.quantity_reserved,
            "available_quantity": available,
            "available_stock": available,  # backward compat alias
            "requested": quantity,
            "shortage": max(quantity - available, Decimal("0")),
            "message": "Sufficient stock" if available >= quantity else f"Insufficient stock (need {quantity}, have {available})",
        }

    @staticmethod
    def get_low_stock_items(company, warehouse_id: int = None) -> List[Dict]:
        """Get all items below reorder level."""
        qs = StockLedger.objects.filter(
            company=company,
            reorder_level__gt=0,
            quantity_on_hand__lte=F("reorder_level"),
        )
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)

        return [
            {
                "product_name": lb.product_name,
                "product_code": lb.product_code,
                "warehouse": lb.warehouse.code,
                "quantity_on_hand": lb.quantity_on_hand,
                "reorder_level": lb.reorder_level,
                "reorder_quantity": lb.reorder_quantity,
                "shortage": lb.reorder_level - lb.quantity_on_hand,
            }
            for lb in qs
        ]


class StockMovementService:
    """
    Create and process stock movements.
    Per ACCOUNTING_MODULE.md §11: Inventory Accounting.
    Every movement updates the StockLedger.
    """

    @staticmethod
    @transaction.atomic
    def create_receipt(
        company,
        warehouse_id: int,
        product_name: str,
        product_code: str,
        quantity: Decimal,
        unit_cost: Decimal,
        unit: str = "عدد",
        reference_type: str = "",
        reference_id: int = None,
        user=None,
        description: str = "",
        batch_number: str = "",
        serial_number: str = "",
        location_id: int = None,
    ) -> StockMovement:
        """
        Record a stock receipt (incoming goods).
        Per ACCOUNTING_MODULE.md §11: Stock Receipt.
        Debit: Inventory, Credit: Goods Received Account.
        """
        if quantity <= 0:
            raise ValidationError("Receipt quantity must be positive")

        warehouse = Warehouse.objects.get(pk=warehouse_id, company=company)

        movement = StockMovement.objects.create(
            company=company,
            warehouse=warehouse,
            location_id=location_id,
            movement_type="receipt",
            reference_type=reference_type,
            reference_id=reference_id,
            product_name=product_name,
            product_code=product_code,
            quantity=quantity,
            unit=unit,
            unit_cost=unit_cost,
            description=description,
            performed_by=user,
            batch_number=batch_number,
            serial_number=serial_number,
        )

        # Update stock ledger
        StockMovementService._update_ledger(
            company=company,
            product_code=product_code,
            product_name=product_name,
            warehouse=warehouse,
            location_id=location_id,
            quantity_delta=quantity,
            unit_cost=unit_cost,
            is_receipt=True,
        )

        logger.info(f"Stock receipt: {product_name} +{quantity} @ {warehouse.code}")
        return movement

    @staticmethod
    @transaction.atomic
    def create_issue(
        company,
        warehouse_id: int,
        product_name: str,
        product_code: str,
        quantity: Decimal,
        unit_cost: Decimal,
        unit: str = "عدد",
        reference_type: str = "",
        reference_id: int = None,
        user=None,
        description: str = "",
        location_id: int = None,
    ) -> StockMovement:
        """
        Record a stock issue (outgoing goods).
        Per ACCOUNTING_MODULE.md §11: Stock Issue.
        Debit: COGS, Credit: Inventory.
        """
        if quantity <= 0:
            raise ValidationError("Issue quantity must be positive")

        # Check availability
        availability = InventoryService.check_availability(
            company, product_code, warehouse_id, quantity
        )
        if not availability["available"]:
            raise ValidationError(availability["message"])

        warehouse = Warehouse.objects.get(pk=warehouse_id, company=company)

        movement = StockMovement.objects.create(
            company=company,
            warehouse=warehouse,
            location_id=location_id,
            movement_type="issue",
            reference_type=reference_type,
            reference_id=reference_id,
            product_name=product_name,
            product_code=product_code,
            quantity=-quantity,  # Negative for issues
            unit=unit,
            unit_cost=unit_cost,
            description=description,
            performed_by=user,
        )

        # Update stock ledger
        StockMovementService._update_ledger(
            company=company,
            product_code=product_code,
            product_name=product_name,
            warehouse=warehouse,
            location_id=location_id,
            quantity_delta=-quantity,
            unit_cost=unit_cost,
            is_receipt=False,
        )

        logger.info(f"Stock issue: {product_name} -{quantity} @ {warehouse.code}")
        return movement

    @staticmethod
    @transaction.atomic
    def create_transfer(
        company,
        from_warehouse_id: int,
        to_warehouse_id: int,
        product_name: str,
        product_code: str,
        quantity: Decimal,
        unit_cost: Decimal,
        unit: str = "عدد",
        user=None,
        description: str = "",
    ) -> Dict:
        """
        Transfer stock between warehouses.
        Creates two movements: issue from source, receipt at destination.
        """
        if quantity <= 0:
            raise ValidationError("Transfer quantity must be positive")
        if from_warehouse_id == to_warehouse_id:
            raise ValidationError("Cannot transfer to the same warehouse")

        # Issue from source
        issue_movement = StockMovementService.create_issue(
            company=company,
            warehouse_id=from_warehouse_id,
            product_name=product_name,
            product_code=product_code,
            quantity=quantity,
            unit_cost=unit_cost,
            unit=unit,
            reference_type="transfer",
            user=user,
            description=f"Transfer out: {description}",
        )

        # Receipt at destination
        receipt_movement = StockMovementService.create_receipt(
            company=company,
            warehouse_id=to_warehouse_id,
            product_name=product_name,
            product_code=product_code,
            quantity=quantity,
            unit_cost=unit_cost,
            unit=unit,
            reference_type="transfer",
            reference_id=issue_movement.id,
            user=user,
            description=f"Transfer in: {description}",
        )

        return {
            "issue_movement": issue_movement,
            "receipt_movement": receipt_movement,
            "product_name": product_name,
            "quantity": quantity,
        }

    @staticmethod
    def _update_ledger(
        company,
        product_code: str,
        product_name: str,
        warehouse,
        quantity_delta: Decimal,
        unit_cost: Decimal,
        is_receipt: bool,
        location_id: int = None,
    ):
        """Update or create stock ledger entry."""
        ledger, created = StockLedger.objects.select_for_update().get_or_create(
            company=company,
            product_code=product_code,
            warehouse=warehouse,
            location_id=location_id,
            defaults={
                "product_name": product_name,
                "quantity_on_hand": Decimal("0"),
                "quantity_reserved": Decimal("0"),
                "quantity_available": Decimal("0"),
                "unit_cost": unit_cost,
                "total_value": Decimal("0"),
            },
        )

        # Update quantities
        ledger.quantity_on_hand = ledger.quantity_on_hand + quantity_delta
        ledger.quantity_available = ledger.quantity_on_hand - ledger.quantity_reserved

        # Update cost (weighted average on receipt)
        if is_receipt and quantity_delta > 0:
            old_total = ledger.unit_cost * (ledger.quantity_on_hand - quantity_delta)
            new_total = unit_cost * quantity_delta
            total_qty = ledger.quantity_on_hand
            if total_qty > 0:
                ledger.unit_cost = (old_total + new_total) / total_qty

        ledger.total_value = ledger.quantity_on_hand * ledger.unit_cost

        # Update timestamps
        if is_receipt:
            ledger.last_receipt_date = timezone.now()
        else:
            ledger.last_issue_date = timezone.now()

        ledger.save()


class ReservationService:
    """
    Reserve and release stock for orders.
    Per DATABASE_SCHEMA.md: reservations table.
    """

    @staticmethod
    @transaction.atomic
    def reserve_stock(
        company,
        product_name: str,
        product_code: str,
        warehouse_id: int,
        quantity: Decimal,
        reference_type: str,
        reference_id: int,
        user=None,
        unit: str = "عدد",
        expires_at=None,
    ) -> InventoryReservation:
        """Reserve stock for an order."""
        if quantity <= 0:
            raise ValidationError("Reservation quantity must be positive")

        # Check availability
        availability = InventoryService.check_availability(
            company, product_code, warehouse_id, quantity
        )
        if not availability["available"]:
            raise ValidationError(availability["message"])

        reservation = InventoryReservation.objects.create(
            company=company,
            product_name=product_name,
            product_code=product_code,
            warehouse_id=warehouse_id,
            quantity=quantity,
            unit=unit,
            reference_type=reference_type,
            reference_id=reference_id,
            reserved_by=user,
            expires_at=expires_at,
        )

        # Update stock ledger — increase reserved, decrease available
        StockLedger.objects.filter(
            company=company,
            product_code=product_code,
            warehouse_id=warehouse_id,
        ).update(
            quantity_reserved=F("quantity_reserved") + quantity,
            quantity_available=F("quantity_available") - quantity,
        )

        logger.info(f"Reserved {quantity} × {product_name} for {reference_type}#{reference_id}")
        return reservation

    @staticmethod
    @transaction.atomic
    def release_reservation(
        company,
        reservation_id: int,
        user=None,
    ) -> InventoryReservation:
        """Release a reservation (e.g. order cancelled)."""
        reservation = InventoryReservation.objects.get(
            pk=reservation_id, company=company
        )

        if reservation.status != "active":
            raise ValidationError(f"Reservation is {reservation.status}, cannot release")

        remaining = reservation.quantity - reservation.quantity_fulfilled

        reservation.status = "cancelled"
        reservation.save(update_fields=["status"])

        # Update stock ledger — decrease reserved, increase available
        StockLedger.objects.filter(
            company=company,
            product_code=reservation.product_code,
            warehouse_id=reservation.warehouse_id,
        ).update(
            quantity_reserved=F("quantity_reserved") - remaining,
            quantity_available=F("quantity_available") + remaining,
        )

        logger.info(f"Released reservation #{reservation_id}: {remaining} × {reservation.product_name}")
        return reservation

    @staticmethod
    @transaction.atomic
    def fulfill_reservation(
        company,
        reservation_id: int,
        quantity: Decimal,
    ) -> InventoryReservation:
        """Fulfill (partially or fully) a reservation by issuing stock."""
        reservation = InventoryReservation.objects.get(
            pk=reservation_id, company=company
        )

        if reservation.status != "active":
            raise ValidationError(f"Reservation is {reservation.status}")

        remaining_to_fulfill = reservation.quantity - reservation.quantity_fulfilled
        if quantity > remaining_to_fulfill:
            raise ValidationError(
                f"Cannot fulfill {quantity}, only {remaining_to_fulfill} remaining"
            )

        # Get actual cost from stock ledger
        try:
            ledger = StockLedger.objects.get(
                company=company,
                product_code=reservation.product_code,
                warehouse_id=reservation.warehouse_id,
            )
            actual_cost = ledger.unit_cost
        except StockLedger.DoesNotExist:
            actual_cost = Decimal("0")

        # Issue stock
        StockMovementService.create_issue(
            company=company,
            warehouse_id=reservation.warehouse_id,
            product_name=reservation.product_name,
            product_code=reservation.product_code,
            quantity=quantity,
            unit_cost=actual_cost,
            unit=reservation.unit,
            reference_type=reservation.reference_type,
            reference_id=reservation.reference_id,
            description=f"Fulfill reservation #{reservation_id}",
        )

        # Update reservation
        reservation.quantity_fulfilled = reservation.quantity_fulfilled + quantity
        if reservation.quantity_fulfilled >= reservation.quantity:
            reservation.status = "fulfilled"
        reservation.save(update_fields=["quantity_fulfilled", "status"])

        return reservation


class ValuationEngine:
    """
    Inventory valuation engine.
    Per MANUFACTURING_MODULE.md §16: Cost Methods (FIFO, Average, Standard).
    """

    @staticmethod
    def calculate_fifo_cost(company, product_code: str, warehouse_id: int, quantity: Decimal) -> Dict:
        """
        Calculate FIFO (First In First Out) cost for issuing stock.
        Returns oldest stock first.
        """
        receipts = StockMovement.objects.filter(
            company=company,
            product_code=product_code,
            warehouse_id=warehouse_id,
            movement_type="receipt",
            quantity__gt=0,
        ).order_by("movement_date")

        remaining = quantity
        total_cost = Decimal("0")
        layers = []

        for receipt in receipts:
            if remaining <= 0:
                break

            layer_qty = min(receipt.quantity, remaining)
            layer_cost = layer_qty * receipt.unit_cost
            total_cost += layer_cost
            remaining -= layer_qty

            layers.append({
                "date": receipt.movement_date,
                "quantity": layer_qty,
                "unit_cost": receipt.unit_cost,
                "total_cost": layer_cost,
            })

        avg_cost = total_cost / quantity if quantity > 0 else Decimal("0")

        return {
            "method": "fifo",
            "product_code": product_code,
            "quantity_requested": quantity,
            "total_cost": total_cost,
            "average_unit_cost": avg_cost,
            "layers": layers,
            "fully_satisfied": remaining <= 0,
        }

    @staticmethod
    def calculate_average_cost(company, product_code: str, warehouse_id: int) -> Dict:
        """
        Calculate weighted average cost from all receipts.
        """
        result = StockMovement.objects.filter(
            company=company,
            product_code=product_code,
            warehouse_id=warehouse_id,
            movement_type="receipt",
            quantity__gt=0,
        ).aggregate(
            total_qty=Sum("quantity"),
            total_value=Sum(F("quantity") * F("unit_cost")),
        )

        total_qty = result["total_qty"] or Decimal("0")
        total_value = result["total_value"] or Decimal("0")
        avg_cost = total_value / total_qty if total_qty > 0 else Decimal("0")

        return {
            "method": "average",
            "product_code": product_code,
            "total_quantity_receipts": total_qty,
            "total_value": total_value,
            "weighted_average_cost": avg_cost,
        }

    @staticmethod
    def get_inventory_valuation(company, warehouse_id: int = None) -> Dict:
        """Get total inventory valuation for reporting."""
        qs = StockLedger.objects.filter(company=company)
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)

        result = qs.aggregate(
            total_on_hand=Sum("quantity_on_hand"),
            total_value=Sum("total_value"),
        )

        items = []
        for ledger in qs.select_related("warehouse").order_by("product_code"):
            items.append({
                "product_name": ledger.product_name,
                "product_code": ledger.product_code,
                "warehouse": ledger.warehouse.code,
                "quantity": ledger.quantity_on_hand,
                "unit_cost": ledger.unit_cost,
                "total_value": ledger.total_value,
            })

        return {
            "total_quantity": result["total_on_hand"] or Decimal("0"),
            "total_value": result["total_value"] or Decimal("0"),
            "items": items,
        }
