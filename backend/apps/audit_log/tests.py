"""
Audit Log Tests — Tests for model tracking, middleware, and API endpoints.
"""
from django.test import TestCase, RequestFactory
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from apps.accounts.models import Company, User
from apps.sso.models import SSOProvider
from apps.audit_log.middleware import (
    AuditLogMiddleware, get_current_user, get_current_ip, get_current_ua,
    register_model, unregister_model, get_audited_models,
)
from apps.audit_log.signals import auto_register_models
from apps.audit_log.models import AuditLog


class AuditLogMiddlewareTest(TestCase):
    """Test that middleware stores request context in thread-local."""

    def test_middleware_stores_user(self):
        factory = RequestFactory()
        request = factory.get("/api/v1/test/")
        request.user = User(username="testuser")

        middleware = AuditLogMiddleware(lambda r: None)
        middleware.process_request(request)

        self.assertEqual(get_current_user(), request.user)
        self.assertIsNotNone(get_current_ip())

    def test_middleware_cleans_up(self):
        factory = RequestFactory()
        request = factory.get("/api/v1/test/")
        request.user = User(username="testuser")

        middleware = AuditLogMiddleware(lambda r: None)
        middleware.process_request(request)
        self.assertIsNotNone(get_current_user())

        from django.http import HttpResponse
        middleware.process_response(request, HttpResponse())
        self.assertIsNone(get_current_user())


class ModelRegistrationTest(TestCase):
    """Test model registration and auto-registration."""

    def test_register_model(self):
        initial = get_audited_models()
        register_model(SSOProvider)
        self.assertIn("sso.ssoprovider", get_audited_models())
        # Clean up
        unregister_model(SSOProvider)

    def test_unregister_model(self):
        register_model(SSOProvider)
        self.assertIn("sso.ssoprovider", get_audited_models())
        unregister_model(SSOProvider)
        self.assertNotIn("sso.ssoprovider", get_audited_models())


class AuditLogCreationTest(TestCase):
    """Test that audit log entries are created on model operations."""

    def setUp(self):
        self.company = Company.objects.create(name="AuditCo", enabled_modules=["reporting"])
        register_model(SSOProvider)
        # Simulate user in thread-local
        self.user = User.objects.create_user("audituser", password="pass", email="a@b.com")

    def tearDown(self):
        unregister_model(SSOProvider)

    def test_create_creates_audit_log(self):
        from apps.audit_log.middleware import _thread_locals
        _thread_locals.user = self.user
        _thread_locals.ip = "127.0.0.1"
        _thread_locals.user_agent = "test"

        provider = SSOProvider.objects.create(
            company=self.company, name="Audited", slug="audited",
            protocol="oidc", oidc_client_id="x", oidc_discovery_url="https://x.com",
        )

        ct = ContentType.objects.get_for_model(SSOProvider)
        logs = AuditLog.objects.filter(content_type=ct, object_id=str(provider.pk))
        self.assertTrue(logs.exists())
        log = logs.first()
        self.assertEqual(log.action, "create")
        self.assertEqual(log.user, self.user)
        self.assertIn("name", log.new_values)

    def test_update_creates_audit_log(self):
        from apps.audit_log.middleware import _thread_locals
        _thread_locals.user = self.user
        _thread_locals.ip = "127.0.0.1"

        provider = SSOProvider.objects.create(
            company=self.company, name="Original", slug="orig",
            protocol="oidc", oidc_client_id="x", oidc_discovery_url="https://x.com",
        )

        _thread_locals.user = self.user
        provider.name = "Updated"
        provider.save()

        ct = ContentType.objects.get_for_model(SSOProvider)
        logs = AuditLog.objects.filter(content_type=ct, object_id=str(provider.pk), action="update")
        self.assertTrue(logs.exists())
        log = logs.first()
        self.assertIn("name", log.changed_fields)
        self.assertEqual(log.old_values.get("name"), "Original")
        self.assertEqual(log.new_values.get("name"), "Updated")

    def test_delete_creates_audit_log(self):
        from apps.audit_log.middleware import _thread_locals
        _thread_locals.user = self.user
        _thread_locals.ip = "127.0.0.1"

        provider = SSOProvider.objects.create(
            company=self.company, name="Doomed", slug="doomed",
            protocol="oidc", oidc_client_id="x", oidc_discovery_url="https://x.com",
        )
        pk = provider.pk

        provider.delete()

        ct = ContentType.objects.get_for_model(SSOProvider)
        logs = AuditLog.objects.filter(content_type=ct, object_id=str(pk), action="delete")
        self.assertTrue(logs.exists())


class AuditLogAPITest(TestCase):
    """Test audit log API endpoints."""

    def setUp(self):
        self.user = User.objects.create_user("apitest", password="pass", email="api@b.com")
        self.user.company = Company.objects.create(name="APICo", enabled_modules=["reporting"])
        self.user.save()
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Create a sample audit log
        AuditLog.objects.create(
            action="create",
            user=self.user,
            company=self.user.company,
            description="Test entry",
            old_values={},
            new_values={"name": "test"},
            changed_fields=["name"],
        )

    def test_list_audit_logs(self):
        resp = self.client.get("/api/v1/audit/entries/")
        self.assertEqual(resp.status_code, 200)

    def test_audit_summary(self):
        resp = self.client.get("/api/v1/audit/summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("total_entries", resp.data)
        self.assertIn("entries_by_action", resp.data)


class BillingAuditVisibilityTest(TestCase):
    """Billing audit rows have no company; they must still reach billing users."""

    def setUp(self):
        import datetime as dt

        from rest_framework.test import APIClient

        from apps.billing.models import Payment

        self.company_a = Company.objects.create(name="شرکت الف", enabled_modules=["finance"])
        self.company_b = Company.objects.create(name="شرکت ب", enabled_modules=["finance"])
        self.user_a = User.objects.create_user(
            "audit_a", password="pass", email="a@example.com", company=self.company_a,
        )
        self.user_b = User.objects.create_user(
            "audit_b", password="pass", email="b@example.com", company=self.company_b,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user_a)

        self.payment = Payment.objects.create(
            payer_code="3001", payer_name="شرکت نمونه",
            payment_date=dt.date(2025, 7, 1), amount=1_000,
        )
        self.company_a_log = AuditLog.objects.create(
            action="update", company=self.company_a, description="A company entry",
        )
        self.company_b_log = AuditLog.objects.create(
            action="update", company=self.company_b, description="B company entry",
        )

    def _entries(self):
        response = self.client.get("/api/v1/audit/entries/")
        self.assertEqual(response.status_code, 200)
        data = response.data
        return data["results"] if isinstance(data, dict) and "results" in data else data

    def _descriptions(self, entries):
        return {row["description"] for row in entries}

    def test_billing_entries_are_visible_alongside_own_company_rows(self):
        descriptions = self._descriptions(self._entries())
        self.assertIn("A company entry", descriptions)
        self.assertTrue(any("billing.payment" in text for text in descriptions))
        # Another company's row never leaks through the same response.
        self.assertNotIn("B company entry", descriptions)

    def test_other_company_does_not_see_these_rows(self):
        self.client.force_authenticate(user=self.user_b)

        descriptions = self._descriptions(self._entries())

        self.assertIn("B company entry", descriptions)
        self.assertNotIn("A company entry", descriptions)

    def test_billing_entries_need_the_billing_view_permission(self):
        self.user_a.can_view = False
        self.user_a.save(update_fields=["can_view"])

        descriptions = self._descriptions(self._entries())

        self.assertIn("A company entry", descriptions)
        self.assertFalse(any("billing.payment" in text for text in descriptions))
