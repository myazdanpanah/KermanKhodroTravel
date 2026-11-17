/**
 * Service Requests List Page
 * Per UI_UX_GUIDELINES.md §7: Table design, §8: Form patterns.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Headphones, ChevronDown,
  Clock, Users, Wrench, AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';
import { serviceManagementApi, ServiceRequest } from '../../api/serviceManagement';
import { useToast } from '../../components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  new: { label: 'جدید', color: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue dark:text-nx-blue', icon: Clock },
  assigned: { label: 'تخصیص یافته', color: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue dark:text-nx-blue', icon: Users },
  in_progress: { label: 'در حال انجام', color: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-warning-900 dark:text-nx-warning-300', icon: Wrench },
  waiting_customer: { label: 'در انتظار مشتری', color: 'bg-nx-warning-100 text-nx-warning-700 dark:bg-nx-warning-900 dark:text-nx-warning-300', icon: Clock },
  waiting_parts: { label: 'در انتظار قطعات', color: 'bg-nx-warning-100 text-nx-warning-700 dark:bg-nx-warning-900 dark:text-nx-warning-300', icon: AlertTriangle },
  completed: { label: 'تکمیل شده', color: 'bg-nx-teal/10 text-nx-teal dark:bg-nx-teal dark:text-nx-teal', icon: CheckCircle },
  closed: { label: 'بسته شده', color: 'bg-nx-mist/10 text-nx-navy dark:bg-nx-navy dark:text-nx-mist', icon: XCircle },
  cancelled: { label: 'لغو شده', color: 'bg-nx-danger-100 text-nx-danger-700 dark:bg-nx-danger-900 dark:text-nx-danger-300', icon: XCircle },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: 'کم', color: 'text-nx-mist' },
  medium: { label: 'متوسط', color: 'text-nx-blue' },
  high: { label: 'زیاد', color: 'text-nx-blue' },
  critical: { label: 'بحرانی', color: 'text-nx-danger-600 font-bold' },
};

export default function ServiceRequestsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    serviceManagementApi.getServiceRequests(params)
      .then(res => setRequests(res.data.data))
      .catch(() => toast('خطا در دریافت درخواست‌ها', 'error'))
      .finally(() => setLoading(false));
  }, [statusFilter, priorityFilter]);

  const filtered = requests.filter(r =>
    !search || r.request_number.includes(search) ||
    r.customer_name?.includes(search) ||
    r.product_name.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Headphones className="h-6 w-6 text-nx-blue" />
            درخواست‌های خدمات
          </h1>
          <p className="text-sm text-nx-mist dark:text-nx-mist mt-1">
            {filtered.length} درخواست
          </p>
        </div>
        <button
          onClick={() => navigate('/erp/service-management/requests/new')}
          className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition-colors"
        >
          <Plus className="h-4 w-4" />
          درخواست جدید
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="جستجو..."
            className="w-full pr-10 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pr-8 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm"
          >
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(STATUS_MAP).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="appearance-none pr-8 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm"
          >
            <option value="">همه اولویت‌ها</option>
            {Object.entries(PRIORITY_MAP).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-nx-mist dark:text-nx-mist">
            <Headphones className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>هیچ درخواستی یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">شماره</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">مشتری</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">محصول</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">اولویت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">تاریخ</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">SLA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(req => {
                  const status = STATUS_MAP[req.status] || STATUS_MAP.new;
                  const priority = PRIORITY_MAP[req.priority] || PRIORITY_MAP.medium;
                  const StatusIcon = status.icon;
                  return (
                    <tr
                      key={req.id}
                      onClick={() => navigate(`/erp/service-management/requests/${req.id}`)}
                      className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{req.request_number}</td>
                      <td className="px-4 py-3">{req.customer_name || '—'}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate">{req.product_name}</td>
                      <td className={`px-4 py-3 ${priority.color}`}>{priority.label}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-nx-mist dark:text-nx-mist">
                        {new Date(req.created_at).toLocaleDateString('fa-IR')}
                      </td>
                      <td className="px-4 py-3">
                        {req.sla_response_met === false && (
                          <span className="text-nx-danger-500 text-xs font-medium">⚠ نقض</span>
                        )}
                        {req.sla_response_met === true && (
                          <span className="text-nx-teal text-xs">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
