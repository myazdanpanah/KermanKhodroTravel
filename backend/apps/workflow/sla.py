"""
Workflow SLA Management — per WORKFLOW_ENGINE.md §26.

Every workflow may define one or more Service Level Agreements (SLAs).
SLA Metrics: Response Time, Approval Time, Resolution Time, Completion Time.
SLA timers start automatically when entering a state.
"""

import logging
from datetime import timedelta
from decimal import Decimal
from typing import Dict, List, Optional

from django.db import transaction
from django.db import models
from django.conf import settings
from django.utils import timezone

from apps.finance.exceptions import ValidationError

logger = logging.getLogger(__name__)


class WorkflowSLARule(models.Model):
    """
    SLA rule definition — per WORKFLOW_ENGINE.md §26.
    Defines time limits for workflow states.
    """
    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="sla_rules")
    definition = models.ForeignKey("workflow.WorkflowDefinition", on_delete=models.CASCADE, related_name="sla_rules")
    state = models.ForeignKey("workflow.WorkflowState", on_delete=models.CASCADE, related_name="sla_rules")

    name = models.CharField(max_length=200)
    max_hours = models.DecimalField(max_digits=8, decimal_places=2, help_text="Maximum allowed hours in this state")
    warning_hours = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="Warning threshold (hours before deadline)")

    # Actions on breach
    notify_on_warning = models.BooleanField(default=True)
    notify_on_breach = models.BooleanField(default=True)
    escalate_on_breach = models.BooleanField(default=False)
    auto_cancel_on_breach = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("definition", "state")]
        ordering = ["max_hours"]

    def __str__(self):
        return f"SLA: {self.name} ({self.max_hours}h max)"


class WorkflowSLATracker(models.Model):
    """
    Runtime SLA tracking — tracks SLA status for each workflow instance state.
    Per WORKFLOW_ENGINE.md §27: Timers & Deadlines.
    """
    STATUS_CHOICES = [
        ("on_track", "On Track"),
        ("warning", "Warning"),
        ("breached", "Breached"),
        ("completed", "Completed"),
    ]

    instance = models.ForeignKey("workflow.WorkflowInstance", on_delete=models.CASCADE, related_name="sla_trackers")
    sla_rule = models.ForeignKey(WorkflowSLARule, on_delete=models.CASCADE, related_name="trackers")
    state = models.ForeignKey("workflow.WorkflowState", on_delete=models.CASCADE, related_name="sla_trackers")

    started_at = models.DateTimeField(default=timezone.now)
    deadline = models.DateTimeField()
    warning_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="on_track")
    breach_notified = models.BooleanField(default=False)
    warning_notified = models.BooleanField(default=False)

    class Meta:
        ordering = ["deadline"]

    def __str__(self):
        return f"SLA for {self.instance} — {self.status}"

    @property
    def elapsed_hours(self):
        """Hours elapsed since SLA started."""
        end = self.completed_at or timezone.now()
        delta = end - self.started_at
        return Decimal(str(delta.total_seconds() / 3600))

    @property
    def remaining_hours(self):
        """Hours remaining before deadline."""
        remaining = self.deadline - timezone.now()
        return Decimal(str(max(remaining.total_seconds() / 3600, 0)))

    @property
    def is_overdue(self):
        """Check if SLA is breached."""
        return timezone.now() > self.deadline and self.status != "completed"


class SLAService:
    """
    SLA management service.
    Per WORKFLOW_ENGINE.md §26: SLA Management.
    Per WORKFLOW_ENGINE.md §27: Timers & Deadlines.
    """

    @staticmethod
    @transaction.atomic
    def start_sla(instance, state):
        """
        Start SLA timers when entering a state.
        Called automatically on workflow transitions.
        """
        from .models import WorkflowInstance

        rules = WorkflowSLARule.objects.filter(
            company=instance.company,
            definition=instance.definition,
            state=state,
            is_active=True,
        )

        now = timezone.now()
        trackers = []

        for rule in rules:
            deadline = now + timedelta(hours=float(rule.max_hours))
            warning_at = None
            if rule.warning_hours:
                warning_at = now + timedelta(hours=float(rule.warning_hours))

            tracker = WorkflowSLATracker.objects.create(
                instance=instance,
                sla_rule=rule,
                state=state,
                started_at=now,
                deadline=deadline,
                warning_at=warning_at,
                status="on_track",
            )
            trackers.append(tracker)

            logger.info(
                f"SLA started for instance #{instance.id} in state '{state.name}': "
                f"deadline={deadline.isoformat()}"
            )

        return trackers

    @staticmethod
    @transaction.atomic
    def complete_sla(instance, state):
        """
        Mark SLA as completed when leaving a state.
        Called automatically on workflow transitions.
        """
        trackers = WorkflowSLATracker.objects.filter(
            instance=instance,
            state=state,
            status__in=("on_track", "warning"),
        )

        now = timezone.now()
        completed_count = 0
        for tracker in trackers:
            tracker.completed_at = now
            tracker.status = "completed"
            tracker.save(update_fields=["completed_at", "status"])
            completed_count += 1

        return completed_count

    @staticmethod
    def check_sla_status(company):
        """
        Check all active SLA trackers and update statuses.
        Should be called periodically (e.g., via Celery beat).
        Returns count of breached SLAs.
        """
        now = timezone.now()

        # Find trackers that are now in warning zone
        warning_trackers = WorkflowSLATracker.objects.filter(
            instance__company=company,
            status="on_track",
            warning_at__lte=now,
            completed_at__isnull=True,
        ).select_related("instance", "sla_rule")

        for tracker in warning_trackers:
            tracker.status = "warning"
            tracker.save(update_fields=["status"])
            logger.warning(
                f"SLA warning: instance #{tracker.instance.id} "
                f"in state '{tracker.state.name}' — "
                f"{tracker.remaining_hours:.1f}h remaining"
            )

        # Find breached SLAs
        breached_trackers = WorkflowSLATracker.objects.filter(
            instance__company=company,
            status__in=("on_track", "warning"),
            deadline__lte=now,
            completed_at__isnull=True,
        ).select_related("instance", "sla_rule")

        breached_count = 0
        for tracker in breached_trackers:
            tracker.status = "breached"
            tracker.save(update_fields=["status"])
            breached_count += 1

            logger.error(
                f"SLA BREACHED: instance #{tracker.instance.id} "
                f"({tracker.instance.document_type}#{tracker.instance.document_id}) "
                f"in state '{tracker.state.name}' — "
                f"breached by {abs(tracker.remaining_hours):.1f}h"
            )

            # Trigger escalation if configured
            if tracker.sla_rule.escalate_on_breach:
                from .escalation import EscalationService
                EscalationService._execute_escalation(
                    tracker.instance,
                    None,  # Will find appropriate rule
                )

        return breached_count

    @staticmethod
    def get_sla_dashboard(company) -> Dict:
        """Get SLA compliance metrics for dashboard."""
        from django.db.models import Avg, Count, Q

        now = timezone.now()

        # Overall stats
        total = WorkflowSLATracker.objects.filter(
            instance__company=company
        )

        completed = total.filter(status="completed")
        breached = total.filter(status="breached")
        active = total.filter(status__in=("on_track", "warning"), completed_at__isnull=True)

        # Calculate average completion duration using ExpressionWrapper
        from django.db.models import ExpressionWrapper, DurationField, F
        avg_duration = completed.annotate(
            duration=ExpressionWrapper(
                F("completed_at") - F("started_at"),
                output_field=DurationField(),
            )
        ).aggregate(avg_duration=Avg("duration"))

        avg_hours = 0
        if avg_duration["avg_duration"]:
            avg_hours = avg_duration["avg_duration"].total_seconds() / 3600

        return {
            "total_tracked": total.count(),
            "on_track": active.filter(status="on_track").count(),
            "warning": active.filter(status="warning").count(),
            "breached": breached.count(),
            "completed": completed.count(),
            "compliance_rate": (
                (completed.count() / total.count() * 100)
                if total.count() > 0 else 0
            ),
        }
