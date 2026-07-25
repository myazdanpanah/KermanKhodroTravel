"""
Rate Limiting URL Configuration.

Phase 22: API Rate Limiting & Throttling
"""

from django.urls import path
from . import views

app_name = "rate_limiting"

urlpatterns = [
    # API Keys
    path("api-keys/", views.api_key_list, name="api_key_list"),
    path("api-keys/<int:pk>/", views.api_key_detail, name="api_key_detail"),
    path("api-keys/<int:pk>/toggle/", views.api_key_toggle, name="api_key_toggle"),
    path("api-keys/<int:pk>/regenerate/", views.api_key_regenerate, name="api_key_regenerate"),

    # Rate Limit Policies (admin only)
    path("policies/", views.policy_list, name="policy_list"),
    path("policies/<int:pk>/", views.policy_detail, name="policy_detail"),

    # Usage Analytics
    path("stats/", views.rate_limit_stats, name="rate_limit_stats"),
    path("logs/", views.rate_limit_logs, name="rate_limit_logs"),
]
