"""
SSO & Identity Views — Provider management, auth flow, JIT provisioning, and audit.
"""
import hashlib
import json
import secrets
import logging
from datetime import timedelta

from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response

from .models import SSOProvider, SSOUserMapping, SSOLoginAttempt, SSORefreshToken
from .serializers import (
    SSOProviderSerializer, SSOProviderPublicSerializer,
    SSOUserMappingSerializer, SSOLoginAttemptSerializer,
    SSOInitiateRequest, SSOCallbackRequest,
)

User = get_user_model()
logger = logging.getLogger("sso")


def _get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


# ── Provider CRUD ──

class SSOProviderViewSet(viewsets.ModelViewSet):
    """CRUD for SSO identity provider configurations."""
    serializer_class = SSOProviderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        company = getattr(self.request.user, "company", None)
        if not company:
            return SSOProvider.objects.none()
        return SSOProvider.objects.filter(company=company)

    def get_serializer_class(self):
        if self.action == "list_public":
            return SSOProviderPublicSerializer
        return SSOProviderSerializer

    def perform_create(self, serializer):
        company = getattr(self.request.user, "company", None)
        serializer.save(company=company, created_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="public")
    def list_public(self, request):
        """List active providers for the login page (no auth required)."""
        company_slug = request.query_params.get("company")
        qs = SSOProvider.objects.filter(status="active")
        if company_slug:
            qs = qs.filter(company__slug=company_slug)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def test_connection(self, request, pk=None):
        """Test SSO provider connectivity (metadata fetch, OIDC discovery, etc.)."""
        provider = self.get_object()
        result = _test_provider_connection(provider)
        return Response(result)

    @action(detail=True, methods=["post"])
    def toggle_status(self, request, pk=None):
        """Toggle provider active/inactive."""
        provider = self.get_object()
        provider.status = "active" if provider.status != "active" else "inactive"
        provider.save(update_fields=["status", "updated_at"])
        return Response({"status": provider.status})

    @action(detail=True, methods=["get"])
    def login_attempts(self, request, pk=None):
        """List login attempts for a provider."""
        provider = self.get_object()
        attempts = SSOLoginAttempt.objects.filter(provider=provider)[:50]
        serializer = SSOLoginAttemptSerializer(attempts, many=True)
        return Response(serializer.data)


# ── SSO Auth Flow ──

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def sso_initiate(request):
    """
    Initiate SSO login. Returns a redirect URL to the IdP.
    Frontend should redirect the user's browser to this URL.
    """
    serializer = SSOInitiateRequest(data=request.data)
    serializer.is_valid(raise_exception=True)

    provider_slug = serializer.validated_data["provider_slug"]
    try:
        provider = SSOProvider.objects.get(slug=provider_slug, status="active")
    except SSOProvider.DoesNotExist:
        return Response({"error": "Provider not found or inactive"}, status=404)

    state = secrets.token_urlsafe(32)
    redirect_uri = serializer.validated_data.get(
        "redirect_uri",
        f"{request.build_absolute_uri('/').rstrip('/')}/api/v1/sso/callback/{provider.slug}/",
    )

    if provider.protocol == "oidc":
        redirect_url = _build_oidc_auth_url(provider, state, redirect_uri)
    elif provider.protocol == "saml":
        redirect_url = _build_saml_auth_request(provider, state, redirect_uri)
    else:
        return Response({"error": f"Unsupported protocol: {provider.protocol}"}, status=400)

    # Store state for validation (use Django cache for stateless deployments)
    from django.core.cache import cache
    state_data = {
        "provider_slug": provider.slug,
        "redirect_uri": redirect_uri,
        "created_at": timezone.now().isoformat(),
    }
    cache.set(f"sso_state_{state}", state_data, timeout=300)  # 5 minutes
    # Also store in session as fallback
    request.session[f"sso_state_{state}"] = state_data

    return Response({"redirect_url": redirect_url, "state": state})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def sso_callback(request, provider_slug):
    """
    Handle SSO callback from IdP. Validates assertion/code, provisions user, issues JWT.
    """
    try:
        provider = SSOProvider.objects.get(slug=provider_slug, status="active")
    except SSOProvider.DoesNotExist:
        return Response({"error": "Provider not found"}, status=404)

    ip = _get_client_ip(request)
    ua = request.META.get("HTTP_USER_AGENT", "")

    try:
        if provider.protocol == "oidc":
            result = _handle_oidc_callback(provider, request, ip, ua)
        elif provider.protocol == "saml":
            result = _handle_saml_callback(provider, request, ip, ua)
        else:
            return Response({"error": "Unsupported protocol"}, status=400)

        return Response(result, status=200)
    except Exception as e:
        logger.exception("SSO callback error for provider %s", provider_slug)
        SSOLoginAttempt.objects.create(
            company=provider.company,
            provider=provider,
            status="error",
            ip_address=ip,
            user_agent=ua,
            error_message=str(e),
        )
        return Response({"error": "Authentication failed", "detail": str(e)}, status=400)


# ── Audit endpoints ──

class SSOUserMappingViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view of SSO user mappings."""
    serializer_class = SSOUserMappingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        company = getattr(self.request.user, "company", None)
        if not company:
            return SSOUserMapping.objects.none()
        return SSOUserMapping.objects.filter(provider__company=company)


class SSOLoginAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit trail for SSO login attempts."""
    serializer_class = SSOLoginAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        company = getattr(self.request.user, "company", None)
        if not company:
            return SSOLoginAttempt.objects.none()
        qs = SSOLoginAttempt.objects.filter(provider__company=company)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs[:200]


# ── Internal helpers ──

def _build_oidc_auth_url(provider, state, redirect_uri):
    """Build OIDC authorization URL."""
    from urllib.parse import urlencode
    params = {
        "client_id": provider.oidc_client_id,
        "response_type": "code",
        "scope": " ".join(provider.oidc_scopes or ["openid", "email", "profile"]),
        "redirect_uri": redirect_uri,
        "state": state,
        "response_mode": "query",
    }
    base_url = provider.oidc_authorization_url or f"{provider.oidc_discovery_url.rstrip('/')}/authorize"
    return f"{base_url}?{urlencode(params)}"


def _build_saml_auth_request(provider, state, redirect_uri):
    """Build SAML AuthnRequest redirect URL."""
    # In production, use python3-saml to create a proper AuthnRequest
    # This is a simplified version for the scaffold
    import base64
    from urllib.parse import urlencode
    authn_request = f"""<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="_{secrets.token_hex(16)}" Version="2.0"
        IssueInstant="{timezone.now().strftime('%Y-%m-%dT%H:%M:%SZ')}"
        AssertionConsumerServiceURL="{redirect_uri}"
        Destination="{provider.saml_sso_url}">
        <saml:Issuer>{provider.saml_entity_id}</saml:Issuer>
        <samlp:NameIDPolicy Format="{provider.saml_name_id_format}" AllowCreate="true"/>
    </samlp:AuthnRequest>"""
    encoded = base64.b64encode(authn_request.encode()).decode()
    return f"{provider.saml_sso_url}?{urlencode({'SAMLRequest': encoded, 'RelayState': state})}"


def _handle_oidc_callback(provider, request, ip, ua):
    """Handle OIDC callback: exchange code for tokens via Authlib, fetch claims, provision user."""
    code = request.data.get("code") or request.query_params.get("code")
    state_val = request.data.get("state") or request.query_params.get("state")

    if not code:
        raise ValueError("Missing authorization code")

    # Validate state (use cache for stateless deployments)
    from django.core.cache import cache
    state_key = f"sso_state_{state_val}"
    stored_state = cache.get(state_key)
    if not stored_state:
        # Fallback to session (for Django session-backed deployments)
        stored_state = request.session.get(state_key)
    if not stored_state:
        raise ValueError("Invalid or expired state parameter")
    cache.delete(state_key)
    request.session.pop(state_key, None)

    redirect_uri = stored_state.get("redirect_uri", "")

    # Exchange authorization code for tokens using Authlib
    try:
        from authlib.integrations.requests_client import OAuth2Session
        from authlib.jose import jwt as authlib_jwt
        import requests as http_requests

        # Build OAuth2 session with provider config
        oauth = OAuth2Session(
            client_id=provider.oidc_client_id,
            client_secret=provider.oidc_client_secret,
            redirect_uri=redirect_uri,
            scope=" ".join(provider.oidc_scopes or ["openid", "email", "profile"]),
        )

        # Token exchange
        token_url = provider.oidc_token_url
        if not token_url:
            # Auto-discover from discovery URL
            disc_resp = http_requests.get(provider.oidc_discovery_url, timeout=10)
            disc_resp.raise_for_status()
            token_url = disc_resp.json()["token_endpoint"]
            provider.oidc_token_url = token_url
            provider.oidc_userinfo_url = disc_resp.json().get("userinfo_endpoint", "")
            provider.oidc_jwks_url = disc_resp.json().get("jwks_uri", "")
            provider.save(update_fields=["oidc_token_url", "oidc_userinfo_url", "oidc_jwks_url", "updated_at"])

        token_resp = oauth.fetch_token(token_url, code=code)
        access_token = token_resp.get("access_token")

        # Fetch user info from the IdP
        userinfo_url = provider.oidc_userinfo_url
        userinfo = {}
        if userinfo_url:
            userinfo_resp = oauth.get(userinfo_url)
            if userinfo_resp.status_code == 200:
                userinfo = userinfo_resp.json()

        # If no userinfo endpoint, decode the ID token
        if not userinfo and "id_token" in token_resp:
            try:
                # Fetch JWKS for verification
                jwks_url = provider.oidc_jwks_url
                if jwks_url:
                    jwks_resp = http_requests.get(jwks_url, timeout=10)
                    jwks_resp.raise_for_status()
                    jwks = jwks_resp.json()
                    claims = authlib_jwt.decode(
                        token_resp["id_token"], jwks
                    )
                    claims.validate()
                    userinfo = dict(claims)
                else:
                    raise ValueError("No JWKS endpoint configured — cannot verify ID token. Configure oidc_jwks_url in provider settings.")
            except Exception:
                logger.warning("Failed to decode ID token for provider %s", provider.slug)

        if not userinfo:
            raise ValueError("Could not fetch user info from IdP")

    except Exception as e:
        if "Could not fetch" in str(e) or "Missing" in str(e):
            raise
        raise ValueError(f"OIDC token exchange failed: {e}")

    # Map attributes from claims to local user fields
    mapping = provider.attribute_mapping or {}
    email = userinfo.get(mapping.get("email", "email"), "")
    first_name = userinfo.get(mapping.get("first_name", "given_name"), "")
    last_name = userinfo.get(mapping.get("last_name", "family_name"), "")

    if not email:
        raise ValueError("No email found in IdP claims")

    user, is_new = _provision_or_get_user(provider, email, first_name, last_name, userinfo, ip, ua)

    # Issue JWT
    from apps.accounts.authentication import JWTAuthentication
    token = JWTAuthentication.generate_token(user)

    return {
        "access": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": getattr(user, "email", ""),
            "first_name": getattr(user, "first_name", ""),
            "last_name": getattr(user, "last_name", ""),
        },
        "is_new_user": is_new,
    }


def _handle_saml_callback(provider, request, ip, ua):
    """Handle SAML callback: validate assertion via python3-saml, provision user, issue JWT."""
    saml_response = request.data.get("SAMLResponse") or request.query_params.get("SAMLResponse")
    relay_state = request.data.get("RelayState") or request.query_params.get("RelayState", "")

    if not saml_response:
        raise ValueError("Missing SAMLResponse")

    # Validate state
    from django.core.cache import cache
    state_key = f"sso_state_{relay_state}"
    stored_state = cache.get(state_key)
    if not stored_state:
        stored_state = request.session.get(state_key)
    if stored_state:
        cache.delete(state_key)
        request.session.pop(state_key, None)

    # Parse and validate SAML assertion using python3-saml
    try:
        from onelogin.saml2.auth import OneLogin_Saml2_Auth
        from onelogin.saml2.response import OneLogin_Saml2_Response
        import base64
        import json

        # Build the settings dict python3-saml expects
        saml_settings = {
            "strict": True,
            "sp": {
                "entityId": provider.saml_entity_id or f"{provider.saml_sso_url}/metadata",
                "assertionConsumerService": {
                    "url": stored_state.get("redirect_uri", "") if stored_state else "",
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
                },
            },
            "idp": {
                "entityId": provider.saml_entity_id,
                "singleSignOnService": {
                    "url": provider.saml_sso_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "singleLogoutService": {
                    "url": provider.saml_slo_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
            },
        }

        # Add certificate for signature verification
        if provider.saml_certificate:
            saml_settings["idp"]["x509cert"] = provider.saml_certificate

        # Parse the response
        saml_resp = OneLogin_Saml2_Response(saml_settings, saml_response)

        # Validate the response
        if not saml_resp.is_valid({
            "current_url": request.build_absolute_uri(),
            "http_host": request.get_host(),
        }):
            errors = saml_resp.get_error()
            raise ValueError(f"SAML assertion validation failed: {errors}")

        # Extract attributes from the validated assertion
        attrs = saml_resp.get_attributes()
        name_id = saml_resp.get_nameid()

        # Build claims from SAML attributes
        mapping = provider.attribute_mapping or {}
        email = attrs.get(mapping.get("email", "email"), name_id or "")
        first_name = attrs.get(mapping.get("first_name", "first_name"), "")
        last_name = attrs.get(mapping.get("last_name", "last_name"), "")

        # Include raw claims for audit
        userinfo = {
            "sub": name_id or email,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            **attrs,
        }

    except ImportError:
        raise ValueError("python3-saml is not installed. Install it with: pip install python3-saml")
    except Exception as e:
        if "is not installed" in str(e):
            raise
        raise ValueError(f"SAML assertion validation failed: {e}")

    if not email:
        raise ValueError("No email found in SAML assertion")

    user, is_new = _provision_or_get_user(provider, email, first_name, last_name, userinfo, ip, ua)

    # Issue JWT
    from apps.accounts.authentication import JWTAuthentication
    token = JWTAuthentication.generate_token(user)

    return {
        "access": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": getattr(user, "email", ""),
            "first_name": getattr(user, "first_name", ""),
            "last_name": getattr(user, "last_name", ""),
        },
        "is_new_user": is_new,
    }


def _provision_or_get_user(provider, email, first_name, last_name, claims, ip, ua):
    """Find existing user or JIT-provision a new one."""
    external_id = claims.get("sub", email)
    is_new = False

    # Check existing mapping
    mapping = SSOUserMapping.objects.filter(provider=provider, external_id=external_id).first()
    if mapping:
        mapping.last_login_at = timezone.now()
        mapping.raw_claims = claims
        mapping.save(update_fields=["last_login_at", "raw_claims", "updated_at"])
        SSOLoginAttempt.objects.create(
            company=provider.company, provider=provider, status="success",
            external_email=email, external_id=external_id, user=mapping.user,
            ip_address=ip, user_agent=ua,
        )
        return mapping.user, False

    # JIT provision
    if not provider.jit_provisioning:
        raise ValueError("User not found and JIT provisioning is disabled")

    # Check allowed domains
    if provider.allowed_domains:
        domain = email.split("@")[-1] if "@" in email else ""
        if domain not in provider.allowed_domains:
            raise ValueError(f"Domain '{domain}' is not allowed for this SSO provider")

    # Create user
    username = email.split("@")[0] if "@" in email else external_id[:30]
    base_username = username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    user = User.objects.create_user(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
    )
    is_new = True

    # Set company if available
    if provider.company:
        setattr(user, "company", provider.company)
        user.save(update_fields=["company"])

    # Create mapping
    SSOUserMapping.objects.create(
        company=provider.company, provider=provider,
        external_id=external_id, external_email=email,
        user=user, raw_claims=claims, last_login_at=timezone.now(),
    )

    SSOLoginAttempt.objects.create(
        company=provider.company, provider=provider, status="success",
        external_email=email, external_id=external_id, user=user,
        ip_address=ip, user_agent=ua, metadata={"jit_provisioned": True},
    )

    return user, True


def _test_provider_connection(provider):
    """Test SSO provider connectivity."""
    import requests
    result = {"success": False, "message": "", "metadata": {}}

    try:
        if provider.protocol == "oidc":
            if not provider.oidc_discovery_url:
                result["message"] = "No discovery URL configured"
                return result
            resp = requests.get(provider.oidc_discovery_url, timeout=10)
            if resp.status_code == 200:
                metadata = resp.json()
                result["success"] = True
                result["message"] = "OIDC discovery successful"
                result["metadata"] = {
                    "issuer": metadata.get("issuer"),
                    "authorization_endpoint": metadata.get("authorization_endpoint"),
                    "token_endpoint": metadata.get("token_endpoint"),
                    "jwks_uri": metadata.get("jwks_uri"),
                    "supported_scopes": metadata.get("scopes_supported", []),
                }
                # Auto-fill OIDC URLs from discovery
                provider.oidc_authorization_url = metadata.get("authorization_endpoint", "")
                provider.oidc_token_url = metadata.get("token_endpoint", "")
                provider.oidc_userinfo_url = metadata.get("userinfo_endpoint", "")
                provider.oidc_jwks_url = metadata.get("jwks_uri", "")
                provider.save(update_fields=[
                    "oidc_authorization_url", "oidc_token_url",
                    "oidc_userinfo_url", "oidc_jwks_url", "updated_at",
                ])
            else:
                result["message"] = f"Discovery returned HTTP {resp.status_code}"

        elif provider.protocol == "saml":
            if provider.saml_metadata_url:
                resp = requests.get(provider.saml_metadata_url, timeout=10)
                if resp.status_code == 200:
                    result["success"] = True
                    result["message"] = "SAML metadata fetched successfully"
                    result["metadata"] = {"content_length": len(resp.content)}
                else:
                    result["message"] = f"Metadata returned HTTP {resp.status_code}"
            elif provider.saml_sso_url:
                result["success"] = True
                result["message"] = "SSO URL is configured (metadata URL not set)"
            else:
                result["message"] = "No SSO URL or metadata URL configured"

    except requests.exceptions.Timeout:
        result["message"] = "Connection timed out"
    except requests.exceptions.ConnectionError:
        result["message"] = "Could not connect to IdP"
    except Exception as e:
        result["message"] = f"Error: {str(e)}"

    return result
