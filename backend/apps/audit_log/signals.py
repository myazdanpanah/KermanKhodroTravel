"""
Audit Logging Middleware — Captures model create/update/delete operations.

Uses Django signals (pre_save, post_save, pre_delete) to intercept
model operations and record field-level diffs in AuditLog.
"""
import json
import logging
from copy import deepcopy

from django.db.models.signals import pre_save, post_save, pre_delete
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger("audit_log")

# Models to audit — populated by AuditLogConfig or defaults
_audited_models = set()
_audit_config_cache = {}


def _get_model_label(model):
    """Get 'app_label.ModelName' string."""
    return f"{model._meta.app_label}.{model._meta.model_name}"


def _get_track_fields(model):
    """Get fields to track for a model, excluding auto and relational fields."""
    exclude = {"id", "created_at", "updated_at", "is_deleted", "deleted_at",
               "deleted_by", "delete_reason", "password"}
    return [
        f.name for f in model._meta.get_fields()
        if hasattr(f, "column") and f.name not in exclude
    ]


def _serialize_value(value):
    """Serialize a value for JSON storage."""
    if value is None:
        return None
    if hasattr(value, "pk"):
        return value.pk
    if isinstance(value, (list, tuple)):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    if isinstance(value, (int, float, str, bool)):
        return value
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


def _get_field_values(instance, fields):
    """Extract current values for tracked fields."""
    values = {}
    for field_name in fields:
        try:
            value = getattr(instance, field_name, None)
            values[field_name] = _serialize_value(value)
        except Exception:
            values[field_name] = None
    return values


def _get_actor():
    """Resolve who acted, dropping users that are not persisted yet."""
    from .middleware import get_current_user, get_current_ip, get_current_ua

    user = get_current_user()
    if user is not None and getattr(user, "pk", None) is None:
        # An unsaved user cannot be a foreign key; keep the log, lose the name.
        user = None
    return user, get_current_ip(), get_current_ua()


# ── Signal Handlers ──

import threading
_pre_save_cache = threading.local()  # Per-thread pre-save cache


@receiver(pre_save)
def audit_pre_save(sender, instance, **kwargs):
    """Capture field values before save for diff calculation."""
    model_label = _get_model_label(sender)

    # Check if this model is audited
    if model_label not in _audited_models:
        return

    track_fields = _get_track_fields(sender)

    # For updates, capture current DB values
    if instance.pk:
        try:
            old_instance = sender.objects.get(pk=instance.pk)
            old_values = _get_field_values(old_instance, track_fields)
        except sender.DoesNotExist:
            old_values = {}
    else:
        old_values = {}

    if not hasattr(_pre_save_cache, 'data'):
        _pre_save_cache.data = {}
    _pre_save_cache.data[instance.pk or f"new_{id(instance)}"] = old_values


@receiver(post_save)
def audit_post_save(sender, instance, created, **kwargs):
    """Record create/update operation with field diffs."""
    model_label = _get_model_label(sender)

    if model_label not in _audited_models:
        return

    track_fields = _get_track_fields(sender)
    new_values = _get_field_values(instance, track_fields)

    cache_key = instance.pk or f"new_{id(instance)}"
    old_values = _pre_save_cache.data.pop(cache_key, {}) if hasattr(_pre_save_cache, 'data') else {}

    # Calculate changed fields
    changed_fields = []
    for field in track_fields:
        old_val = old_values.get(field)
        new_val = new_values.get(field)
        if old_val != new_val:
            changed_fields.append(field)

    # Skip if nothing changed (for updates)
    if not created and not changed_fields:
        return

    # Get the actor resolved after authentication, not during the middleware.
    user, ip, ua = _get_actor()

    # Determine company
    company = getattr(instance, "company", None)

    # Build description
    action = "create" if created else "update"
    obj_str = str(instance)[:200]
    description = f"{'Created' if created else 'Updated'} {model_label}: {obj_str}"

    try:
        from .models import AuditLog
        AuditLog.objects.create(
            action=action,
            user=user,
            ip_address=ip,
            user_agent=ua,
            content_type=ContentType.objects.get_for_model(sender),
            object_id=str(instance.pk),
            description=description,
            old_values=old_values if old_values else {},
            new_values=new_values,
            changed_fields=changed_fields,
            company=company,
        )
    except Exception as e:
        logger.warning("Failed to create audit log for %s: %s", model_label, e)


@receiver(pre_delete)
def audit_pre_delete(sender, instance, **kwargs):
    """Record delete operation with final state snapshot."""
    model_label = _get_model_label(sender)

    if model_label not in _audited_models:
        return

    track_fields = _get_track_fields(sender)
    old_values = _get_field_values(instance, track_fields)

    user, ip, ua = _get_actor()
    company = getattr(instance, "company", None)

    obj_str = str(instance)[:200]
    description = f"Deleted {model_label}: {obj_str}"

    try:
        from .models import AuditLog
        AuditLog.objects.create(
            action="delete",
            user=user,
            ip_address=ip,
            user_agent=ua,
            content_type=ContentType.objects.get_for_model(sender),
            object_id=str(instance.pk),
            description=description,
            old_values=old_values,
            new_values={},
            changed_fields=list(old_values.keys()),
            company=company,
        )
    except Exception as e:
        logger.warning("Failed to create audit log for delete %s: %s", model_label, e)


def register_model(model_class, track_fields=None, exclude_fields=None):
    """
    Register a model for audit logging.
    
    Usage:
        from apps.audit_log.middleware import register_model
        from apps.finance.models import Invoice
        register_model(Invoice)
    """
    model_label = _get_model_label(model_class)
    _audited_models.add(model_label)
    logger.debug("Registered model for audit logging: %s", model_label)


def unregister_model(model_class):
    """Remove a model from audit logging."""
    model_label = _get_model_label(model_class)
    _audited_models.discard(model_label)


def get_audited_models():
    """Return set of currently audited model labels."""
    return _audited_models.copy()


# ── Auto-discovery: audit all models with BaseModel ──

def auto_register_models():
    """
    Automatically register all models that inherit from BaseModel
    for audit logging. Called once at startup.
    """
    from django.apps import apps
    try:
        from apps.core.models import BaseModel
    except ImportError:
        return

    for model in apps.get_models():
        if issubclass(model, BaseModel) and model is not BaseModel:
            register_model(model)
