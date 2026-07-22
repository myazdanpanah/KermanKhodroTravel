"""
Service Management Admin Registration.
"""

from django.contrib import admin
from .models import (
    ServiceRequest, Warranty, Technician, WorkOrder, WorkOrderOperation,
    ServiceContract, SLARule, MaintenancePlan, MaintenanceSchedule,
    ServicePart, ServiceFeedback,
)


class WorkOrderOperationInline(admin.TabularInline):
    model = WorkOrderOperation
    extra = 0


class ServicePartInline(admin.TabularInline):
    model = ServicePart
    extra = 0


class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = ("request_number", "customer", "product_name", "priority", "status", "received_date")
    list_filter = ("status", "priority")
    search_fields = ("request_number", "product_name", "serial_number")


class WarrantyAdmin(admin.ModelAdmin):
    list_display = ("product_name", "serial_number", "warranty_type", "status", "start_date", "end_date")
    list_filter = ("status", "warranty_type")


class TechnicianAdmin(admin.ModelAdmin):
    list_display = ("name", "employee_id", "department", "skills", "is_active")
    list_filter = ("is_active", "department")


class WorkOrderAdmin(admin.ModelAdmin):
    list_display = ("work_order_number", "service_request", "technician", "status", "actual_total_cost")
    list_filter = ("status",)
    inlines = [WorkOrderOperationInline, ServicePartInline]


class ServiceContractAdmin(admin.ModelAdmin):
    list_display = ("contract_number", "customer", "contract_type", "status", "start_date", "end_date")
    list_filter = ("status", "contract_type")


class SLARuleAdmin(admin.ModelAdmin):
    list_display = ("name", "priority", "response_time_hours", "resolution_time_hours", "is_active")
    list_filter = ("priority", "is_active")


class MaintenancePlanAdmin(admin.ModelAdmin):
    list_display = ("name", "maintenance_type", "status", "next_maintenance_date")
    list_filter = ("status", "maintenance_type")


admin.site.register(ServiceRequest, ServiceRequestAdmin)
admin.site.register(Warranty, WarrantyAdmin)
admin.site.register(Technician, TechnicianAdmin)
admin.site.register(WorkOrder, WorkOrderAdmin)
admin.site.register(ServiceContract, ServiceContractAdmin)
admin.site.register(SLARule, SLARuleAdmin)
admin.site.register(MaintenancePlan, MaintenancePlanAdmin)
admin.site.register(MaintenanceSchedule)
admin.site.register(ServicePart)
admin.site.register(ServiceFeedback)
