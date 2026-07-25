"""
Rate Limiting Throttle Classes and Middleware.

Phase 22: Provides DRF throttle classes and middleware for API rate limiting.
Supports per-user, per-API-key, per-module, and per-endpoint throttling.
"""

import time
import logging
from django.core.cache import cache
from django.utils.deprecation import MiddlewareMixin
from rest_framework.throttling import BaseThrottle, UserRateThrottle

from .models import APIKey, RateLimitLog

logger = logging.getLogger(__name__)


# ─── DRF Throttle Classes ────────────────────────────────────────


class APIKeyRateThrottle(BaseThrottle):
    """
    Rate limit based on API key.
    Checks custom rate limits from APIKey.rate_limit_override or defaults.
    """

    def allow_request(self, request, view):
        api_key = getattr(request, "api_key", None)
        if not api_key:
            return True  # No API key = use user-based throttling

        # Get rate limits from API key override or default policy
        overrides = api_key.rate_limit_override or {}
        rate_per_minute = overrides.get("requests_per_minute", 60)
        rate_per_hour = overrides.get("requests_per_hour", 1000)

        cache_key_minute = f"rl_apikey_minute:{api_key.id}"
        cache_key_hour = f"rl_apikey_hour:{api_key.id}"

        # Atomic increment using cache.add + cache.incr pattern
        # For minute counter
        new_minute = cache.add(cache_key_minute, 1, timeout=60)
        if not new_minute:
            minute_count = cache.incr(cache_key_minute)
        else:
            minute_count = 1

        if minute_count > rate_per_minute:
            self.wait_time = 60
            return False

        # For hour counter
        new_hour = cache.add(cache_key_hour, 1, timeout=3600)
        if not new_hour:
            hour_count = cache.incr(cache_key_hour)
        else:
            hour_count = 1

        if hour_count > rate_per_hour:
            self.wait_time = 3600
            return False

        return True

    def wait(self):
        return getattr(self, 'wait_time', 60)


class ModuleRateThrottle(BaseThrottle):
    """
    Rate limit per module endpoint.
    Uses the module slug from the URL path.
    """

    def allow_request(self, request, view):
        module = getattr(view, "required_module", None)
        if not module:
            return True

        cache_key = f"rl_module:{module}:{self.get_ident(request)}"
        rate_per_minute = 100  # Default 100/min per module per client

        # Atomic increment using cache.add + cache.incr pattern
        new = cache.add(cache_key, 1, timeout=60)
        if not new:
            count = cache.incr(cache_key)
        else:
            count = 1

        if count > rate_per_minute:
            self.wait_time = 60
            return False

        return True

    def wait(self):
        return getattr(self, 'wait_time', 60)


class ChatRateThrottle(UserRateThrottle):
    """Rate limit LLM chat requests: 20/minute per user."""
    rate = "20/minute"
    scope = "llm_chat"


class NLQueryRateThrottle(UserRateThrottle):
    """Rate limit NL query requests: 30/minute per user."""
    rate = "30/minute"
    scope = "nl_query"


class AlertRateThrottle(UserRateThrottle):
    """Rate limit alert API requests: 60/minute per user."""
    rate = "60/minute"
    scope = "alert"


# ─── Request Logging Middleware ───────────────────────────────────


class RateLimitLoggingMiddleware(MiddlewareMixin):
    """
    Middleware that logs every API request for rate limit tracking
    and analytics. Lightweight - only logs /api/ endpoints.
    """

    def process_request(self, request):
        request._start_time = time.time()

    def process_response(self, request, response):
        # Only log API endpoints
        if not request.path.startswith("/api/"):
            return response

        try:
            elapsed_ms = int((time.time() - getattr(request, "_start_time", time.time())) * 1000)

            # Determine module from URL path
            parts = request.path.strip("/").split("/")
            module = parts[2] if len(parts) > 2 else ""

            api_key = getattr(request, "api_key", None)
            user = getattr(request, "user", None)
            if hasattr(user, "is_authenticated") and not user.is_authenticated:
                user = None

            # Get throttle info from response headers
            rate_limit_limit = None
            rate_limit_remaining = None
            was_throttled = response.status_code == 429

            if "X-RateLimit-Limit" in response:
                try:
                    rate_limit_limit = int(response["X-RateLimit-Limit"])
                except (ValueError, TypeError):
                    pass
            if "X-RateLimit-Remaining" in response:
                try:
                    rate_limit_remaining = int(response["X-RateLimit-Remaining"])
                except (ValueError, TypeError):
                    pass

            company = None
            if api_key:
                company = api_key.company
            elif user and hasattr(user, "company"):
                company = user.company

            if company:
                from django.db import transaction
                log_data = dict(
                    company_id=company.id,
                    api_key=api_key,
                    user=user,
                    method=request.method,
                    path=request.path[:500],
                    status_code=response.status_code,
                    response_time_ms=elapsed_ms,
                    rate_limit_remaining=rate_limit_remaining,
                    rate_limit_limit=rate_limit_limit,
                    was_throttled=was_throttled,
                    ip_address=self._get_client_ip(request),
                    user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
                    module=module,
                )
                # Defer log write to after response is sent
                transaction.on_commit(
                    lambda: RateLimitLog.objects.create(**log_data)
                )
        except Exception as e:
            # Never let logging break the request
            logger.debug("Rate limit logging failed: %s", e)

        return response

    def _get_client_ip(self, request):
        """Extract client IP, respecting X-Forwarded-For."""
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")


# ─── API Key Authentication Backend ──────────────────────────────


class APIKeyAuthentication:
    """
    DRF-compatible authentication class that authenticates requests
    via API key in the X-API-Key header.
    """

    keyword = "X-API-Key"

    def authenticate(self, request):
        raw_key = request.META.get(f"HTTP_{self.keyword.upper().replace('-', '_')}")

        if not raw_key:
            return None

        api_key = APIKey.verify_key(raw_key)
        if not api_key:
            return None

        # Record usage
        api_key.record_usage()

        # Store API key on request for throttle classes
        request.api_key = api_key

        # Return the key creator as the authenticated user
        # If creator was deleted, deny authentication rather than
        # returning an arbitrary staff user
        if api_key.created_by:
            return (api_key.created_by, api_key)

        # No valid user found - deny authentication
        from rest_framework.exceptions import AuthenticationFailed
        raise AuthenticationFailed(
            "API key has no associated user. "
            "Please regenerate this key or contact support."
        )

    def authenticate_header(self, request):
        return self.keyword
