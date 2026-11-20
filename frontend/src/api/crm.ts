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
    apiClient.get<{ data: CRMSummary }>('/api/v1/crm/summary/'),

  // Leads
  getLeads: (params?: Record<string, string>) =>
    apiClient.get<{ data: Lead[] }>('/api/v1/crm/leads/', { params }),
  getLead: (id: number) =>
    apiClient.get<{ data: Lead }>(`/api/v1/crm/leads/${id}/`),
  createLead: (data: Partial<Lead>) =>
    apiClient.post<{ data: Lead }>('/api/v1/crm/leads/', data),
  updateLead: (id: number, data: Partial<Lead>) =>
    apiClient.put<{ data: Lead }>(`/api/v1/crm/leads/${id}/`, data),
  deleteLead: (id: number) =>
    apiClient.delete(`/api/v1/crm/leads/${id}/`),
  convertLead: (id: number) =>
    apiClient.post(`/api/v1/crm/leads/${id}/convert/`),

  // Opportunities
  getOpportunities: (params?: Record<string, string>) =>
    apiClient.get<{ data: Opportunity[] }>('/api/v1/crm/opportunities/', { params }),
  getOpportunity: (id: number) =>
    apiClient.get<{ data: Opportunity }>(`/api/v1/crm/opportunities/${id}/`),
  createOpportunity: (data: Partial<Opportunity>) =>
    apiClient.post<{ data: Opportunity }>('/api/v1/crm/opportunities/', data),
  updateOpportunity: (id: number, data: Partial<Opportunity>) =>
    apiClient.put<{ data: Opportunity }>(`/api/v1/crm/opportunities/${id}/`, data),
  deleteOpportunity: (id: number) =>
    apiClient.delete(`/api/v1/crm/opportunities/${id}/`),
  moveOpportunity: (id: number, status: string) =>
    apiClient.post<{ data: Opportunity }>(`/api/v1/crm/opportunities/${id}/move/`, { status }),
  closeWon: (id: number) =>
    apiClient.post(`/api/v1/crm/opportunities/${id}/close-won/`),
  closeLost: (id: number, reason?: string) =>
    apiClient.post(`/api/v1/crm/opportunities/${id}/close-lost/`, { reason }),

  // Activities
  getActivities: (params?: Record<string, string>) =>
    apiClient.get<{ data: Activity[] }>('/api/v1/crm/activities/', { params }),
  getActivity: (id: number) =>
    apiClient.get<{ data: Activity }>(`/api/v1/crm/activities/${id}/`),
  createActivity: (data: Partial<Activity> & { opportunity_id?: number }) =>
    apiClient.post<{ data: Activity }>('/api/v1/crm/activities/', data),
  updateActivity: (id: number, data: Partial<Activity>) =>
    apiClient.put<{ data: Activity }>(`/api/v1/crm/activities/${id}/`, data),
  deleteActivity: (id: number) =>
    apiClient.delete(`/api/v1/crm/activities/${id}/`),
  completeActivity: (id: number, outcome?: string) =>
    apiClient.post(`/api/v1/crm/activities/${id}/complete/`, { outcome }),

  // Campaigns
  getCampaigns: () =>
    apiClient.get<{ data: Campaign[] }>('/api/v1/crm/campaigns/'),
  getCampaign: (id: number) =>
    apiClient.get<{ data: Campaign }>(`/api/v1/crm/campaigns/${id}/`),
  createCampaign: (data: Partial<Campaign>) =>
    apiClient.post<{ data: Campaign }>('/api/v1/crm/campaigns/', data),
  updateCampaign: (id: number, data: Partial<Campaign>) =>
    apiClient.put<{ data: Campaign }>(`/api/v1/crm/campaigns/${id}/`, data),
  deleteCampaign: (id: number) =>
    apiClient.delete(`/api/v1/crm/campaigns/${id}/`),

  // Tasks
  getTasks: (params?: Record<string, string>) =>
    apiClient.get<{ data: CRMTask[] }>('/api/v1/crm/tasks/', { params }),
  getTask: (id: number) =>
    apiClient.get<{ data: CRMTask }>(`/api/v1/crm/tasks/${id}/`),
  createTask: (data: Partial<CRMTask> & { opportunity_id?: number }) =>
    apiClient.post<{ data: CRMTask }>('/api/v1/crm/tasks/', data),
  updateTask: (id: number, data: Partial<CRMTask>) =>
    apiClient.put<{ data: CRMTask }>(`/api/v1/crm/tasks/${id}/`, data),
  deleteTask: (id: number) =>
    apiClient.delete(`/api/v1/crm/tasks/${id}/`),
  completeTask: (id: number) =>
    apiClient.post(`/api/v1/crm/tasks/${id}/complete/`),

  // Timeline
  getTimeline: (customerId: number) =>
    apiClient.get(`/api/v1/crm/timeline/${customerId}/`),
};
