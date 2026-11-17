import { useToast } from "../../components/Toast";
/**
 * Scheduled Reports Page — Manage automated report scheduling
 */
import { useState, useEffect } from 'react';
import { Plus, Search, Calendar, Trash2 } from 'lucide-react';
import { reportingApi, ScheduledReport, ReportTemplate } from '../../api/reporting';

const FREQ_LABELS: Record<string, string> = {
  hourly: 'ساعتی', daily: 'روزانه', weekly: 'هفتگی', monthly: 'ماهانه', quarterly: 'فصلی',
};

export default function ScheduledReportsPage() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', template: 0, frequency: 'daily', export_format: 'pdf', recipients: [] as string[] });

  useEffect(() => {
    Promise.all([reportingApi.getScheduled(), reportingApi.getTemplates()])
      .then(([r1, r2]) => { setSchedules(r1.data.data); setTemplates(r2.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = schedules.filter(s => !search || s.name.includes(search));

  const handleCreate = async () => {
    if (!form.name || !form.template) return;
    try {
      const res = await reportingApi.createScheduled(form);
      setSchedules(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', template: 0, frequency: 'daily', export_format: 'pdf', recipients: [] });
    } catch { toast("خطا", "error"); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا از حذف اطمینان دارید؟')) return;
    try {
      await reportingApi.deleteScheduled(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch { toast("خطا", "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Calendar className="h-6 w-6 text-nx-teal" /> گزارش‌های زمان‌بندی شده
          </h1>
          <p className="text-sm text-nx-mist dark:text-nx-mist mt-1">{schedules.length} برنامه زمان‌بندی</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-teal text-white rounded-lg hover:bg-nx-teal">
          <Plus className="h-4 w-4" /> برنامه جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs text-nx-mist mb-1">نام *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">قالب گزارش *</label>
              <select value={form.template} onChange={e => setForm({ ...form, template: Number(e.target.value) })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
                <option value={0}>انتخاب کنید</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-nx-mist mb-1">دوره</label>
              <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
                {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-nx-mist mb-1">فرمت خروجی</label>
              <select value={form.export_format} onChange={e => setForm({ ...form, export_format: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
                <option value="pdf">PDF</option>
                <option value="xlsx">Excel</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-nx-mist">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-nx-teal text-white rounded-lg hover:bg-nx-teal text-sm">ایجاد</button>
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
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-nx-teal" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-nx-mist text-sm">هیچ برنامه‌ای یافت نشد</div>
        ) : (
          <div className="divide-y divide-nx-border dark:divide-nx-navy">
            {filtered.map(s => (
              <div key={s.id} className="px-4 py-4 flex items-center justify-between hover:bg-white dark:hover:bg-nx-navy">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${s.is_active ? 'bg-nx-teal/10 text-nx-teal' : 'bg-nx-mist/10 text-nx-mist'}`}>
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-nx-navy dark:text-white text-sm">{s.name}</p>
                    <p className="text-xs text-nx-mist mt-0.5">{s.template_name} — {FREQ_LABELS[s.frequency] || s.frequency} — {s.export_format.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.last_run_at && <span className="text-xs text-nx-mist">آخرین اجرا: {new Date(s.last_run_at).toLocaleDateString('fa-IR')}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-nx-teal/10 text-nx-teal' : 'bg-nx-mist/10 text-nx-mist'}`}>
                    {s.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="p-1.5 text-nx-mist hover:text-nx-danger-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
