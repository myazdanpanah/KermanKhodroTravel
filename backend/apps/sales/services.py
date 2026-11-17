"""
Sales Module Services — Enterprise ERP Sales Management.

Per TRADING_MODULE.md §5: Sales Lifecycle.
Per TRADING_MODULE.md §6: Pricing Engine.
Per TRADING_MODULE.md §16: Accounting Integration.
Per DJANGO_BACKEND.md §23: Service Layer Pattern.
"""

import logging
from decimal import Decimal
from typing import Dict, List, Optional

from django.db import transaction
from django.utils import timezone

from apps.finance.exceptions import ValidationError
from .models import (
    SalesQuotation, SalesQuotationLine,
    SalesOrder, SalesOrderLine,
    SalesInvoice, SalesInvoiceLine,
    SalesReturn, SalesReturnLine,
)

logger = logging.getLogger(__name__)


class QuotationService:
    """
    Manage sales quotation lifecycle.
    Per TRADING_MODULE.md §5.2: Sales Quotation.
    """

    @staticmethod
    @transaction.atomic
    def create_quotation(
        company,
        customer_id: int,
        quotation_date,
        valid_until,
        lines_data: List[Dict],
        user=None,
        notes: str = "",
        terms: str = "",
        currency: str = "IRR",
    ) -> SalesQuotation:
        """Create a new sales quotation with line items."""
        from apps.finance.models import Customer

        customer = Customer.objects.get(pk=customer_id, company=company)

        # Auto-generate quotation number
        last = SalesQuotation.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        quotation_number = f"QT-{next_num:05d}"

        quotation = SalesQuotation.objects.create(
            company=company,
            quotation_number=quotation_number,
            customer=customer,
            quotation_date=quotation_date,
            valid_until=valid_until,
            currency=currency,
            notes=notes,
            terms=terms,
            created_by=user,
        )

        subtotal = Decimal("0")
        discount_total = Decimal("0")
        tax_total = Decimal("0")
        for line_data in lines_data:
            line = SalesQuotationLine(
                company=company,
                quotation=quotation,
                product_name=line_data["product_name"],
                product_code=line_data.get("product_code", ""),
                description=line_data.get("description", ""),
                quantity=Decimal(str(line_data["quantity"])),
                unit=line_data.get("unit", "عدد"),
                unit_price=Decimal(str(line_data["unit_price"])),
                discount_percent=Decimal(str(line_data.get("discount_percent", 0))),
                tax_percent=Decimal(str(line_data.get("tax_percent", 0))),
            )
            line.save()  # Trigger line_total calculation
            subtotal += line.quantity * line.unit_price
            discount_total += line.discount_amount
            tax_total += line.tax_amount

        quotation.subtotal = subtotal
        quotation.discount_amount = discount_total
        quotation.tax_amount = tax_total
        quotation.save(update_fields=["subtotal", "discount_amount", "tax_amount", "total"])

        logger.info(f"Quotation #{quotation_number} created for {customer}")
        return quotation

    @staticmethod
    def send_quotation(company, quotation_id: int) -> SalesQuotation:
        """Mark quotation as sent to customer."""
        quotation = SalesQuotation.objects.get(pk=quotation_id, company=company)
        if quotation.status != "draft":
            raise ValidationError(f"Cannot send quotation in '{quotation.status}' status")
        quotation.status = "sent"
        quotation.save(update_fields=["status"])
        return quotation

    @staticmethod
    @transaction.atomic
    def convert_to_order(
        company,
        quotation_id: int,
        warehouse_id: int = None,
        delivery_date=None,
        user=None,
    ) -> SalesOrder:
        """Convert a quotation to a sales order."""
        quotation = SalesQuotation.objects.get(pk=quotation_id, company=company)
        if quotation.status not in ("draft", "sent", "approved"):
            raise ValidationError(f"Cannot convert quotation in '{quotation.status}' status")

        # Create sales order
        order = SalesService.create_order(
            company=company,
            customer_id=quotation.customer_id,
            order_date=timezone.now().date(),
            warehouse_id=warehouse_id,
            delivery_date=delivery_date,
            lines_data=[
                {
                    "product_name": line.product_name,
                    "product_code": line.product_code,
                    "description": line.description,
                    "quantity": line.quantity,
                    "unit": line.unit,
                    "unit_price": line.unit_price,
                    "discount_percent": line.discount_percent,
                    "tax_percent": line.tax_percent,
                }
                for line in quotation.lines.all()
            ],
            user=user,
            source_quotation=quotation,
        )

        # Update quotation
        quotation.status = "converted"
        quotation.converted_order = order
        quotation.save(update_fields=["status", "converted_order"])

        logger.info(f"Quotation #{quotation.quotation_number} converted to SO #{order.order_number}")
        return order


class SalesService:
    """
    Manage sales order lifecycle.
    Per TRADING_MODULE.md §5.3: Sales Order.
    """

    @staticmethod
    @transaction.atomic
    def create_order(
        company,
        customer_id: int,
        order_date,
        lines_data: List[Dict],
        user=None,
        warehouse_id: int = None,
        delivery_date=None,
        payment_terms: str = "",
        notes: str = "",
        currency: str = "IRR",
        source_quotation=None,
    ) -> SalesOrder:
        """Create a new sales order with line items."""
        from apps.finance.models import Customer

        customer = Customer.objects.get(pk=customer_id, company=company)

        # Auto-generate order number
        last = SalesOrder.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        order_number = f"SO-{next_num:05d}"

        order = SalesOrder.objects.create(
            company=company,
            order_number=order_number,
            customer=customer,
            warehouse_id=warehouse_id,
            order_date=order_date,
            delivery_date=delivery_date,
            currency=currency,
            payment_terms=payment_terms,
            notes=notes,
            source_quotation=source_quotation,
            created_by=user,
        )

        subtotal = Decimal("0")
        discount_total = Decimal("0")
        tax_total = Decimal("0")
        for line_data in lines_data:
            line = SalesOrderLine(
                company=company,
                order=order,
                product_name=line_data["product_name"],
                product_code=line_data.get("product_code", ""),
                description=line_data.get("description", ""),
                quantity=Decimal(str(line_data["quantity"])),
                unit=line_data.get("unit", "عدد"),
                unit_price=Decimal(str(line_data["unit_price"])),
                discount_percent=Decimal(str(line_data.get("discount_percent", 0))),
                tax_percent=Decimal(str(line_data.get("tax_percent", 0))),
            )
            line.save()  # Trigger line_total calculation
            subtotal += line.quantity * line.unit_price
            discount_total += line.discount_amount
            tax_total += line.tax_amount

        order.subtotal = subtotal
        order.discount_amount = discount_total
        order.tax_amount = tax_total
        order.save(update_fields=["subtotal", "discount_amount", "tax_amount", "total"])

        logger.info(f"Sales Order #{order_number} created for {customer}")
        return order

    @staticmethod
    def confirm_order(company, order_id: int) -> SalesOrder:
        """Confirm a sales order, reserving inventory."""
        order = SalesOrder.objects.get(pk=order_id, company=company)
        if order.status != "draft":
            raise ValidationError(f"Cannot confirm order in '{order.status}' status")

        # Reserve inventory for each line
        from apps.inventory.services import ReservationService
        for line in order.lines.all():
            if line.product_code and order.warehouse_id:
                try:
                    ReservationService.reserve_stock(
                        company=company,
                        product_name=line.product_name,
                        product_code=line.product_code,
                        warehouse_id=order.warehouse_id,
                        quantity=line.quantity,
                        reference_type="sales_order",
                        reference_id=order.id,
                        user=order.created_by,
                    )
                except Exception as e:
                    logger.warning(f"Failed to reserve stock for {line.product_name}: {e}")

        order.status = "confirmed"
        order.save(update_fields=["status"])
        logger.info(f"Sales Order #{order.order_number} confirmed")
        return order

    @staticmethod
    def cancel_order(company, order_id: int) -> SalesOrder:
        """Cancel a sales order and release reservations."""
        order = SalesOrder.objects.get(pk=order_id, company=company)
        if order.status in ("completed", "cancelled"):
            raise ValidationError(f"Cannot cancel order in '{order.status}' status")

        # Release reservations
        from apps.inventory.models import InventoryReservation
        reservations = InventoryReservation.objects.filter(
            company=company,
            reference_type="sales_order",
            reference_id=order.id,
            status="active",
        )
        for reservation in reservations:
            from apps.inventory.services import ReservationService
            ReservationService.release_reservation(company, reservation.id)

        order.status = "cancelled"
        order.save(update_fields=["status"])
        logger.info(f"Sales Order #{order.order_number} cancelled")
        return order

    @staticmethod
    def get_order_summary(company) -> Dict:
        """Get sales order summary for dashboard."""
        from django.db.models import Sum, Count, Q

        orders = SalesOrder.objects.filter(company=company)
        return {
            "total_orders": orders.count(),
            "draft": orders.filter(status="draft").count(),
            "confirmed": orders.filter(status="confirmed").count(),
            "processing": orders.filter(status="processing").count(),
            "delivered": orders.filter(status="delivered").count(),
            "completed": orders.filter(status="completed").count(),
            "total_value": orders.aggregate(total=Sum("total"))["total"] or Decimal("0"),
        }


class InvoiceService:
    """
    Manage sales invoice lifecycle.
    Per TRADING_MODULE.md §16: Sales Invoice Accounting.
    """

    @staticmethod
    @transaction.atomic
    def create_invoice(
        company,
        customer_id: int,
        invoice_date,
        due_date,
        lines_data: List[Dict],
        user=None,
        sales_order_id: int = None,
        notes: str = "",
        currency: str = "IRR",
    ) -> SalesInvoice:
        """Create a new sales invoice."""
        from apps.finance.models import Customer

        customer = Customer.objects.get(pk=customer_id, company=company)

        # Auto-generate invoice number
        last = SalesInvoice.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        invoice_number = f"SI-{next_num:05d}"

        invoice = SalesInvoice.objects.create(
            company=company,
            invoice_number=invoice_number,
            customer=customer,
            sales_order_id=sales_order_id,
            invoice_date=invoice_date,
            due_date=due_date,
            currency=currency,
            notes=notes,
            created_by=user,
        )

        subtotal = Decimal("0")
        discount_total = Decimal("0")
        tax_total = Decimal("0")
        for line_data in lines_data:
            line = SalesInvoiceLine(
                company=company,
                invoice=invoice,
                product_name=line_data["product_name"],
                product_code=line_data.get("product_code", ""),
                description=line_data.get("description", ""),
                quantity=Decimal(str(line_data["quantity"])),
                unit=line_data.get("unit", "عدد"),
                unit_price=Decimal(str(line_data["unit_price"])),
                discount_percent=Decimal(str(line_data.get("discount_percent", 0))),
                tax_percent=Decimal(str(line_data.get("tax_percent", 0))),
            )
            line.save()  # Trigger line_total calculation
            subtotal += line.quantity * line.unit_price
            discount_total += line.discount_amount
            tax_total += line.tax_amount

        invoice.subtotal = subtotal
        invoice.discount_amount = discount_total
        invoice.tax_amount = tax_total
        invoice.save(update_fields=["subtotal", "discount_amount", "tax_amount", "total"])

        logger.info(f"Sales Invoice #{invoice_number} created for {customer}")
        return invoice

    @staticmethod
    @transaction.atomic
    def issue_invoice(company, invoice_id: int, user=None) -> SalesInvoice:
        """
        Issue a sales invoice and post accounting entries.
        Per TRADING_MODULE.md §16:
        Debit: Customer Receivable
        Credit: Sales Revenue
        Credit: VAT Payable
        """
        invoice = SalesInvoice.objects.get(pk=invoice_id, company=company)
        if invoice.status != "draft":
            raise ValidationError(f"Cannot issue invoice in '{invoice.status}' status")

        # Post accounting entries
        from .posting import SalesPostingEngine
        voucher = SalesPostingEngine.post_sales_invoice(
            company=company,
            invoice=invoice,
            user=user,
        )
        invoice.journal_voucher = voucher

        invoice.status = "issued"
        invoice.save(update_fields=["status", "journal_voucher"])

        logger.info(f"Sales Invoice #{invoice.invoice_number} issued")
        return invoice

    @staticmethod
    @transaction.atomic
    def record_payment(
        company,
        invoice_id: int,
        amount: Decimal,
        user=None,
    ) -> SalesInvoice:
        """Record a payment against a sales invoice."""
        invoice = SalesInvoice.objects.get(pk=invoice_id, company=company)
        if invoice.status in ("cancelled",):
            raise ValidationError("Cannot record payment for cancelled invoice")

        invoice.amount_paid = invoice.amount_paid + amount

        if invoice.amount_paid >= invoice.total:
            invoice.status = "paid"
        elif invoice.amount_paid > 0:
            invoice.status = "partial"

        invoice.save(update_fields=["amount_paid", "status"])
        logger.info(f"Payment of {amount} recorded for invoice #{invoice.invoice_number}")
        return invoice

    @staticmethod
    def get_receivables(company) -> Dict:
        """Get accounts receivable summary."""
        from django.db.models import Sum

        invoices = SalesInvoice.objects.filter(
            company=company,
            status__in=("issued", "sent", "partial", "overdue"),
        )
        totals = invoices.aggregate(
            total_due=Sum("total"),
            total_paid=Sum("amount_paid"),
        )
        return {
            "outstanding_invoices": invoices.count(),
            "total_due": totals["total_due"] or Decimal("0"),
            "total_paid": totals["total_paid"] or Decimal("0"),
            "balance": (totals["total_due"] or Decimal("0")) - (totals["total_paid"] or Decimal("0")),
        }


class ReturnService:
    """
    Manage sales returns.
    Per TRADING_MODULE.md §14: Sales Return.
    """

    @staticmethod
    @transaction.atomic
    def create_return(
        company,
        customer_id: int,
        return_date,
        lines_data: List[Dict],
        user=None,
        sales_invoice_id: int = None,
        sales_order_id: int = None,
        reason: str = "",
        restocking_fee: Decimal = Decimal("0"),
    ) -> SalesReturn:
        """Create a sales return."""
        from apps.finance.models import Customer

        customer = Customer.objects.get(pk=customer_id, company=company)

        # Auto-generate return number
        last = SalesReturn.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        return_number = f"SR-{next_num:05d}"

        return_order = SalesReturn.objects.create(
            company=company,
            return_number=return_number,
            customer=customer,
            sales_invoice_id=sales_invoice_id,
            sales_order_id=sales_order_id,
            return_date=return_date,
            reason=reason,
            restocking_fee=restocking_fee,
            created_by=user,
        )

        total = Decimal("0")
        for line_data in lines_data:
            line = SalesReturnLine(
                company=company,
                return_order=return_order,
                product_name=line_data["product_name"],
                product_code=line_data.get("product_code", ""),
                quantity=Decimal(str(line_data["quantity"])),
                unit=line_data.get("unit", "عدد"),
                unit_price=Decimal(str(line_data["unit_price"])),
                reason=line_data.get("reason", ""),
                is_defective=line_data.get("is_defective", False),
            )
            line.save()  # Trigger line_total calculation
            total += line.line_total

        return_order.total_amount = total
        return_order.save(update_fields=["total_amount", "net_amount"])

        logger.info(f"Sales Return #{return_number} created for {customer}")
        return return_order

    @staticmethod
    @transaction.atomic
    def receive_return(company, return_id: int, user=None) -> SalesReturn:
        """
        Receive returned goods and post accounting entries.
        Per TRADING_MODULE.md §14:
        Debit: Sales Return
        Credit: Customer Receivable
        """
        return_order = SalesReturn.objects.get(pk=return_id, company=company)
        if return_order.status != "draft":
            raise ValidationError(f"Cannot receive return in '{return_order.status}' status")

        # Post accounting entries
        from .posting import SalesPostingEngine
        voucher = SalesPostingEngine.post_sales_return(
            company=company,
            return_order=return_order,
            user=user,
        )
        return_order.journal_voucher = voucher

        # Receive returned stock
        from apps.inventory.services import StockMovementService
        for line in return_order.lines.all():
            if line.product_code:
                try:
                    StockMovementService.create_receipt(
                        company=company,
                        warehouse_id=1,  # Default warehouse — should be from order
                        product_name=line.product_name,
                        product_code=line.product_code,
                        quantity=line.quantity,
                        unit_cost=line.unit_price,
                        reference_type="sales_return",
                        reference_id=return_order.id,
                        user=user,
                        description=f"Return #{return_order.return_number}",
                    )
                except Exception as e:
                    logger.warning(f"Failed to receive returned stock for {line.product_name}: {e}")

        return_order.status = "received"
        return_order.save(update_fields=["status", "journal_voucher"])

        logger.info(f"Sales Return #{return_order.return_number} received")
        return return_order
