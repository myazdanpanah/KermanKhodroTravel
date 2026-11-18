/**
 * Activities Page
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, Calendar, CheckCircle, Clock } from 'lucide-react';
import { crmApi, Activity } from '../../api/crm';
import { useToast } from '../../components/Toast';

const TYPE_MAP: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  call: { label: 'تماس', icon: Phone, color: 'text-nx-blue bg-nx-blue/10' },
  email: { label: 'ایمیل', icon: Mail, color: 'text-nx-blue bg-nx-blue/10' },
  meeting: { label: 'جلسه', icon: Calendar, color: 'text-nx-teal bg-nx-teal/10' },
  task: { label: 'وظیفه', icon: Clock, color: 'text-nx-blue bg-nx-blue/10' },
  note: { label: 'یادداشت', icon: CheckCircle, color: 'text-nx-mist bg-white' },
  sms: { label: 'پیامک', icon: Phone, color: 'text-nx-teal bg-nx-teal/10' },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  planned: { label: 'برنامه‌ریزی شده', color: 'bg-nx-blue/10 text-nx-blue' },
  in_progress: { label: 'در حال انجام', color: 'bg-nx-blue/10 text-nx-blue' },
  completed: { label: 'تکمیل شده', color: 'bg-nx-teal/10 text-nx-teal' },
  cancelled: { label: 'لغو شده', color: 'bg-nx-mist/10 text-nx-navy' },
};

export default function ActivitiesPage() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ activity_type: 'call', subject: '', description: '' });

  useEffect(() => {
    crmApi.getActivities().then(r => setActivities(r.data.data)).catch(() => toast('خطا در دریافت فعالیت‌ها', 'error')).finally(() => setLoading(false));
  }, []);

  const filtered = activities.filter(a => !search || a.subject.includes(search));

  const handleCreate = async () => {
    if (!form.subject) return;
    try {
      const res = await crmApi.createActivity(form);
      setActivities(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ activity_type: 'call', subject: '', description: '' });
      toast('فعالیت ایجاد شد', 'success');
    } catch { toast('خطا در ایجاد فعالیت', 'error'); }
  };

  const handleComplete = async (id: number) => {
    try {
      const res = await crmApi.completeActivity(id);
      setActivities(prev => prev.map(a => a.id === id ? res.data.data : a));
      toast('فعالیت تکمیل شد', 'success');
    } catch { toast('خطا در تکمیل فعالیت', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Calendar className="h-6 w-6 text-nx-blue" /> فعالیت‌ها
          </h1>
          <p className="text-sm text-slate-300 mt-1">{filtered.length} فعالیت</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition-colors">
          <Plus className="h-4 w-4" /> فعالیت جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">نوع</label>
              <select value={form.activity_type} onChange={e => setForm({ ...form, activity_type: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
                {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">موضوع *</label>
              <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">توضیحات</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
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
          <div className="text-center py-12 text-nx-mist"><Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ فعالیتی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">نوع</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">موضوع</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(act => {
                  const type = TYPE_MAP[act.activity_type] || TYPE_MAP.call;
                  const status = STATUS_MAP[act.status] || STATUS_MAP.planned;
                  const TypeIcon = type.icon;
                  return (
                    <tr key={act.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${type.color}`}><TypeIcon className="h-3 w-3" />{type.label}</span></td>
                      <td className="px-4 py-3">{act.subject}</td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span></td>
                      <td className="px-4 py-3">
                        {act.status !== 'completed' && (
                          <button onClick={() => handleComplete(act.id)} className="text-nx-teal hover:text-nx-teal text-xs">تکمیل</button>
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
