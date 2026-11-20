"""
Audit Logging Middleware — Stores request context in thread-local for signal handlers.

The signal handlers in signals.py need access to the current user, IP,
and user agent. This middleware stores them in thread-local storage so
signal handlers can retrieve them without direct request access.
"""
import threading
from django.utils.deprecation import MiddlewareMixin

_thread_locals = threading.local()


def _authenticated(user):
    """Return the user only when it is a real, signed-in account."""
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return user


def set_current_user(user):
    """Record the actor once authentication has actually run."""
    _thread_locals.user = _authenticated(user)


def get_current_user():
    """
    Resolve the current actor as late as possible.

    The middleware runs before DRF authenticates a JWT, so the Django request
    still carries AnonymousUser at that point. The authentication class calls
    set_current_user() after a successful login, and session authentication
    has already populated request.user; reading both here keeps audit rows
    attributed to whoever really performed the change.
    """
    user = _authenticated(getattr(_thread_locals, "user", None))
    if user is not None:
        return user
    request = getattr(_thread_locals, "request", None)
    return _authenticated(getattr(request, "user", None)) if request is not None else None


def get_current_ip():
    """Get the current client IP from thread-local storage."""
    return getattr(_thread_locals, "ip", None)


def get_current_ua():
    """Get the current user agent from thread-local storage."""
    return getattr(_thread_locals, "user_agent", "")


class AuditLogMiddleware(MiddlewareMixin):
    """
    Middleware that stores request context in thread-local storage
    for use by audit log signal handlers.
    """

    def process_request(self, request):
        # Do not snapshot request.user here: with token auth it is still the
        # AnonymousUser until the view's authentication classes run.
        _thread_locals.request = request
        _thread_locals.user = None
        _thread_locals.ip = self._get_client_ip(request)
        _thread_locals.user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]
        _thread_locals.path = request.path
        _thread_locals.method = request.method

    def process_response(self, request, response):
        # Clean up thread-local after response
        _thread_locals.request = None
        _thread_locals.user = None
        _thread_locals.ip = None
        _thread_locals.user_agent = ""
        _thread_locals.path = ""
        _thread_locals.method = ""
        return response

    def _get_client_ip(self, request):
        """Extract client IP, respecting X-Forwarded-For."""
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")


# Re-export the audit model registry helpers here for backwards compatibility.
# They live in signals.py, but callers (and the tests) import them from
# middleware, which is the documented public entry point.
from .signals import (  # noqa: E402,F401
    register_model,
    unregister_model,
    get_audited_models,
)
