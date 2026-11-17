from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    # API
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),
    path("api/v1/datasets/", include("apps.datasets.urls")),
    path("api/v1/dashboards/", include("apps.dashboards.urls")),
    path("api/v1/db-manager/", include("apps.db_manager.urls")),
    path("api/v1/finance/", include("apps.finance.urls")),
    path("api/v1/llm/", include("apps.llm.urls")),
    path("api/v1/manufacturing/", include("apps.manufacturing.urls")),
    path("api/v1/workflows/", include("apps.workflow.urls")),
    path("api/v1/inventory/", include("apps.inventory.urls")),
    path("api/v1/purchasing/", include("apps.purchasing.urls")),
    path("api/v1/sales/", include("apps.sales.urls")),
    path("api/v1/trading/", include("apps.trading.urls")),
    path("api/v1/service-sales/", include("apps.service_sales.urls")),
    path("api/v1/service-management/", include("apps.service_management.urls")),
    path("api/v1/crm/", include("apps.crm.urls")),
    path("api/v1/hr/", include("apps.hr.urls")),
    path("api/v1/reporting/", include("apps.reporting.urls")),
    path("api/v1/ai/", include("apps.ai_insights.urls")),
    path("api/v1/rate-limiting/", include("apps.rate_limiting.urls")),
    path("api/v1/tenants/", include("apps.multi_tenant.urls")),
    path("api/v1/sso/", include("apps.sso.urls")),
    path("api/v1/audit/", include("apps.audit_log.urls")),
    # Schema
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
