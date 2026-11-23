"""Core URL Configuration."""

from django.urls import path
from . import views

urlpatterns = [
    path("", views.global_search_view, name="global-search"),
]
