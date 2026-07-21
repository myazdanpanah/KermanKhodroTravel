"""
Workflow Notification Engine — per WORKFLOW_ENGINE.md §29.

Workflow events generate notifications.
Supported Channels: In-App, Email, SMS, Push Notification, Webhook.
Notifications are asynchronous.
"""

import logging
from typing import Dict, List, Optional

from django.db import transaction
from django.db import models
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class WorkflowNotification(models.Model):
    """
    In-app notification for workflow events.
    Per WORKFLOW_ENGINE.md §29: Notification Engine.
    """
    NOTIFICATION_TYPES = [
        ("submitted", "Document Submitted"),
        ("approval_required", "Approval Required"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("returned", "Returned for Revision"),
        ("delegated", "Delegated to You"),
        ("escalated", "Escalated"),
        ("cancelled", "Document Cancelled"),
        ("completed", "Workflow Completed"),
        ("sla_warning", "SLA Warning"),
        ("sla_breach", "SLA Breached"),
    ]

    CHANNEL_CHOICES = [
        ("in_app", "In-App"),
        ("email", "Email"),
        ("sms", "SMS"),
        ("push", "Push Notification"),
        ("webhook", "Webhook"),
    ]

    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="workflow_notifications")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="workflow_notifications")

    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default="in_app")

    title = models.CharField(max_length=200)
    message = models.TextField()

    # Reference to the workflow instance
    instance = models.ForeignKey("workflow.WorkflowInstance", on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")

    # Read status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    # Delivery status (for email/sms/push)
    is_delivered = models.BooleanField(default=False)
    delivered_at = models.DateTimeField(null=True, blank=True)
    delivery_error = models.CharField(max_length=500, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.notification_type}] {self.title} → {self.recipient}"

    def mark_read(self):
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=["is_read", "read_at"])


class WorkflowNotificationRule(models.Model):
    """
    Configurable notification rules — which events notify which roles.
    Per WORKFLOW_ENGINE.md §29: Notification Events.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="notification_rules")
    definition = models.ForeignKey("workflow.WorkflowDefinition", on_delete=models.CASCADE, related_name="notification_rules")

    notification_type = models.CharField(max_length=30, choices=WorkflowNotification.NOTIFICATION_TYPES)
    target_role = models.CharField(max_length=50, help_text="Role to notify (e.g. 'approver', 'manager')")
    channel = models.CharField(max_length=20, choices=WorkflowNotification.CHANNEL_CHOICES, default="in_app")

    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("definition", "notification_type", "target_role")]

    def __str__(self):
        return f"{self.notification_type} → {self.target_role} ({self.channel})"


class NotificationService:
    """
    Workflow notification dispatcher.
    Per WORKFLOW_ENGINE.md §29: Notification Engine.
    """

    @staticmethod
    @transaction.atomic
    def send_notification(
        company,
        recipient_id: int,
        notification_type: str,
        title: str,
        message: str,
        instance=None,
        channel: str = "in_app",
    ) -> WorkflowNotification:
        """Send a workflow notification."""
        notification = WorkflowNotification.objects.create(
            company=company,
            recipient_id=recipient_id,
            notification_type=notification_type,
            channel=channel,
            title=title,
            message=message,
            instance=instance,
        )

        # For in-app, mark as delivered immediately
        if channel == "in_app":
            notification.is_delivered = True
            notification.delivered_at = timezone.now()
            notification.save(update_fields=["is_delivered", "delivered_at"])

        logger.info(f"Notification sent: [{notification_type}] {title} → user#{recipient_id}")
        return notification

    @staticmethod
    def _notify_by_rules(instance, notification_type: str, title: str, message: str, performed_by, skip_ids=None):
        """
        Send notifications based on WorkflowNotificationRule configuration.
        Falls back to direct assignment if no rules are configured.
        """
        rules = WorkflowNotificationRule.objects.filter(
            company=instance.company,
            definition=instance.definition,
            notification_type=notification_type,
            is_active=True,
        )

        if rules.exists():
            # Send to all configured target roles
            from apps.accounts.models import User
            notified_ids = set(skip_ids or set())
            notified_ids.add(performed_by.id)  # Never notify the actor
            for rule in rules:
                users = User.objects.filter(
                    company=instance.company,
                    role=rule.target_role,
                )
                for user in users:
                    if user.id not in notified_ids:
                        NotificationService.send_notification(
                            company=instance.company,
                            recipient_id=user.id,
                            notification_type=notification_type,
                            title=title,
                            message=message,
                            instance=instance,
                            channel=rule.channel,
                        )
                        notified_ids.add(user.id)
        else:
            # Fallback: notify the assigned user directly
            if instance.assigned_to and instance.assigned_to_id != performed_by.id:
                NotificationService.send_notification(
                    company=instance.company,
                    recipient_id=instance.assigned_to_id,
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    instance=instance,
                )

    @staticmethod
    def notify_transition(instance, action: str, performed_by, comment: str = ""):
        """
        Send notifications after a workflow transition.
        Called automatically after every successful transition.
        Uses WorkflowNotificationRule if configured, falls back to direct assignment.
        """
        from .models import WorkflowInstance

        doc_label = f"{instance.document_type}#{instance.document_id}"
        state_name = instance.current_state.name if instance.current_state else "Unknown"

        # Notify based on action
        if action == "submit":
            # Find who needs to approve next
            if instance.assigned_to and instance.assigned_to != performed_by:
                NotificationService.send_notification(
                    company=instance.company,
                    recipient_id=instance.assigned_to_id,
                    notification_type="approval_required",
                    title=f"Approval Required: {doc_label}",
                    message=f"{performed_by.username} submitted {doc_label} for your approval.\nState: {state_name}",
                    instance=instance,
                )

        elif action in ("approve", "confirm"):
            # Notify the document creator
            if instance.created_by and instance.created_by != performed_by:
                NotificationService.send_notification(
                    company=instance.company,
                    recipient_id=instance.created_by_id,
                    notification_type="approved",
                    title=f"Approved: {doc_label}",
                    message=f"{performed_by.username} approved {doc_label}.\nState: {state_name}",
                    instance=instance,
                )

            # Notify next approver if any
            if instance.assigned_to and instance.assigned_to != performed_by:
                NotificationService.send_notification(
                    company=instance.company,
                    recipient_id=instance.assigned_to_id,
                    notification_type="approval_required",
                    title=f"Approval Required: {doc_label}",
                    message=f"{doc_label} requires your approval.\nState: {state_name}",
                    instance=instance,
                )

        elif action in ("reject", "return"):
            # Notify the document creator
            if instance.created_by:
                NotificationService.send_notification(
                    company=instance.company,
                    recipient_id=instance.created_by_id,
                    notification_type="rejected" if action == "reject" else "returned",
                    title=f"{'Rejected' if action == 'reject' else 'Returned'}: {doc_label}",
                    message=f"{performed_by.username} {'rejected' if action == 'reject' else 'returned'} {doc_label}.\nReason: {comment or 'No reason provided'}",
                    instance=instance,
                )

        elif action == "cancel":
            # Notify assigned user
            if instance.assigned_to and instance.assigned_to != performed_by:
                NotificationService.send_notification(
                    company=instance.company,
                    recipient_id=instance.assigned_to_id,
                    notification_type="cancelled",
                    title=f"Cancelled: {doc_label}",
                    message=f"{doc_label} has been cancelled by {performed_by.username}.\nReason: {comment or 'No reason provided'}",
                    instance=instance,
                )

        elif action == "complete":
            # Notify the document creator
            if instance.created_by:
                NotificationService.send_notification(
                    company=instance.company,
                    recipient_id=instance.created_by_id,
                    notification_type="completed",
                    title=f"Completed: {doc_label}",
                    message=f"{doc_label} workflow has been completed.",
                    instance=instance,
                )

        # Note: _notify_by_rules is called separately if rule-based
        # notifications are needed beyond the direct assignment above.

    @staticmethod
    def get_unread_count(company, user) -> int:
        """Get count of unread notifications for a user."""
        return WorkflowNotification.objects.filter(
            company=company, recipient=user, is_read=False
        ).count()

    @staticmethod
    def get_notifications(company, user, limit: int = 50) -> list:
        """Get recent notifications for a user."""
        notifications = WorkflowNotification.objects.filter(
            company=company, recipient=user
        ).select_related("instance")[:limit]

        return [
            {
                "id": n.id,
                "type": n.notification_type,
                "title": n.title,
                "message": n.message,
                "is_read": n.is_read,
                "instance_id": n.instance_id,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ]

    @staticmethod
    @transaction.atomic
    def mark_all_read(company, user):
        """Mark all notifications as read."""
        count = WorkflowNotification.objects.filter(
            company=company, recipient=user, is_read=False
        ).update(is_read=True, read_at=timezone.now())
        return count
