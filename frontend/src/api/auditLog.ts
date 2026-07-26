/**
 * Audit Log API Client
 */
import apiClient from './client'

export interface AuditLogEntry {
  id: number
  action: 'create' | 'update' | 'delete' | 'view'
  timestamp: string
  user: number | null
  user_display: string
  ip_address: string
  user_agent: string
  content_type: number | null
  content_type_display: string
  object_id: string
  description: string
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  changed_fields: string[]
  module: string
  company: number
  metadata: Record<string, unknown>
}

export interface AuditLogSummary {
  total_entries: number
  entries_today: number
  entries_by_action: Record<string, number>
  entries_by_module: Record<string, number>
  recent_users: Array<{ user__username: string; count: number }>
  daily_trend: Array<{ date: string; count: number }>
}

export interface AuditLogConfig {
  id: number
  content_type: number
  content_type_display: string
  is_enabled: boolean
  track_fields: string[]
  exclude_fields: string[]
  capture_snapshots: boolean
  created_at: string
}

export const auditApi = {
  // Entries
  getEntries: (params?: Record<string, string>) =>
    apiClient.get<{ results: AuditLogEntry[] }>('/api/v1/audit/entries/', { params }),
  getEntry: (id: number) => apiClient.get<AuditLogEntry>(`/api/v1/audit/entries/${id}/`),

  // Summary
  getSummary: () => apiClient.get<AuditLogSummary>('/api/v1/audit/summary/'),

  // Config
  getConfigs: () => apiClient.get<AuditLogConfig[]>('/api/v1/audit/config/'),
  createConfig: (data: Partial<AuditLogConfig>) => apiClient.post<AuditLogConfig>('/api/v1/audit/config/', data),
  updateConfig: (id: number, data: Partial<AuditLogConfig>) =>
    apiClient.put<AuditLogConfig>(`/api/v1/audit/config/${id}/`, data),
  deleteConfig: (id: number) => apiClient.delete(`/api/v1/audit/config/${id}/`),
}
