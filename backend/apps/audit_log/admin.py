"""
Audit Log Admin — View audit trail in Django admin.
"""
from django.contrib import admin
from .models import AuditLog, AuditLogConfig


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["action", "content_type", "object_id", "user", "ip_address", "timestamp"]
    list_filter = ["action", "content_type", "timestamp"]
    search_fields = ["description", "object_id", "user__username"]
    readonly_fields = [
        "action", "timestamp", "user", "ip_address", "user_agent",
        "content_type", "object_id", "description",
        "old_values", "new_values", "changed_fields",
        "module", "company", "metadata",
    ]
    date_hierarchy = "timestamp"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AuditLogConfig)
class AuditLogConfigAdmin(admin.ModelAdmin):
    list_display = ["content_type", "is_enabled", "capture_snapshots", "created_at"]
    list_filter = ["is_enabled"]
