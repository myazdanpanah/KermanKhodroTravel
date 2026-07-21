"""
Service Sales Module Tests — comprehensive test suite.
"""

from decimal import Decimal
from datetime import date

from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.accounts.models import Company
from apps.finance.models import Customer

from .models import (
    ServiceCategory, ServiceProvider, Service,
    Booking, BookingLine, Passenger, Ticket,
    TourPackage, HotelReservation,
    CommissionRule, CommissionTransaction, RefundTransaction,
)
from .services import BookingService, CommissionService, RefundService
from .posting import ServiceSalesPostingEngine

User = get_user_model()


class ServiceSalesTestBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name="ServiceTestCo", code="ST")
        cls.user = User.objects.create_user(username="serviceuser", password="pass123", company=cls.company)
        cls.customer = Customer.objects.create(company=cls.company, name="Test Customer", customer_type="retail")

        cls.category = ServiceCategory.objects.create(company=cls.company, name="Flight Tickets")
        cls.provider = ServiceProvider.objects.create(company=cls.company, name="Iran Air", provider_type="airline")
        cls.service = Service.objects.create(
            company=cls.company, name="Tehran → Istanbul", service_type="flight",
            category=cls.category, provider=cls.provider,
            selling_price=Decimal("15000000"), supplier_cost=Decimal("10000000"),
            tax_percent=Decimal("9"),
        )


class ServiceTests(ServiceSalesTestBase):
    def test_create_service(self):
        self.assertEqual(self.service.selling_price, Decimal("15000000"))
        self.assertEqual(self.service.gross_margin, Decimal("5000000"))


class BookingTests(ServiceSalesTestBase):
    def test_create_booking(self):
        booking = BookingService.create_booking(
            company=self.company,
            customer_id=self.customer.id,
            booking_date=date.today(),
            lines_data=[{"service_id": self.service.id, "quantity": 2}],
            user=self.user,
        )
        self.assertEqual(booking.status, "draft")
        self.assertEqual(booking.lines.count(), 1)
        self.assertTrue(booking.total > 0)

    def test_confirm_booking(self):
        booking = BookingService.create_booking(
            company=self.company, customer_id=self.customer.id,
            booking_date=date.today(),
            lines_data=[{"service_id": self.service.id}],
        )
        result = BookingService.confirm_booking(self.company, booking.id)
        self.assertEqual(result.status, "confirmed")

    def test_record_payment(self):
        booking = BookingService.create_booking(
            company=self.company, customer_id=self.customer.id,
            booking_date=date.today(),
            lines_data=[{"service_id": self.service.id}],
        )
        BookingService.confirm_booking(self.company, booking.id)
        result = BookingService.record_payment(self.company, booking.id, Decimal("5000000"))
        self.assertEqual(result.status, "draft")  # Not fully paid yet

    def test_complete_booking(self):
        booking = BookingService.create_booking(
            company=self.company, customer_id=self.customer.id,
            booking_date=date.today(),
            lines_data=[{"service_id": self.service.id}],
        )
        BookingService.confirm_booking(self.company, booking.id)
        result = BookingService.complete_booking(self.company, booking.id)
        self.assertEqual(result.status, "completed")


class CommissionTests(ServiceSalesTestBase):
    def test_calculate_commission(self):
        rule = CommissionRule.objects.create(
            company=self.company, name="Agent 5%",
            commission_type="percentage", commission_rate=Decimal("5"),
        )
        booking = BookingService.create_booking(
            company=self.company, customer_id=self.customer.id,
            booking_date=date.today(),
            lines_data=[{"service_id": self.service.id}],
        )
        BookingService.confirm_booking(self.company, booking.id)
        commission = CommissionService.calculate_commission(
            self.company, booking.id, self.user.id, rule.id,
        )
        self.assertTrue(commission.commission_amount > 0)


class RefundTests(ServiceSalesTestBase):
    def test_process_refund(self):
        booking = BookingService.create_booking(
            company=self.company, customer_id=self.customer.id,
            booking_date=date.today(),
            lines_data=[{"service_id": self.service.id}],
        )
        BookingService.confirm_booking(self.company, booking.id)
        booking.status = "cancelled"
        booking.save(update_fields=["status"])

        refund = RefundService.process_refund(
            self.company, booking.id, Decimal("10000000"),
            penalty_amount=Decimal("2000000"), reason="Change of plans",
        )
        self.assertEqual(refund.net_refund, Decimal("8000000"))


class PostingTests(ServiceSalesTestBase):
    def test_post_booking_invoice(self):
        booking = BookingService.create_booking(
            company=self.company, customer_id=self.customer.id,
            booking_date=date.today(),
            lines_data=[{"service_id": self.service.id}],
        )
        voucher = ServiceSalesPostingEngine.post_booking_invoice(
            self.company, booking, self.user,
        )
        entries = voucher.entries.all()
        self.assertEqual(entries.count(), 3)  # Dr 131, Cr 404, Cr 221
