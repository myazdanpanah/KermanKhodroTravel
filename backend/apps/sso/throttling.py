"""
SSO Rate Limiting — Throttle classes for authentication endpoints.

Provides aggressive rate limits for sso_initiate and sso_callback
to prevent brute-force and credential-stuffing attacks.
"""
from django.core.cache import cache
from rest_framework.throttling import BaseThrottle


class SSOInitiateThrottle(BaseThrottle):
    """Rate limit for SSO initiation: 10/min per IP."""
    
    def allow_request(self, request, view):
        ip = self.get_ident(request)
        cache_key = f"sso_initiate_rl:{ip}"
        
        new = cache.add(cache_key, 1, timeout=60)
        if not new:
            count = cache.incr(cache_key)
        else:
            count = 1

        if count > 10:
            self.wait_time = 60
            return False

        return True


class SSOCallbackThrottle(SSORateThrottle):
    """Rate limit for SSO callbacks: 20/min per IP."""
    
    def allow_request(self, request, view):
        ip = self.get_ident(request)
        cache_key = f"sso_callback_rl:{ip}"
        
        new = cache.add(cache_key, 1, timeout=60)
        if not new:
            count = cache.incr(cache_key)
        else:
            count = 1

        if count > 20:
            self.wait_time = 60
            return False

        return True
