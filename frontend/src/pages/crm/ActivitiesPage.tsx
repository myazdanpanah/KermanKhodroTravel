/**
 * Activities Page
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, Calendar, CheckCircle, Clock } from 'lucide-react';
import { crmApi, Activity } from '../../api/crm';
import { useToast } from '../../components/Toast';

const TYPE_MAP: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  call: { label: 'تماس', icon: Phone, color: 'text-blue-500 bg-blue-50' },
  email: { label: 'ایمیل', icon: Mail, color: 'text-purple-500 bg-purple-50' },
  meeting: { label: 'جلسه', icon: Calendar, color: 'text-green-500 bg-green-50' },
  task: { label: 'وظیفه', icon: Clock, color: 'text-orange-500 bg-orange-50' },
  note: { label: 'یادداشت', icon: CheckCircle, color: 'text-gray-500 bg-gray-50' },
  sms: { label: 'پیامک', icon: Phone, color: 'text-teal-500 bg-teal-50' },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  planned: { label: 'برنامه‌ریزی شده', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'در حال انجام', color: 'bg-orange-100 text-orange-700' },
  completed: { label: 'تکمیل شده', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'لغو شده', color: 'bg-gray-100 text-gray-700' },
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Calendar className="h-6 w-6 text-purple-500" /> فعالیت‌ها
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filtered.length} فعالیت</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
          <Plus className="h-4 w-4" /> فعالیت جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع</label>
              <select value={form.activity_type} onChange={e => setForm({ ...form, activity_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
                {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">موضوع *</label>
              <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">توضیحات</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ فعالیتی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-right px-4 py-3 font-medium text-gray-500">نوع</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">موضوع</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(act => {
                  const type = TYPE_MAP[act.activity_type] || TYPE_MAP.call;
                  const status = STATUS_MAP[act.status] || STATUS_MAP.planned;
                  const TypeIcon = type.icon;
                  return (
                    <tr key={act.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${type.color}`}><TypeIcon className="h-3 w-3" />{type.label}</span></td>
                      <td className="px-4 py-3">{act.subject}</td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span></td>
                      <td className="px-4 py-3">
                        {act.status !== 'completed' && (
                          <button onClick={() => handleComplete(act.id)} className="text-green-500 hover:text-green-700 text-xs">تکمیل</button>
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
