/**
 * Office API client — correspondence, workbench and business links.
 */

import apiClient from './client';

export interface OfficeMetaUser { id: number; name: string; role: string }
export interface OfficeMetaTeam { id: number; name: string; division: string }
export interface OfficeMetaDivision { id: number; name: string }
export interface OfficeOption { value: string; label: string }

export interface OfficeMeta {
  secretariats: { id: number; name: string; code: string; is_active: boolean }[];
  users: OfficeMetaUser[];
  teams: OfficeMetaTeam[];
  divisions: OfficeMetaDivision[];
  types: OfficeOption[];
  statuses: OfficeOption[];
  priorities: OfficeOption[];
  confidentialities: OfficeOption[];
  capabilities: {
    privileged: boolean;
    view_financials: boolean;
    register_secretariat_ids: number[];
  };
}

export interface BusinessRecordDto {
  entity_type: string;
  source_record_id: string;
  display: Record<string, string | number | null>;
  links: Record<string, string>;
  meta: { read_at: string; is_cached: boolean };
}

export interface BusinessLink {
  id: number;
  entity_type: string;
  source_record_id: string;
  relationship_type: string;
  label: string;
  state: 'ok' | 'unavailable';
  error?: string;
  record?: BusinessRecordDto;
}

export interface Attachment {
  id: number;
  original_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: number | null;
  uploaded_by_name: string;
  created_at: string;
}

export interface Letter {
  id: number;
  registration_number: string | null;
  registration_status: string;
  correspondence_type: string;
  subject: string;
  priority: string;
  confidentiality: string;
  current_status: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  secretariat: number | null;
  secretariat_name: string;
  owner: number | null;
  owner_name: string;
  sender_display: string;
  archived_at: string | null;
  letter_date_jalali: string;
  body?: string;
  sender_type?: string;
  sender_user?: number | null;
  sender_name?: string;
  sender_organization?: string;
  sender_email?: string;
  letter_date?: string | null;
  received_at?: string | null;
  registered_at?: string | null;
  registered_by?: number | null;
  registered_by_name?: string;
  parent_correspondence?: number | null;
  parent_subject?: string;
  recipients?: {
    id: number; recipient_type: string; recipient_user: number | null; user_name: string;
    recipient_team: number | null; team_name: string; recipient_division: number | null;
    division_name: string; external_name: string; delivery_type: string; delivery_status: string;
  }[];
  routes?: {
    id: number; from_user_name: string; to_user_name: string; route_type: string;
    instruction: string; assigned_at: string; due_at: string | null; route_status: string;
  }[];
  comments?: { id: number; author_name: string; body: string; created_at: string }[];
  actions?: { id: number; actor_name: string; action: string; note: string; created_at: string }[];
  business_links?: BusinessLink[];
  attachments?: Attachment[];
  can_edit?: boolean;
}

export interface SecretariatInfo {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  members: { id: number; user: number; user_name: string; can_register: boolean }[];
}

export interface WorkbenchSummary {
  buckets: Record<string, number>;
  generated_at: string;
}

export interface TimelineEvent {
  kind: string;
  action: string;
  actor: string;
  note: string;
  metadata: Record<string, unknown>;
  at: string;
}

export const officeApi = {
  getMeta: () => apiClient.get<{ data: OfficeMeta }>('/office/meta/'),
  getWorkbench: () => apiClient.get<{ data: WorkbenchSummary }>('/office/workbench/'),
  getWorkbenchList: (bucket: string) =>
    apiClient.get<{ data: Letter[] }>('/office/workbench/list/', { params: { bucket } }),
  getLetters: (params?: Record<string, string>) =>
    apiClient.get<{ data: Letter[] }>('/office/correspondence/', { params }),
  createLetter: (payload: Record<string, unknown>) =>
    apiClient.post<{ data: Letter }>('/office/correspondence/', payload),
  getLetter: (id: number) => apiClient.get<{ data: Letter }>(`/office/correspondence/${id}/`),
  updateLetter: (id: number, payload: Record<string, unknown>) =>
    apiClient.patch<{ data: Letter }>(`/office/correspondence/${id}/`, payload),
  registerLetter: (id: number) =>
    apiClient.post<{ data: Letter }>(`/office/correspondence/${id}/register/`, {}),
  referLetter: (id: number, payload: Record<string, unknown>) =>
    apiClient.post<{ data: Letter }>(`/office/correspondence/${id}/refer/`, payload),
  replyLetter: (id: number, payload: { body: string; subject?: string }) =>
    apiClient.post<{ data: Letter }>(`/office/correspondence/${id}/reply/`, payload),
  archiveLetter: (id: number) =>
    apiClient.post<{ data: Letter }>(`/office/correspondence/${id}/archive/`, {}),
  uploadAttachment: (id: number, form: FormData) =>
    apiClient.post<{ data: Attachment }>(`/office/correspondence/${id}/attachments/`, form),
  deleteAttachment: (id: number, attachmentId: number) =>
    apiClient.delete(`/office/correspondence/${id}/attachments/${attachmentId}/`),
  downloadAttachment: (id: number, attachmentId: number) =>
    apiClient.get<Blob>(`/office/correspondence/${id}/attachments/${attachmentId}/download/`, {
      responseType: 'blob',
    }),
  addComment: (id: number, body: string) =>
    apiClient.post(`/office/correspondence/${id}/comments/`, { body }),
  getTimeline: (id: number) =>
    apiClient.get<{ data: TimelineEvent[] }>(`/office/correspondence/${id}/timeline/`),
  addBusinessLink: (id: number, payload: Record<string, unknown>) =>
    apiClient.post<{ data: BusinessLink[] }>(`/office/correspondence/${id}/business-links/`, payload),
  deleteBusinessLink: (id: number, linkId: number) =>
    apiClient.delete(`/office/correspondence/${id}/business-links/${linkId}/`),
  searchBusiness: (entityType: string, q: string) =>
    apiClient.get<{ data: { id: string; label: string; sublabel: string }[] }>(
      '/office/integrations/business/search/',
      { params: { entity_type: entityType, q } },
    ),
  getIntegrationHealth: () => apiClient.get('/office/integrations/business/health/'),
  getSecretariats: () => apiClient.get<{ data: SecretariatInfo[] }>('/office/secretariats/'),
  createSecretariat: (payload: { name: string; code: string }) =>
    apiClient.post<{ data: SecretariatInfo }>('/office/secretariats/', payload),
  addSecretariatMember: (id: number, payload: { user_id: number; can_register: boolean }) =>
    apiClient.post(`/office/secretariats/${id}/members/`, payload),
  removeSecretariatMember: (id: number, memberId: number) =>
    apiClient.delete(`/office/secretariats/${id}/members/`, { data: { member_id: memberId } }),
};
