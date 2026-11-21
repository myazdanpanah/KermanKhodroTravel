/**
 * Correspondence list — cartable buckets, search and the new-letter composer.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, X, Inbox, Clock, Send, Eye, FileEdit, AlertTriangle, Archive, Paperclip,
  CheckCircle2, AlertCircle, Loader2, FileText,
} from 'lucide-react';
import { officeApi, Letter, OfficeMeta } from '../../api/office';
import { useToast } from '../../components/Toast';
import JalaliDateInput from '../../components/JalaliDateInput';
import { formatJalali } from '../../lib/jalali';
import { apiErrorMessage } from '../../lib/apiError';

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

type RecipientDraft = { user_id: string; delivery_type: 'primary' | 'action_required' | 'cc' };

type UploadRow = {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  previewUrl?: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes.toLocaleString('fa-IR')} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت`;
}

const emptyForm = {
  subject: '', body: '', correspondence_type: 'internal', secretariat_id: '',
  priority: 'normal', confidentiality: 'normal', letter_date: '', due_at: '',
  sender_name: '', sender_organization: '',
};

export default function CorrespondenceListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState<OfficeMeta | null>(null);
  const bucket = params.get('bucket') || 'inbox';
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [recipients, setRecipients] = useState<RecipientDraft[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const addRecipient = () => {
    setRecipients((prev) => [...prev, { user_id: '', delivery_type: 'primary' }]);
  };

  const updateRecipient = (index: number, patch: Partial<RecipientDraft>) => {
    setRecipients((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const setBucket = (next: string) => {
    const updated = new URLSearchParams(params);
    updated.set('bucket', next);
    updated.delete('new');
    setParams(updated, { replace: true });
  };

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

  const clearUploads = () => {
    setUploads((prev) => {
      prev.forEach((row) => { if (row.previewUrl) URL.revokeObjectURL(row.previewUrl); });
      return [];
    });
  };

  const closeForm = () => {
    setShowForm(false);
    clearUploads();
    if (params.get('new')) {
      const updated = new URLSearchParams(params);
      updated.delete('new');
      setParams(updated, { replace: true });
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const rows = Array.from(list).map<UploadRow>((file) => ({
      file,
      progress: 0,
      status: 'pending',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setUploads((prev) => [...prev, ...rows]);
  };

  const removeUpload = (index: number) => {
    setUploads((prev) => {
      const row = prev[index];
      if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const patchUpload = (index: number, patch: Partial<UploadRow>) => {
    setUploads((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

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
        letter_date: form.letter_date || null,
        letter_date_jalali: form.letter_date ? formatJalali(form.letter_date) : '',
        due_at: form.due_at ? new Date(`${form.due_at}T23:59:59`).toISOString() : null,
      };
      if (form.secretariat_id) payload.secretariat_id = Number(form.secretariat_id);
      if (form.sender_name) payload.sender_name = form.sender_name;
      if (form.sender_organization) payload.sender_organization = form.sender_organization;
      // One row per recipient; a user listed twice keeps the first role.
      const seen = new Set<number>();
      const rows = recipients
        .filter((row) => row.user_id)
        .filter((row) => {
          const id = Number(row.user_id);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((row) => ({
          recipient_type: 'user',
          recipient_user_id: Number(row.user_id),
          delivery_type: row.delivery_type,
        }));
      if (rows.length > 0) payload.recipients = rows;
      const res = await officeApi.createLetter(payload);
      const letterId = res.data.data.id;

      // The letter exists now, so attachments go to its own private endpoint.
      let uploaded = 0;
      for (let index = 0; index < uploads.length; index += 1) {
        patchUpload(index, { status: 'uploading', progress: 0 });
        const data = new FormData();
        data.append('file', uploads[index].file);
        try {
          await officeApi.uploadAttachment(letterId, data, (percent) => {
            patchUpload(index, { progress: percent });
          });
          patchUpload(index, { status: 'done', progress: 100 });
          uploaded += 1;
        } catch (error) {
          patchUpload(index, { status: 'error', progress: 0, error: apiErrorMessage(error, 'بارگذاری انجام نشد') });
          toast(apiErrorMessage(error, `بارگذاری «${uploads[index].file.name}» انجام نشد`), 'error');
        }
      }
      const failed = uploads.length - uploaded;
      toast(
        failed > 0
          ? `پیش‌نویس ساخته شد؛ ${uploaded} پیوست بارگذاری شد و ${failed} فایل ناموفق بود`
          : uploaded > 0
            ? `پیش‌نویس با ${uploaded} پیوست ساخته شد`
            : 'پیش‌نویس نامه ایجاد شد',
        failed > 0 ? 'error' : 'success',
      );
      setShowForm(false);
      setForm(emptyForm);
      setRecipients([]);
      clearUploads();
      navigate(`/erp/office/correspondence/${letterId}`);
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
          <h1 className="text-xl font-bold text-nx-navy dark:text-white">نامه‌ها</h1>
          <p className="mt-1 text-sm text-nx-mist">فهرست نامه‌های وارده، صادره و داخلی به تفکیک سبد کارتابل</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-nx-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> نامه جدید
        </button>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 dark:bg-nx-navy"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-nx-navy dark:text-white">نامه جدید</h2>
              <button onClick={closeForm} className="text-nx-mist hover:text-nx-danger">
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
              <div className="text-xs text-nx-mist">
                <JalaliDateInput label="تاریخ نامه (شمسی)" value={form.letter_date}
                  onChange={(iso) => setForm({ ...form, letter_date: iso })} />
              </div>
              <div className="text-xs text-nx-mist">
                <JalaliDateInput label="مهلت اقدام" value={form.due_at}
                  onChange={(iso) => setForm({ ...form, due_at: iso })} />
              </div>
              <div className="space-y-2 rounded-lg border border-nx-border p-3 sm:col-span-2 dark:border-nx-navy-border">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-nx-navy dark:text-white">گیرندگان و رونوشت</p>
                  <button type="button" onClick={addRecipient}
                    className="flex items-center gap-1 text-xs text-nx-blue hover:opacity-70">
                    <Plus className="h-3.5 w-3.5" /> افزودن گیرنده
                  </button>
                </div>
                {recipients.length === 0 ? (
                  <p className="text-[11px] text-nx-mist">در صورت نیاز، یک یا چند کاربر را با نقش گیرنده اصلی، نیازمند اقدام یا رونوشت اضافه کنید.</p>
                ) : (
                  <ul className="space-y-2">
                    {recipients.map((row, index) => (
                      <li key={index} className="flex flex-wrap items-center gap-2">
                        <select value={row.user_id} onChange={(e) => updateRecipient(index, { user_id: e.target.value })}
                          className="min-w-0 flex-1 rounded-lg border border-nx-border bg-transparent px-2 py-1.5 text-xs dark:border-nx-navy-border dark:text-white">
                          <option value="">— انتخاب کاربر —</option>
                          {meta?.users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}{u.division_name ? ` — ${u.division_name}` : ''}
                            </option>
                          ))}
                        </select>
                        <select value={row.delivery_type}
                          onChange={(e) => updateRecipient(index, { delivery_type: e.target.value as RecipientDraft['delivery_type'] })}
                          className="rounded-lg border border-nx-border bg-transparent px-2 py-1.5 text-xs dark:border-nx-navy-border dark:text-white">
                          <option value="primary">گیرنده اصلی</option>
                          <option value="action_required">نیازمند اقدام</option>
                          <option value="cc">رونوشت</option>
                        </select>
                        <button type="button" onClick={() => removeRecipient(index)}
                          className="text-nx-mist hover:text-nx-danger" title="حذف گیرنده">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="sm:col-span-2 text-xs text-nx-mist">
                متن نامه
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              </label>
              <div className="sm:col-span-2 space-y-2 rounded-lg border border-dashed border-nx-border p-3 dark:border-nx-navy-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-nx-navy dark:text-white">
                    <Paperclip className="h-3.5 w-3.5 text-nx-blue" /> پیوست‌ها
                  </p>
                  <button type="button" onClick={() => fileInput.current?.click()}
                    className="flex items-center gap-1 rounded-lg border border-nx-border px-2.5 py-1.5 text-xs text-nx-navy dark:border-nx-navy-border dark:text-white">
                    <Plus className="h-3.5 w-3.5" /> افزودن فایل
                  </button>
                </div>
                <input ref={fileInput} type="file" multiple className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.zip"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }} />
                {uploads.length === 0 ? (
                  <p className="text-[11px] text-nx-mist">
                    حداکثر ۱۰ مگابایت برای هر فایل؛ PDF، JPG/PNG، DOCX، XLSX یا ZIP. فایل‌ها بلافاصله پس از انتخاب نمایش داده می‌شوند و هنگام ذخیره با درصد بارگذاری تأیید می‌شوند.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {uploads.map((row, index) => (
                      <li key={`${row.file.name}-${index}`} className="rounded-lg border border-nx-border p-2 dark:border-nx-navy-border">
                        <div className="flex items-center gap-2">
                          {row.previewUrl ? (
                            <img src={row.previewUrl} alt={row.file.name} className="h-9 w-9 rounded object-cover" />
                          ) : (
                            <span className="grid h-9 w-9 place-items-center rounded bg-black/5 text-nx-mist dark:bg-white/10">
                              <FileText className="h-4 w-4" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-nx-navy dark:text-white">{row.file.name}</p>
                            <p className="text-[10px] text-nx-mist">{formatSize(row.file.size)}</p>
                          </div>
                          {row.status === 'done' && <CheckCircle2 className="h-4 w-4 shrink-0 text-nx-teal" />}
                          {row.status === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-nx-danger" />}
                          {row.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-nx-blue" />}
                          {row.status !== 'uploading' && (
                            <button type="button" onClick={() => removeUpload(index)}
                              className="shrink-0 text-nx-mist hover:text-nx-danger" title="حذف فایل">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {(row.status === 'uploading' || row.status === 'done') && (
                          <div className="mt-1.5 h-1 overflow-hidden rounded bg-black/10 dark:bg-white/10">
                            <div
                              className={`h-full rounded transition-all ${row.status === 'done' ? 'bg-nx-teal' : 'bg-nx-blue'}`}
                              style={{ width: `${row.progress}%` }}
                            />
                          </div>
                        )}
                        {row.status === 'done' && <p className="mt-1 text-[10px] text-nx-teal">بارگذاری انجام شد</p>}
                        {row.error && <p className="mt-1 text-[10px] text-nx-danger">{row.error}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeForm} className="rounded-lg border border-nx-border px-4 py-2 text-sm text-nx-mist dark:border-nx-navy-border">
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
