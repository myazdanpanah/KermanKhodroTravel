"""
AI Insights — Real-time Anomaly Alert Service (Phase 20)

Provides:
- AnomalyAlertService: sends in-app notifications when anomalies are detected
- AnomalyAlertSerializer: serializes alerts for the API
- Channel layer integration for WebSocket push (when configured)
"""
import logging
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.models import BaseModel

logger = logging.getLogger(__name__)


class AnomalyAlert(BaseModel):
    """An in-app notification for a detected anomaly."""

    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    anomaly = models.ForeignKey(
        'ai_insights.AnomalyDetection', on_delete=models.CASCADE,
        related_name='alerts', null=True, blank=True,
    )
    module = models.CharField(max_length=50)
    title = models.CharField(max_length=255)
    message = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    is_read = models.BooleanField(default=False)
    is_notified = models.BooleanField(default=False, help_text='Whether a push notification was sent')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.severity}] {self.title}"


class AnomalyAlertService:
    """Service to create and manage real-time anomaly alerts."""

    @staticmethod
    def create_alerts_for_anomalies(company, anomalies):
        """Create alert objects for a batch of newly detected anomalies.

        Also attempts to push via WebSocket if channels is configured.
        Returns the list of created AnomalyAlert instances.
        """
        alerts = []
        for anomaly in anomalies:
            title = f"Anomaly Detected: {anomaly.metric_name}"
            message = (
                f"{anomaly.description}\n"
                f"Severity: {anomaly.severity.upper()} | Module: {anomaly.module}"
            )
            alert = AnomalyAlert.objects.create(
                company=company,
                anomaly=anomaly,
                module=anomaly.module,
                title=title,
                message=message,
                severity=anomaly.severity,
            )
            alerts.append(alert)

            # Attempt WebSocket push (non-blocking)
            AnomalyAlertService._push_websocket(company.id, alert)

        return alerts

    @staticmethod
    def _push_websocket(company_id, alert):
        """Push an alert via Django Channels WebSocket (if configured)."""
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            channel_layer = get_channel_layer()
            if channel_layer is None:
                return

            payload = {
                'type': 'anomaly_alert',
                'alert_id': alert.id,
                'title': alert.title,
                'message': alert.message,
                'severity': alert.severity,
                'module': alert.module,
                'timestamp': alert.created_at.isoformat(),
            }
            async_to_sync(channel_layer.group_send)(
                f'anomaly_alerts_company_{company_id}',
                payload,
            )
            alert.is_notified = True
            alert.save(update_fields=['is_notified'])
        except Exception:
            # Channels not configured — silently skip
            logger.debug("WebSocket push skipped (channels not configured)")

    @staticmethod
    def list_alerts(company, module=None, severity=None, unread_only=False):
        qs = AnomalyAlert.objects.filter(company=company)
        if module:
            qs = qs.filter(module=module)
        if severity:
            qs = qs.filter(severity=severity)
        if unread_only:
            qs = qs.filter(is_read=False)
        return qs

    @staticmethod
    def mark_read(company, alert_id):
        alert = AnomalyAlert.objects.get(pk=alert_id, company=company)
        alert.is_read = True
        alert.save(update_fields=['is_read'])
        return alert

    @staticmethod
    def mark_all_read(company):
        AnomalyAlert.objects.filter(company=company, is_read=False).update(is_read=True)

    @staticmethod
    def summary(company):
        qs = AnomalyAlert.objects.filter(company=company)
        return {
            'total': qs.count(),
            'unread': qs.filter(is_read=False).count(),
            'critical': qs.filter(severity='critical', is_read=False).count(),
            'high': qs.filter(severity='high', is_read=False).count(),
        }

    @staticmethod
    def delete_old_alerts(company, days=90):
        """Delete alerts older than N days."""
        cutoff = timezone.now() - timezone.timedelta(days=days)
        deleted, _ = AnomalyAlert.objects.filter(
            company=company, created_at__lt=cutoff
        ).delete()
        return deleted
