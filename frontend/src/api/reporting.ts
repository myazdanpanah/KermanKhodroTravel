/**
 * Reporting & Analytics API Client
 */
import apiClient from './client';

export interface ReportTemplate {
  id: number;
  name: string;
  description: string;
  module: string;
  visualization: string;
  query_config: Record<string, unknown>;
  parameters_schema: unknown[];
  is_public: boolean;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface ReportExecution {
  id: number;
  template: number;
  template_name: string;
  parameters: Record<string, unknown>;
  status: string;
  result_data: {
    headers: string[];
    rows: unknown[][];
    summary: Record<string, unknown>;
  };
  row_count: number;
  execution_time_ms: number;
  error_message: string;
  executed_by: number;
  executed_by_name: string;
  created_at: string;
}

export interface Dashboard {
  id: number;
  name: string;
  description: string;
  layout_config: Record<string, unknown>;
  is_default: boolean;
  is_public: boolean;
  refresh_interval: number;
  allowed_roles: string[];
  created_by: number;
  created_by_name: string;
  widgets: DashboardWidget[];
  created_at: string;
}

export interface DashboardWidget {
  id: number;
  dashboard: number;
  report_template: number | null;
  report_template_name: string;
  title: string;
  chart_type: string;
  query_config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  config: Record<string, unknown>;
  refresh_interval: number;
}

export interface KPI {
  id: number;
  name: string;
  code: string;
  description: string;
  module: string;
  formula: string;
  unit: string;
  target_value: number;
  current_value: number;
  previous_value: number;
  trend: string;
  variance: number;
  status: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface KPISummary {
  total_kpis: number;
  on_target: number;
  below_target: number;
  improving: number;
  declining: number;
}

export interface ScheduledReport {
  id: number;
  template: number;
  template_name: string;
  name: string;
  frequency: string;
  cron_expression: string;
  parameters: Record<string, unknown>;
  recipients: string[];
  export_format: string;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export interface ReportSnapshot {
  id: number;
  template: number;
  template_name: string;
  parameters: Record<string, unknown>;
  result_data: Record<string, unknown>;
  row_count: number;
  file_path: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export const reportingApi = {
  // Report Templates
  getTemplates: () => apiClient.get<{ data: ReportTemplate[] }>('/api/v1/reporting/reports/'),
  createTemplate: (data: Partial<ReportTemplate>) => apiClient.post<{ data: ReportTemplate }>('/api/v1/reporting/reports/', data),
  deleteTemplate: (id: number) => apiClient.delete(`/api/v1/reporting/reports/${id}/`),

  // Report Executions
  executeReport: (templateId: number, parameters?: Record<string, unknown>) =>
    apiClient.post<{ data: ReportExecution }>('/api/v1/reporting/executions/', { template_id: templateId, parameters }),
  getExecutions: () => apiClient.get<{ data: ReportExecution[] }>('/api/v1/reporting/executions/'),
  exportExecution: (id: number, format: string) =>
    apiClient.get(`/api/v1/reporting/executions/${id}/export/`, { params: { format }, responseType: 'blob' as any }),
  createSnapshot: (id: number) => apiClient.post(`/api/v1/reporting/executions/${id}/snapshot/`),

  // Dashboards
  getDashboards: () => apiClient.get<{ data: Dashboard[] }>('/api/v1/reporting/dashboards/'),
  getDashboard: (id: number) => apiClient.get<{ data: Dashboard }>(`/api/v1/reporting/dashboards/${id}/`),
  createDashboard: (data: Partial<Dashboard>) => apiClient.post<{ data: Dashboard }>('/api/v1/reporting/dashboards/', data),
  updateDashboard: (id: number, data: Partial<Dashboard>) => apiClient.put<{ data: Dashboard }>(`/api/v1/reporting/dashboards/${id}/`, data),
  deleteDashboard: (id: number) => apiClient.delete(`/api/v1/reporting/dashboards/${id}/`),
  addWidget: (dashboardId: number, data: Partial<DashboardWidget>) =>
    apiClient.post<{ data: DashboardWidget }>(`/api/v1/reporting/dashboards/${dashboardId}/add_widget/`, data),
  removeWidget: (dashboardId: number, widgetId: number) =>
    apiClient.delete(`/api/v1/reporting/dashboards/${dashboardId}/remove_widget/${widgetId}/`),

  // KPIs
  getKPIs: (module?: string) => apiClient.get<{ data: KPI[] }>('/api/v1/reporting/kpis/', { params: module ? { module } : {} }),
  createKPI: (data: Partial<KPI>) => apiClient.post<{ data: KPI }>('/api/v1/reporting/kpis/', data),
  updateKPIValue: (id: number, value: number) => apiClient.post(`/api/v1/reporting/kpis/${id}/update_value/`, { value }),
  getKPISummary: () => apiClient.get<{ data: KPISummary }>('/api/v1/reporting/kpis/summary/'),

  // Scheduled Reports
  getScheduled: () => apiClient.get<{ data: ScheduledReport[] }>('/api/v1/reporting/scheduled/'),
  createScheduled: (data: Partial<ScheduledReport>) => apiClient.post<{ data: ScheduledReport }>('/api/v1/reporting/scheduled/', data),
  deleteScheduled: (id: number) => apiClient.delete(`/api/v1/reporting/scheduled/${id}/`),
};
