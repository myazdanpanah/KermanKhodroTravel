"""
WebSocket URL routing for AI Insights real-time features (Phase 20).
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(
        r'ws/ai/alerts/(?P<company_id>\d+)/$',
        consumers.AnomalyAlertConsumer.as_asgi(),
    ),
]
