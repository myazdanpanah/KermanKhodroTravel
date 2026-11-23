"""CRM URL Patterns."""
from django.urls import path
from . import sms_views, views

urlpatterns = [
    path("leads/", views.lead_list, name="crm-lead-list"),
    path("leads/<int:pk>/", views.lead_detail, name="crm-lead-detail"),
    path("leads/<int:pk>/convert/", views.lead_convert, name="crm-lead-convert"),

    path("opportunities/", views.opportunity_list, name="crm-opportunity-list"),
    path("opportunities/<int:pk>/", views.opportunity_detail, name="crm-opportunity-detail"),
    path("opportunities/<int:pk>/move/", views.opportunity_move, name="crm-opportunity-move"),
    path("opportunities/<int:pk>/close-won/", views.opportunity_close_won, name="crm-opportunity-close-won"),
    path("opportunities/<int:pk>/close-lost/", views.opportunity_close_lost, name="crm-opportunity-close-lost"),

    path("activities/", views.activity_list, name="crm-activity-list"),
    path("activities/<int:pk>/", views.activity_detail, name="crm-activity-detail"),
    path("activities/<int:pk>/complete/", views.activity_complete, name="crm-activity-complete"),

    path("campaigns/", views.campaign_list, name="crm-campaign-list"),
    path("campaigns/<int:pk>/", views.campaign_detail, name="crm-campaign-detail"),

    path("tasks/", views.task_list, name="crm-task-list"),
    path("tasks/<int:pk>/", views.task_detail, name="crm-task-detail"),
    path("tasks/<int:pk>/complete/", views.task_complete, name="crm-task-complete"),

    path("timeline/<int:customer_id>/", views.customer_timeline, name="crm-timeline"),

    path("summary/", views.crm_summary, name="crm-summary"),

    # SMS gateway: settings, send, bulk send, history
    path("sms/settings/", sms_views.sms_settings_view, name="crm-sms-settings"),
    path("sms/send/", sms_views.sms_send_view, name="crm-sms-send"),
    path("sms/bulk-send/", sms_views.sms_bulk_send_view, name="crm-sms-bulk-send"),
    path("sms/messages/", sms_views.sms_messages_view, name="crm-sms-messages"),
]
