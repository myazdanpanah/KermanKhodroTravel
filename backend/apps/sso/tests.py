"""
SSO & Identity — Tests for providers, auth flow, JIT provisioning, and audit trail.
"""
from unittest.mock import MagicMock
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from django.core.cache import cache

from apps.accounts.models import Company
from apps.sso.models import SSOProvider, SSOUserMapping, SSOLoginAttempt
from rest_framework.test import APIClient
from apps.sso.views import (
    _provision_or_get_user,
    _build_oidc_auth_url,
    _test_provider_connection,
)

User = get_user_model()


class SSOProviderModelTest(TestCase):
    """Test SSO provider model behavior."""

    def setUp(self):
        self.company = Company.objects.create(name="TestCo", enabled_modules=["reporting"])
        self.provider = SSOProvider.objects.create(
            company=self.company,
            name="Test OIDC",
            slug="test-oidc",
            protocol="oidc",
            status="active",
            oidc_client_id="test-client-id",
            oidc_discovery_url="https://idp.example.com/.well-known/openid-configuration",
        )

    def test_str(self):
        self.assertEqual(str(self.provider), "Test OIDC (OpenID Connect)")

    def test_is_configured_oidc(self):
        self.assertTrue(self.provider.is_configured)

    def test_is_configured_oidc_incomplete(self):
        self.provider.oidc_client_id = ""
        self.provider.save()
        self.assertFalse(self.provider.is_configured)

    def test_is_configured_saml(self):
        self.provider.protocol = "saml"
        self.provider.saml_entity_id = "https://idp.example.com"
        self.provider.saml_sso_url = "https://idp.example.com/sso"
        self.provider.save()
        self.assertTrue(self.provider.is_configured)

    def test_is_configured_saml_incomplete(self):
        self.provider.protocol = "saml"
        self.provider.saml_entity_id = ""
        self.provider.saml_sso_url = ""
        self.provider.save()
        self.assertFalse(self.provider.is_configured)

    def test_slug_auto_generation(self):
        p = SSOProvider.objects.create(
            company=self.company, name="Auto Slug", protocol="oidc",
            oidc_client_id="x", oidc_discovery_url="https://x.com",
        )
        self.assertTrue(p.slug)
        self.assertGreater(len(p.slug), 5)


class JITProvisioningTest(TestCase):
    """Test JIT user provisioning and domain allowlist."""

    def setUp(self):
        self.company = Company.objects.create(name="TestCo", enabled_modules=["reporting"])
        self.provider = SSOProvider.objects.create(
            company=self.company,
            name="Test",
            slug="test-jit",
            protocol="oidc",
            status="active",
            jit_provisioning=True,
            oidc_client_id="x",
            oidc_discovery_url="https://x.com",
        )

    def test_jit_creates_new_user(self):
        user, is_new = _provision_or_get_user(
            self.provider, "newuser@acme.com", "New", "User",
            {"sub": "idp-123", "email": "newuser@acme.com"},
            "127.0.0.1", "test-agent",
        )
        self.assertTrue(is_new)
        self.assertEqual(user.email, "newuser@acme.com")
        self.assertEqual(user.first_name, "New")
        self.assertEqual(user.last_name, "User")

    def test_jit_returns_existing_user(self):
        user1, _ = _provision_or_get_user(
            self.provider, "existing@acme.com", "First", "Last",
            {"sub": "idp-456", "email": "existing@acme.com"},
            "127.0.0.1", "test-agent",
        )
        user2, is_new = _provision_or_get_user(
            self.provider, "existing@acme.com", "Updated", "Name",
            {"sub": "idp-456", "email": "existing@acme.com"},
            "127.0.0.1", "test-agent",
        )
        self.assertFalse(is_new)
        self.assertEqual(user1.id, user2.id)

    def test_jit_disabled_rejects_unknown(self):
        self.provider.jit_provisioning = False
        self.provider.save()
        with self.assertRaises(ValueError) as ctx:
            _provision_or_get_user(
                self.provider, "unknown@test.com", "", "",
                {"sub": "idp-789", "email": "unknown@test.com"},
                "127.0.0.1", "test-agent",
            )
        self.assertIn("JIT provisioning is disabled", str(ctx.exception))

    def test_domain_allowlist_blocks(self):
        self.provider.allowed_domains = ["acme.com"]
        self.provider.save()
        with self.assertRaises(ValueError) as ctx:
            _provision_or_get_user(
                self.provider, "user@evil.com", "", "",
                {"sub": "idp-bad", "email": "user@evil.com"},
                "127.0.0.1", "test-agent",
            )
        self.assertIn("not allowed", str(ctx.exception))

    def test_domain_allowlist_allows(self):
        self.provider.allowed_domains = ["acme.com", "trusted.org"]
        self.provider.save()
        user, is_new = _provision_or_get_user(
            self.provider, "user@trusted.org", "", "",
            {"sub": "idp-good", "email": "user@trusted.org"},
            "127.0.0.1", "test-agent",
        )
        self.assertTrue(is_new)
        self.assertEqual(user.email, "user@trusted.org")

    def test_username_collision_handled(self):
        User.objects.create_user("testuser", email="a@b.com")
        user, is_new = _provision_or_get_user(
            self.provider, "testuser@c.com", "", "",
            {"sub": "idp-collide", "email": "testuser@c.com"},
            "127.0.0.1", "test-agent",
        )
        self.assertTrue(is_new)
        self.assertNotEqual(user.username, "testuser")
        self.assertTrue(user.username.startswith("testuser"))

    def test_audit_trail_created(self):
        _provision_or_get_user(
            self.provider, "audit@test.com", "", "",
            {"sub": "idp-audit", "email": "audit@test.com"},
            "10.0.0.1", "Mozilla/5.0",
        )
        mapping = SSOUserMapping.objects.get(provider=self.provider, external_id="idp-audit")
        self.assertEqual(mapping.external_email, "audit@test.com")

        attempt = SSOLoginAttempt.objects.get(provider=self.provider, external_email="audit@test.com")
        self.assertEqual(attempt.status, "success")
        self.assertEqual(attempt.ip_address, "10.0.0.1")
        self.assertTrue(attempt.metadata.get("jit_provisioned"))


class OIDCUrlBuilderTest(TestCase):
    """Test OIDC authorization URL construction."""

    def test_build_oidc_url(self):
        provider = MagicMock(
            oidc_client_id="my-app",
            oidc_scopes=["openid", "email"],
            oidc_authorization_url="https://idp.example.com/authorize",
            oidc_discovery_url="",
        )
        url = _build_oidc_auth_url(provider, "state123", "https://app.com/callback")
        self.assertIn("client_id=my-app", url)
        self.assertIn("response_type=code", url)
        self.assertIn("state=state123", url)
        self.assertIn("scope=openid+email", url)
        self.assertIn("redirect_uri=", url)
        self.assertTrue(url.startswith("https://idp.example.com/authorize?"))

    def test_build_oidc_url_fallback_to_discovery(self):
        provider = MagicMock(
            oidc_client_id="my-app",
            oidc_scopes=["openid"],
            oidc_authorization_url="",
            oidc_discovery_url="https://idp.example.com/.well-known/openid-configuration",
        )
        url = _build_oidc_auth_url(provider, "st", "https://app.com/cb")
        self.assertIn("https://idp.example.com/.well-known/openid-configuration/authorize", url)


class SSOCallbackStateTest(TestCase):
    """Test state validation in SSO initiate/callback flow."""

    def setUp(self):
        self.factory = RequestFactory()

    def test_state_stored_in_cache(self):
        from apps.sso.views import sso_initiate

        company = Company.objects.create(name="StateCo", enabled_modules=["reporting"])
        provider = SSOProvider.objects.create(
            company=company, name="StateTest", slug="state-test",
            protocol="oidc", status="active",
            oidc_client_id="x", oidc_discovery_url="https://x.com",
            oidc_authorization_url="https://x.com/auth",
        )
        request = self.factory.post("/api/v1/sso/initiate/", {
            "provider_slug": "state-test",
            "redirect_uri": "https://app.com/cb",
        }, content_type="application/json")
        request.session = {}

        response = sso_initiate(request)
        state = response.data.get("state", "")
        self.assertTrue(state)

        # State should be in cache
        cached = cache.get(f"sso_state_{state}")
        self.assertIsNotNone(cached)
        self.assertEqual(cached["provider_slug"], "state-test")

    def test_invalid_state_rejected(self):
        from apps.sso.views import sso_callback

        company = Company.objects.create(name="StateCo2", enabled_modules=["reporting"])
        provider = SSOProvider.objects.create(
            company=company, name="StateTest2", slug="state-test2",
            protocol="oidc", status="active",
            oidc_client_id="x", oidc_discovery_url="https://x.com",
        )
        request = self.factory.post(
            f"/api/v1/sso/callback/{provider.slug}/",
            {"code": "test", "state": "invalid-state"},
            content_type="application/json",
        )
        request.session = {}
        request.META = {"REMOTE_ADDR": "127.0.0.1", "HTTP_USER_AGENT": "test"}

        response = sso_callback(request, provider.slug)
        self.assertEqual(response.status_code, 400)


class SSOProviderAPITest(TestCase):
    """Test SSO provider CRUD API endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="ssotester", password="testpass123", email="ssotester@test.com",
        )
        self.user.company = Company.objects.create(name="APICo", enabled_modules=["reporting"])
        self.user.save()
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_list_providers(self):
        SSOProvider.objects.create(
            company=self.user.company, name="P1", slug="p1",
            protocol="oidc", oidc_client_id="x", oidc_discovery_url="https://x.com",
        )
        resp = self.client.get("/api/v1/sso/providers/")
        self.assertEqual(resp.status_code, 200)

    def test_create_provider(self):
        resp = self.client.post("/api/v1/sso/providers/", {
            "name": "New Provider",
            "protocol": "oidc",
            "oidc_client_id": "client-123",
            "oidc_discovery_url": "https://idp.example.com/.well-known/openid-configuration",
        })
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["name"], "New Provider")

    def test_create_saml_provider(self):
        resp = self.client.post("/api/v1/sso/providers/", {
            "name": "SAML Provider",
            "protocol": "saml",
            "saml_entity_id": "https://idp.example.com",
            "saml_sso_url": "https://idp.example.com/sso",
        })
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["protocol"], "saml")

    def test_secret_not_in_response(self):
        resp = self.client.post("/api/v1/sso/providers/", {
            "name": "Secret Test",
            "protocol": "oidc",
            "oidc_client_id": "cid",
            "oidc_client_secret": "super-secret-value",
            "oidc_discovery_url": "https://x.com",
        })
        self.assertEqual(resp.status_code, 201)
        self.assertNotIn("super-secret-value", str(resp.data))

    def test_toggle_status(self):
        provider = SSOProvider.objects.create(
            company=self.user.company, name="Toggle", slug="toggle",
            protocol="oidc", status="active",
            oidc_client_id="x", oidc_discovery_url="https://x.com",
        )
        resp = self.client.post(f"/api/v1/sso/providers/{provider.id}/toggle_status/")
        self.assertEqual(resp.status_code, 200)
        provider.refresh_from_db()
        self.assertEqual(provider.status, "inactive")

    def test_test_connection(self):
        provider = SSOProvider.objects.create(
            company=self.user.company, name="TestConn", slug="test-conn",
            protocol="oidc", oidc_client_id="x", oidc_discovery_url="",
        )
        resp = self.client.post(f"/api/v1/sso/providers/{provider.id}/test_connection/")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["success"])
        self.assertIn("No discovery URL", resp.data["message"])

    def test_list_public_unauthenticated(self):
        """Test that unauthenticated users can list active providers for the login page."""
        SSOProvider.objects.create(
            company=self.user.company, name="ActivePublic", slug="active-pub",
            protocol="oidc", status="active",
            oidc_client_id="x", oidc_discovery_url="https://x.com",
        )
        SSOProvider.objects.create(
            company=self.user.company, name="InactivePublic", slug="inactive-pub",
            protocol="oidc", status="inactive",
            oidc_client_id="x", oidc_discovery_url="https://x.com",
        )
        unauth_client = APIClient()
        resp = unauth_client.get("/api/v1/sso/providers/public/")
        self.assertEqual(resp.status_code, 200)
        data = resp.data.get("results", resp.data) if isinstance(resp.data, dict) else resp.data
        names = [p["name"] for p in data]
        self.assertIn("ActivePublic", names)
        self.assertNotIn("InactivePublic", names)
