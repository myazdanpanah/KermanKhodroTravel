import api from './client'

export interface AIInsight {
  id: number
  company: number
  insight_type: string
  title: string
  description: string
  severity: string
  module: string
  data_payload: Record<string, unknown>
  is_read: boolean
  is_dismissed: boolean
  created_at: string
}

export interface Anomaly {
  id: number
  company: number
  module: string
  metric_name: string
  expected_value: number
  actual_value: number
  deviation_pct: number
  severity: string
  description: string
  is_resolved: boolean
  created_at: string
}

export interface Forecast {
  id: number
  company: number
  module: string
  metric_name: string
  forecast_period: string
  forecast_data: Array<{ date: string; value: number; lower_bound: number; upper_bound: number }>
  accuracy_score: number
  model_used: string
  created_at: string
}

export interface NLQuery {
  id: number
  company: number
  query_text: string
  generated_sql: string
  result_data: { headers: string[]; rows: unknown[][] }
  execution_time_ms: number
  status: string
  error_message: string
  created_by: number | null
  created_at: string
}

export interface AIDashboard {
  insights: { total: number; unread: number; critical: number; by_type: Array<{ insight_type: string; count: number }> }
  anomalies: { total: number; critical: number; high: number; medium: number; low: number; by_module: Array<{ module: string; count: number }> }
  recent_queries: NLQuery[]
  forecasts_count: number
}

export const aiApi = {
  // Dashboard
  getDashboard: () => api.get<AIDashboard>('/ai/dashboard/'),

  // Insights
  getInsights: (params?: { module?: string; unread?: boolean }) =>
    api.get<AIInsight[]>('/ai/insights/', { params }),
  getInsightSummary: () => api.get('/ai/insights/summary/'),
  markInsightRead: (id: number) => api.post(`/ai/insights/${id}/read/`),
  dismissInsight: (id: number) => api.post(`/ai/insights/${id}/dismiss/`),

  // Anomalies
  getAnomalies: (params?: { module?: string; severity?: string }) =>
    api.get<Anomaly[]>('/ai/anomalies/', { params }),
  detectAnomalies: (module?: string) =>
    api.post('/ai/anomalies/detect/', { module: module || 'all' }),
  resolveAnomaly: (id: number) => api.post(`/ai/anomalies/${id}/resolve/`),
  getAnomalySummary: () => api.get('/ai/anomalies/summary/'),

  // Forecasts
  getForecasts: (params?: { module?: string }) =>
    api.get<Forecast[]>('/ai/forecasts/', { params }),
  getForecast: (id: number) => api.get<Forecast>(`/ai/forecasts/${id}/`),
  generateForecast: (data: { module: string; metric_name: string; periods?: number }) =>
    api.post<Forecast>('/ai/forecasts/generate/', data),

  // NL Queries
  getQueries: () => api.get<NLQuery[]>('/ai/nl-queries/'),
  createQuery: (query_text: string) =>
    api.post<NLQuery>('/ai/nl-queries/create/', { query_text }),
}
