"""
AI Insights Serializers
"""
from rest_framework import serializers
from .models import AIInsight, AnomalyDetection, Forecast, NLQuery


class AIInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIInsight
        fields = [
            'id', 'company', 'insight_type', 'title', 'description',
            'severity', 'module', 'data_payload', 'is_read', 'is_dismissed',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class AnomalyDetectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnomalyDetection
        fields = [
            'id', 'company', 'module', 'metric_name',
            'expected_value', 'actual_value', 'deviation_pct',
            'severity', 'description', 'is_resolved',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ForecastSerializer(serializers.ModelSerializer):
    class Meta:
        model = Forecast
        fields = [
            'id', 'company', 'module', 'metric_name',
            'forecast_period', 'forecast_data', 'accuracy_score',
            'model_used', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class NLQuerySerializer(serializers.ModelSerializer):
    class Meta:
        model = NLQuery
        fields = [
            'id', 'company', 'query_text', 'generated_sql',
            'result_data', 'execution_time_ms', 'status',
            'error_message', 'created_by', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'generated_sql', 'result_data', 'execution_time_ms', 'status', 'error_message']


class NLQueryCreateSerializer(serializers.Serializer):
    query_text = serializers.CharField(max_length=2000)
