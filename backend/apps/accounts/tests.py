"""
Tests for login, register, and JWT authentication endpoints.
"""

import os
import tempfile

import jwt
from datetime import datetime, timedelta, timezone

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class LoginViewTests(TestCase):
    """Tests for the login endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("login")
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
            email="test@example.com",
            role="finance",
            department="Finance",
        )

    def test_login_success(self):
        """Valid credentials return a JWT token and user data."""
        response = self.client.post(
            self.url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["username"], "testuser")
        self.assertEqual(response.data["user"]["role"], "finance")

    def test_login_wrong_password(self):
        """Wrong password returns 401."""
        response = self.client.post(
            self.url,
            {"username": "testuser", "password": "wrongpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    def test_login_nonexistent_user(self):
        """Non-existent username returns 401."""
        response = self.client.post(
            self.url,
            {"username": "nobody", "password": "testpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_missing_fields(self):
        """Missing username or password returns 400."""
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_missing_password(self):
        """Missing password returns 400."""
        response = self.client.post(
            self.url, {"username": "testuser"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_inactive_user(self):
        """Inactive user cannot log in."""
        self.user.is_active = False
        self.user.save()
        response = self.client.post(
            self.url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_returns_valid_jwt(self):
        """The returned JWT can be decoded and contains correct claims."""
        response = self.client.post(
            self.url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )
        token = response.data["token"]
        from django.conf import settings

        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        self.assertEqual(payload["user_id"], self.user.id)
        self.assertEqual(payload["username"], "testuser")
        self.assertEqual(payload["role"], "finance")
        self.assertIn("exp", payload)
        self.assertIn("iat", payload)


class RegisterViewTests(TestCase):
    """Tests for the register endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("register")

    def test_register_success(self):
        """Valid registration returns token and user data."""
        response = self.client.post(
            self.url,
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "securepass123",
                "role": "sales",
                "department": "Sales",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["username"], "newuser")
        self.assertTrue(User.objects.filter(username="newuser").exists())

    def test_register_duplicate_username(self):
        """Duplicate username returns 400."""
        User.objects.create_user(
            username="existing", password="pass12345", role="sales"
        )
        response = self.client.post(
            self.url,
            {
                "username": "existing",
                "email": "new@example.com",
                "password": "securepass123",
                "role": "sales",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_short_password(self):
        """Password shorter than 8 chars returns 400."""
        response = self.client.post(
            self.url,
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "short",
                "role": "sales",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_fields(self):
        """Missing required fields returns 400."""
        response = self.client.post(
            self.url, {"username": "newuser"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class JWTAuthenticationTests(TestCase):
    """Tests for the JWT authentication middleware."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
            email="test@example.com",
            role="ceo",
        )
        self.profile_url = reverse("profile")

    def _get_token(self):
        """Helper to get a valid JWT token."""
        from apps.accounts.authentication import JWTAuthentication

        return JWTAuthentication.generate_token(self.user)

    def test_authenticated_request(self):
        """Valid token allows access to protected endpoints."""
        token = self._get_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")

    def test_no_token_returns_401_or_403(self):
        """Missing token returns 401 or 403 (DRF default)."""
        response = self.client.get(self.profile_url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_invalid_token_returns_401_or_403(self):
        """Invalid token returns 401 or 403."""
        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid.token.here")
        response = self.client.get(self.profile_url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_expired_token_returns_401_or_403(self):
        """Expired token returns 401 or 403."""
        from django.conf import settings

        payload = {
            "user_id": self.user.id,
            "username": self.user.username,
            "role": self.user.role,
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        }
        expired_token = jwt.encode(
            payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {expired_token}")
        response = self.client.get(self.profile_url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_disabled_user_token_rejected(self):
        """Token for a disabled user is rejected."""
        self.user.is_active = False
        self.user.save()
        token = self._get_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(self.profile_url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_malformed_auth_header(self):
        """Malformed Authorization header is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION="Token somevalue")
        response = self.client.get(self.profile_url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


class CompanyBrandingScopeTests(TestCase):
    """Branding must be scoped to the caller's own company (no cross-tenant fallback)."""

    def setUp(self):
        from apps.accounts.models import Company

        self.client = APIClient()
        self.company = Company.objects.create(name="Tenant A", primary_color="#111111")
        self.other = Company.objects.create(name="Tenant B", primary_color="#222222")
        self.url = reverse("company-branding")
        self.admin = User.objects.create_user(
            username="brand_admin", password="pass12345", role="admin",
            is_staff=True, company=self.company,
        )

    def test_get_returns_own_company_branding(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.company.id)

    def test_put_updates_own_company(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            self.url, {"primary_color": "#7C3AED"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.company.refresh_from_db()
        self.assertEqual(self.company.primary_color, "#7C3AED")

    def test_put_without_company_is_forbidden(self):
        """A company-less admin must not be able to write any tenant's branding."""
        orphan = User.objects.create_user(
            username="brand_orphan", password="pass12345", role="admin", is_staff=True,
        )
        self.client.force_authenticate(user=orphan)
        response = self.client.put(
            self.url, {"primary_color": "#FF0000"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        for company in (self.company, self.other):
            company.refresh_from_db()
        self.assertEqual(self.company.primary_color, "#111111")
        self.assertEqual(self.other.primary_color, "#222222")

    def test_get_without_company_is_bad_request(self):
        orphan = User.objects.create_user(
            username="brand_orphan2", password="pass12345", role="admin", is_staff=True,
        )
        self.client.force_authenticate(user=orphan)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_of_company_cannot_write(self):
        viewer = User.objects.create_user(
            username="brand_sales", password="pass12345", role="sales",
            company=self.company,
        )
        self.client.force_authenticate(user=viewer)
        response = self.client.put(
            self.url, {"primary_color": "#00FF00"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.company.refresh_from_db()
        self.assertEqual(self.company.primary_color, "#111111")

    def test_invalid_hex_is_rejected(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            self.url, {"primary_color": "not-a-color"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_public_read_still_falls_back_to_first_active_company(self):
        """The public endpoint (login screen) keeps the fallback by design."""
        self.client.force_authenticate(user=None)
        response = self.client.get(reverse("branding-public"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.company.id)


# 1x1 transparent PNG — smallest valid image for ImageField upload tests
PNG_1PX = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


class CompanyBrandingAccessTests(TestCase):
    """CEO and Admin may change branding; other roles may only read it."""

    def setUp(self):
        from apps.accounts.models import Company

        self.client = APIClient()
        self.company = Company.objects.create(name="Tenant Brand")
        self.url = reverse("company-branding")
        self.admin = User.objects.create_user(
            username="brand_admin_access", password="pass12345", role="admin",
            is_staff=True, company=self.company,
        )
        self.ceo = User.objects.create_user(
            username="brand_ceo", password="pass12345", role="ceo", company=self.company,
        )
        self.sales = User.objects.create_user(
            username="brand_sales_access", password="pass12345", role="sales",
            company=self.company,
        )

    def test_ceo_can_update_branding(self):
        self.client.force_authenticate(user=self.ceo)
        response = self.client.put(
            self.url, {"primary_color": "#0EA5E9", "accent_color": "#14B8A6"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.company.refresh_from_db()
        self.assertEqual(self.company.primary_color, "#0EA5E9")
        self.assertEqual(self.company.accent_color, "#14B8A6")

    def test_admin_can_update_branding(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(self.url, {"primary_color": "#101D35"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.company.refresh_from_db()
        self.assertEqual(self.company.primary_color, "#101D35")

    def test_sales_is_rejected_with_403(self):
        self.client.force_authenticate(user=self.sales)
        response = self.client.put(self.url, {"primary_color": "#FF0000"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("error", response.data)
        self.company.refresh_from_db()
        self.assertNotEqual(self.company.primary_color, "#FF0000")

    def test_sales_can_still_read_branding(self):
        self.client.force_authenticate(user=self.sales)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.company.id)

    def test_invalid_hex_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        for bad in ("red", "#12345", "#GGGGGG", "3678F6"):
            response = self.client.put(self.url, {"primary_color": bad}, format="json")
            self.assertEqual(
                response.status_code, status.HTTP_400_BAD_REQUEST,
                msg=f"{bad!r} should be rejected",
            )


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="nexivo-brand-test-"))
class CompanyBrandingLogoTests(TestCase):
    """Logo upload and clear_logo behaviour."""

    def setUp(self):
        from apps.accounts.models import Company

        self.client = APIClient()
        self.company = Company.objects.create(name="Tenant Logo")
        self.url = reverse("company-branding")
        self.admin = User.objects.create_user(
            username="brand_admin_logo", password="pass12345", role="admin",
            is_staff=True, company=self.company,
        )
        self.client.force_authenticate(user=self.admin)

    def _upload(self, name="logo.png"):
        return self.client.put(
            self.url,
            {"logo": SimpleUploadedFile(name, PNG_1PX, content_type="image/png")},
            format="multipart",
        )

    def test_logo_upload_stores_file_and_returns_url(self):
        response = self._upload()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data["logo_url"])
        self.assertTrue(response.data["logo_url"].startswith("/media/companies/"))

        self.company.refresh_from_db()
        self.assertTrue(self.company.logo)
        self.assertTrue(os.path.exists(self.company.logo.path))

    def test_clear_logo_removes_file(self):
        self._upload("to-clear.png")
        self.company.refresh_from_db()
        stored_path = self.company.logo.path
        self.assertTrue(os.path.exists(stored_path))

        response = self.client.put(self.url, {"clear_logo": "true"}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["logo_url"])

        self.company.refresh_from_db()
        self.assertFalse(self.company.logo)
        self.assertFalse(os.path.exists(stored_path))

    def test_clear_logo_is_harmless_when_no_logo(self):
        response = self.client.put(self.url, {"clear_logo": "true"}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["logo_url"])

    def test_logo_upload_requires_admin_or_ceo(self):
        sales = User.objects.create_user(
            username="brand_sales_logo", password="pass12345", role="sales",
            company=self.company,
        )
        self.client.force_authenticate(user=sales)
        response = self._upload()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.company.refresh_from_db()
        self.assertFalse(self.company.logo)


class BrandingPublicDefaultsTests(TestCase):
    """The public endpoint returns NEXIVO defaults when no company exists."""

    def setUp(self):
        from apps.accounts.models import Company

        Company.objects.all().delete()  # no tenant configured yet
        self.client = APIClient()
        self.url = reverse("branding-public")

    def test_public_endpoint_returns_defaults_without_company(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["id"])
        self.assertIsNone(response.data["logo_url"])
        self.assertEqual(response.data["primary_color"], "#3678F6")
        self.assertEqual(response.data["accent_color"], "#24C6B2")

    def test_public_endpoint_is_anonymous(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_company_endpoint_rejects_anonymous(self):
        response = self.client.get(reverse("company-branding"))
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )


class UserManagementTests(TestCase):
    """Admins create and edit users (including password resets) from Settings."""

    def setUp(self):
        from apps.accounts.models import Company

        self.client = APIClient()
        self.company = Company.objects.create(name="Tenant Users")
        self.list_url = reverse("users-list-create")
        self.admin = User.objects.create_user(
            username="um_admin", password="pass12345", role="admin",
            is_staff=True, company=self.company,
        )
        self.sales = User.objects.create_user(
            username="um_sales", password="pass12345", role="sales",
            company=self.company,
        )

    def test_admin_creates_user_with_role_and_company(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            self.list_url,
            {
                "username": "um_created", "password": "created12345",
                "email": "created@example.com", "first_name": "New", "last_name": "Hire",
                "role": "finance", "department": "Finance", "company": self.company.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(username="um_created")
        self.assertEqual(created.role, "finance")
        self.assertEqual(created.company_id, self.company.id)
        self.assertTrue(created.check_password("created12345"))

    def test_admin_updates_role_company_and_department(self):
        target = User.objects.create_user(
            username="um_target", password="pass12345", role="sales", company=self.company,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            reverse("user-detail", args=[target.id]),
            {"role": "finance", "department": "Finance", "company": None},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertEqual(target.role, "finance")
        self.assertEqual(target.department, "Finance")
        self.assertIsNone(target.company_id)

    def test_admin_resets_password_via_put(self):
        target = User.objects.create_user(
            username="um_pw", password="oldpass12345", role="sales", company=self.company,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            reverse("user-detail", args=[target.id]),
            {"password": "brandnew12345"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertTrue(target.check_password("brandnew12345"))
        self.assertFalse(target.check_password("oldpass12345"))

    def test_short_password_reset_is_rejected(self):
        target = User.objects.create_user(
            username="um_pw_short", password="oldpass12345", role="sales",
            company=self.company,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            reverse("user-detail", args=[target.id]),
            {"password": "short"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        target.refresh_from_db()
        self.assertTrue(target.check_password("oldpass12345"))

    def test_sales_cannot_create_or_edit_users(self):
        target = User.objects.create_user(
            username="um_member", password="pass12345", role="finance",
            company=self.company,
        )
        self.client.force_authenticate(user=self.sales)
        create = self.client.post(
            self.list_url, {"username": "um_nope", "password": "nope12345"}, format="json"
        )
        edit = self.client.put(
            reverse("user-detail", args=[target.id]), {"role": "admin"}, format="json"
        )
        self.assertEqual(create.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(edit.status_code, status.HTTP_403_FORBIDDEN)
        target.refresh_from_db()
        self.assertEqual(target.role, "finance")
        self.assertFalse(User.objects.filter(username="um_nope").exists())

    def test_admin_cannot_delete_self(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(reverse("user-detail", args=[self.admin.id]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())
