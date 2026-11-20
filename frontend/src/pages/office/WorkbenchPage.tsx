/**
 * Office workbench — personal cartable plus new-letter composer.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, Inbox, Clock, Send, Eye, FileEdit, AlertTriangle, Archive, Settings } from 'lucide-react';
import { officeApi, Letter, OfficeMeta } from '../../api/office';
import { useToast } from '../../components/Toast';
import { formatJalali } from '../../lib/jalali';
import SecretariatPanel from './SecretariatPanel';

const BUCKETS: { key: string; label: string; icon: typeof Inbox }[] = [
  { key: 'inbox', label: 'صندوق ورودی', icon: Inbox },
  { key: 'action', label: 'نیازمند اقدام', icon: AlertTriangle },
  { key: 'sent', label: 'ارسالی', icon: Send },
  { key: 'cc', label: 'رونوشت', icon: Eye },
  { key: 'overdue', label: 'معوق', icon: Clock },
  { key: 'drafts', label: 'پیش‌نویس‌ها', icon: FileEdit },
  { key: 'archived', label: 'بایگانی', icon: Archive },
];

const STATUS_LABEL: Record<string, string> = {
  open: 'باز', in_progress: 'در جریان', awaiting_reply: 'در انتظار پاسخ',
  answered: 'پاسخ داده‌شده', closed: 'بسته‌شده',
};
const PRIORITY_LABEL: Record<string, string> = { low: 'کم', normal: 'عادی', high: 'زیاد', urgent: 'فوری' };
const TYPE_LABEL: Record<string, string> = { incoming: 'وارده', outgoing: 'صادره', internal: 'داخلی' };

const emptyForm = {
  subject: '', body: '', correspondence_type: 'internal', secretariat_id: '',
  priority: 'normal', confidentiality: 'normal', letter_date_jalali: '', due_at: '',
  sender_name: '', sender_organization: '', recipient_user_id: '',
};

export default function WorkbenchPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [meta, setMeta] = useState<OfficeMeta | null>(null);
  const [bucket, setBucket] = useState('inbox');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showSecretariats, setShowSecretariats] = useState(false);

  const load = async (nextBucket = bucket) => {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        officeApi.getWorkbenchList(nextBucket),
        officeApi.getWorkbench(),
      ]);
      setLetters(list.data.data);
      setCounts(summary.data.data.buckets);
    } catch {
      toast('خطا در دریافت نامه‌ها', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    officeApi.getMeta().then((res) => setMeta(res.data.data)).catch(() => toast('خطا در دریافت تنظیمات', 'error'));
  }, [toast]);

  useEffect(() => { load(bucket); }, [bucket]);

  const filtered = letters.filter((letter) =>
    !search ||
    letter.subject.includes(search) ||
    (letter.registration_number || '').includes(search) ||
    letter.sender_display.includes(search));

  const submit = async () => {
    if (!form.subject.trim()) {
      toast('موضوع نامه را وارد کنید', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        subject: form.subject,
        body: form.body,
        correspondence_type: form.correspondence_type,
        priority: form.priority,
        confidentiality: form.confidentiality,
        letter_date_jalali: form.letter_date_jalali,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      };
      if (form.secretariat_id) payload.secretariat_id = Number(form.secretariat_id);
      if (form.sender_name) payload.sender_name = form.sender_name;
      if (form.sender_organization) payload.sender_organization = form.sender_organization;
      if (form.recipient_user_id) {
        payload.recipients = [{
          recipient_type: 'user', recipient_user_id: Number(form.recipient_user_id),
          delivery_type: 'action_required',
        }];
      }
      const res = await officeApi.createLetter(payload);
      toast('پیش‌نویس نامه ایجاد شد', 'success');
      setShowForm(false);
      setForm(emptyForm);
      navigate(`/erp/office/correspondence/${res.data.data.id}`);
    } catch {
      toast('خطا در ایجاد نامه', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-nx-navy dark:text-white">میزکار اداری</h1>
          <p className="mt-1 text-sm text-nx-mist">کارتابل شخصی، نامه‌های در جریان و اقدام‌های باز</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta?.capabilities.privileged && (
            <button onClick={() => setShowSecretariats(true)}
              className="flex items-center gap-2 rounded-lg border border-nx-border px-4 py-2 text-sm text-nx-navy dark:border-nx-navy-border dark:text-white">
              <Settings className="h-4 w-4" /> دبیرخانه‌ها
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-nx-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> نامه جدید
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {BUCKETS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setBucket(key)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              bucket === key
                ? 'border-nx-blue bg-nx-blue/10 text-nx-blue'
                : 'border-nx-border text-nx-mist hover:border-nx-blue/40 dark:border-nx-navy-border'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
            <span className="rounded bg-black/5 px-1.5 dark:bg-white/10">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-nx-border bg-white dark:border-nx-navy-border dark:bg-nx-navy">
        <div className="flex items-center gap-2 border-b border-nx-border p-3 dark:border-nx-navy-border">
          <Search className="h-4 w-4 text-nx-mist" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو در موضوع، شماره یا فرستنده..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-nx-mist dark:text-white"
          />
        </div>

        {loading ? (
          <p className="p-6 text-sm text-nx-mist">در حال بارگذاری…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-nx-mist">نامه‌ای در این بخش نیست.</p>
        ) : (
          <ul className="divide-y divide-nx-border dark:divide-nx-navy-border">
            {filtered.map((letter) => (
              <li key={letter.id}>
                <button
                  onClick={() => navigate(`/erp/office/correspondence/${letter.id}`)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-right hover:bg-nx-blue/5"
                >
                  <span className="rounded bg-black/5 px-2 py-1 font-mono text-[11px] text-nx-mist dark:bg-white/10">
                    {letter.registration_number || 'پیش‌نویس'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-nx-navy dark:text-white">
                    {letter.subject}
                  </span>
                  <span className="text-xs text-nx-mist">{TYPE_LABEL[letter.correspondence_type]}</span>
                  <span className={`text-xs ${letter.priority === 'urgent' || letter.priority === 'high' ? 'text-nx-danger' : 'text-nx-mist'}`}>
                    {PRIORITY_LABEL[letter.priority]}
                  </span>
                  <span className="text-xs text-nx-mist">{STATUS_LABEL[letter.current_status]}</span>
                  <span className="text-xs text-nx-mist">{formatJalali(letter.created_at) || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showSecretariats && meta && (
        <SecretariatPanel meta={meta} onClose={() => setShowSecretariats(false)} />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 dark:bg-nx-navy"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-nx-navy dark:text-white">نامه جدید</h2>
              <button onClick={() => setShowForm(false)} className="text-nx-mist hover:text-nx-danger">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs text-nx-mist">
                موضوع *
                <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              </label>
              <label className="text-xs text-nx-mist">
                نوع نامه
                <select value={form.correspondence_type} onChange={(e) => setForm({ ...form, correspondence_type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
                  {meta?.types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-nx-mist">
                دبیرخانه
                <select value={form.secretariat_id} onChange={(e) => setForm({ ...form, secretariat_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
                  <option value="">— بدون دبیرخانه —</option>
                  {meta?.secretariats.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </label>
              <label className="text-xs text-nx-mist">
                اولویت
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
                  {meta?.priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-nx-mist">
                محرمانگی
                <select value={form.confidentiality} onChange={(e) => setForm({ ...form, confidentiality: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
                  {meta?.confidentialities.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-nx-mist">
                تاریخ نامه (شمسی)
                <input value={form.letter_date_jalali} onChange={(e) => setForm({ ...form, letter_date_jalali: e.target.value })}
                  placeholder="1404/09/01"
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              </label>
              <label className="text-xs text-nx-mist">
                مهلت اقدام
                <input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              </label>
              <label className="sm:col-span-2 text-xs text-nx-mist">
                گیرنده (نیازمند اقدام)
                <select value={form.recipient_user_id} onChange={(e) => setForm({ ...form, recipient_user_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
                  <option value="">— بدون گیرنده —</option>
                  {meta?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2 text-xs text-nx-mist">
                متن نامه
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-nx-border px-4 py-2 text-sm text-nx-mist dark:border-nx-navy-border">
                انصراف
              </button>
              <button onClick={submit} disabled={saving}
                className="rounded-lg bg-nx-blue px-4 py-2 text-sm text-white disabled:opacity-50">
                {saving ? 'در حال ذخیره…' : 'ذخیره پیش‌نویس'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
