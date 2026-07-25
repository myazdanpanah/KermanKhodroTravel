"""
Multi-tenant URL Configuration.

Phase 18: Multi-tenant Architecture
"""

from django.urls import path
from . import views

app_name = "multi_tenant"

urlpatterns = [
    # Tenant management
    path("tenants/", views.tenant_list, name="tenant_list"),
    path("tenants/<int:pk>/", views.tenant_detail, name="tenant_detail"),
    path("tenants/onboard/", views.tenant_onboard, name="tenant_onboard"),
    path("tenants/my-info/", views.tenant_my_info, name="tenant_my_info"),

    # Plans
    path("plans/", views.plan_list, name="plan_list"),
    path("plans/change/", views.tenant_change_plan, name="tenant_change_plan"),

    # Features
    path("features/", views.feature_list, name="feature_list"),
    path("features/<int:pk>/toggle/", views.feature_toggle, name="feature_toggle"),

    # Subscriptions
    path("subscriptions/", views.subscription_list, name="subscription_list"),
]
