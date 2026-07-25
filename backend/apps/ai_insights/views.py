"""
AI Insights Views — Dashboard, Insights, Anomalies, Forecasts, NL Queries, Alerts
"""
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import AIInsight, AnomalyDetection, Forecast, NLQuery
from .alerts import AnomalyAlert, AnomalyAlertService
from .serializers import (
    AIInsightSerializer, AnomalyDetectionSerializer,
    ForecastSerializer, NLQuerySerializer, NLQueryCreateSerializer,
    AnomalyAlertSerializer,
)
from .services import InsightService, AnomalyService, ForecastService, NLQueryService


# ---- AI Insights ----

@api_view(["GET"])
def insight_list(request):
    """List AI insights for the company."""
    module = request.query_params.get('module')
    unread = request.query_params.get('unread', '').lower() == 'true'
    insights = InsightService.list_insights(request.user.company, module=module, unread_only=unread)
    return Response(AIInsightSerializer(insights, many=True).data)


@api_view(["POST"])
def insight_mark_read(request, pk):
    """Mark an insight as read."""
    insight = InsightService.mark_read(request.user.company, pk)
    return Response(AIInsightSerializer(insight).data)


@api_view(["POST"])
def insight_dismiss(request, pk):
    """Dismiss an insight."""
    insight = InsightService.dismiss(request.user.company, pk)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def insight_summary(request):
    """Get insight summary stats."""
    return Response(InsightService.summary(request.user.company))


# ---- Anomaly Detection ----

@api_view(["GET"])
def anomaly_list(request):
    """List detected anomalies."""
    module = request.query_params.get('module')
    severity = request.query_params.get('severity')
    anomalies = AnomalyService.list_anomalies(request.user.company, module=module, severity=severity)
    return Response(AnomalyDetectionSerializer(anomalies, many=True).data)


@api_view(["POST"])
def anomaly_detect(request):
    """Run anomaly detection across modules. Creates alerts for new anomalies (Phase 20)."""
    company = request.user.company
    module = request.data.get('module', 'all')
    all_anomalies = []
    if module in ('all', 'finance'):
        all_anomalies.extend(AnomalyService.detect_finance_anomalies(company))
    if module in ('all', 'sales'):
        all_anomalies.extend(AnomalyService.detect_sales_anomalies(company))

    # Phase 20: Create real-time alerts for newly detected anomalies
    if all_anomalies:
        AnomalyAlertService.create_alerts_for_anomalies(company, all_anomalies)

    return Response({
        'detected': len(all_anomalies),
        'anomalies': AnomalyDetectionSerializer(all_anomalies, many=True).data,
    })


@api_view(["POST"])
def anomaly_resolve(request, pk):
    """Resolve an anomaly."""
    anomaly = AnomalyService.resolve(request.user.company, pk)
    return Response(AnomalyDetectionSerializer(anomaly).data)


@api_view(["GET"])
def anomaly_summary(request):
    """Get anomaly summary stats."""
    return Response(AnomalyService.summary(request.user.company))


# ---- Forecasts ----

@api_view(["GET"])
def forecast_list(request):
    """List forecasts."""
    module = request.query_params.get('module')
    forecasts = ForecastService.list_forecasts(request.user.company, module=module)
    return Response(ForecastSerializer(forecasts, many=True).data)


@api_view(["GET"])
def forecast_detail(request, pk):
    """Get a specific forecast."""
    forecast = ForecastService.get_forecast(request.user.company, pk)
    return Response(ForecastSerializer(forecast).data)


@api_view(["POST"])
def forecast_generate(request):
    """Generate a new forecast."""
    module = request.data.get('module', 'finance')
    metric_name = request.data.get('metric_name', 'revenue')
    periods = request.data.get('periods', 30)

    forecast = ForecastService.generate_linear_forecast(
        request.user.company, module, metric_name, periods
    )
    if forecast is None:
        return Response(
            {'error': 'Not enough historical data to generate forecast (need at least 5 data points)'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(ForecastSerializer(forecast).data, status=status.HTTP_201_CREATED)


# ---- Natural Language Queries (Phase 19: LLM-powered) ----

@api_view(["GET"])
def nl_query_list(request):
    """List recent NL queries."""
    queries = NLQueryService.list_queries(request.user.company)
    return Response(NLQuerySerializer(queries, many=True).data)


@api_view(["POST"])
def nl_query_create(request):
    """Process a natural language query. Uses LLM when available, falls back to keywords."""
    serializer = NLQueryCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    nl_query = NLQueryService.process_query(
        request.user.company,
        serializer.validated_data['query_text'],
        user=request.user,
    )
    return Response(NLQuerySerializer(nl_query).data, status=status.HTTP_201_CREATED)


# ---- Anomaly Alerts (Phase 20) ----

@api_view(["GET"])
def alert_list(request):
    """List anomaly alerts."""
    module = request.query_params.get('module')
    severity = request.query_params.get('severity')
    unread = request.query_params.get('unread', '').lower() == 'true'
    alerts = AnomalyAlertService.list_alerts(
        request.user.company, module=module, severity=severity, unread_only=unread,
    )
    return Response(AnomalyAlertSerializer(alerts, many=True).data)


@api_view(["POST"])
def alert_mark_read(request, pk):
    """Mark an alert as read."""
    alert = AnomalyAlertService.mark_read(request.user.company, pk)
    return Response(AnomalyAlertSerializer(alert).data)


@api_view(["POST"])
def alert_mark_all_read(request):
    """Mark all alerts as read."""
    AnomalyAlertService.mark_all_read(request.user.company)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def alert_summary(request):
    """Get alert summary stats."""
    return Response(AnomalyAlertService.summary(request.user.company))


# ---- Dashboard Summary ----

@api_view(["GET"])
def ai_dashboard(request):
    """Get AI insights dashboard summary."""
    company = request.user.company
    return Response({
        'insights': InsightService.summary(company),
        'anomalies': AnomalyService.summary(company),
        'alerts': AnomalyAlertService.summary(company),
        'recent_queries': NLQuerySerializer(
            NLQueryService.list_queries(company, limit=5), many=True
        ).data,
        'forecasts_count': Forecast.objects.filter(company=company).count(),
    })
