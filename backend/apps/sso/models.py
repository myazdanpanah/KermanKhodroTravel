"""
SSO & Identity — Provider configurations, JIT provisioning, and audit trail.

Supports SAML 2.0 and OIDC/OAuth2 identity providers (Okta, Azure AD, Google, OneLogin, etc.)
"""
import secrets
from django.db import models
from django.conf import settings
from apps.core.models import BaseModel


class SSOProvider(BaseModel):
    """Identity provider configuration."""

    PROTOCOL_CHOICES = [
        ("saml", "SAML 2.0"),
        ("oidc", "OpenID Connect"),
    ]

    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("pending", "Pending Setup"),
    ]

    # Basic info
    name = models.CharField(max_length=200, help_text="Display name, e.g. 'Okta Production'")
    slug = models.SlugField(max_length=100, unique=True, help_text="URL-safe identifier")
    protocol = models.CharField(max_length=10, choices=PROTOCOL_CHOICES, default="oidc")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    description = models.TextField(blank=True, default="")

    # SAML 2.0 fields
    saml_entity_id = models.CharField(max_length=500, blank=True, default="", help_text="IdP Entity ID")
    saml_sso_url = models.URLField(max_length=500, blank=True, default="", help_text="IdP SSO Login URL")
    saml_slo_url = models.URLField(max_length=500, blank=True, default="", help_text="IdP Single Logout URL")
    saml_certificate = models.TextField(blank=True, default="", help_text="IdP X.509 signing certificate (PEM)")
    saml_metadata_url = models.URLField(max_length=500, blank=True, default="", help_text="IdP Metadata XML URL")
    saml_name_id_format = models.CharField(
        max_length=200, blank=True, default="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        help_text="Requested NameID format",
    )

    # OIDC/OAuth2 fields
    oidc_client_id = models.CharField(max_length=500, blank=True, default="")
    oidc_client_secret = models.CharField(max_length=500, blank=True, default="")
    oidc_discovery_url = models.URLField(max_length=500, blank=True, default="", help_text="OIDC .well-known/openid-configuration URL")
    oidc_authorization_url = models.URLField(max_length=500, blank=True, default="")
    oidc_token_url = models.URLField(max_length=500, blank=True, default="")
    oidc_userinfo_url = models.URLField(max_length=500, blank=True, default="")
    oidc_jwks_url = models.URLField(max_length=500, blank=True, default="")
    oidc_scopes = models.JSONField(default=list, blank=True, help_text='e.g. ["openid", "email", "profile"]')

    # User provisioning
    jit_provisioning = models.BooleanField(default=True, help_text="Auto-create users on first SSO login")
    default_role = models.CharField(max_length=50, blank=True, default="updater", help_text="Role assigned to JIT-provisioned users")
    default_modules = models.JSONField(default=list, blank=True, help_text="Modules enabled for JIT users")

    # Attribute mapping (JSON: idp_field -> local_field)
    attribute_mapping = models.JSONField(
        default=dict,
        blank=True,
        help_text='Mapping of IdP attributes to user fields. e.g. {"email": "email", "first_name": "first_name", "groups": "role"}',
    )

    # Domain allowlist (auto-assign company by email domain)
    allowed_domains = models.JSONField(
        default=list, blank=True,
        help_text='Email domains that can use this IdP. e.g. ["acme.com"]',
    )

    # Metadata
    logo_url = models.URLField(max_length=500, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sso_providers_created",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_protocol_display()})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = secrets.token_hex(8)
        super().save(*args, **kwargs)

    @property
    def is_configured(self):
        """Check if provider has minimum required configuration."""
        if self.protocol == "saml":
            return bool(self.saml_entity_id and self.saml_sso_url)
        return bool(self.oidc_client_id and self.oidc_discovery_url)


class SSOUserMapping(BaseModel):
    """Maps external IdP user to local user for JIT provisioning audit."""

    provider = models.ForeignKey(SSOProvider, on_delete=models.CASCADE, related_name="user_mappings")
    external_id = models.CharField(max_length=500, help_text="Subject/ID from the IdP")
    external_email = models.EmailField(blank=True, default="")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sso_mappings",
    )
    last_login_at = models.DateTimeField(null=True, blank=True)
    raw_claims = models.JSONField(default=dict, blank=True, help_text="Raw SAML assertion or OIDC claims")

    class Meta:
        unique_together = [("provider", "external_id")]

    def __str__(self):
        return f"{self.external_id} -> {self.user.username} ({self.provider.name})"


class SSOLoginAttempt(BaseModel):
    """Audit trail for all SSO login attempts."""

    STATUS_CHOICES = [
        ("success", "Success"),
        ("failed", "Failed"),
        ("error", "Error"),
    ]

    provider = models.ForeignKey(SSOProvider, on_delete=models.SET_NULL, null=True, related_name="login_attempts")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    external_email = models.EmailField(blank=True, default="")
    external_id = models.CharField(max_length=500, blank=True, default="")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sso_login_attempts",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional context (relay state, etc.)")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.status}: {self.external_email or 'unknown'} via {self.provider or 'unknown'}"


class SSORefreshToken(BaseModel):
    """Tracks refresh tokens for SSO sessions with rotation support."""

    provider = models.ForeignKey(SSOProvider, on_delete=models.CASCADE, related_name="refresh_tokens")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sso_refresh_tokens")
    token_hash = models.CharField(max_length=256, help_text="SHA-256 hash of the refresh token")
    external_refresh_token = models.TextField(blank=True, default="")
    expires_at = models.DateTimeField()
    revoked = models.BooleanField(default=False)
    replaced_by = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"RefreshToken({self.user.username}, {self.provider.name})"
