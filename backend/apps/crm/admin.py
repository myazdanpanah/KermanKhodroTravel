"""CRM Admin Registration."""
from django.contrib import admin
from .models import Lead, Opportunity, Activity, Campaign, CRMTask, CustomerTimeline

admin.site.register(Lead)
admin.site.register(Opportunity)
admin.site.register(Activity)
admin.site.register(Campaign)
admin.site.register(CRMTask)
admin.site.register(CustomerTimeline)
