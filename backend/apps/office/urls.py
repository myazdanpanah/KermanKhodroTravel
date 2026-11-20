"""Nexivo Office URL patterns."""

from django.urls import path

from . import views

urlpatterns = [
    path("workbench/", views.workbench, name="office-workbench"),
    path("workbench/list/", views.workbench_list, name="office-workbench-list"),

    path("correspondence/", views.correspondence_list, name="office-correspondence-list"),
    path("correspondence/<int:pk>/", views.correspondence_detail, name="office-correspondence-detail"),
    path("correspondence/<int:pk>/register/", views.correspondence_register, name="office-correspondence-register"),
    path("correspondence/<int:pk>/refer/", views.correspondence_refer, name="office-correspondence-refer"),
    path("correspondence/<int:pk>/reply/", views.correspondence_reply, name="office-correspondence-reply"),
    path("correspondence/<int:pk>/archive/", views.correspondence_archive, name="office-correspondence-archive"),
    path("correspondence/<int:pk>/comments/", views.correspondence_comments, name="office-correspondence-comments"),
    path("correspondence/<int:pk>/timeline/", views.correspondence_timeline, name="office-correspondence-timeline"),
    path("correspondence/<int:pk>/business-links/", views.correspondence_business_links),
    path("correspondence/<int:pk>/business-links/<int:link_id>/", views.correspondence_business_link_delete),

    path("meta/", views.office_meta, name="office-meta"),
    path("integrations/business/health/", views.integration_health),
    path("integrations/business/search/", views.integration_search),
    path("integrations/business/records/<str:entity_type>/<str:record_id>/", views.integration_record),
]
