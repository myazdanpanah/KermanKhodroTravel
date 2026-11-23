/**
 * CRM API Client
 */

import apiClient from './client';

export interface Lead {
  id: number;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  address: string;
  status: string;
  source: string;
  priority: string;
  industry: string;
  employees_count: number | null;
  annual_revenue: number | null;
  currency: string;
  assigned_to: number | null;
  converted_customer: number | null;
  converted_at: string | null;
  score: number;
  notes: string;
  campaign: number | null;
  campaign_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: number;
  name: string;
  customer: number | null;
  customer_name: string;
  lead: number | null;
  status: string;
  stage: string;
  priority: string;
  estimated_value: number;
  probability: number;
  weighted_value: number;
  currency: string;
  expected_close_date: string | null;
  actual_close_date: string | null;
  assigned_to: number | null;
  source: string;
  campaign: number | null;
  description: string;
  loss_reason: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  activity_type: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  lead: number | null;
  opportunity: number | null;
  customer: number | null;
  due_date: string | null;
  completed_at: string | null;
  duration_minutes: number;
  assigned_to: number | null;
  outcome: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  campaign_type: string;
  status: string;
  description: string;
  budget: number;
  actual_cost: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  expected_leads: number;
  actual_leads: number;
  expected_revenue: number;
  actual_revenue: number;
  assigned_to: number | null;
  notes: string;
  roi: number;
  created_at: string;
  updated_at: string;
}

export interface CRMTask {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  lead: number | null;
  opportunity: number | null;
  customer: number | null;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
}

export interface CRMSummary {
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    lost: number;
  };
  pipeline: {
    total_opportunities: number;
    total_value: number;
    weighted_value: number;
    by_stage: Record<string, number>;
    won_count: number;
    won_value: number;
    lost_count: number;
  };
}

export const crmApi = {
  getSummary: () =>
    apiClient.get<{ data: CRMSummary }>('/crm/summary/'),

  // Leads
  getLeads: (params?: Record<string, string>) =>
    apiClient.get<{ data: Lead[] }>('/crm/leads/', { params }),
  getLead: (id: number) =>
    apiClient.get<{ data: Lead }>(`/crm/leads/${id}/`),
  createLead: (data: Partial<Lead>) =>
    apiClient.post<{ data: Lead }>('/crm/leads/', data),
  updateLead: (id: number, data: Partial<Lead>) =>
    apiClient.put<{ data: Lead }>(`/crm/leads/${id}/`, data),
  deleteLead: (id: number) =>
    apiClient.delete(`/crm/leads/${id}/`),
  convertLead: (id: number) =>
    apiClient.post(`/crm/leads/${id}/convert/`),

  // Opportunities
  getOpportunities: (params?: Record<string, string>) =>
    apiClient.get<{ data: Opportunity[] }>('/crm/opportunities/', { params }),
  getOpportunity: (id: number) =>
    apiClient.get<{ data: Opportunity }>(`/crm/opportunities/${id}/`),
  createOpportunity: (data: Partial<Opportunity>) =>
    apiClient.post<{ data: Opportunity }>('/crm/opportunities/', data),
  updateOpportunity: (id: number, data: Partial<Opportunity>) =>
    apiClient.put<{ data: Opportunity }>(`/crm/opportunities/${id}/`, data),
  deleteOpportunity: (id: number) =>
    apiClient.delete(`/crm/opportunities/${id}/`),
  moveOpportunity: (id: number, status: string) =>
    apiClient.post<{ data: Opportunity }>(`/crm/opportunities/${id}/move/`, { status }),
  closeWon: (id: number) =>
    apiClient.post(`/crm/opportunities/${id}/close-won/`),
  closeLost: (id: number, reason?: string) =>
    apiClient.post(`/crm/opportunities/${id}/close-lost/`, { reason }),

  // Activities
  getActivities: (params?: Record<string, string>) =>
    apiClient.get<{ data: Activity[] }>('/crm/activities/', { params }),
  getActivity: (id: number) =>
    apiClient.get<{ data: Activity }>(`/crm/activities/${id}/`),
  createActivity: (data: Partial<Activity> & { opportunity_id?: number }) =>
    apiClient.post<{ data: Activity }>('/crm/activities/', data),
  updateActivity: (id: number, data: Partial<Activity>) =>
    apiClient.put<{ data: Activity }>(`/crm/activities/${id}/`, data),
  deleteActivity: (id: number) =>
    apiClient.delete(`/crm/activities/${id}/`),
  completeActivity: (id: number, outcome?: string) =>
    apiClient.post(`/crm/activities/${id}/complete/`, { outcome }),

  // Campaigns
  getCampaigns: () =>
    apiClient.get<{ data: Campaign[] }>('/crm/campaigns/'),
  getCampaign: (id: number) =>
    apiClient.get<{ data: Campaign }>(`/crm/campaigns/${id}/`),
  createCampaign: (data: Partial<Campaign>) =>
    apiClient.post<{ data: Campaign }>('/crm/campaigns/', data),
  updateCampaign: (id: number, data: Partial<Campaign>) =>
    apiClient.put<{ data: Campaign }>(`/crm/campaigns/${id}/`, data),
  deleteCampaign: (id: number) =>
    apiClient.delete(`/crm/campaigns/${id}/`),

  // Tasks
  getTasks: (params?: Record<string, string>) =>
    apiClient.get<{ data: CRMTask[] }>('/crm/tasks/', { params }),
  getTask: (id: number) =>
    apiClient.get<{ data: CRMTask }>(`/crm/tasks/${id}/`),
  createTask: (data: Partial<CRMTask> & { opportunity_id?: number }) =>
    apiClient.post<{ data: CRMTask }>('/crm/tasks/', data),
  updateTask: (id: number, data: Partial<CRMTask>) =>
    apiClient.put<{ data: CRMTask }>(`/crm/tasks/${id}/`, data),
  deleteTask: (id: number) =>
    apiClient.delete(`/crm/tasks/${id}/`),
  completeTask: (id: number) =>
    apiClient.post(`/crm/tasks/${id}/complete/`),

  // Timeline
  getTimeline: (customerId: number) =>
    apiClient.get(`/crm/timeline/${customerId}/`),

  // Bulk SMS
  sendBulkSms: (payload: {
    template: string;
    recipients: Array<{
      phone: string;
      variables?: Record<string, string | number>;
      message?: string;
    }>;
    campaign_id?: number | string;
    dry_run?: boolean;
  }) =>
    apiClient.post<{
      success: boolean;
      dry_run?: boolean;
      total: number;
      sent?: number;
      failed?: number;
      results: Array<{
        index: number;
        id?: number;
        phone: string;
        body?: string;
        status?: 'sent' | 'failed';
        error?: string;
        valid?: boolean;
        char_count?: number;
        provider_message_id?: string;
      }>;
    }>('/crm/sms/bulk-send/', payload),
};
