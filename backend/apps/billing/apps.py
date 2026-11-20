from django.apps import AppConfig


class BillingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.billing"
    verbose_name = "Billing (KKT invoices)"

    def ready(self):
        # These models do not inherit apps.core.BaseModel, so the audit app's
        # auto-discovery skips them. Register the ledger explicitly so edits
        # and deletes land in AuditLog with the acting user attached.
        from apps.audit_log.middleware import register_model
        from .models import ApprovalRequest, Credit, Invoice, ManualDebt, Payment

        for model in (Invoice, Payment, ManualDebt, Credit, ApprovalRequest):
            register_model(model)
