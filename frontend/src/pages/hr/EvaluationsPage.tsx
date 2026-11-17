/**
 * Performance Evaluations Page
 */
import { useState, useEffect } from 'react';
import { Plus, Search, TrendingUp } from 'lucide-react';
import { hrApi, PerformanceEvaluation } from '../../api/hr';
import { useToast } from '../../components/Toast';

export default function EvaluationsPage() {
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<PerformanceEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employee_id: 0, period_label: '', evaluation_date: new Date().toISOString().split('T')[0],
    productivity_score: 3, quality_score: 3, teamwork_score: 3, initiative_score: 3, communication_score: 3,
    comments: '', goals: '',
  });

  useEffect(() => {
    hrApi.getEvaluations().then(r => setEvaluations(r.data.data)).catch(() => toast("خطا", "error")).finally(() => setLoading(false));
  }, []);

  const filtered = evaluations.filter(e => !search || e.employee_name.includes(search) || e.period_label.includes(search));

  const handleCreate = async () => {
    if (!form.employee_id || !form.period_label) return;
    try {
      const res = await hrApi.createEvaluation(form);
      setEvaluations(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ employee_id: 0, period_label: '', evaluation_date: new Date().toISOString().split('T')[0], productivity_score: 3, quality_score: 3, teamwork_score: 3, initiative_score: 3, communication_score: 3, comments: '', goals: '' });
    } catch { toast("خطا", "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-nx-teal" /> ارزیابی عملکرد
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-200 mt-1">{filtered.length} ارزیابی</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue">
          <Plus className="h-4 w-4" /> ارزیابی جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-nx-mist mb-1">شناسه کارمند *</label><input type="number" value={form.employee_id || ''} onChange={e => setForm({ ...form, employee_id: Number(e.target.value) })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">دوره ارزیابی *</label><input type="text" value={form.period_label} onChange={e => setForm({ ...form, period_label: e.target.value })} placeholder="Q1 2026" className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">تاریخ</label><input type="date" value={form.evaluation_date} onChange={e => setForm({ ...form, evaluation_date: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            {[
              { key: 'productivity_score', label: ' بهره‌وری' },
              { key: 'quality_score', label: 'کیفیت' },
              { key: 'teamwork_score', label: 'کار تیمی' },
              { key: 'initiative_score', label: 'ابتکار' },
              { key: 'communication_score', label: 'ارتباطات' },
            ].map(({ key, label }) => (
              <div key={key}><label className="block text-xs text-nx-mist mb-1">{label} (1-5)</label><input type="number" min={1} max={5} value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            ))}
            <div className="md:col-span-3"><label className="block text-xs text-nx-mist mb-1">نظرات</label><textarea value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} rows={2} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
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
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-nx-mist"><TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ ارزیابی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">کارمند</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">دوره</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">بهره‌وری</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">کیفیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">تیمی</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">ابتکار</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">ارتباط</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">معدل</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ev => (
                  <tr key={ev.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
                    <td className="px-4 py-3 font-medium">{ev.employee_name}</td>
                    <td className="px-4 py-3 text-xs">{ev.period_label}</td>
                    <td className="px-4 py-3 text-xs">{ev.productivity_score}/5</td>
                    <td className="px-4 py-3 text-xs">{ev.quality_score}/5</td>
                    <td className="px-4 py-3 text-xs">{ev.teamwork_score}/5</td>
                    <td className="px-4 py-3 text-xs">{ev.initiative_score}/5</td>
                    <td className="px-4 py-3 text-xs">{ev.communication_score}/5</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span className={ev.overall_score >= 4 ? 'text-nx-teal' : ev.overall_score >= 3 ? 'text-nx-warning-600' : 'text-nx-danger-600'}>
                        {ev.overall_score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
