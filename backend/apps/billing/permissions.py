"""Route-level permission enforcement (spec §9)."""

from __future__ import annotations

from functools import wraps

from rest_framework import status
from rest_framework.response import Response

PERMISSION_FLAGS = [
    "can_view",
    "can_pay",
    "can_issue",
    "can_manage_users",
    "can_manage_settings",
    "can_delete_history",
    "can_delete_payment",
    "can_export",
    "can_manage_companies",
    "can_submit",
    "can_approve",
    "can_edit_template",
]


def has_perm(user, flag: str) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    # The CEO owns the process and the admin runs the installation, so both
    # always pass the per-feature matrix (individual users stay flag-driven).
    if getattr(user, "role", "") in ("ceo", "admin"):
        return True
    return bool(getattr(user, flag, False))


def perm_required(flag: str):
    """Decorator for DRF function views: 401 when anonymous, 403 without flag."""

    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if not getattr(request.user, "is_authenticated", False):
                return Response(
                    {"error": "برای دسترسی باید وارد شوید."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            if not has_perm(request.user, flag):
                return Response(
                    {"error": "شما مجوز انجام این عملیات را ندارید."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return view(request, *args, **kwargs)

        return wrapper

    return decorator


def permissions_payload(user) -> dict:
    """Shape used by GET /auth/me (spec §6.1)."""
    return {
        "view": has_perm(user, "can_view"),
        "pay": has_perm(user, "can_pay"),
        "issue": has_perm(user, "can_issue"),
        "manage_users": has_perm(user, "can_manage_users"),
        "manage_settings": has_perm(user, "can_manage_settings"),
        "delete_history": has_perm(user, "can_delete_history"),
        "delete_payment": has_perm(user, "can_delete_payment"),
        "export": has_perm(user, "can_export"),
        "manage_companies": has_perm(user, "can_manage_companies"),
        "submit": has_perm(user, "can_submit"),
        "approve": has_perm(user, "can_approve"),
        "edit_template": has_perm(user, "can_edit_template"),
    }
