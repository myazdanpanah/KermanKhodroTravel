from django.contrib import admin

from .models import (
    ApprovalRequest,
    AvailableLetterNumber,
    CompanySettings,
    Credit,
    FinalFile,
    Invoice,
    InvoiceTemplate,
    LetterSequence,
    ManualDebt,
    Payer,
    Payment,
    ServiceCategory,
)


@admin.register(Payer)
class PayerAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "parent", "customer_type", "phone")
    search_fields = ("code", "name", "national_id")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("letter_number", "payer", "payer_code", "invoice_type", "amount", "issue_date")
    list_filter = ("invoice_type",)
    search_fields = ("letter_number", "payer", "payer_code")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("payer_name", "amount", "payment_date", "tracking_number")
    search_fields = ("payer_name", "payer_code", "tracking_number")


@admin.register(ManualDebt)
class ManualDebtAdmin(admin.ModelAdmin):
    list_display = ("payer_code", "description", "amount", "date")


@admin.register(Credit)
class CreditAdmin(admin.ModelAdmin):
    list_display = ("payer_code", "amount", "credit_date", "invoice_number")


@admin.register(LetterSequence)
class LetterSequenceAdmin(admin.ModelAdmin):
    list_display = ("payer_code", "year", "last_number")


@admin.register(AvailableLetterNumber)
class AvailableLetterNumberAdmin(admin.ModelAdmin):
    list_display = ("payer_code", "year", "number")


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not CompanySettings.objects.exists()


class FinalFileInline(admin.TabularInline):
    model = FinalFile
    extra = 0
    readonly_fields = ("file_name", "service_type", "file_path", "created_at")


@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
    list_display = ("letter_number", "payer_name", "service_type", "status", "created_at")
    list_filter = ("status", "service_type")
    search_fields = ("letter_number", "payer_name", "payer_code")
    inlines = [FinalFileInline]


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active", "display_order")


@admin.register(InvoiceTemplate)
class InvoiceTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at", "updated_at")


@admin.register(FinalFile)
class FinalFileAdmin(admin.ModelAdmin):
    list_display = ("file_name", "letter_number", "service_type", "created_at")
