"""
AI Insights URL Configuration
"""
from django.urls import path
from . import views

app_name = 'ai_insights'

urlpatterns = [
    # Dashboard
    path('dashboard/', views.ai_dashboard, name='ai-dashboard'),

    # Insights
    path('insights/', views.insight_list, name='insight-list'),
    path('insights/summary/', views.insight_summary, name='insight-summary'),
    path('insights/<int:pk>/read/', views.insight_mark_read, name='insight-mark-read'),
    path('insights/<int:pk>/dismiss/', views.insight_dismiss, name='insight-dismiss'),

    # Anomalies
    path('anomalies/', views.anomaly_list, name='anomaly-list'),
    path('anomalies/detect/', views.anomaly_detect, name='anomaly-detect'),
    path('anomalies/summary/', views.anomaly_summary, name='anomaly-summary'),
    path('anomalies/<int:pk>/resolve/', views.anomaly_resolve, name='anomaly-resolve'),

    # Forecasts
    path('forecasts/', views.forecast_list, name='forecast-list'),
    path('forecasts/generate/', views.forecast_generate, name='forecast-generate'),
    path('forecasts/<int:pk>/', views.forecast_detail, name='forecast-detail'),

    # Natural Language Queries
    path('nl-queries/', views.nl_query_list, name='nl-query-list'),
    path('nl-queries/create/', views.nl_query_create, name='nl-query-create'),
]
