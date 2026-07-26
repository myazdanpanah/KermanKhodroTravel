"""
SSO Serializers — Provider CRUD, auth flow request/response, and audit models.
"""
from rest_framework import serializers
from .models import SSOProvider, SSOUserMapping, SSOLoginAttempt, SSORefreshToken


class SSOProviderSerializer(serializers.ModelSerializer):
    is_configured = serializers.ReadOnlyField()
    protocol_display = serializers.CharField(source="get_protocol_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True, default="")

    class Meta:
        model = SSOProvider
        fields = [
            "id", "name", "slug", "protocol", "status", "description",
            "protocol_display", "status_display", "is_configured",
            # SAML
            "saml_entity_id", "saml_sso_url", "saml_slo_url",
            "saml_certificate", "saml_metadata_url", "saml_name_id_format",
            # OIDC
            "oidc_client_id", "oidc_client_secret", "oidc_discovery_url",
            "oidc_authorization_url", "oidc_token_url", "oidc_userinfo_url",
            "oidc_jwks_url", "oidc_scopes",
            # Provisioning
            "jit_provisioning", "default_role", "default_modules",
            "attribute_mapping", "allowed_domains",
            # Meta
            "logo_url", "created_by", "created_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_at", "is_configured"]

    def validate(self, data):
        protocol = data.get("protocol", self.instance and self.instance.protocol)
        if protocol == "saml":
            if not data.get("saml_entity_id") and not (self.instance and self.instance.saml_entity_id):
                raise serializers.ValidationError({"saml_entity_id": "Required for SAML providers"})
            if not data.get("saml_sso_url") and not (self.instance and self.instance.saml_sso_url):
                raise serializers.ValidationError({"saml_sso_url": "Required for SAML providers"})
        elif protocol == "oidc":
            if not data.get("oidc_client_id") and not (self.instance and self.instance.oidc_client_id):
                raise serializers.ValidationError({"oidc_client_id": "Required for OIDC providers"})
            if not data.get("oidc_discovery_url") and not (self.instance and self.instance.oidc_discovery_url):
                raise serializers.ValidationError({"oidc_discovery_url": "Required for OIDC providers"})
        return data


class SSOProviderPublicSerializer(serializers.ModelSerializer):
    """Public-facing serializer (no secrets) for login page."""
    is_configured = serializers.ReadOnlyField()

    class Meta:
        model = SSOProvider
        fields = ["id", "name", "slug", "protocol", "logo_url", "is_configured"]


class SSOUserMappingSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source="provider.name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = SSOUserMapping
        fields = [
            "id", "provider", "provider_name", "external_id",
            "external_email", "user", "username",
            "last_login_at", "raw_claims", "created_at",
        ]
        read_only_fields = ["id", "created_at", "last_login_at"]


class SSOLoginAttemptSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source="provider.name", read_only=True, default="")
    username = serializers.CharField(source="user.username", read_only=True, default="")

    class Meta:
        model = SSOLoginAttempt
        fields = [
            "id", "provider", "provider_name", "status",
            "external_email", "external_id", "user", "username",
            "ip_address", "user_agent", "error_message",
            "metadata", "created_at",
        ]
        read_only_fields = fields


class SSORefreshTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = SSORefreshToken
        fields = ["id", "provider", "user", "expires_at", "revoked", "created_at"]
        read_only_fields = fields


# ── Auth flow serializers ──

class SSOInitiateRequest(serializers.Serializer):
    """Request to initiate SSO login."""
    provider_slug = serializers.SlugField()
    redirect_uri = serializers.URLField(required=False, help_text="Override callback URL")


class SSOInitiateResponse(serializers.Serializer):
    """Response with redirect URL to IdP."""
    redirect_url = serializers.URLField()
    state = serializers.CharField()


class SSOCallbackRequest(serializers.Serializer):
    """SAML/OIDC callback parameters."""
    code = serializers.CharField(required=False, help_text="OIDC authorization code")
    state = serializers.CharField(required=False, help_text="OIDC state parameter")
    SAMLResponse = serializers.CharField(required=False, help_text="SAML response (base64)")
    RelayState = serializers.CharField(required=False, help_text="SAML relay state")


class SSOCallbackResponse(serializers.Serializer):
    """Successful SSO authentication response."""
    access = serializers.CharField(help_text="JWT access token")
    refresh = serializers.CharField(help_text="JWT refresh token")
    user = serializers.DictField(help_text="User profile data")
    is_new_user = serializers.BooleanField(help_text="Whether JIT provisioned")


class SSOTestConnectionRequest(serializers.Serializer):
    """Test SSO provider connectivity."""
    provider_id = serializers.IntegerField()


class SSOTestConnectionResponse(serializers.Serializer):
    """Test connection result."""
    success = serializers.BooleanField()
    message = serializers.CharField()
    metadata = serializers.DictField(required=False)
