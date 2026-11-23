"""Custom DRF permissions for db_manager — admin vs updater."""

from django.db import models
from rest_framework.permissions import BasePermission


class IsMainAdmin(BasePermission):
    """Allow access exclusively to the main system administrator."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role == "admin" or user.is_superuser


class IsAdminOrCEO(BasePermission):
    """Allow access exclusively to the main system administrator."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role == "admin" or user.is_superuser


class IsUpdaterOrAbove(BasePermission):
    """Allow access to system admin/staff, plus updater-role users with table permissions."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == "admin" or user.is_superuser or user.is_staff:
            return True
        return user.role == "updater"


class CanEditTable(BasePermission):
    """Check that the user is the main administrator for table editing."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role == "admin" or user.is_superuser
