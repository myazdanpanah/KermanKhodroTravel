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
  new: { label: 'جدید', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: Clock },
  assigned: { label: 'تخصیص یافته', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: Users },
  in_progress: { label: 'در حال انجام', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: Wrench },
  waiting_customer: { label: 'در انتظار مشتری', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Clock },
  waiting_parts: { label: 'در انتظار قطعات', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', icon: AlertTriangle },
  completed: { label: 'تکمیل شده', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  closed: { label: 'بسته شده', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300', icon: XCircle },
  cancelled: { label: 'لغو شده', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: XCircle },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: 'کم', color: 'text-gray-500' },
  medium: { label: 'متوسط', color: 'text-blue-500' },
  high: { label: 'زیاد', color: 'text-orange-500' },
  critical: { label: 'بحرانی', color: 'text-red-600 font-bold' },
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Headphones className="h-6 w-6 text-orange-500" />
            درخواست‌های خدمات
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filtered.length} درخواست
          </p>
        </div>
        <button
          onClick={() => navigate('/erp/service-management/requests/new')}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          درخواست جدید
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="جستجو..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pr-8 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(STATUS_MAP).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="appearance-none pr-8 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="">همه اولویت‌ها</option>
            {Object.entries(PRIORITY_MAP).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Headphones className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>هیچ درخواستی یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">شماره</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">مشتری</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">محصول</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">اولویت</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">تاریخ</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">SLA</th>
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
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
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
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(req.created_at).toLocaleDateString('fa-IR')}
                      </td>
                      <td className="px-4 py-3">
                        {req.sla_response_met === false && (
                          <span className="text-red-500 text-xs font-medium">⚠ نقض</span>
                        )}
                        {req.sla_response_met === true && (
                          <span className="text-green-500 text-xs">✓</span>
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
