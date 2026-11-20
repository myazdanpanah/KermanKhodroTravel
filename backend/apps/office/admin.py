"""Django admin for Office configuration."""

from django.contrib import admin

from .models import (
    BusinessRecordReference,
    Correspondence,
    Secretariat,
    SecretariatMember,
    SecretariatNumberSequence,
)


class SecretariatMemberInline(admin.TabularInline):
    model = SecretariatMember
    extra = 1


@admin.register(Secretariat)
class SecretariatAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "company", "is_active")
    list_filter = ("is_active", "company")
    search_fields = ("name", "code")
    inlines = [SecretariatMemberInline]


@admin.register(SecretariatMember)
class SecretariatMemberAdmin(admin.ModelAdmin):
    list_display = ("secretariat", "user", "can_register", "created_at")
    list_filter = ("can_register", "secretariat")


@admin.register(Correspondence)
class CorrespondenceAdmin(admin.ModelAdmin):
    list_display = ("id", "registration_number", "subject", "correspondence_type",
                    "registration_status", "current_status", "company")
    list_filter = ("correspondence_type", "registration_status", "current_status", "confidentiality")
    search_fields = ("subject", "registration_number")
    readonly_fields = ("registration_number", "registered_at", "registered_by")


admin.site.register(SecretariatNumberSequence)
admin.site.register(BusinessRecordReference)
