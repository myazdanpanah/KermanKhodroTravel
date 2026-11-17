"""
Multi-tenant Tests — Tenant management, subscription, and feature flags.

Phase 18: Multi-tenant Architecture
"""

from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import Company, User
from .models import Tenant, TenantPlan, TenantSubscription, TenantFeature


class TenantPlanTest(TestCase):
    """Test TenantPlan model."""

    def setUp(self):
        self.company = Company.objects.create(name="Plan Company")

    def test_create_plan(self):
        """Test creating a subscription plan."""
        plan = TenantPlan.objects.create(
            company=self.company,
            name="Professional",
            plan_type="professional",
            price_monthly=99.99,
            max_users=50,
            max_storage_gb=100,
            enabled_modules=["finance", "sales", "crm"],
        )
        self.assertEqual(plan.name, "Professional")
        self.assertEqual(plan.max_users, 50)
        self.assertIn("finance", plan.enabled_modules)

    def test_free_plan(self):
        """Test free plan defaults."""
        plan = TenantPlan.objects.create(
            company=self.company,
            name="Free",
            plan_type="free",
            max_users=5,
            max_storage_gb=1,
        )
        self.assertEqual(plan.price_monthly, 0)


class TenantTest(TestCase):
    """Test Tenant model."""

    def setUp(self):
        self.company = Company.objects.create(name="Test Company")
        self.plan = TenantPlan.objects.create(
            company=self.company,
            name="Starter",
            plan_type="starter",
            max_users=10,
        )

    def test_create_tenant(self):
        """Test creating a tenant."""
        tenant = Tenant.objects.create(
            company=self.company,
            plan=self.plan,
            is_trial=True,
            trial_ends_at=timezone.now() + timedelta(days=14),
        )
        self.assertEqual(tenant.company, self.company)
        self.assertTrue(tenant.is_trial)
        self.assertTrue(tenant.is_active)

    def test_tenant_is_active_trial(self):
        """Test tenant is active during trial."""
        tenant = Tenant.objects.create(
            company=self.company,
            is_trial=True,
            trial_ends_at=timezone.now() + timedelta(days=7),
        )
        self.assertTrue(tenant.is_active)

    def test_tenant_is_inactive_expired_trial(self):
        """Test tenant is inactive when trial expires."""
        tenant = Tenant.objects.create(
            company=self.company,
            is_trial=True,
            trial_ends_at=timezone.now() - timedelta(days=1),
        )
        self.assertFalse(tenant.is_active)

    def test_tenant_is_inactive_suspended(self):
        """Test tenant is inactive when suspended."""
        tenant = Tenant.objects.create(
            company=self.company,
            is_suspended=True,
        )
        self.assertFalse(tenant.is_active)

    def test_can_add_user(self):
        """Test checking if tenant can add users."""
        tenant = Tenant.objects.create(
            company=self.company,
            plan=self.plan,
            current_users=5,
        )
        self.assertTrue(tenant.can_add_user)

    def test_cannot_add_user_at_limit(self):
        """Test cannot add users at plan limit."""
        tenant = Tenant.objects.create(
            company=self.company,
            plan=self.plan,
            current_users=10,
        )
        self.assertFalse(tenant.can_add_user)


class TenantSubscriptionTest(TestCase):
    """Test TenantSubscription model."""

    def setUp(self):
        self.company = Company.objects.create(name="Test Company")
        self.tenant = Tenant.objects.create(company=self.company)
        self.plan = TenantPlan.objects.create(
            company=self.company,
            name="Pro",
            plan_type="professional",
        )

    def test_create_subscription(self):
        """Test creating a subscription."""
        sub = TenantSubscription.objects.create(
            company=self.company,
            tenant=self.tenant,
            plan=self.plan,
            status="active",
            billing_cycle="monthly",
            starts_at=timezone.now(),
            ends_at=timezone.now() + timedelta(days=30),
        )
        self.assertEqual(sub.status, "active")
        self.assertTrue(sub.is_active)


class TenantFeatureTest(TestCase):
    """Test TenantFeature model."""

    def setUp(self):
        self.company = Company.objects.create(name="Test Company")
        self.tenant = Tenant.objects.create(company=self.company)

    def test_create_feature(self):
        """Test creating a feature flag."""
        feature = TenantFeature.objects.create(
            company=self.company,
            tenant=self.tenant,
            feature_key="advanced_reporting",
            feature_type="capability",
            is_enabled=True,
        )
        self.assertEqual(feature.feature_key, "advanced_reporting")
        self.assertTrue(feature.is_enabled)

    def test_toggle_feature(self):
        """Test toggling a feature flag."""
        feature = TenantFeature.objects.create(
            company=self.company,
            tenant=self.tenant,
            feature_key="sso",
            is_enabled=True,
        )
        feature.is_enabled = False
        feature.save(update_fields=["is_enabled"])
        feature.refresh_from_db()
        self.assertFalse(feature.is_enabled)
