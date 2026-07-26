"""
Audit Log Serializers — DRF serializers for audit trail API.
"""
from rest_framework import serializers
from .models import AuditLog, AuditLogConfig


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit log entries."""
    user_display = serializers.SerializerMethodField()
    content_type_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "action", "timestamp",
            "user", "user_display", "ip_address", "user_agent",
            "content_type", "content_type_display", "object_id",
            "description", "old_values", "new_values", "changed_fields",
            "module", "company", "metadata",
        ]
        read_only_fields = fields

    def get_user_display(self, obj):
        if obj.user:
            return f"{obj.user.username} ({obj.user.get_full_name() or obj.user.username})"
        return "System"

    def get_content_type_display(self, obj):
        if obj.content_type:
            return f"{obj.content_type.app_label}.{obj.content_type.model}"
        return "Unknown"


class AuditLogConfigSerializer(serializers.ModelSerializer):
    """Serializer for audit log configuration."""
    content_type_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditLogConfig
        fields = [
            "id", "content_type", "content_type_display",
            "is_enabled", "track_fields", "exclude_fields",
            "capture_snapshots", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_content_type_display(self, obj):
        if obj.content_type:
            return f"{obj.content_type.app_label}.{obj.content_type.model}"
        return "Unknown"


class AuditLogSummarySerializer(serializers.Serializer):
    """Summary statistics for the audit dashboard."""
    total_entries = serializers.IntegerField()
    entries_today = serializers.IntegerField()
    entries_by_action = serializers.DictField()
    entries_by_module = serializers.DictField()
    recent_users = serializers.ListField()
