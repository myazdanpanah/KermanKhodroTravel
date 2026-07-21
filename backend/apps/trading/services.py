"""
Trading Module Services — Enterprise ERP Import/Export Management.

Per TRADING_MODULE.md §12: Import/Export Lifecycle.
Per DJANGO_BACKEND.md §23: Service Layer Pattern.
"""

import logging
from decimal import Decimal
from typing import Dict, List

from django.db import transaction
from django.utils import timezone

from apps.finance.exceptions import ValidationError
from .models import (
    ImportOrder, ExportOrder, Container,
    Shipment, CustomsDocument, InternationalCost,
)

logger = logging.getLogger(__name__)


class ImportService:
    """Manage import order lifecycle."""

    @staticmethod
    @transaction.atomic
    def create_import_order(
        company,
        supplier_id: int,
        product_name: str,
        quantity: Decimal,
        unit_price_foreign: Decimal,
        foreign_currency: str = "USD",
        exchange_rate: Decimal = Decimal("1"),
        user=None,
        **kwargs,
    ) -> ImportOrder:
        """Create a new import order."""
        from apps.finance.models import Supplier
        supplier = Supplier.objects.get(pk=supplier_id, company=company)

        last = ImportOrder.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        order_number = f"IMP-{next_num:05d}"

        import_order = ImportOrder.objects.create(
            company=company,
            order_number=order_number,
            supplier=supplier,
            product_name=product_name,
            quantity=quantity,
            unit_price_foreign=unit_price_foreign,
            foreign_currency=foreign_currency,
            exchange_rate=exchange_rate,
            created_by=user,
            **kwargs,
        )

        logger.info(f"Import order #{order_number} created")
        return import_order

    @staticmethod
    def confirm_import(company, order_id: int) -> ImportOrder:
        """Confirm import order."""
        order = ImportOrder.objects.get(pk=order_id, company=company)
        if order.status != "draft":
            raise ValidationError(f"Cannot confirm in '{order.status}' status")
        order.status = "confirmed"
        order.save(update_fields=["status"])
        return order

    @staticmethod
    def mark_shipped(company, order_id: int) -> ImportOrder:
        """Mark import order as shipped."""
        order = ImportOrder.objects.get(pk=order_id, company=company)
        if order.status != "confirmed":
            raise ValidationError(f"Cannot mark shipped in '{order.status}' status")
        order.status = "shipped"
        order.save(update_fields=["status"])
        return order

    @staticmethod
    def clear_customs(company, order_id: int, declaration_number: str = "",
                      duty_amount: Decimal = Decimal("0"),
                      vat_amount: Decimal = Decimal("0")) -> ImportOrder:
        """Clear customs for import order."""
        order = ImportOrder.objects.get(pk=order_id, company=company)
        order.customs_declaration_number = declaration_number
        order.customs_duty_amount = duty_amount
        order.customs_vat_amount = vat_amount
        order.status = "customs_cleared"
        order.save(update_fields=["status", "customs_declaration_number",
                                   "customs_duty_amount", "customs_vat_amount"])
        return order

    @staticmethod
    def receive_at_warehouse(company, order_id: int) -> ImportOrder:
        """Mark import order as received at warehouse."""
        order = ImportOrder.objects.get(pk=order_id, company=company)
        order.status = "warehouse_received"
        order.actual_delivery = timezone.now().date()
        order.save(update_fields=["status", "actual_delivery"])
        return order

    @staticmethod
    def complete_import(company, order_id: int) -> ImportOrder:
        """Complete import order."""
        order = ImportOrder.objects.get(pk=order_id, company=company)
        order.status = "completed"
        order.save(update_fields=["status"])
        return order


class ExportService:
    """Manage export order lifecycle."""

    @staticmethod
    @transaction.atomic
    def create_export_order(
        company,
        customer_id: int,
        product_name: str,
        quantity: Decimal,
        unit_price_foreign: Decimal,
        foreign_currency: str = "USD",
        exchange_rate: Decimal = Decimal("1"),
        user=None,
        **kwargs,
    ) -> ExportOrder:
        """Create a new export order."""
        from apps.finance.models import Customer
        customer = Customer.objects.get(pk=customer_id, company=company)

        last = ExportOrder.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        order_number = f"EXP-{next_num:05d}"

        export_order = ExportOrder.objects.create(
            company=company,
            order_number=order_number,
            customer=customer,
            product_name=product_name,
            quantity=quantity,
            unit_price_foreign=unit_price_foreign,
            foreign_currency=foreign_currency,
            exchange_rate=exchange_rate,
            created_by=user,
            **kwargs,
        )

        logger.info(f"Export order #{order_number} created")
        return export_order

    @staticmethod
    def confirm_export(company, order_id: int) -> ExportOrder:
        """Confirm export order."""
        order = ExportOrder.objects.get(pk=order_id, company=company)
        if order.status != "draft":
            raise ValidationError(f"Cannot confirm in '{order.status}' status")
        order.status = "confirmed"
        order.save(update_fields=["status"])
        return order

    @staticmethod
    def mark_shipped(company, order_id: int) -> ExportOrder:
        """Mark export order as shipped."""
        order = ExportOrder.objects.get(pk=order_id, company=company)
        order.status = "shipped"
        order.actual_ship_date = timezone.now().date()
        order.save(update_fields=["status", "actual_ship_date"])
        return order


class ShipmentService:
    """Manage shipments."""

    @staticmethod
    @transaction.atomic
    def create_shipment(
        company,
        shipment_type: str = "sea",
        origin: str = "",
        destination: str = "",
        import_order_id: int = None,
        export_order_id: int = None,
        container_id: int = None,
        user=None,
        **kwargs,
    ) -> Shipment:
        """Create a new shipment."""
        import uuid
        unique_suffix = uuid.uuid4().hex[:6].upper()
        shipment_number = f"SHP-{unique_suffix}"

        shipment = Shipment.objects.create(
            company=company,
            shipment_number=shipment_number,
            shipment_type=shipment_type,
            origin=origin,
            destination=destination,
            import_order_id=import_order_id,
            export_order_id=export_order_id,
            container_id=container_id,
            **kwargs,
        )
        return shipment

    @staticmethod
    def update_status(company, shipment_id: int, status: str) -> Shipment:
        """Update shipment status."""
        shipment = Shipment.objects.get(pk=shipment_id, company=company)
        shipment.status = status
        if status == "in_transit":
            shipment.actual_departure = timezone.now().date()
        elif status == "delivered":
            shipment.actual_arrival = timezone.now().date()
        shipment.save()
        return shipment


class TradingSummaryService:
    """Get trading dashboard summary."""

    @staticmethod
    def get_summary(company) -> Dict:
        """Get import/export summary for dashboard."""
        from django.db.models import Sum

        imports = ImportOrder.objects.filter(company=company)
        exports = ExportOrder.objects.filter(company=company)

        return {
            "total_imports": imports.count(),
            "active_imports": imports.exclude(status__in=("completed", "cancelled")).count(),
            "pending_customs": imports.filter(status="customs_pending").count(),
            "total_exports": exports.count(),
            "active_exports": exports.exclude(status__in=("completed", "cancelled")).count(),
            "total_import_value_irr": imports.aggregate(t=Sum("total_price_irr"))["t"] or Decimal("0"),
            "total_export_value_irr": exports.aggregate(t=Sum("total_price_irr"))["t"] or Decimal("0"),
        }
