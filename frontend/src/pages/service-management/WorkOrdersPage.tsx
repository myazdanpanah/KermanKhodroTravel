import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Wrench, ChevronDown,
} from 'lucide-react';
import { serviceManagementApi, WorkOrder } from '../../api/serviceManagement';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  created: { label: 'ایجاد شده', color: 'bg-nx-mist/10 text-nx-navy dark:bg-nx-navy dark:text-nx-mist' },
  assigned: { label: 'تخصیص یافته', color: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue dark:text-nx-blue' },
  started: { label: 'شروع شده', color: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue dark:text-nx-blue' },
  paused: { label: 'متوقف', color: 'bg-nx-warning-100 text-nx-warning-700 dark:bg-nx-warning-900 dark:text-nx-warning-300' },
  completed: { label: 'تکمیل شده', color: 'bg-nx-teal/10 text-nx-teal dark:bg-nx-teal dark:text-nx-teal' },
  approved: { label: 'تأیید شده', color: 'bg-nx-teal/10 text-nx-teal dark:bg-nx-teal dark:text-nx-teal' },
  closed: { label: 'بسته شده', color: 'bg-nx-mist/10 text-nx-navy dark:bg-nx-navy dark:text-nx-mist' },
};

import { useToast } from '../../components/Toast';

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    serviceManagementApi.getWorkOrders(params)
      .then(res => setOrders(res.data.data))
      .catch(() => toast('خطا در دریافت دستور کارها', 'error'))
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
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Wrench className="h-6 w-6 text-nx-blue" />
            دستور کارها
          </h1>
          <p className="text-sm text-nx-mist dark:text-nx-mist mt-1">
            {filtered.length} دستور کار
          </p>
        </div>
        <button
          onClick={() => navigate('/erp/service-management/work-orders/new')}
          className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition-colors"
        >
          <Plus className="h-4 w-4" />
          دستور کار جدید
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
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-nx-mist dark:text-nx-mist">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>هیچ دستور کاری یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">شماره</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">درخواست</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">تکنسین</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">هزینه تخمینی</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist dark:text-nx-mist">هزینه واقعی</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(wo => {
                  const status = STATUS_MAP[wo.status] || STATUS_MAP.created;
                  return (
                    <tr
                      key={wo.id}
                      onClick={() => navigate(`/erp/service-management/work-orders/${wo.id}`)}
                      className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy cursor-pointer transition-colors"
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
