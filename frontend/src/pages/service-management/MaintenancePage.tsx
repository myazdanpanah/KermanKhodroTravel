/**
 * Maintenance Plans Page
 * Per UI_UX_GUIDELINES.md §7: Table design.
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Wrench, Calendar, CheckCircle } from 'lucide-react';
import { serviceManagementApi, MaintenancePlan } from '../../api/serviceManagement';

const TYPE_MAP: Record<string, string> = {
  time_based: 'بر اساس زمان',
  usage_based: 'بر اساس مصرف',
  condition_based: 'بر اساس شرایط',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'پیش‌نویس', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
  active: { label: 'فعال', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  paused: { label: 'متوقف', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  completed: { label: 'تکمیل', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
};

export default function MaintenancePage() {
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', product_name: '', maintenance_type: 'time_based', interval_days: 90,
    checklist: '', estimated_cost: 0,
  });

  useEffect(() => {
    serviceManagementApi.getMaintenancePlans()
      .then(res => setPlans(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = plans.filter(p => !search || p.name.includes(search) || p.product_name?.includes(search));

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await serviceManagementApi.createMaintenancePlan(form as any);
      setPlans(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', product_name: '', maintenance_type: 'time_based', interval_days: 90, checklist: '', estimated_cost: 0 });
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Wrench className="h-6 w-6 text-indigo-500" />
            نگهداری پیشگیرانه
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filtered.length} برنامه</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
          <Plus className="h-4 w-4" /> برنامه جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">برنامه نگهداری جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">محصول</label>
              <input type="text" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع نگهداری</label>
              <select value={form.maintenance_type} onChange={e => setForm({ ...form, maintenance_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
                {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">فاصله (روز)</label>
              <input type="number" value={form.interval_days} onChange={e => setForm({ ...form, interval_days: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">هزینه تخمینی (ریال)</label>
              <input type="number" value={form.estimated_cost} onChange={e => setForm({ ...form, estimated_cost: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">چک‌لیست (هر خط یک آیتم)</label>
              <textarea value={form.checklist} onChange={e => setForm({ ...form, checklist: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>هیچ برنامه نگهداری یافت نشد</p>
          </div>
        ) : (
          filtered.map(plan => {
            const status = STATUS_MAP[plan.status] || STATUS_MAP.draft;
            return (
              <div key={plan.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                    {plan.product_name && <p className="text-xs text-gray-500 mt-0.5">{plan.product_name}</p>}
                  </div>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <p>{TYPE_MAP[plan.maintenance_type]} — هر {plan.interval_days} روز</p>
                  {plan.next_maintenance_date && (
                    <p className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      نگهداری بعدی: {plan.next_maintenance_date}
                    </p>
                  )}
                  {plan.estimated_cost > 0 && (
                    <p>{plan.estimated_cost.toLocaleString('fa-IR')} ریال</p>
                  )}
                </div>
                {plan.checklist && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">چک‌لیست:</p>
                    {plan.checklist.split('\n').filter(Boolean).slice(0, 3).map((item, i) => (
                      <p key={i} className="text-xs text-gray-500 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-400" /> {item}
                      </p>
                    ))}
                    {plan.checklist.split('\n').filter(Boolean).length > 3 && (
                      <p className="text-xs text-gray-400 mt-1">+{plan.checklist.split('\n').filter(Boolean).length - 3} آیتم دیگر</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
