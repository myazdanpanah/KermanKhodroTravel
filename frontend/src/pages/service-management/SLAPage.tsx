import { useToast } from "../../components/Toast";
/**
 * SLA Rules Page
 * Per UI_UX_GUIDELINES.md §7: Table design.
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Clock, Trash2 } from 'lucide-react';
import { serviceManagementApi, SLARule } from '../../api/serviceManagement';

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: 'کم', color: 'bg-nx-mist/10 text-nx-navy dark:bg-nx-navy dark:text-nx-mist' },
  medium: { label: 'متوسط', color: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue dark:text-nx-blue' },
  high: { label: 'زیاد', color: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-warning-900 dark:text-nx-warning-300' },
  critical: { label: 'بحرانی', color: 'bg-nx-danger-100 text-nx-danger-700 dark:bg-nx-danger-900 dark:text-nx-danger-300' },
};

export default function SLAPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<SLARule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', priority: 'medium', response_time_hours: 24, resolution_time_hours: 72,
    working_hours_start: 8, working_hours_end: 17, escalate_after_hours: 0,
  });

  useEffect(() => {
    serviceManagementApi.getSLARules()
      .then(res => setRules(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = rules.filter(r => !search || r.name.includes(search));

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await serviceManagementApi.createSLARule({
        ...form,
        escalate_after_hours: form.escalate_after_hours || undefined,
      } as any);
      setRules(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', priority: 'medium', response_time_hours: 24, resolution_time_hours: 72, working_hours_start: 8, working_hours_end: 17, escalate_after_hours: 0 });
    } catch { toast("خطا", "error"); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا از حذف این قانون اطمینان دارید؟')) return;
    try {
      await serviceManagementApi.deleteSLARule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch { toast("خطا", "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Clock className="h-6 w-6 text-nx-warning-500" />
            قوانین SLA
          </h1>
          <p className="text-sm text-nx-mist dark:text-nx-mist mt-1">قوانین سطح خدمات — {filtered.length} قانون</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition-colors">
          <Plus className="h-4 w-4" /> قانون جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <h3 className="text-lg font-semibold text-nx-navy dark:text-white mb-4">قانون SLA جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">نام *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">اولویت</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
                {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">زمان پاسخ (ساعت)</label>
              <input type="number" value={form.response_time_hours} onChange={e => setForm({ ...form, response_time_hours: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">زمان حل مشکل (ساعت)</label>
              <input type="number" value={form.resolution_time_hours} onChange={e => setForm({ ...form, resolution_time_hours: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">ساعت شروع کار</label>
              <input type="number" value={form.working_hours_start} onChange={e => setForm({ ...form, working_hours_start: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">ساعت پایان کار</label>
              <input type="number" value={form.working_hours_end} onChange={e => setForm({ ...form, working_hours_end: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-nx-mist">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
      </div>

      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-nx-mist dark:text-nx-mist">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>هیچ قانون SLA یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">نام</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">اولویت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">زمان پاسخ</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">زمان حل</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">ساعات کاری</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rule => {
                  const p = PRIORITY_MAP[rule.priority] || PRIORITY_MAP.medium;
                  return (
                    <tr key={rule.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
                      <td className="px-4 py-3 font-medium">{rule.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${p.color}`}>{p.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{rule.response_time_hours} ساعت</td>
                      <td className="px-4 py-3 text-xs">{rule.resolution_time_hours} ساعت</td>
                      <td className="px-4 py-3 text-xs">{rule.working_hours_start}:00 - {rule.working_hours_end}:00</td>
                      <td className="px-4 py-3">
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(rule.id); }} className="p-1.5 text-nx-mist hover:text-nx-danger-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
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
