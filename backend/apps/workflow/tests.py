"""
Workflow Engine Extension Tests — delegation, escalation, SLA, notifications.
Per WORKFLOW_ENGINE.md §24-§31.
"""

import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.tests_helpers import create_test_company, create_test_user
from .models import (
    WorkflowDefinition, WorkflowState, WorkflowTransition,
    WorkflowInstance, WorkflowHistory, WorkflowComment,
    WorkflowDelegation, WorkflowEscalationRule, WorkflowEscalationLog,
    WorkflowSLARule, WorkflowSLATracker,
    WorkflowNotification, WorkflowNotificationRule,
)
from .service import WorkflowService, WorkflowExecutionService
from .delegation import DelegationService
from .escalation import EscalationService
from .sla import SLAService
from .notifications import NotificationService

User = get_user_model()


class WorkflowTestBase(TestCase):
    """Shared setUp for workflow tests."""

    def setUp(self):
        self.company = create_test_company(name="WFTestCo")
        self.user = create_test_user(username="wfuser", company=self.company, role="ceo")
        self.user2 = create_test_user(username="wfuser2", company=self.company, role="finance")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.company.enable_module("workflow")

        # Create a workflow definition
        self.definition = WorkflowDefinition.objects.create(
            company=self.company,
            name="Purchase Order Approval",
            document_type="purchase_order",
            description="Standard PO approval flow",
            created_by=self.user,
        )

        # Create states
        self.start_state = WorkflowState.objects.create(
            definition=self.definition, name="draft",
            state_type="start", order=0,
        )
        self.review_state = WorkflowState.objects.create(
            definition=self.definition, name="manager_review",
            state_type="approval", required_role="finance", order=1,
        )
        self.completed_state = WorkflowState.objects.create(
            definition=self.definition, name="approved",
            state_type="completed", order=2,
        )
        self.cancelled_state = WorkflowState.objects.create(
            definition=self.definition, name="cancelled",
            state_type="cancelled", order=3,
        )

        # Create transitions
        WorkflowTransition.objects.create(
            definition=self.definition,
            source_state=self.start_state,
            target_state=self.review_state,
            action="submit",
        )
        WorkflowTransition.objects.create(
            definition=self.definition,
            source_state=self.review_state,
            target_state=self.completed_state,
            action="approve",
        )
        WorkflowTransition.objects.create(
            definition=self.definition,
            source_state=self.start_state,
            target_state=self.cancelled_state,
            action="cancel",
        )
        WorkflowTransition.objects.create(
            definition=self.definition,
            source_state=self.review_state,
            target_state=self.start_state,
            action="reject",
            requires_comment=True,
        )


class WorkflowCoreTests(WorkflowTestBase):
    """Tests for core workflow operations."""

    def test_start_workflow(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=1,
            user=self.user,
        )
        self.assertEqual(instance.status, "active")
        self.assertEqual(instance.current_state.name, "draft")

    def test_start_workflow_no_definition(self):
        from apps.finance.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            WorkflowService.start_workflow(
                company=self.company,
                document_type="nonexistent",
                document_id=1,
                user=self.user,
            )

    def test_get_available_actions(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=2,
            user=self.user,
        )
        actions = WorkflowService.get_available_actions(instance)
        self.assertEqual(len(actions), 2)  # submit, cancel

    def test_execute_transition(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=3,
            user=self.user,
        )

        result = WorkflowExecutionService.execute_transition(
            instance=instance, action="submit",
            user=self.user, comment="Submitting for review",
        )

        instance.refresh_from_db()
        self.assertEqual(instance.current_state.name, "manager_review")
        self.assertEqual(instance.status, "active")

        # History should be recorded
        history = WorkflowHistory.objects.filter(instance=instance)
        self.assertEqual(history.count(), 2)  # started + submitted

    def test_execute_invalid_transition(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=4,
            user=self.user,
        )

        from apps.finance.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            WorkflowExecutionService.execute_transition(
                instance=instance, action="approve",
                user=self.user,
            )

    def test_cancel_workflow(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=5,
            user=self.user,
        )

        result = WorkflowExecutionService.cancel_workflow(
            instance=instance, user=self.user, reason="No longer needed",
        )

        instance.refresh_from_db()
        self.assertEqual(instance.status, "cancelled")

    def test_pending_workflows(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=6,
            user=self.user,
        )
        WorkflowExecutionService.execute_transition(
            instance=instance, action="submit",
            user=self.user,
        )

        pending = WorkflowService.get_pending_workflows(self.company)
        self.assertEqual(pending.count(), 1)

    def test_workflow_view_list(self):
        WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=7,
            user=self.user,
        )
        resp = self.client.get("/api/v1/workflows/")
        self.assertEqual(resp.status_code, 200)

    def test_workflow_view_transition(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=8,
            user=self.user,
        )
        resp = self.client.post(
            f"/api/v1/workflows/{instance.id}/transition/",
            {"action": "submit", "comment": "Submit"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

    def test_workflow_definitions_list(self):
        resp = self.client.get("/api/v1/workflows/definitions/")
        self.assertEqual(resp.status_code, 200)


class DelegationTests(WorkflowTestBase):
    """Tests for Workflow Delegation Engine."""

    def test_create_delegation(self):
        delegation = DelegationService.create_delegation(
            company=self.company,
            definition_id=self.definition.id,
            delegator_id=self.user.id,
            delegate_id=self.user2.id,
            delegation_type="temporary",
            reason="On vacation",
            end_date=datetime.date.today() + datetime.timedelta(days=7),
        )
        self.assertTrue(delegation.is_active)
        self.assertEqual(delegation.delegator, self.user)
        self.assertEqual(delegation.delegate, self.user2)

    def test_cannot_delegate_to_self(self):
        from apps.finance.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            DelegationService.create_delegation(
                company=self.company,
                definition_id=self.definition.id,
                delegator_id=self.user.id,
                delegate_id=self.user.id,
            )

    def test_resolve_approver_with_delegation(self):
        DelegationService.create_delegation(
            company=self.company,
            definition_id=self.definition.id,
            delegator_id=self.user.id,
            delegate_id=self.user2.id,
            delegation_type="permanent",
        )

        resolved = DelegationService.resolve_approver(
            self.company, self.definition.id, self.user.id,
        )
        self.assertEqual(resolved, self.user2.id)

    def test_resolve_approver_without_delegation(self):
        resolved = DelegationService.resolve_approver(
            self.company, self.definition.id, self.user.id,
        )
        self.assertEqual(resolved, self.user.id)

    def test_revoke_delegation(self):
        delegation = DelegationService.create_delegation(
            company=self.company,
            definition_id=self.definition.id,
            delegator_id=self.user.id,
            delegate_id=self.user2.id,
            delegation_type="permanent",
        )

        DelegationService.revoke_delegation(delegation.id, self.user)
        delegation.refresh_from_db()
        self.assertFalse(delegation.is_active)
        self.assertIsNotNone(delegation.revoked_at)


class EscalationTests(WorkflowTestBase):
    """Tests for Workflow Escalation Engine."""

    def test_create_escalation_rule(self):
        rule = WorkflowEscalationRule.objects.create(
            company=self.company,
            definition=self.definition,
            state=self.review_state,
            name="8-hour timeout",
            trigger_type="timeout_hours",
            timeout_value=8,
            escalation_target="ceo",
            is_active=True,
        )
        self.assertTrue(rule.is_active)
        self.assertEqual(rule.timeout_value, 8)

    def test_escalation_log_creation(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=10,
            user=self.user,
        )
        WorkflowExecutionService.execute_transition(
            instance=instance, action="submit",
            user=self.user,
        )

        log = WorkflowEscalationLog.objects.create(
            instance=instance,
            escalated_from=self.user,
            escalated_to=self.user2,
            reason="Timeout: 8 hours exceeded",
        )
        self.assertIsNotNone(log.timestamp)


class SLATests(WorkflowTestBase):
    """Tests for Workflow SLA Management."""

    def test_create_sla_rule(self):
        rule = WorkflowSLARule.objects.create(
            company=self.company,
            definition=self.definition,
            state=self.review_state,
            name="Review SLA",
            max_hours=Decimal("8.00"),
            warning_hours=Decimal("6.00"),
            notify_on_warning=True,
            notify_on_breach=True,
            escalate_on_breach=True,
        )
        self.assertTrue(rule.is_active)

    def test_start_sla(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=20,
            user=self.user,
        )

        # Create SLA rule for draft state
        WorkflowSLARule.objects.create(
            company=self.company,
            definition=self.definition,
            state=self.start_state,
            name="Draft SLA",
            max_hours=Decimal("24.00"),
        )

        trackers = SLAService.start_sla(instance, self.start_state)
        self.assertEqual(len(trackers), 1)
        self.assertEqual(trackers[0].status, "on_track")

    def test_complete_sla(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=21,
            user=self.user,
        )

        WorkflowSLARule.objects.create(
            company=self.company,
            definition=self.definition,
            state=self.start_state,
            name="Draft SLA",
            max_hours=Decimal("24.00"),
        )

        SLAService.start_sla(instance, self.start_state)
        completed = SLAService.complete_sla(instance, self.start_state)
        self.assertEqual(completed, 1)

    def test_sla_dashboard(self):
        dashboard = SLAService.get_sla_dashboard(self.company)
        self.assertIn("total_tracked", dashboard)
        self.assertIn("compliance_rate", dashboard)


class NotificationTests(WorkflowTestBase):
    """Tests for Workflow Notification Engine."""

    def test_send_notification(self):
        notification = NotificationService.send_notification(
            company=self.company,
            recipient_id=self.user.id,
            notification_type="approval_required",
            title="Approval Needed",
            message="PO-001 needs your approval",
        )
        self.assertTrue(notification.is_delivered)

    def test_get_unread_count(self):
        NotificationService.send_notification(
            company=self.company,
            recipient_id=self.user.id,
            notification_type="approval_required",
            title="Test",
            message="Test message",
        )

        count = NotificationService.get_unread_count(self.company, self.user)
        self.assertEqual(count, 1)

    def test_mark_all_read(self):
        NotificationService.send_notification(
            company=self.company,
            recipient_id=self.user.id,
            notification_type="approval_required",
            title="Test",
            message="Test message",
        )

        NotificationService.mark_all_read(self.company, self.user)
        count = NotificationService.get_unread_count(self.company, self.user)
        self.assertEqual(count, 0)

    def test_notify_transition(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=30,
            user=self.user,
        )

        NotificationService.notify_transition(
            instance=instance,
            action="submit",
            performed_by=self.user,
            comment="Submitting for review",
        )

        # Should create notification for assigned user
        # (assigned_to is None initially, so no notification)
        # But if we assign someone, it should work
        instance.assigned_to = self.user2
        instance.save(update_fields=["assigned_to"])

        NotificationService.notify_transition(
            instance=instance,
            action="submit",
            performed_by=self.user,
            comment="Submitting for review",
        )

        count = NotificationService.get_unread_count(self.company, self.user2)
        self.assertGreater(count, 0)

    def test_notifications_list(self):
        NotificationService.send_notification(
            company=self.company,
            recipient_id=self.user.id,
            notification_type="approved",
            title="Approved!",
            message="Your PO was approved",
        )

        notifications = NotificationService.get_notifications(self.company, self.user)
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0]["type"], "approved")


class WorkflowCommentTests(WorkflowTestBase):
    """Tests for workflow comments."""

    def test_create_comment(self):
        instance = WorkflowService.start_workflow(
            company=self.company,
            document_type="purchase_order",
            document_id=40,
            user=self.user,
        )

        comment = WorkflowComment.objects.create(
            instance=instance,
            author=self.user,
            text="Please review the attached documents",
        )
        self.assertEqual(comment.text, "Please review the attached documents")
