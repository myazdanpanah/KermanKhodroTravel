/**
 * Service Management API Client
 * Per UI_UX_GUIDELINES.md §4: API integration patterns.
 */

import apiClient from './client';

// ─── Service Requests ────────────────────────────────────────

export interface ServiceRequest {
  id: number;
  request_number: string;
  customer: number;
  customer_name: string;
  product_name: string;
  product_code: string;
  serial_number: string;
  problem_description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  assigned_to: number | null;
  assigned_technician: number | null;
  assigned_technician_name: string;
  warranty: number | null;
  warranty_status: string | null;
  received_date: string;
  resolved_date: string | null;
  closed_date: string | null;
  sla_response_deadline: string | null;
  sla_resolution_deadline: string | null;
  sla_response_met: boolean | null;
  sla_resolution_met: boolean | null;
  is_chargeable: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceRequestCreate {
  customer_id: number;
  product_name: string;
  product_code?: string;
  serial_number?: string;
  problem_description: string;
  priority?: string;
  notes?: string;
}

// ─── Warranty ────────────────────────────────────────────────

export interface Warranty {
  id: number;
  customer: number;
  customer_name: string;
  product_name: string;
  product_code: string;
  serial_number: string;
  warranty_type: string;
  status: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ─── Technician ──────────────────────────────────────────────

export interface Technician {
  id: number;
  name: string;
  employee_id: string;
  department: string;
  phone: string;
  skills: string;
  hourly_rate: number;
  is_active: boolean;
  performance_score: number;
  created_at: string;
  updated_at: string;
}

// ─── Work Order ──────────────────────────────────────────────

export interface WorkOrderOperation {
  id: number;
  sequence: number;
  name: string;
  description: string;
  labor_hours: number;
  parts_used: string;
  status: string;
  completed_at: string | null;
}

export interface WorkOrder {
  id: number;
  work_order_number: string;
  service_request: number;
  service_request_number: string;
  technician: number | null;
  technician_name: string;
  problem: string;
  diagnosis: string;
  resolution: string;
  required_parts: string;
  estimated_cost: number;
  actual_labor_cost: number;
  actual_parts_cost: number;
  actual_external_cost: number;
  actual_overhead: number;
  actual_total_cost: number;
  estimated_hours: number;
  actual_hours: number;
  status: string;
  start_date: string | null;
  completed_date: string | null;
  approved_date: string | null;
  operations: WorkOrderOperation[];
  notes: string;
  created_at: string;
  updated_at: string;
}

// ─── Service Contract ────────────────────────────────────────

export interface ServiceContract {
  id: number;
  contract_number: string;
  customer: number;
  customer_name: string;
  contract_type: string;
  status: string;
  start_date: string;
  end_date: string;
  coverage_description: string;
  sla_level: string;
  price: number;
  billing_cycle: string;
  currency: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ─── SLA Rule ────────────────────────────────────────────────

export interface SLARule {
  id: number;
  name: string;
  priority: string;
  response_time_hours: number;
  resolution_time_hours: number;
  working_hours_start: number;
  working_hours_end: number;
  escalate_after_hours: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Maintenance ─────────────────────────────────────────────

export interface MaintenancePlan {
  id: number;
  name: string;
  product_name: string;
  product_code: string;
  maintenance_type: string;
  status: string;
  interval_days: number;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  checklist: string;
  estimated_cost: number;
  assigned_technician: number | null;
  assigned_technician_name: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceSchedule {
  id: number;
  plan: number;
  plan_name: string;
  scheduled_date: string;
  completed_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── Service Feedback ────────────────────────────────────────

export interface ServiceFeedback {
  id: number;
  work_order: number;
  rating: number;
  comment: string;
  created_date: string;
}

// ─── Summary ─────────────────────────────────────────────────

export interface ServiceSummary {
  total: number;
  new: number;
  assigned: number;
  in_progress: number;
  waiting_parts: number;
  completed: number;
  closed: number;
  sla_breaches: number;
  sla: {
    total_open: number;
    breaches: Array<{ type: string; request: string; deadline: string }>;
    breach_count: number;
  };
}

// ─── API Calls ───────────────────────────────────────────────

export const serviceManagementApi = {
  // Summary
  getSummary: () =>
    apiClient.get<{ data: ServiceSummary }>('/api/v1/service-management/summary/'),

  // Service Requests
  getServiceRequests: (params?: Record<string, string>) =>
    apiClient.get<{ data: ServiceRequest[] }>('/api/v1/service-management/requests/', { params }),
  getServiceRequest: (id: number) =>
    apiClient.get<{ data: ServiceRequest }>(`/api/v1/service-management/requests/${id}/`),
  createServiceRequest: (data: ServiceRequestCreate) =>
    apiClient.post<{ data: ServiceRequest }>('/api/v1/service-management/requests/', data),
  updateServiceRequest: (id: number, data: Partial<ServiceRequest>) =>
    apiClient.put<{ data: ServiceRequest }>(`/api/v1/service-management/requests/${id}/`, data),
  deleteServiceRequest: (id: number) =>
    apiClient.delete(`/api/v1/service-management/requests/${id}/`),
  assignTechnician: (id: number, technicianId: number) =>
    apiClient.post<{ data: ServiceRequest }>(`/api/v1/service-management/requests/${id}/assign/`, { technician_id: technicianId }),
  transitionRequest: (id: number, newStatus: string) =>
    apiClient.post<{ data: ServiceRequest }>(`/api/v1/service-management/requests/${id}/transition/`, { status: newStatus }),

  // Warranties
  getWarranties: (params?: Record<string, string>) =>
    apiClient.get<{ data: Warranty[] }>('/api/v1/service-management/warranties/', { params }),
  getWarranty: (id: number) =>
    apiClient.get<{ data: Warranty }>(`/api/v1/service-management/warranties/${id}/`),
  createWarranty: (data: Partial<Warranty>) =>
    apiClient.post<{ data: Warranty }>('/api/v1/service-management/warranties/', data),
  validateWarranty: (serialNumber: string) =>
    apiClient.post<{ data: { covered: boolean; reason: string } }>('/api/v1/service-management/warranties/validate/', { serial_number: serialNumber }),

  // Technicians
  getTechnicians: (params?: Record<string, string>) =>
    apiClient.get<{ data: Technician[] }>('/api/v1/service-management/technicians/', { params }),
  getTechnician: (id: number) =>
    apiClient.get<{ data: Technician }>(`/api/v1/service-management/technicians/${id}/`),
  createTechnician: (data: Partial<Technician>) =>
    apiClient.post<{ data: Technician }>('/api/v1/service-management/technicians/', data),
  updateTechnician: (id: number, data: Partial<Technician>) =>
    apiClient.put<{ data: Technician }>(`/api/v1/service-management/technicians/${id}/`, data),
  deleteTechnician: (id: number) =>
    apiClient.delete(`/api/v1/service-management/technicians/${id}/`),

  // Work Orders
  getWorkOrders: (params?: Record<string, string>) =>
    apiClient.get<{ data: WorkOrder[] }>('/api/v1/service-management/work-orders/', { params }),
  getWorkOrder: (id: number) =>
    apiClient.get<{ data: WorkOrder }>(`/api/v1/service-management/work-orders/${id}/`),
  createWorkOrder: (data: { service_request_id: number; technician_id?: number; problem?: string; estimated_cost?: number; estimated_hours?: number }) =>
    apiClient.post<{ data: WorkOrder }>('/api/v1/service-management/work-orders/', data),
  updateWorkOrder: (id: number, data: Partial<WorkOrder>) =>
    apiClient.put<{ data: WorkOrder }>(`/api/v1/service-management/work-orders/${id}/`, data),
  startWorkOrder: (id: number) =>
    apiClient.post<{ data: WorkOrder }>(`/api/v1/service-management/work-orders/${id}/start/`),
  completeWorkOrder: (id: number) =>
    apiClient.post<{ data: WorkOrder }>(`/api/v1/service-management/work-orders/${id}/complete/`),
  approveWorkOrder: (id: number) =>
    apiClient.post<{ data: WorkOrder }>(`/api/v1/service-management/work-orders/${id}/approve/`),

  // Contracts
  getContracts: (params?: Record<string, string>) =>
    apiClient.get<{ data: ServiceContract[] }>('/api/v1/service-management/contracts/', { params }),
  getContract: (id: number) =>
    apiClient.get<{ data: ServiceContract }>(`/api/v1/service-management/contracts/${id}/`),
  createContract: (data: Partial<ServiceContract>) =>
    apiClient.post<{ data: ServiceContract }>('/api/v1/service-management/contracts/', data),
  updateContract: (id: number, data: Partial<ServiceContract>) =>
    apiClient.put<{ data: ServiceContract }>(`/api/v1/service-management/contracts/${id}/`, data),
  activateContract: (id: number) =>
    apiClient.post<{ data: ServiceContract }>(`/api/v1/service-management/contracts/${id}/activate/`),

  // SLA Rules
  getSLARules: (params?: Record<string, string>) =>
    apiClient.get<{ data: SLARule[] }>('/api/v1/service-management/sla-rules/', { params }),
  getSLARule: (id: number) =>
    apiClient.get<{ data: SLARule }>(`/api/v1/service-management/sla-rules/${id}/`),
  createSLARule: (data: Partial<SLARule>) =>
    apiClient.post<{ data: SLARule }>('/api/v1/service-management/sla-rules/', data),
  updateSLARule: (id: number, data: Partial<SLARule>) =>
    apiClient.put<{ data: SLARule }>(`/api/v1/service-management/sla-rules/${id}/`, data),
  deleteSLARule: (id: number) =>
    apiClient.delete(`/api/v1/service-management/sla-rules/${id}/`),

  // Maintenance
  getMaintenancePlans: () =>
    apiClient.get<{ data: MaintenancePlan[] }>('/api/v1/service-management/maintenance-plans/'),
  getMaintenancePlan: (id: number) =>
    apiClient.get<{ data: MaintenancePlan }>(`/api/v1/service-management/maintenance-plans/${id}/`),
  createMaintenancePlan: (data: Partial<MaintenancePlan>) =>
    apiClient.post<{ data: MaintenancePlan }>('/api/v1/service-management/maintenance-plans/', data),
  updateMaintenancePlan: (id: number, data: Partial<MaintenancePlan>) =>
    apiClient.put<{ data: MaintenancePlan }>(`/api/v1/service-management/maintenance-plans/${id}/`, data),
  getSchedules: () =>
    apiClient.get<{ data: MaintenanceSchedule[] }>('/api/v1/service-management/maintenance-schedules/'),

  // Feedback
  submitFeedback: (workOrderId: number, rating: number, comment?: string) =>
    apiClient.post<{ data: ServiceFeedback }>('/api/v1/service-management/feedback/', {
      work_order_id: workOrderId,
      rating,
      comment: comment || '',
    }),
};
