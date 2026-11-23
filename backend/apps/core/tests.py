"""Tests for core global search."""

from rest_framework.test import APITestCase
from django.urls import reverse
from apps.accounts.tests_helpers import create_test_company, create_test_user
from apps.office.models import Correspondence
from apps.billing.models import Invoice, Payment, Payer


class GlobalSearchTests(APITestCase):
    def setUp(self):
        self.company = create_test_company(name="کرمان خودرو")
        self.user = create_test_user(username="test_ceo", company=self.company, role="ceo")
        self.client.force_authenticate(user=self.user)

        # Create sample entities
        Payer.objects.create(code="099", name="شرکت تست کرمان")
        Invoice.objects.create(
            letter_number="1405/099/00001",
            payer="شرکت تست کرمان",
            payer_code="099",
            invoice_type="هتل",
            amount=5000000,
            issue_date="2026-01-01",
        )
        Payment.objects.create(
            tracking_number="TRK-99001",
            payer_code="099",
            payer_name="شرکت تست کرمان",
            payment_date="2026-01-02",
            amount=5000000,
        )
        Correspondence.objects.create(
            company=self.company,
            subject="نامه آزمایشی کرمان",
            body="متن نامه تستی",
            created_by=self.user,
            owner=self.user,
        )

    def test_empty_query_returns_empty_results(self):
        response = self.client.get(reverse("global-search"), {"q": ""})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 0)
        self.assertEqual(len(response.data["results"]), 0)

    def test_global_search_finds_cross_system_entities(self):
        response = self.client.get(reverse("global-search"), {"q": "کرمان"})
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data["total"], 3)
        categories = {item["category"] for item in response.data["results"]}
        self.assertIn("correspondence", categories)
        self.assertIn("invoice", categories)
        self.assertIn("customer", categories)
