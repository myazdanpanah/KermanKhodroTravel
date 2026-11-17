"""
Service Sales Module Services — Enterprise ERP Service Sales Management.

Per SERVICE_SALES_MODULE.md §9: Booking Engine.
Per SERVICE_SALES_MODULE.md §11: Commission Engine.
Per SERVICE_SALES_MODULE.md §12: Cancellation & Refund.
Per SERVICE_SALES_MODULE.md §14: Accounting Integration.
"""

import logging
from decimal import Decimal
from typing import Dict

from django.db import transaction
from django.utils import timezone

from apps.finance.exceptions import ValidationError
from .models import (
    Booking, BookingLine, Passenger, Ticket, Service,
    CommissionRule, CommissionTransaction, RefundTransaction,
)

logger = logging.getLogger(__name__)


class BookingService:
    """Manage booking lifecycle."""

    @staticmethod
    @transaction.atomic
    def create_booking(
        company,
        customer_id: int,
        booking_date,
        lines_data: list,
        user=None,
        **kwargs,
    ) -> Booking:
        """Create a new booking with line items."""
        from apps.finance.models import Customer
        customer = Customer.objects.get(pk=customer_id, company=company)

        last = Booking.objects.filter(company=company).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        booking_number = f"BK-{next_num:05d}"

        booking = Booking.objects.create(
            company=company,
            booking_number=booking_number,
            customer=customer,
            booking_date=booking_date,
            created_by=user,
            **kwargs,
        )

        subtotal = Decimal("0")
        discount_total = Decimal("0")
        tax_total = Decimal("0")
        for line_data in lines_data:
            service = Service.objects.get(pk=line_data["service_id"], company=company)
            line = BookingLine(
                company=company,
                booking=booking,
                service=service,
                description=line_data.get("description", ""),
                quantity=Decimal(str(line_data.get("quantity", 1))),
                unit_price=Decimal(str(line_data.get("unit_price", service.selling_price))),
                discount_percent=Decimal(str(line_data.get("discount_percent", 0))),
                tax_percent=Decimal(str(line_data.get("tax_percent", service.tax_percent))),
                supplier_cost=service.supplier_cost,
            )
            line.save()
            subtotal += line.quantity * line.unit_price
            discount_total += line.discount_amount
            tax_total += line.tax_amount

        booking.subtotal = subtotal
        booking.discount_amount = discount_total
        booking.tax_amount = tax_total
        booking.save(update_fields=["subtotal", "discount_amount", "tax_amount", "total"])
        return booking

    @staticmethod
    def confirm_booking(company, booking_id: int) -> Booking:
        """Confirm a booking."""
        booking = Booking.objects.get(pk=booking_id, company=company)
        if booking.status != "draft":
            raise ValidationError(f"Cannot confirm booking in '{booking.status}' status")
        booking.status = "confirmed"
        booking.save(update_fields=["status"])
        return booking

    @staticmethod
    def complete_booking(company, booking_id: int) -> Booking:
        """Complete a booking."""
        booking = Booking.objects.get(pk=booking_id, company=company)
        if booking.status not in ("confirmed", "paid"):
            raise ValidationError(f"Cannot complete booking in '{booking.status}' status")
        booking.status = "completed"
        booking.save(update_fields=["status"])
        return booking

    @staticmethod
    def record_payment(company, booking_id: int, amount: Decimal) -> Booking:
        """Record a payment against a booking."""
        booking = Booking.objects.get(pk=booking_id, company=company)
        booking.amount_paid += amount
        if booking.amount_paid >= booking.total:
            booking.status = "paid"
        booking.save(update_fields=["amount_paid", "status"])
        return booking


class CommissionService:
    """Manage commissions."""

    @staticmethod
    @transaction.atomic
    def calculate_commission(
        company,
        booking_id: int,
        agent_id: int,
        rule_id: int = None,
    ) -> CommissionTransaction:
        """Calculate and record commission for a booking."""
        booking = Booking.objects.get(pk=booking_id, company=company)

        if rule_id:
            rule = CommissionRule.objects.get(pk=rule_id, company=company)
        else:
            rule = CommissionRule.objects.filter(
                company=company, is_active=True
            ).first()

        if not rule:
            raise ValidationError("No commission rule found")

        base_amount = booking.subtotal
        if rule.commission_type == "percentage":
            commission = base_amount * rule.commission_rate / Decimal("100")
        elif rule.commission_type == "fixed":
            commission = rule.fixed_amount
        elif rule.commission_type == "margin_based":
            total_margin = sum(
                (line.line_total - line.supplier_cost * line.quantity)
                for line in booking.lines.all()
            )
            commission = total_margin * rule.commission_rate / Decimal("100")
        else:
            commission = Decimal("0")

        from django.contrib.auth import get_user_model
        User = get_user_model()
        agent = User.objects.get(pk=agent_id)

        transaction_obj = CommissionTransaction.objects.create(
            company=company,
            booking=booking,
            rule=rule,
            agent=agent,
            commission_amount=commission,
            base_amount=base_amount,
        )
        return transaction_obj


class RefundService:
    """Manage refunds."""

    @staticmethod
    @transaction.atomic
    def process_refund(
        company,
        booking_id: int,
        refund_amount: Decimal,
        penalty_amount: Decimal = Decimal("0"),
        reason: str = "",
        user=None,
    ) -> RefundTransaction:
        """Process a refund for a cancelled booking."""
        booking = Booking.objects.get(pk=booking_id, company=company)
        if booking.status not in ("cancelled", "completed"):
            raise ValidationError("Booking must be cancelled or completed to refund")

        refund = RefundTransaction.objects.create(
            company=company,
            booking=booking,
            refund_amount=refund_amount,
            penalty_amount=penalty_amount,
            reason=reason,
            created_by=user,
        )

        booking.status = "refunded"
        booking.save(update_fields=["status"])
        return refund
