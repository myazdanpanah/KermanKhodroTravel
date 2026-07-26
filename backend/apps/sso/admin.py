"""
SSO Admin — Provider management, user mappings, and login attempt audit.
"""
from django.contrib import admin
from .models import SSOProvider, SSOUserMapping, SSOLoginAttempt, SSORefreshToken


@admin.register(SSOProvider)
class SSOProviderAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "protocol", "status", "jit_provisioning", "created_at"]
    list_filter = ["protocol", "status", "jit_provisioning"]
    search_fields = ["name", "slug"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(SSOUserMapping)
class SSOUserMappingAdmin(admin.ModelAdmin):
    list_display = ["external_id", "external_email", "provider", "user", "last_login_at"]
    list_filter = ["provider"]
    search_fields = ["external_id", "external_email", "user__username"]


@admin.register(SSOLoginAttempt)
class SSOLoginAttemptAdmin(admin.ModelAdmin):
    list_display = ["status", "external_email", "provider", "ip_address", "created_at"]
    list_filter = ["status", "provider"]
    search_fields = ["external_email", "external_id"]
    readonly_fields = ["created_at"]


@admin.register(SSORefreshToken)
class SSORefreshTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "provider", "expires_at", "revoked", "created_at"]
    list_filter = ["revoked", "provider"]
    readonly_fields = ["created_at"]
