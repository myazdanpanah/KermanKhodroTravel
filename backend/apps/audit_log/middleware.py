"""
Audit Logging Middleware — Stores request context in thread-local for signal handlers.

The signal handlers in signals.py need access to the current user, IP,
and user agent. This middleware stores them in thread-local storage so
signal handlers can retrieve them without direct request access.
"""
import threading
from django.utils.deprecation import MiddlewareMixin

_thread_locals = threading.local()


def get_current_user():
    """Get the current user from thread-local storage."""
    return getattr(_thread_locals, "user", None)


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
        _thread_locals.user = getattr(request, "user", None)
        _thread_locals.ip = self._get_client_ip(request)
        _thread_locals.user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]
        _thread_locals.path = request.path
        _thread_locals.method = request.method

    def process_response(self, request, response):
        # Clean up thread-local after response
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
