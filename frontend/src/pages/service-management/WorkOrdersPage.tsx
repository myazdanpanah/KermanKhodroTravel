import { useToast } from '../../components/Toast';
const { toast } = useToast();
/**
 * Work Orders List Page
 * Per UI_UX_GUIDELINES.md §7: Table design.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Wrench, ChevronDown,
} from 'lucide-react';
import { serviceManagementApi, WorkOrder } from '../../api/serviceManagement';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  created: { label: 'ایجاد شده', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
  assigned: { label: 'تخصیص یافته', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  started: { label: 'شروع شده', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  paused: { label: 'متوقف', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  completed: { label: 'تکمیل شده', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  approved: { label: 'تأیید شده', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300' },
  closed: { label: 'بسته شده', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
};

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    serviceManagementApi.getWorkOrders(params)
      .then(res => setOrders(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = orders.filter(o =>
    !search || o.work_order_number.includes(search) ||
    o.service_request_number?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Wrench className="h-6 w-6 text-orange-500" />
            دستور کارها
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filtered.length} دستور کار
          </p>
        </div>
        <button
          onClick={() => navigate('/erp/service-management/work-orders/new')}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          دستور کار جدید
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
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>هیچ دستور کاری یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">شماره</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">درخواست</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">تکنسین</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">هزینه تخمینی</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">هزینه واقعی</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(wo => {
                  const status = STATUS_MAP[wo.status] || STATUS_MAP.created;
                  return (
                    <tr
                      key={wo.id}
                      onClick={() => navigate(`/erp/service-management/work-orders/${wo.id}`)}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{wo.work_order_number}</td>
                      <td className="px-4 py-3 text-xs">{wo.service_request_number}</td>
                      <td className="px-4 py-3">{wo.technician_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{wo.estimated_cost.toLocaleString('fa-IR')} ریال</td>
                      <td className="px-4 py-3 text-xs font-semibold">{wo.actual_total_cost.toLocaleString('fa-IR')} ریال</td>
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
