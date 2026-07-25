"""
Rate Limiting Tests — API Key management, throttling, and usage tracking.

Phase 22: API Rate Limiting & Throttling
"""

import time
from unittest.mock import patch
from django.test import TestCase, RequestFactory
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import Company, User
from .models import APIKey, RateLimitPolicy, RateLimitLog, generate_api_key, hash_api_key
from .throttling import APIKeyRateThrottle


class APIKeyModelTest(TestCase):
    """Test APIKey model creation, validation, and management."""

    def setUp(self):
        self.company = Company.objects.create(name="Test Company")
        self.user = User.objects.create_user(
            username="testuser", password="testpass123",
            company=self.company, role="admin",
        )

    def test_generate_api_key(self):
        """Test API key generation produces valid format."""
        key = generate_api_key()
        self.assertTrue(key.startswith("nxv_"))
        self.assertEqual(len(key), 44)  # "nxv_" + 40 hex chars

    def test_hash_api_key(self):
        """Test API key hashing is deterministic."""
        key = "nxv_test123"
        h1 = hash_api_key(key)
        h2 = hash_api_key(key)
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)  # SHA-256 hex

    def test_create_api_key(self):
        """Test creating an API key returns raw key."""
        api_key, raw_key = APIKey.create_key(
            company=self.company,
            name="Test Key",
            created_by=self.user,
        )
        self.assertIsNotNone(raw_key)
        self.assertTrue(raw_key.startswith("nxv_"))
        self.assertEqual(api_key.name, "Test Key")
        self.assertEqual(api_key.company, self.company)
        self.assertTrue(api_key.is_active)
        self.assertEqual(api_key.key_prefix, raw_key[:12] + "...")

    def test_verify_api_key(self):
        """Test verifying a valid API key."""
        _, raw_key = APIKey.create_key(
            company=self.company,
            name="Verify Test",
            created_by=self.user,
        )
        verified = APIKey.verify_key(raw_key)
        self.assertIsNotNone(verified)
        self.assertEqual(verified.name, "Verify Test")

    def test_verify_invalid_key(self):
        """Test verifying an invalid API key returns None."""
        result = APIKey.verify_key("nxv_invalid_key_12345678901234567890")
        self.assertIsNone(result)

    def test_verify_deactivated_key(self):
        """Test verifying a deactivated key returns None."""
        api_key, raw_key = APIKey.create_key(
            company=self.company,
            name="Deactivated Key",
            created_by=self.user,
        )
        api_key.is_active = False
        api_key.save(update_fields=["is_active"])
        result = APIKey.verify_key(raw_key)
        self.assertIsNone(result)

    def test_verify_expired_key(self):
        """Test verifying an expired key returns None."""
        api_key, raw_key = APIKey.create_key(
            company=self.company,
            name="Expired Key",
            created_by=self.user,
            expires_at=timezone.now() - timedelta(hours=1),
        )
        result = APIKey.verify_key(raw_key)
        self.assertIsNone(result)

    def test_is_valid_active_key(self):
        """Test is_valid returns True for active, non-expired key."""
        api_key, _ = APIKey.create_key(
            company=self.company,
            name="Valid Key",
            created_by=self.user,
        )
        self.assertTrue(api_key.is_valid())

    def test_is_valid_expired_key(self):
        """Test is_valid returns False for expired key."""
        api_key, _ = APIKey.create_key(
            company=self.company,
            name="Expired Key",
            created_by=self.user,
            expires_at=timezone.now() - timedelta(hours=1),
        )
        self.assertFalse(api_key.is_valid())

    def test_record_usage(self):
        """Test recording usage increments counter."""
        api_key, _ = APIKey.create_key(
            company=self.company,
            name="Usage Test",
            created_by=self.user,
        )
        self.assertEqual(api_key.total_requests, 0)
        self.assertIsNone(api_key.last_used_at)

        api_key.record_usage()
        api_key.refresh_from_db()
        self.assertEqual(api_key.total_requests, 1)
        self.assertIsNotNone(api_key.last_used_at)

    def test_scopes_and_modules(self):
        """Test API key with custom scopes and modules."""
        api_key, _ = APIKey.create_key(
            company=self.company,
            name="Scoped Key",
            created_by=self.user,
            scopes=["finance:read", "sales:write"],
            allowed_modules=["finance", "sales"],
        )
        self.assertEqual(api_key.scopes, ["finance:read", "sales:write"])
        self.assertEqual(api_key.allowed_modules, ["finance", "sales"])

    def test_rate_limit_override(self):
        """Test API key with custom rate limit overrides."""
        api_key, _ = APIKey.create_key(
            company=self.company,
            name="Override Key",
            created_by=self.user,
            rate_limit_override={"requests_per_minute": 200},
        )
        self.assertEqual(api_key.rate_limit_override, {"requests_per_minute": 200})


class RateLimitPolicyTest(TestCase):
    """Test RateLimitPolicy model."""

    def setUp(self):
        self.company = Company.objects.create(name="Test Company")

    def test_create_policy(self):
        """Test creating a rate limit policy."""
        policy = RateLimitPolicy.objects.create(
            company=self.company,
            name="Default Policy",
            scope="global",
            requests_per_minute=60,
            requests_per_hour=1000,
        )
        self.assertEqual(policy.name, "Default Policy")
        self.assertTrue(policy.is_active)

    def test_module_policy(self):
        """Test creating a module-specific policy."""
        policy = RateLimitPolicy.objects.create(
            company=self.company,
            name="Finance Policy",
            scope="module",
            module="finance",
            requests_per_minute=120,
        )
        self.assertEqual(policy.module, "finance")


class APIKeyThrottleTest(TestCase):
    """Test API key rate throttling logic."""

    def setUp(self):
        self.cache = cache
        self.cache.clear()

    def test_throttle_allows_within_limit(self):
        """Test requests within rate limit are allowed."""
        throttle = APIKeyRateThrottle()
        mock_key = type("MockKey", (), {"id": 1, "rate_limit_override": {"requests_per_minute": 5}})()

        mock_request = type("Request", (), {"api_key": mock_key})()
        mock_view = type("View", (), {})()

        result = throttle.allow_request(mock_request, mock_view)
        self.assertTrue(result)

    def test_throttle_blocks_over_limit(self):
        """Test requests over rate limit are blocked."""
        throttle = APIKeyRateThrottle()
        mock_key = type("MockKey", (), {"id": 999, "rate_limit_override": {"requests_per_minute": 2}})()

        mock_request = type("Request", (), {"api_key": mock_key})()
        mock_view = type("View", (), {})()

        # First two should pass
        self.assertTrue(throttle.allow_request(mock_request, mock_view))
        self.assertTrue(throttle.allow_request(mock_request, mock_view))

        # Third should be blocked
        self.assertFalse(throttle.allow_request(mock_request, mock_view))


class RateLimitLogTest(TestCase):
    """Test RateLimitLog model."""

    def setUp(self):
        self.company = Company.objects.create(name="Test Company")
        self.user = User.objects.create_user(
            username="testuser", password="testpass123",
            company=self.company, role="admin",
        )

    def test_create_log(self):
        """Test creating a rate limit log entry."""
        log = RateLimitLog.objects.create(
            company=self.company,
            user=self.user,
            method="GET",
            path="/api/v1/finance/invoices/",
            status_code=200,
            response_time_ms=150,
            module="finance",
            ip_address="127.0.0.1",
        )
        self.assertEqual(log.method, "GET")
        self.assertEqual(log.status_code, 200)
        self.assertFalse(log.was_throttled)

    def test_throttled_log(self):
        """Test creating a throttled request log."""
        log = RateLimitLog.objects.create(
            company=self.company,
            method="POST",
            path="/api/v1/llm/chat/",
            status_code=429,
            was_throttled=True,
            rate_limit_limit=20,
            rate_limit_remaining=0,
            module="llm",
        )
        self.assertTrue(log.was_throttled)
        self.assertEqual(log.rate_limit_remaining, 0)

    def test_log_index_performance(self):
        """Test that log queries with filters are efficient."""
        # Create multiple logs
        for i in range(50):
            RateLimitLog.objects.create(
                company=self.company,
                user=self.user if i % 2 == 0 else None,
                method="GET",
                path=f"/api/v1/test/{i}/",
                status_code=200 if i % 3 != 0 else 429,
                was_throttled=i % 3 == 0,
                module="test",
            )

        # Query with filters
        throttled = RateLimitLog.objects.filter(
            company=self.company,
            was_throttled=True,
        )
        self.assertEqual(throttled.count(), 17)  # ceil(50/3)
