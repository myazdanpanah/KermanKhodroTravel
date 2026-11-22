from django.urls import path
from . import views

urlpatterns = [
    path("", views.dataset_list, name="dataset-list"),
    path("upload/", views.dataset_upload, name="dataset-upload"),
    path("<int:pk>/", views.dataset_detail, name="dataset-detail"),
    path("<int:pk>/query/", views.dataset_query, name="dataset-query"),
    path("<int:pk>/test-sql/", views.dataset_test_sql, name="dataset-test-sql-pk"),
    path("test-sql/", views.dataset_test_sql, name="dataset-test-sql"),
    # Superset integration
    path("superset/health/", views.superset_health, name="superset-health"),
    path("superset/sync-all/", views.superset_sync_all, name="superset-sync-all"),
    path("superset/sync-erp/", views.sync_erp_datasets_view, name="superset-sync-erp"),
    path("sync-erp-tables/", views.sync_erp_datasets_view, name="sync-erp-tables"),
    path("<int:pk>/superset/sync/", views.superset_sync_dataset, name="superset-sync-dataset"),
]
