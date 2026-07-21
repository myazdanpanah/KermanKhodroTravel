"""
Workflow Escalation Engine — per WORKFLOW_ENGINE.md §25.

If an approval exceeds its SLA:
  Pending Approval → Timeout → Escalation Rule → Higher Authority → Notification → Audit Record.

Escalation policies are configurable by workflow.
"""

import logging
from datetime import timedelta
from typing import Optional

from django.db import transaction
from django.db import models
from django.conf import settings
from django.utils import timezone

from apps.finance.exceptions import ValidationError

logger = logging.getLogger(__name__)


class WorkflowEscalationRule(models.Model):
    """
    Escalation rule — per WORKFLOW_ENGINE.md §25.
    Defines when and how to escalate a pending approval.
    """
    TRIGGER_TYPES = [
        ("timeout_hours", "Timeout (Hours)"),
        ("timeout_days", "Timeout (Days)"),
        ("sla_breach", "SLA Breach"),
        ("manual", "Manual Escalation"),
    ]

    ESCALATION_TARGETS = [
        ("next_level", "Next Approval Level"),
        ("specific_user", "Specific User"),
        ("department_head", "Department Head"),
        ("ceo", "CEO/Executive"),
    ]

    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="escalation_rules")
    definition = models.ForeignKey("workflow.WorkflowDefinition", on_delete=models.CASCADE, related_name="escalation_rules")
    state = models.ForeignKey("workflow.WorkflowState", on_delete=models.CASCADE, related_name="escalation_rules", null=True, blank=True)

    name = models.CharField(max_length=200)
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_TYPES, default="timeout_hours")
    timeout_value = models.IntegerField(default=8, help_text="Timeout value (hours or days depending on trigger type)")

    escalation_target = models.CharField(max_length=20, choices=ESCALATION_TARGETS, default="next_level")
    target_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="escalation_targets")

    notify_delegator = models.BooleanField(default=True, help_text="Also notify the original assignee?")
    escalate_only_once = models.BooleanField(default=True, help_text="Prevent re-escalation?")

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timeout_value"]

    def __str__(self):
        return f"Escalate: {self.name} after {self.timeout_value}h"


class WorkflowEscalationLog(models.Model):
    """
    Immutable log of every escalation action.
    Per WORKFLOW_ENGINE.md §31: Workflow History — immutable.
    """
    instance = models.ForeignKey("workflow.WorkflowInstance", on_delete=models.PROTECT, related_name="escalation_logs")
    rule = models.ForeignKey(WorkflowEscalationRule, on_delete=models.SET_NULL, null=True, related_name="logs")
    escalated_from = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="escalated_from")
    escalated_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="escalated_to")
    reason = models.CharField(max_length=500, blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"Escalation: {self.escalated_from} → {self.escalated_to} at {self.timestamp}"


class EscalationService:
    """
    Processes workflow escalations.
    Per WORKFLOW_ENGINE.md §25: Escalation Engine.
    Per WORKFLOW_ENGINE.md §52: Monitoring — expired SLAs.
    """

    @staticmethod
    def check_escalations(company):
        """
        Check all active workflow instances for overdue escalations.
        Should be called periodically (e.g., via Celery beat).
        """
        from .models import WorkflowInstance

        now = timezone.now()
        active_instances = WorkflowInstance.objects.filter(
            company=company, status="active"
        ).select_related("current_state", "definition")

        escalated_count = 0
        for instance in active_instances:
            rules = WorkflowEscalationRule.objects.filter(
                company=company,
                definition=instance.definition,
                state=instance.current_state,
                is_active=True,
            )

            for rule in rules:
                # Check if already escalated for this rule
                already_escalated = WorkflowEscalationLog.objects.filter(
                    instance=instance, rule=rule
                ).exists()

                if rule.escalate_only_once and already_escalated:
                    continue

                # Calculate timeout threshold
                if rule.trigger_type == "timeout_hours":
                    threshold = now - timedelta(hours=rule.timeout_value)
                elif rule.trigger_type == "timeout_days":
                    threshold = now - timedelta(days=rule.timeout_value)
                else:
                    continue

                # Check if instance has been pending too long
                if instance.updated_at < threshold:
                    EscalationService._execute_escalation(instance, rule)
                    escalated_count += 1

        logger.info(f"Escalation check complete: {escalated_count} instances escalated")
        return escalated_count

    @staticmethod
    @transaction.atomic
    def _execute_escalation(instance, rule):
        """Execute an escalation for a single instance."""
        from .models import WorkflowInstance
        from apps.accounts.models import User

        # Determine target user based on escalation_target type
        target_user = rule.target_user

        if rule.escalation_target == "next_level":
            # Find next approval state
            next_state = instance.definition.states.filter(
                state_type="approval"
            ).exclude(
                pk=instance.current_state_id
            ).first()
            if next_state and next_state.required_role:
                target_user = User.objects.filter(
                    company=instance.company, role=next_state.required_role
                ).first()

        elif rule.escalation_target == "ceo":
            # Find the CEO user
            target_user = User.objects.filter(
                company=instance.company, role="ceo"
            ).first()

        elif rule.escalation_target == "department_head":
            # Find the department head (admin role as fallback)
            target_user = User.objects.filter(
                company=instance.company, role="admin"
            ).first()

        # For "specific_user", target_user is already set from rule.target_user

        if not target_user:
            logger.warning(f"No escalation target found for rule #{rule.id} (target type: {rule.escalation_target})")
            return

        # Log the escalation
        WorkflowEscalationLog.objects.create(
            instance=instance,
            rule=rule,
            escalated_from=instance.assigned_to,
            escalated_to=target_user,
            reason=f"Auto-escalation: {rule.name} (timeout {rule.timeout_value}h, target: {rule.escalation_target})",
        )

        # Reassign the instance
        instance.assigned_to = target_user
        instance.save(update_fields=["assigned_to", "updated_at"])

        # Send escalation notification to the new assignee
        try:
            from .notifications import NotificationService
            doc_label = f"{instance.document_type}#{instance.document_id}"
            NotificationService.send_notification(
                company=instance.company,
                recipient_id=target_user.id,
                notification_type="escalated",
                title=f"Escalated: {doc_label}",
                message=f"This document has been escalated to you.\nReason: {rule.name}\nOriginal assignee: {instance.assigned_to}",
                instance=instance,
            )
            # Notify the original assignee if configured
            if rule.notify_delegator and instance.assigned_to and instance.assigned_to_id != target_user.id:
                NotificationService.send_notification(
                    company=instance.company,
                    recipient_id=instance.assigned_to_id,
                    notification_type="escalated",
                    title=f"Escalation Notice: {doc_label}",
                    message=f"Your pending document has been escalated to {target_user.username}.",
                    instance=instance,
                )
        except Exception as e:
            logger.warning(f"Failed to send escalation notification: {e}")

        logger.info(
            f"Escalated instance #{instance.id} ({instance.document_type}#{instance.document_id}) "
            f"from user#{instance.assigned_to_id} to user#{target_user.id} ({rule.escalation_target})"
        )
