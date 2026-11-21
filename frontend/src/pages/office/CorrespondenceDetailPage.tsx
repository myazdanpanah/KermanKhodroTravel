/**
 * Correspondence detail — letter, routing, timeline and related business records.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, Archive, BadgeCheck, Building2, Download, FileText, Link2, MessageSquare,
  Paperclip, Pencil, Send, Trash2, Upload, Users, X,
} from 'lucide-react';
import { officeApi, Attachment, Letter, OfficeMeta, BusinessLink, TimelineEvent } from '../../api/office';
import { useToast } from '../../components/Toast';
import JalaliDateInput from '../../components/JalaliDateInput';
import { formatJalali } from '../../lib/jalali';

const TYPE_LABEL: Record<string, string> = { incoming: 'وارده', outgoing: 'صادره', internal: 'داخلی' };
const STATUS_LABEL: Record<string, string> = {
  open: 'باز', in_progress: 'در جریان', awaiting_reply: 'در انتظار پاسخ',
  answered: 'پاسخ داده‌شده', closed: 'بسته‌شده',
};
const PRIORITY_LABEL: Record<string, string> = { low: 'کم', normal: 'عادی', high: 'زیاد', urgent: 'فوری' };
const CONF_LABEL: Record<string, string> = {
  normal: 'عادی', confidential: 'محرمانه', highly_confidential: 'خیلی محرمانه', restricted: 'محدود',
};
const ENTITY_LABEL: Record<string, string> = {
  customer: 'مشتری', invoice: 'صورت‌حساب', receipt: 'رسید', payment: 'پرداخت', opportunity: 'فرصت CRM',
};
const ACTION_LABEL: Record<string, string> = {
  created: 'ایجاد پیش‌نویس', registered: 'ثبت در دبیرخانه', referred: 'ارجاع',
  replied: 'پاسخ', archived: 'بایگانی', read: 'خوانده‌شده', updated: 'ویرایش پیش‌نویس',
  attachment_added: 'افزودن پیوست', attachment_deleted: 'حذف پیوست',
};
const RELATION_LABEL: Record<string, string> = {
  about: 'درباره', concerns: 'مربوط به', invoice_for: 'صورت‌حساب مربوط', payment_for: 'پرداخت مربوط',
  customer_context: 'زمینه مشتری', supporting_evidence: 'مستند پشتیبان', follow_up_to: 'پیگیری',
  discussed_in: 'بحث‌شده در',
};

const CARD = 'rounded-xl border border-nx-border bg-white p-4 dark:border-nx-navy-border dark:bg-nx-navy';
const DELIVERY_LABEL: Record<string, string> = {
  primary: 'گیرنده اصلی', action_required: 'نیازمند اقدام', cc: 'رونوشت', bcc: 'رونوشت مخفی',
  information: 'جهت اطلاع',
};

type RecipientDraft = {
  label: string;
  recipient_type: string;
  delivery_type: string;
  recipient_user_id?: number;
  recipient_team_id?: number;
  recipient_division_id?: number;
  external_name?: string;
};

function errorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { message?: string } } };
  return err.response?.data?.message || fallback;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes.toLocaleString('fa-IR')} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت`;
}

function money(value: unknown) {
  if (typeof value !== 'number') return '—';
  return `${value.toLocaleString('fa-IR')} ریال`;
}

export default function CorrespondenceDetailPage() {
  const { id } = useParams();
  const letterId = Number(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [letter, setLetter] = useState<Letter | null>(null);
  const [meta, setMeta] = useState<OfficeMeta | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [links, setLinks] = useState<BusinessLink[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [comment, setComment] = useState('');
  const [referOpen, setReferOpen] = useState(false);
  const [referForm, setReferForm] = useState({ user_id: '', route_type: 'action', instruction: '' });
  const [linkForm, setLinkForm] = useState({ entity_type: 'customer', q: '', relationship_type: 'concerns' });
  const [searchResults, setSearchResults] = useState<{ id: string; label: string; sublabel: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    subject: '', body: '', priority: 'normal', due_at: '', recipients: [] as RecipientDraft[],
  });
  const [newRecipient, setNewRecipient] = useState({ user_id: '', delivery_type: 'primary' });
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [res, events] = await Promise.all([
        officeApi.getLetter(letterId),
        officeApi.getTimeline(letterId),
      ]);
      setLetter(res.data.data);
      setLinks(res.data.data.business_links || []);
      setTimeline(events.data.data);
    } catch {
      toast('نامه یافت نشد', 'error');
      navigate('/erp/office');
    }
  }, [letterId, navigate, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    officeApi.getMeta().then((res) => setMeta(res.data.data)).catch(() => undefined);
  }, []);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast(message, 'success');
      await load();
    } catch {
      toast('عملیات انجام نشد', 'error');
    } finally {
      setBusy(false);
    }
  };

  const searchRecord = async () => {
    try {
      const res = await officeApi.searchBusiness(linkForm.entity_type, linkForm.q);
      setSearchResults(res.data.data);
      if (res.data.data.length === 0) toast('رکوردی یافت نشد', 'error');
    } catch {
      toast('جستجو انجام نشد', 'error');
    }
  };

  const startEdit = () => {
    if (!letter) return;
    setEditForm({
      subject: letter.subject,
      body: letter.body || '',
      priority: letter.priority,
      due_at: letter.due_at ? new Date(letter.due_at).toISOString().slice(0, 10) : '',
      recipients: (letter.recipients || []).map((recipient) => ({
        label: recipient.user_name || recipient.team_name || recipient.division_name || recipient.external_name,
        recipient_type: recipient.recipient_type,
        delivery_type: recipient.delivery_type,
        recipient_user_id: recipient.recipient_user ?? undefined,
        recipient_team_id: recipient.recipient_team ?? undefined,
        recipient_division_id: recipient.recipient_division ?? undefined,
        external_name: recipient.external_name || undefined,
      })),
    });
    setEditing(true);
  };

  const saveDraft = async () => {
    if (!letter) return;
    setBusy(true);
    try {
      await officeApi.updateLetter(letter.id, {
        subject: editForm.subject,
        body: editForm.body,
        priority: editForm.priority,
        due_at: editForm.due_at ? new Date(`${editForm.due_at}T23:59:59`).toISOString() : null,
        recipients: editForm.recipients.map((recipient) => ({
          recipient_type: recipient.recipient_type,
          delivery_type: recipient.delivery_type,
          ...(recipient.recipient_user_id ? { recipient_user_id: recipient.recipient_user_id } : {}),
          ...(recipient.recipient_team_id ? { recipient_team_id: recipient.recipient_team_id } : {}),
          ...(recipient.recipient_division_id ? { recipient_division_id: recipient.recipient_division_id } : {}),
          ...(recipient.external_name ? { external_name: recipient.external_name } : {}),
        })),
      });
      toast('پیش‌نویس به‌روزرسانی شد', 'success');
      setEditing(false);
      await load();
    } catch (err) {
      toast(errorMessage(err, 'ذخیره تغییرات انجام نشد'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addRecipient = () => {
    const user = meta?.users.find((item) => String(item.id) === newRecipient.user_id);
    if (!user) return;
    if (editForm.recipients.some((recipient) => recipient.recipient_user_id === user.id)) {
      toast('این گیرنده قبلاً اضافه شده است', 'error');
      return;
    }
    setEditForm({
      ...editForm,
      recipients: [...editForm.recipients, {
        label: user.name, recipient_type: 'user', delivery_type: newRecipient.delivery_type,
        recipient_user_id: user.id,
      }],
    });
    setNewRecipient({ user_id: '', delivery_type: newRecipient.delivery_type });
  };

  const uploadAttachment = async (file: File) => {
    if (!letter) return;
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    try {
      await officeApi.uploadAttachment(letter.id, form);
      toast('پیوست افزوده شد', 'success');
      await load();
    } catch (err) {
      toast(errorMessage(err, 'بارگذاری پیوست انجام نشد'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    if (!letter) return;
    try {
      const response = await officeApi.downloadAttachment(letter.id, attachment.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.original_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast('دانلود پیوست انجام نشد', 'error');
    }
  };

  if (!letter) return <p className="text-sm text-nx-mist">در حال بارگذاری…</p>;

  const canRegister = letter.registration_status === 'draft' && Boolean(
    meta?.capabilities.privileged ||
    (letter.secretariat && meta?.capabilities.register_secretariat_ids.includes(letter.secretariat)),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/erp/office')} className="mt-1 text-nx-mist hover:text-nx-blue">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-black/5 px-2 py-1 font-mono text-[11px] text-nx-mist dark:bg-white/10">
                {letter.registration_number || 'پیش‌نویس'}
              </span>
              <span className="rounded-full bg-nx-blue/10 px-2 py-0.5 text-[11px] text-nx-blue">
                {TYPE_LABEL[letter.correspondence_type]}
              </span>
              <span className="rounded-full bg-nx-teal/10 px-2 py-0.5 text-[11px] text-nx-teal">
                {STATUS_LABEL[letter.current_status]}
              </span>
              {letter.confidentiality !== 'normal' && (
                <span className="rounded-full bg-nx-warning-950 px-2 py-0.5 text-[11px] text-nx-warning">
                  {CONF_LABEL[letter.confidentiality]}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-lg font-bold text-nx-navy dark:text-white">{letter.subject}</h1>
            <p className="mt-1 text-xs text-nx-mist">
              {letter.sender_display || '—'} · {formatJalali(letter.created_at)}
              {letter.due_at ? ` · مهلت: ${formatJalali(letter.due_at)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {letter.can_edit && !editing && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 rounded-lg border border-nx-border px-3 py-2 text-xs text-nx-navy dark:border-nx-navy-border dark:text-white">
              <Pencil className="h-4 w-4" /> ویرایش پیش‌نویس
            </button>
          )}
          {canRegister && (
            <button disabled={busy}
              onClick={() => act(() => officeApi.registerLetter(letter.id), 'نامه ثبت شد')}
              className="flex items-center gap-1.5 rounded-lg bg-nx-teal px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
              <BadgeCheck className="h-4 w-4" /> ثبت در دبیرخانه
            </button>
          )}
          <button onClick={() => setReferOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-lg border border-nx-border px-3 py-2 text-xs text-nx-navy dark:border-nx-navy-border dark:text-white">
            <Send className="h-4 w-4" /> ارجاع
          </button>
          {!letter.archived_at && (
            <button disabled={busy}
              onClick={() => act(() => officeApi.archiveLetter(letter.id), 'نامه بایگانی شد')}
              className="flex items-center gap-1.5 rounded-lg border border-nx-border px-3 py-2 text-xs text-nx-mist dark:border-nx-navy-border">
              <Archive className="h-4 w-4" /> بایگانی
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className={CARD}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-nx-navy dark:text-white">
            <Pencil className="h-4 w-4 text-nx-blue" /> ویرایش پیش‌نویس
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={editForm.subject}
              onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
              placeholder="موضوع نامه"
              className="rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm sm:col-span-2 dark:border-nx-navy-border dark:text-white" />
            <select value={editForm.priority}
              onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
              className="rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
              {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 text-xs text-nx-mist">
            <JalaliDateInput label="مهلت اقدام" value={editForm.due_at}
              onChange={(iso) => setEditForm({ ...editForm, due_at: iso })} />
          </div>
          <textarea rows={5} value={editForm.body}
            onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
            placeholder="متن نامه…"
            className="mt-2 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />

          <div className="mt-3 border-t border-nx-border pt-3 dark:border-nx-navy-border">
            <p className="text-xs font-medium text-nx-navy dark:text-white">گیرندگان</p>
            {editForm.recipients.length === 0 ? (
              <p className="mt-1 text-xs text-nx-mist">گیرنده‌ای ثبت نشده است.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {editForm.recipients.map((recipient, index) => (
                  <li key={`${recipient.recipient_type}-${recipient.label}-${index}`}
                    className="flex items-center gap-2 text-xs">
                    <span className="flex-1 text-nx-navy dark:text-white">{recipient.label}</span>
                    <select value={recipient.delivery_type}
                      onChange={(e) => {
                        const recipients = [...editForm.recipients];
                        recipients[index] = { ...recipient, delivery_type: e.target.value };
                        setEditForm({ ...editForm, recipients });
                      }}
                      className="rounded border border-nx-border bg-transparent px-1.5 py-1 text-[11px] dark:border-nx-navy-border dark:text-white">
                      {Object.entries(DELIVERY_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <button onClick={() => setEditForm({
                      ...editForm, recipients: editForm.recipients.filter((_, i) => i !== index),
                    })} className="text-nx-mist hover:text-nx-danger" title="حذف گیرنده">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <select value={newRecipient.user_id}
                onChange={(e) => setNewRecipient({ ...newRecipient, user_id: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-nx-border bg-transparent px-2 py-1.5 text-xs dark:border-nx-navy-border dark:text-white">
                <option value="">افزودن گیرنده…</option>
                {meta?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <select value={newRecipient.delivery_type}
                onChange={(e) => setNewRecipient({ ...newRecipient, delivery_type: e.target.value })}
                className="rounded-lg border border-nx-border bg-transparent px-2 py-1.5 text-xs dark:border-nx-navy-border dark:text-white">
                {Object.entries(DELIVERY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button disabled={!newRecipient.user_id} onClick={addRecipient}
                className="rounded-lg border border-nx-border px-2 py-1.5 text-xs text-nx-navy disabled:opacity-50 dark:border-nx-navy-border dark:text-white">
                افزودن
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button disabled={busy || !editForm.subject.trim()} onClick={saveDraft}
              className="rounded-lg bg-nx-blue px-4 py-2 text-sm text-white disabled:opacity-50">
              ذخیره تغییرات
            </button>
            <button onClick={() => setEditing(false)}
              className="rounded-lg border border-nx-border px-4 py-2 text-sm text-nx-mist dark:border-nx-navy-border">
              انصراف
            </button>
          </div>
        </div>
      )}

      {referOpen && (
        <div className={CARD}>
          <h3 className="mb-3 text-sm font-semibold text-nx-navy dark:text-white">ارجاع نامه</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={referForm.user_id} onChange={(e) => setReferForm({ ...referForm, user_id: e.target.value })}
              className="rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
              <option value="">انتخاب کاربر…</option>
              {meta?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select value={referForm.route_type} onChange={(e) => setReferForm({ ...referForm, route_type: e.target.value })}
              className="rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
              <option value="action">اقدام</option>
              <option value="review">بررسی</option>
              <option value="signature">امضا</option>
              <option value="information">اطلاع</option>
            </select>
            <button
              disabled={!referForm.user_id || busy}
              onClick={async () => {
                await act(
                  () => officeApi.referLetter(letter.id, {
                    target_type: 'user', user_id: Number(referForm.user_id),
                    route_type: referForm.route_type, instruction: referForm.instruction,
                  }),
                  'نامه ارجاع شد',
                );
                setReferOpen(false);
                setReferForm({ user_id: '', route_type: 'action', instruction: '' });
              }}
              className="rounded-lg bg-nx-blue px-3 py-2 text-sm text-white disabled:opacity-50">
              ارجاع
            </button>
          </div>
          <input value={referForm.instruction}
            onChange={(e) => setReferForm({ ...referForm, instruction: e.target.value })}
            placeholder="دستور / توضیح برای گیرنده"
            className="mt-2 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className={CARD}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-nx-navy dark:text-white">
              <FileText className="h-4 w-4 text-nx-blue" /> متن نامه
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-7 text-nx-navy dark:text-white/90">
              {letter.body || 'بدون متن'}
            </p>
          </div>

          <div className={CARD}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-nx-navy dark:text-white">
              <Paperclip className="h-4 w-4 text-nx-blue" /> پیوست‌ها ({(letter.attachments || []).length})
            </h2>
            {(letter.attachments || []).length === 0 ? (
              <p className="text-xs text-nx-mist">پیوستی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {(letter.attachments || []).map((attachment) => (
                  <li key={attachment.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-nx-border p-2 text-xs dark:border-nx-navy-border">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-nx-navy dark:text-white" title={attachment.original_name}>
                        {attachment.original_name}
                      </p>
                      <p className="text-[10px] text-nx-mist">
                        {formatBytes(attachment.size_bytes)} · {attachment.uploaded_by_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button onClick={() => downloadAttachment(attachment)}
                        className="text-nx-blue hover:opacity-70" title="دانلود">
                        <Download className="h-4 w-4" />
                      </button>
                      {!letter.archived_at && (
                        <button onClick={() => act(
                          () => officeApi.deleteAttachment(letter.id, attachment.id), 'پیوست حذف شد',
                        )} className="text-nx-mist hover:text-nx-danger" title="حذف پیوست">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!letter.archived_at && (
              <div className="mt-3 border-t border-nx-border pt-3 dark:border-nx-navy-border">
                <input ref={fileInput} type="file" className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.zip"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void uploadAttachment(file);
                  }} />
                <button disabled={busy} onClick={() => fileInput.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-nx-border px-3 py-1.5 text-xs text-nx-navy disabled:opacity-50 dark:border-nx-navy-border dark:text-white">
                  <Upload className="h-3.5 w-3.5" /> افزودن پیوست
                </button>
                <p className="mt-1 text-[10px] text-nx-mist">
                  حداکثر ۱۰ مگابایت؛ PDF، JPG/PNG، DOCX، XLSX یا ZIP
                </p>
              </div>
            )}
          </div>

          <div className={CARD}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-nx-navy dark:text-white">
              <MessageSquare className="h-4 w-4 text-nx-blue" /> گردش نامه
            </h2>
            {timeline.length === 0 ? (
              <p className="text-xs text-nx-mist">رویدادی ثبت نشده است.</p>
            ) : (
              <ol className="space-y-3 border-r border-nx-border pr-4 dark:border-nx-navy-border">
                {timeline.map((event, index) => (
                  <li key={`${event.at}-${index}`} className="relative text-xs text-nx-mist">
                    <span className="absolute -right-[21px] top-1 h-2 w-2 rounded-full bg-nx-blue" />
                    <p className="text-sm text-nx-navy dark:text-white">{ACTION_LABEL[event.action] || event.action}</p>
                    <p>{event.actor} · {formatJalali(event.at)}{event.note ? ` · ${event.note}` : ''}</p>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-4 flex gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="یادداشت داخلی…"
                className="min-w-0 flex-1 rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              <button disabled={!comment.trim() || busy}
                onClick={() => act(() => officeApi.addComment(letter.id, comment), 'یادداشت ثبت شد').then(() => setComment(''))}
                className="rounded-lg border border-nx-border px-3 py-2 text-sm text-nx-navy disabled:opacity-50 dark:border-nx-navy-border dark:text-white">
                ثبت
              </button>
            </div>
          </div>

          <div className={CARD}>
            <h2 className="mb-2 text-sm font-semibold text-nx-navy dark:text-white">پاسخ</h2>
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={3}
              placeholder="متن پاسخ…"
              className="w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
            <button disabled={!replyBody.trim() || busy}
              onClick={() => act(() => officeApi.replyLetter(letter.id, { body: replyBody }), 'پاسخ ثبت شد').then(() => setReplyBody(''))}
              className="mt-2 rounded-lg bg-nx-blue px-4 py-2 text-sm text-white disabled:opacity-50">
              ثبت پاسخ
            </button>
          </div>
        </div>

        <aside className="space-y-5">
          <div className={CARD}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-nx-navy dark:text-white">
              <Building2 className="h-4 w-4 text-nx-blue" /> مشخصات
            </h2>
            <dl className="space-y-2 text-xs">
              <Row label="دبیرخانه" value={letter.secretariat_name || '—'} />
              <Row label="مسئول" value={letter.owner_name || '—'} />
              <Row label="اولویت" value={PRIORITY_LABEL[letter.priority]} />
              <Row label="محرمانگی" value={CONF_LABEL[letter.confidentiality]} />
              <Row label="تاریخ نامه" value={letter.letter_date_jalali || formatJalali(letter.letter_date) || '—'} />
              <Row label="ثبت" value={letter.registered_at ? formatJalali(letter.registered_at) : 'ثبت نشده'} />
              <Row label="مهلت" value={letter.due_at ? formatJalali(letter.due_at) : '—'} />
              {letter.parent_subject && <Row label="پاسخ به" value={letter.parent_subject} />}
            </dl>
          </div>

          <div className={CARD}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-nx-navy dark:text-white">
              <Users className="h-4 w-4 text-nx-blue" /> گیرندگان
            </h2>
            {(letter.recipients || []).length === 0 ? (
              <p className="text-xs text-nx-mist">گیرنده‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {(letter.recipients || []).map((recipient) => (
                  <li key={recipient.id} className="flex items-center justify-between gap-2">
                    <span className="text-nx-navy dark:text-white">
                      {recipient.user_name || recipient.team_name || recipient.division_name || recipient.external_name}
                    </span>
                    <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-nx-mist dark:bg-white/10">
                      {recipient.delivery_type === 'action_required' ? 'اقدام' : recipient.delivery_type === 'cc' ? 'رونوشت' : 'اطلاع'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={CARD}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-nx-navy dark:text-white">
              <Link2 className="h-4 w-4 text-nx-blue" /> رکوردهای مالی مرتبط
            </h2>

            {links.length === 0 ? (
              <p className="text-xs text-nx-mist">رکوردی پیوند نشده است.</p>
            ) : (
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.id} className="rounded-lg border border-nx-border p-2 text-xs dark:border-nx-navy-border">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-nx-mist">
                          {ENTITY_LABEL[link.entity_type]} · {RELATION_LABEL[link.relationship_type] || link.relationship_type}
                        </p>
                        {link.state === 'ok' && link.record ? (
                          <>
                            <p className="font-medium text-nx-navy dark:text-white">
                              {String(link.record.display.name || link.record.display.invoice_number ||
                                link.record.display.receipt_number || link.record.display.payment_number || '')}
                            </p>
                            <p className="mt-0.5 text-nx-mist">
                              {typeof link.record.display.outstanding_amount === 'number'
                                ? `مانده: ${money(link.record.display.outstanding_amount)}`
                                : typeof link.record.display.balance === 'number'
                                  ? `مانده حساب: ${money(link.record.display.balance)}`
                                  : typeof link.record.display.amount === 'number'
                                    ? money(link.record.display.amount)
                                    : String(link.record.display.customer_name || link.record.display.status || '')}
                            </p>
                            <div className="mt-1 flex gap-2 text-[11px] text-nx-blue">
                              {Object.entries(link.record.links).map(([key, href]) => (
                                <button key={key} onClick={() => navigate(href)} className="hover:underline">
                                  {key === 'customer' ? 'مشتری' : key === 'invoice' ? 'صورت‌حساب' : 'پرداخت‌ها'}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-nx-danger">{link.error || 'رکورد در دسترس نیست'}</p>
                        )}
                      </div>
                      <button
                        onClick={() => act(() => officeApi.deleteBusinessLink(letter.id, link.id), 'پیوند حذف شد')}
                        className="text-nx-mist hover:text-nx-danger" title="حذف پیوند">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 space-y-2 border-t border-nx-border pt-3 dark:border-nx-navy-border">
              <select value={linkForm.entity_type}
                onChange={(e) => { setLinkForm({ ...linkForm, entity_type: e.target.value }); setSearchResults([]); }}
                className="w-full rounded-lg border border-nx-border bg-transparent px-2 py-1.5 text-xs dark:border-nx-navy-border dark:text-white">
                {Object.entries(ENTITY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input value={linkForm.q} onChange={(e) => setLinkForm({ ...linkForm, q: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') searchRecord(); }}
                  placeholder="جستجو…"
                  className="min-w-0 flex-1 rounded-lg border border-nx-border bg-transparent px-2 py-1.5 text-xs dark:border-nx-navy-border dark:text-white" />
                <button onClick={searchRecord} className="rounded-lg border border-nx-border px-2 py-1.5 text-xs text-nx-navy dark:border-nx-navy-border dark:text-white">
                  جستجو
                </button>
              </div>
              {searchResults.length > 0 && (
                <ul className="space-y-1">
                  {searchResults.map((result) => (
                    <li key={result.id}>
                      <button
                        onClick={() => act(
                          () => officeApi.addBusinessLink(letter.id, {
                            entity_type: linkForm.entity_type,
                            source_record_id: result.id,
                            relationship_type: linkForm.relationship_type,
                          }),
                          'رکورد پیوند شد',
                        ).then(() => { setSearchResults([]); setLinkForm({ ...linkForm, q: '' }); })}
                        className="w-full rounded bg-nx-blue/5 px-2 py-1.5 text-right text-xs hover:bg-nx-blue/10">
                        <span className="text-nx-navy dark:text-white">{result.label}</span>
                        {result.sublabel && <span className="block text-[10px] text-nx-mist">{result.sublabel}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-nx-mist">{label}</dt>
      <dd className="text-nx-navy dark:text-white">{value}</dd>
    </div>
  );
}
