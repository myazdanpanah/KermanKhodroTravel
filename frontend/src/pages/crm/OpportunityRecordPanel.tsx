/**
 * Opportunity record panel — the deal's own page: details, its activities and
 * its tasks, with inline logging (Twenty-style record view).
 */

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle, X } from 'lucide-react';
import { crmApi, Activity, CRMTask, Opportunity } from '../../api/crm';
import { useToast } from '../../components/Toast';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  prospecting: { label: 'جستجو', color: 'bg-nx-blue/10 text-nx-blue' },
  qualification: { label: 'تایید', color: 'bg-nx-blue/10 text-nx-blue' },
  proposal: { label: 'پیشنهاد', color: 'bg-nx-warning-100 text-nx-warning-700' },
  negotiation: { label: 'مذاکره', color: 'bg-nx-blue/10 text-nx-blue' },
  closed_won: { label: 'برده شده', color: 'bg-nx-teal/10 text-nx-teal' },
  closed_lost: { label: 'از دست رفته', color: 'bg-nx-danger-100 text-nx-danger-700' },
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'سرنخ', qualified: 'تایید شده', proposal_sent: 'پیشنهاد ارسال شده',
  verbal_agreement: 'توافق شفاهی', contract_sent: 'قرارداد ارسال شده', closed: 'بسته شده',
};

const INPUT = 'px-2 py-1.5 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-xs';

export default function OpportunityRecordPanel({ opportunity, onClose }: { opportunity: Opportunity; onClose: () => void }) {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityForm, setActivityForm] = useState({ activity_type: 'call', subject: '' });
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '' });
  const opp = opportunity;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      crmApi.getActivities({ opportunity: String(opp.id) }),
      crmApi.getTasks({ opportunity: String(opp.id) }),
    ])
      .then(([activityRes, taskRes]) => {
        if (cancelled) return;
        setActivities(activityRes.data.data);
        setTasks(taskRes.data.data);
      })
      .catch(() => toast('خطا در دریافت سابقهٔ فرصت', 'error'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [opp.id]);

  const addActivity = async () => {
    if (!activityForm.subject.trim()) return;
    try {
      const res = await crmApi.createActivity({ ...activityForm, opportunity_id: opp.id });
      setActivities(prev => [res.data.data, ...prev]);
      setActivityForm({ activity_type: 'call', subject: '' });
      toast('فعالیت ثبت شد', 'success');
    } catch { toast('خطا در ثبت فعالیت', 'error'); }
  };

  const addTask = async () => {
    if (!taskForm.title.trim()) return;
    try {
      const res = await crmApi.createTask({ title: taskForm.title, due_date: taskForm.due_date || null, opportunity_id: opp.id });
      setTasks(prev => [res.data.data, ...prev]);
      setTaskForm({ title: '', due_date: '' });
      toast('وظیفه ایجاد شد', 'success');
    } catch { toast('خطا در ایجاد وظیفه', 'error'); }
  };

  const completeActivity = async (id: number) => {
    try {
      const res = await crmApi.completeActivity(id);
      setActivities(prev => prev.map(a => (a.id === id ? res.data.data : a)));
    } catch { toast('خطا در تکمیل فعالیت', 'error'); }
  };

  const completeTask = async (id: number) => {
    try {
      const res = await crmApi.completeTask(id);
      setTasks(prev => prev.map(t => (t.id === id ? res.data.data : t)));
    } catch { toast('خطا در تکمیل وظیفه', 'error'); }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 w-full max-w-md overflow-y-auto bg-white dark:bg-nx-navy border-r border-nx-border dark:border-nx-navy-border shadow-xl">
        <div className="sticky top-0 bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-nx-navy dark:text-white">{opp.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{opp.customer_name || 'بدون مشتری'}</p>
          </div>
          <button onClick={onClose} aria-label="بستن" className="p-1 rounded-lg text-slate-500 hover:bg-nx-mist/40">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${(STATUS_LABELS[opp.status] || STATUS_LABELS.prospecting).color}`}>
              {(STATUS_LABELS[opp.status] || STATUS_LABELS.prospecting).label}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-300">مرحله: {STAGE_LABELS[opp.stage] || opp.stage}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'ارزش تخمینی', value: `${Number(opp.estimated_value).toLocaleString('fa-IR')} ریال` },
              { label: 'ارزش وزنی', value: `${Number(opp.weighted_value).toLocaleString('fa-IR')} ریال` },
              { label: 'احتمال', value: `${opp.probability.toLocaleString('fa-IR')}٪` },
              { label: 'تاریخ بستن مورد انتظار', value: opp.expected_close_date || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-nx-border dark:border-nx-navy-border px-3 py-2">
                <p className="text-xs text-slate-500 dark:text-slate-300">{label}</p>
                <p className="mt-1 font-medium text-nx-navy dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          {opp.description && <p className="text-sm text-slate-600 dark:text-slate-200 leading-6">{opp.description}</p>}

          <section>
            <h3 className="text-sm font-semibold text-nx-navy dark:text-white flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-nx-blue" /> فعالیت‌ها ({activities.length.toLocaleString('fa-IR')})
            </h3>
            {loading ? (
              <p className="text-xs text-slate-500 py-2">در حال دریافت…</p>
            ) : (
              <ul className="space-y-2">
                {activities.map(activity => (
                  <li key={activity.id} className="rounded-lg border border-nx-border dark:border-nx-navy-border px-3 py-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-nx-navy dark:text-white">{activity.subject}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                        {activity.status === 'completed' ? 'تکمیل شده' : 'باز'}
                        {activity.due_date ? ` · ${activity.due_date.slice(0, 10)}` : ''}
                      </p>
                    </div>
                    {activity.status !== 'completed' && (
                      <button onClick={() => void completeActivity(activity.id)} className="text-nx-teal text-xs flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> تکمیل
                      </button>
                    )}
                  </li>
                ))}
                {activities.length === 0 && <li className="text-xs text-slate-400 py-1">فعالیتی ثبت نشده است</li>}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <select value={activityForm.activity_type} onChange={e => setActivityForm({ ...activityForm, activity_type: e.target.value })} className={INPUT}>
                <option value="call">تماس</option>
                <option value="email">ایمیل</option>
                <option value="meeting">جلسه</option>
                <option value="note">یادداشت</option>
              </select>
              <input value={activityForm.subject} onChange={e => setActivityForm({ ...activityForm, subject: e.target.value })} placeholder="موضوع فعالیت" className={`flex-1 ${INPUT}`} />
              <button onClick={() => void addActivity()} className="px-3 py-1.5 bg-nx-blue text-white rounded-lg text-xs">ثبت</button>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-nx-navy dark:text-white flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-nx-teal" /> وظایف ({tasks.length.toLocaleString('fa-IR')})
            </h3>
            <ul className="space-y-2">
              {tasks.map(task => (
                <li key={task.id} className="rounded-lg border border-nx-border dark:border-nx-navy-border px-3 py-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-nx-navy dark:text-white">{task.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                      {task.status === 'completed' ? 'انجام شده' : 'باز'}
                      {task.due_date ? ` · ${task.due_date}` : ''}
                    </p>
                  </div>
                  {task.status !== 'completed' && (
                    <button onClick={() => void completeTask(task.id)} className="text-nx-teal text-xs">انجام شد</button>
                  )}
                </li>
              ))}
              {tasks.length === 0 && <li className="text-xs text-slate-400 py-1">وظیفه‌ای ثبت نشده است</li>}
            </ul>
            <div className="mt-2 flex gap-2">
              <input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="عنوان وظیفه" className={`flex-1 ${INPUT}`} />
              <input type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} className={INPUT} />
              <button onClick={() => void addTask()} className="px-3 py-1.5 bg-nx-blue text-white rounded-lg text-xs">افزودن</button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
