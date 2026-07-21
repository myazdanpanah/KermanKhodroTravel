"""
Workflow Delegation Engine — per WORKFLOW_ENGINE.md §24.

Approvers may delegate authority to other users.
Delegation Types: Temporary, Permanent, Date-based, Emergency.
Rules: Delegation is auditable, never bypasses permissions, expires automatically.
"""

import logging
from datetime import date, timedelta
from typing import Optional

from django.db import transaction
from django.db import models
from django.conf import settings
from django.utils import timezone

from apps.finance.exceptions import ValidationError

logger = logging.getLogger(__name__)


class WorkflowDelegation(models.Model):
    """
    Delegation record — per WORKFLOW_ENGINE.md §24.
    An approver delegates their approval authority to another user.
    """
    DELEGATION_TYPES = [
        ("temporary", "Temporary"),
        ("permanent", "Permanent"),
        ("date_based", "Date-based"),
        ("emergency", "Emergency"),
    ]

    company = models.ForeignKey("accounts.Company", on_delete=models.CASCADE, related_name="workflow_delegations")
    definition = models.ForeignKey("workflow.WorkflowDefinition", on_delete=models.CASCADE, related_name="delegations")

    # Delegator (the original approver)
    delegator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="delegations_given")
    # Delegate (the person receiving authority)
    delegate = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="delegations_received")

    delegation_type = models.CharField(max_length=20, choices=DELEGATION_TYPES, default="temporary")
    reason = models.CharField(max_length=500, blank=True, default="")

    # Date range (for date-based and temporary)
    start_date = models.DateField(default=date.today)
    end_date = models.DateField(null=True, blank=True, help_text="Null = permanent until revoked")

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.delegator} → {self.delegate} ({self.delegation_type})"

    @property
    def is_currently_active(self):
        """Check if delegation is currently active based on date range."""
        if not self.is_active:
            return False
        today = date.today()
        if today < self.start_date:
            return False
        if self.end_date and today > self.end_date:
            return False
        return True


class DelegationService:
    """
    Manages workflow delegations.
    Per WORKFLOW_ENGINE.md §24: Delegation Rules.
    """

    @staticmethod
    @transaction.atomic
    def create_delegation(
        company,
        definition_id: int,
        delegator_id: int,
        delegate_id: int,
        delegation_type: str = "temporary",
        reason: str = "",
        start_date: date = None,
        end_date: date = None,
    ) -> WorkflowDelegation:
        """Create a new delegation."""
        if delegator_id == delegate_id:
            raise ValidationError("Cannot delegate to yourself")

        if delegation_type in ("temporary", "date_based") and not end_date:
            raise ValidationError("End date is required for temporary/date-based delegation")

        delegation = WorkflowDelegation.objects.create(
            company=company,
            definition_id=definition_id,
            delegator_id=delegator_id,
            delegate_id=delegate_id,
            delegation_type=delegation_type,
            reason=reason,
            start_date=start_date or date.today(),
            end_date=end_date,
        )

        logger.info(
            f"Delegation created: user#{delegator_id} → user#{delegate_id} "
            f"for workflow definition#{definition_id} ({delegation_type})"
        )
        return delegation

    @staticmethod
    def get_active_delegations(company, definition_id: int, delegator_id: int) -> list:
        """Get all active delegations for a specific user and workflow."""
        today = date.today()
        delegations = WorkflowDelegation.objects.filter(
            company=company,
            definition_id=definition_id,
            delegator_id=delegator_id,
            is_active=True,
            start_date__lte=today,
        ).filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=today)
        )
        return list(delegations)

    @staticmethod
    @transaction.atomic
    def revoke_delegation(delegation_id: int, user) -> WorkflowDelegation:
        """Revoke (cancel) an active delegation."""
        delegation = WorkflowDelegation.objects.get(pk=delegation_id)
        if not delegation.is_active:
            raise ValidationError("Delegation is already inactive")

        delegation.is_active = False
        delegation.revoked_at = timezone.now()
        delegation.save(update_fields=["is_active", "revoked_at"])

        logger.info(f"Delegation #{delegation_id} revoked by {user.username}")
        return delegation

    @staticmethod
    def resolve_approver(company, definition_id: int, original_approver_id: int) -> int:
        """
        Resolve the actual approver — checking if delegation is active.
        Returns the delegate's ID if delegated, otherwise the original approver's ID.
        """
        delegations = DelegationService.get_active_delegations(
            company, definition_id, original_approver_id
        )
        if delegations:
            # Use the most recent active delegation
            return delegations[0].delegate_id
        return original_approver_id
