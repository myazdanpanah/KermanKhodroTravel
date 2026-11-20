"""
Audit Log Views — API endpoints for viewing and querying audit trail.
"""
from django.utils import timezone
from django.db.models import Count, Q
from django.contrib.contenttypes.models import ContentType
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response

from .models import AuditLog, AuditLogConfig
from .serializers import AuditLogSerializer, AuditLogConfigSerializer, AuditLogSummarySerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only view of audit log entries.
    
    Supports filtering by action, content_type, user, date range.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        company = getattr(self.request.user, "company", None)
        if not company:
            return AuditLog.objects.none()

        # Billing rows are installation-wide (they carry no company), so their
        # audit entries are recorded with company=NULL. Show them to anyone who
        # may read billing, alongside the user's own company's entries; the
        # company filter is never relaxed for other apps.
        from apps.billing.permissions import has_perm as billing_perm

        scope = Q(company=company)
        if billing_perm(self.request.user, "can_view"):
            scope |= Q(company__isnull=True, content_type__app_label="billing")
        qs = AuditLog.objects.filter(scope)

        # Filter by action
        action_filter = self.request.query_params.get("action")
        if action_filter:
            qs = qs.filter(action=action_filter)

        # Filter by content type
        ct_filter = self.request.query_params.get("content_type")
        if ct_filter:
            try:
                app_label, model_name = ct_filter.split(".")
                ct = ContentType.objects.get(app_label=app_label, model=model_name)
                qs = qs.filter(content_type=ct)
            except (ContentType.DoesNotExist, ValueError):
                pass

        # Filter by user
        user_filter = self.request.query_params.get("user")
        if user_filter:
            qs = qs.filter(user_id=user_filter)

        # Filter by date range
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(timestamp__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__lte=date_to)

        # Filter by module
        module_filter = self.request.query_params.get("module")
        if module_filter:
            qs = qs.filter(module=module_filter)

        # Search in description
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(description__icontains=search)

        return qs[:500]  # Limit to prevent abuse


class AuditLogConfigViewSet(viewsets.ModelViewSet):
    """CRUD for audit log configuration per content type."""
    serializer_class = AuditLogConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AuditLogConfig.objects.all()

    def perform_create(self, serializer):
        config = serializer.save()
        # Register/unregister model based on config
        from .middleware import register_model, unregister_model
        if config.is_enabled:
            model = config.content_type.model_class()
            if model:
                register_model(model)
        else:
            model = config.content_type.model_class()
            if model:
                unregister_model(model)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def audit_summary(request):
    """
    Get audit log summary statistics for the dashboard.
    
    Returns counts by action, module, recent users, and daily trend.
    """
    company = getattr(request.user, "company", None)
    if not company:
        return Response({"error": "No company"}, status=400)

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timezone.timedelta(days=7)

    base_qs = AuditLog.objects.filter(company=company)

    total = base_qs.count()
    today = base_qs.filter(timestamp__gte=today_start).count()

    # By action
    by_action = dict(
        base_qs.filter(timestamp__gte=week_ago)
        .values_list("action")
        .annotate(count=Count("id"))
        .values_list("action", "count")
    )

    # By module
    by_module = dict(
        base_qs.filter(timestamp__gte=week_ago, module__gt="")
        .values_list("module")
        .annotate(count=Count("id"))
        .values_list("module", "count")
    )

    # Recent active users
    recent_users = list(
        base_qs.filter(timestamp__gte=week_ago, user__isnull=False)
        .values("user__username")
        .annotate(count=Count("id"))
        .order_by("-count")[:10]
    )

    # Daily trend (last 7 days)
    daily_trend = []
    for i in range(7):
        day = today_start - timezone.timedelta(days=6 - i)
        next_day = day + timezone.timedelta(days=1)
        count = base_qs.filter(timestamp__gte=day, timestamp__lt=next_day).count()
        daily_trend.append({"date": day.strftime("%Y-%m-%d"), "count": count})

    data = {
        "total_entries": total,
        "entries_today": today,
        "entries_by_action": by_action,
        "entries_by_module": by_module,
        "recent_users": recent_users,
        "daily_trend": daily_trend,
    }

    serializer = AuditLogSummarySerializer(data)
    return Response(serializer.data)
