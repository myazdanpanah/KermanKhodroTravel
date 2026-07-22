"""
Service Management URL Patterns.
Per DJANGO_BACKEND.md §20: URL naming conventions.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Service Requests
    path("requests/", views.service_request_list, name="sm-request-list"),
    path("requests/<int:pk>/", views.service_request_detail, name="sm-request-detail"),
    path("requests/<int:pk>/assign/", views.service_request_assign, name="sm-request-assign"),
    path("requests/<int:pk>/transition/", views.service_request_transition, name="sm-request-transition"),

    # Warranties
    path("warranties/", views.warranty_list, name="sm-warranty-list"),
    path("warranties/validate/", views.warranty_validate, name="sm-warranty-validate"),
    path("warranties/<int:pk>/", views.warranty_detail, name="sm-warranty-detail"),

    # Technicians
    path("technicians/", views.technician_list, name="sm-technician-list"),
    path("technicians/<int:pk>/", views.technician_detail, name="sm-technician-detail"),

    # Work Orders
    path("work-orders/", views.work_order_list, name="sm-workorder-list"),
    path("work-orders/<int:pk>/", views.work_order_detail, name="sm-workorder-detail"),
    path("work-orders/<int:pk>/start/", views.work_order_start, name="sm-workorder-start"),
    path("work-orders/<int:pk>/complete/", views.work_order_complete, name="sm-workorder-complete"),
    path("work-orders/<int:pk>/approve/", views.work_order_approve, name="sm-workorder-approve"),

    # Service Contracts
    path("contracts/", views.contract_list, name="sm-contract-list"),
    path("contracts/<int:pk>/", views.contract_detail, name="sm-contract-detail"),
    path("contracts/<int:pk>/activate/", views.contract_activate, name="sm-contract-activate"),

    # SLA Rules
    path("sla-rules/", views.sla_rule_list, name="sm-slarule-list"),
    path("sla-rules/<int:pk>/", views.sla_rule_detail, name="sm-slarule-detail"),

    # Maintenance
    path("maintenance-plans/", views.maintenance_plan_list, name="sm-maintenance-list"),
    path("maintenance-plans/<int:pk>/", views.maintenance_plan_detail, name="sm-maintenance-detail"),
    path("maintenance-schedules/", views.maintenance_schedule_list, name="sm-schedule-list"),

    # Service Parts
    path("parts/", views.service_part_list, name="sm-part-list"),

    # Feedback
    path("feedback/", views.feedback_submit, name="sm-feedback-submit"),

    # Summary
    path("summary/", views.service_summary, name="sm-summary"),
]
