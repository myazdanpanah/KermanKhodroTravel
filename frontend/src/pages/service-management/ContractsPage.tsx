import { useToast } from '../../components/Toast';
/**
 * Service Contracts Page
 * Per UI_UX_GUIDELINES.md §7: Table design.
 */

import { useState, useEffect } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import { serviceManagementApi, ServiceContract } from '../../api/serviceManagement';

const TYPE_MAP: Record<string, string> = {
  maintenance: 'قرارداد نگهداری',
  support: 'قرارداد پشتیبانی',
  amc: 'قرارداد AMC',
  subscription: 'اشتراک خدمات',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'پیش‌نویس', color: 'bg-nx-mist/10 text-nx-navy dark:bg-nx-navy dark:text-nx-mist' },
  active: { label: 'فعال', color: 'bg-nx-teal/10 text-nx-teal dark:bg-nx-teal dark:text-nx-teal' },
  expired: { label: 'منقضی', color: 'bg-nx-danger-100 text-nx-danger-700 dark:bg-nx-danger-900 dark:text-nx-danger-300' },
  cancelled: { label: 'لغو شده', color: 'bg-nx-mist/10 text-nx-navy dark:bg-nx-navy dark:text-nx-mist' },
};

export default function ContractsPage() {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_id: 0, contract_type: 'maintenance', start_date: '', end_date: '',
    coverage_description: '', sla_level: 'standard', price: 0, billing_cycle: 'monthly',
  });

  useEffect(() => {
    serviceManagementApi.getContracts()
      .then(res => setContracts(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = contracts.filter(c =>
    !search || c.contract_number.includes(search) || c.customer_name?.includes(search)
  );

  const handleCreate = async () => {
    if (!form.customer_id || !form.start_date || !form.end_date) return;
    try {
      const res = await serviceManagementApi.createContract(form as any);
      setContracts(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ customer_id: 0, contract_type: 'maintenance', start_date: '', end_date: '', coverage_description: '', sla_level: 'standard', price: 0, billing_cycle: 'monthly' });
    } catch { toast("خطا", "error"); }
  };

  const handleActivate = async (id: number) => {
    try {
      const res = await serviceManagementApi.activateContract(id);
      setContracts(prev => prev.map(c => c.id === id ? res.data.data : c));
    } catch { toast("خطا", "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <FileText className="h-6 w-6 text-nx-teal" />
            قراردادهای خدماتی
          </h1>
          <p className="text-sm text-nx-mist dark:text-nx-mist mt-1">{filtered.length} قرارداد</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition-colors"
        >
          <Plus className="h-4 w-4" />
          قرارداد جدید
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <h3 className="text-lg font-semibold text-nx-navy dark:text-white mb-4">قرارداد جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">شناسه مشتری *</label>
              <input type="number" value={form.customer_id || ''} onChange={e => setForm({ ...form, customer_id: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">نوع قرارداد</label>
              <select value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
                {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">سطح SLA</label>
              <select value={form.sla_level} onChange={e => setForm({ ...form, sla_level: e.target.value })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
                <option value="standard">استاندارد</option>
                <option value="premium">پریمیوم</option>
                <option value="critical">بحرانی</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">تاریخ شروع *</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">تاریخ پایان *</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">قیمت (ریال)</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-nx-mist">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue text-sm">ایجاد</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-nx-mist dark:text-nx-mist">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>هیچ قراردادی یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">شماره</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">مشتری</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">نوع</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">سطح SLA</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">شروع</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">پایان</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const status = STATUS_MAP[c.status] || STATUS_MAP.draft;
                  return (
                    <tr key={c.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
                      <td className="px-4 py-3 font-mono text-xs">{c.contract_number}</td>
                      <td className="px-4 py-3">{c.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-xs">{TYPE_MAP[c.contract_type] || c.contract_type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{c.sla_level}</td>
                      <td className="px-4 py-3 text-xs">{c.start_date}</td>
                      <td className="px-4 py-3 text-xs">{c.end_date}</td>
                      <td className="px-4 py-3">
                        {c.status === 'draft' && (
                          <button onClick={() => handleActivate(c.id)}
                            className="text-nx-teal hover:text-nx-teal text-xs">فعال‌سازی</button>
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
