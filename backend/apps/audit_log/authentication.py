"""
Authentication that makes the authenticated actor visible to audit signals.

DRF authenticates inside the view, long after AuditLogMiddleware has stored
its request context. Without this wrapper the thread-local still points at
AnonymousUser when post_save/pre_delete signals fire, so audit rows were
recorded with no user.
"""
from apps.accounts.authentication import JWTAuthentication

from .middleware import set_current_user


class AuditedJWTAuthentication(JWTAuthentication):
    """JWT authentication that publishes the actor to the audit trail."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _token = result
            set_current_user(user)
            # Keep the plain Django request in sync for code that reads it.
            request._request.user = user
        return result
