"""
SSO & Identity URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"providers", views.SSOProviderViewSet, basename="sso-provider")
router.register(r"mappings", views.SSOUserMappingViewSet, basename="sso-mapping")
router.register(r"attempts", views.SSOLoginAttemptViewSet, basename="sso-attempt")

urlpatterns = [
    path("", include(router.urls)),
    path("initiate/", views.sso_initiate, name="sso-initiate"),
    path("callback/<slug:provider_slug>/", views.sso_callback, name="sso-callback"),
]
