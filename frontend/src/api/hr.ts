/**
 * HR API Client
 */
import apiClient from './client';

export interface Department { id: number; name: string; code: string; description: string; parent: number | null; manager: number | null; is_active: boolean; }
export interface Employee { id: number; employee_id: string; first_name: string; last_name: string; full_name: string; department: number | null; position: string; hire_date: string; status: string; employment_type: string; base_salary: number; currency: string; phone: string; email: string; }
export interface Attendance { id: number; employee: number; employee_name: string; date: string; check_in: string | null; check_out: string | null; status: string; overtime_hours: number; }
export interface LeaveType { id: number; name: string; code: string; default_days: number; is_paid: boolean; }
export interface LeaveRequest { id: number; employee: number; employee_name: string; leave_type: number; leave_type_name: string; start_date: string; end_date: string; days: number; reason: string; status: string; }
export interface PayrollPeriod { id: number; name: string; start_date: string; end_date: string; status: string; }
export interface PayrollRecord { id: number; period: number; employee: number; employee_name: string; base_salary: number; total_earnings: number; total_deductions: number; net_pay: number; status: string; }
export interface PerformanceEvaluation { id: number; employee: number; employee_name: string; evaluation_date: string; period_label: string; overall_score: number; productivity_score: number; quality_score: number; teamwork_score: number; }
export interface Recruitment { id: number; title: string; department: number | null; status: string; positions_count: number; posted_date: string | null; }
export interface Candidate { id: number; recruitment: number; first_name: string; last_name: string; full_name: string; email: string; status: string; }
export interface HRSummary { total: number; active: number; on_leave: number; terminated: number; departments: number; }

export const hrApi = {
  getSummary: () => apiClient.get<{ data: HRSummary }>('/api/v1/hr/summary/'),
  // Departments
  getDepartments: () => apiClient.get<{ data: Department[] }>('/api/v1/hr/departments/'),
  createDepartment: (data: Partial<Department>) => apiClient.post<{ data: Department }>('/api/v1/hr/departments/', data),
  updateDepartment: (id: number, data: Partial<Department>) => apiClient.put<{ data: Department }>(`/api/v1/hr/departments/${id}/`, data),
  deleteDepartment: (id: number) => apiClient.delete(`/api/v1/hr/departments/${id}/`),
  // Employees
  getEmployees: (params?: Record<string, string>) => apiClient.get<{ data: Employee[] }>('/api/v1/hr/employees/', { params }),
  getEmployee: (id: number) => apiClient.get<{ data: Employee }>(`/api/v1/hr/employees/${id}/`),
  createEmployee: (data: Partial<Employee>) => apiClient.post<{ data: Employee }>('/api/v1/hr/employees/', data),
  updateEmployee: (id: number, data: Partial<Employee>) => apiClient.put<{ data: Employee }>(`/api/v1/hr/employees/${id}/`, data),
  deleteEmployee: (id: number) => apiClient.delete(`/api/v1/hr/employees/${id}/`),
  // Attendance
  getAttendance: (params?: Record<string, string>) => apiClient.get<{ data: Attendance[] }>('/api/v1/hr/attendance/', { params }),
  checkInOut: (employeeId: number, action: string) => apiClient.post<{ data: Attendance }>('/api/v1/hr/attendance/', { employee_id: employeeId, action }),
  // Leave
  getLeaveTypes: () => apiClient.get<{ data: LeaveType[] }>('/api/v1/hr/leave-types/'),
  createLeaveType: (data: Partial<LeaveType>) => apiClient.post<{ data: LeaveType }>('/api/v1/hr/leave-types/', data),
  getLeaveRequests: (params?: Record<string, string>) => apiClient.get<{ data: LeaveRequest[] }>('/api/v1/hr/leave-requests/', { params }),
  createLeaveRequest: (data: Partial<LeaveRequest>) => apiClient.post<{ data: LeaveRequest }>('/api/v1/hr/leave-requests/', data),
  approveLeave: (id: number) => apiClient.post(`/api/v1/hr/leave-requests/${id}/approve/`),
  rejectLeave: (id: number, reason?: string) => apiClient.post(`/api/v1/hr/leave-requests/${id}/reject/`, { reason }),
  // Payroll
  getPayrollPeriods: () => apiClient.get<{ data: PayrollPeriod[] }>('/api/v1/hr/payroll-periods/'),
  createPayrollPeriod: (data: Partial<PayrollPeriod>) => apiClient.post<{ data: PayrollPeriod }>('/api/v1/hr/payroll-periods/', data),
  generatePayroll: (periodId: number) => apiClient.post(`/api/v1/hr/payroll-periods/${periodId}/generate/`),
  getPayrollRecords: (params?: Record<string, string>) => apiClient.get<{ data: PayrollRecord[] }>('/api/v1/hr/payroll-records/', { params }),
  // Evaluations
  getEvaluations: () => apiClient.get<{ data: PerformanceEvaluation[] }>('/api/v1/hr/evaluations/'),
  createEvaluation: (data: Partial<PerformanceEvaluation>) => apiClient.post<{ data: PerformanceEvaluation }>('/api/v1/hr/evaluations/', data),
  // Recruitment
  getRecruitments: () => apiClient.get<{ data: Recruitment[] }>('/api/v1/hr/recruitments/'),
  createRecruitment: (data: Partial<Recruitment>) => apiClient.post<{ data: Recruitment }>('/api/v1/hr/recruitments/', data),
  getCandidates: (recruitmentId: number) => apiClient.get<{ data: Candidate[] }>(`/api/v1/hr/recruitments/${recruitmentId}/candidates/`),
  addCandidate: (recruitmentId: number, data: Partial<Candidate>) => apiClient.post<{ data: Candidate }>(`/api/v1/hr/recruitments/${recruitmentId}/candidates/`, data),
};
