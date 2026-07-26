from django.apps import AppConfig


class AuditLogConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.audit_log"
    verbose_name = "Audit Logging"

    def ready(self):
        try:
            from .signals import auto_register_models
            auto_register_models()
        except Exception:
            pass  # Skip during migrations before tables exist
