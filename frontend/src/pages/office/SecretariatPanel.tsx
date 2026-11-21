/**
 * Secretariat configuration — members who may register letters.
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { officeApi, OfficeMeta, SecretariatInfo } from '../../api/office';
import { useToast } from '../../components/Toast';

const ROLE_LABEL: Record<string, string> = {
  admin: 'مدیر سیستم', ceo: 'مدیرعامل', finance: 'مالی', sales: 'فروش', hr: 'منابع انسانی',
};

interface SecretariatPanelProps {
  meta: OfficeMeta;
  onClose?: () => void;
  /** Render inside the settings page instead of a modal. */
  embedded?: boolean;
}

type NumberingForm = {
  pattern: string;
  padding: string;
  persian: boolean;
  letters: { incoming: string; outgoing: string; internal: string; contract: string };
};

const DEFAULT_LETTERS = { incoming: 'I', outgoing: 'O', internal: 'N', contract: 'C' };

function renderPreview(code: string, form: NumberingForm) {
  const sample = (form.pattern || '{year}/{code}/{type}/{seq}')
    .replace(/\{year\}/g, '1405')
    .replace(/\{code\}/g, code)
    .replace(/\{type\}/g, form.letters.outgoing || 'O')
    .replace(/\{seq\}/g, '1'.padStart(Number(form.padding) || 6, '0'));
  return form.persian
    ? sample.replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
    : sample;
}

/** Numbering rules for one secretariat, editable by admins and its managers. */
function NumberingEditor({ row, onSaved }: { row: SecretariatInfo; onSaved: (row: SecretariatInfo) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NumberingForm>({
    pattern: row.number_pattern || '{year}/{code}/{type}/{seq}',
    padding: String(row.sequence_padding ?? 6),
    persian: Boolean(row.persian_digits),
    letters: {
      incoming: row.type_letters?.incoming || '',
      outgoing: row.type_letters?.outgoing || '',
      internal: row.type_letters?.internal || '',
      contract: row.type_letters?.contract || '',
    },
  });

  const save = async () => {
    if (!form.pattern.includes('{seq}')) {
      toast('الگوی شماره باید شامل {seq} باشد', 'error');
      return;
    }
    const padding = Number(form.padding);
    if (!Number.isFinite(padding) || padding < 3 || padding > 10) {
      toast('تعداد ارقام شماره باید بین ۳ و ۱۰ باشد', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await officeApi.updateSecretariat(row.id, {
        number_pattern: form.pattern,
        sequence_padding: padding,
        persian_digits: form.persian,
        type_letters: {
          incoming: form.letters.incoming.trim(),
          outgoing: form.letters.outgoing.trim(),
          internal: form.letters.internal.trim(),
          contract: form.letters.contract.trim(),
        },
      });
      onSaved({ ...row, ...res.data.data });
      toast('تنظیمات شماره‌گذاری ذخیره شد', 'success');
      setOpen(false);
    } catch {
      toast('ذخیرهٔ تنظیمات شماره‌گذاری انجام نشد', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-nx-border p-2 dark:border-nx-navy-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-nx-mist">
          شمارهٔ بعدی: <span className="font-mono text-nx-navy dark:text-white" data-digits="latin">{renderPreview(row.code, form)}</span>
        </p>
        <button onClick={() => setOpen((value) => !value)}
          className="rounded-lg border border-nx-border px-2 py-1 text-[11px] text-nx-navy dark:border-nx-navy-border dark:text-white">
          {open ? 'بستن تنظیمات شماره‌گذاری' : 'تنظیمات شماره‌گذاری'}
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <label className="block text-[11px] text-nx-mist">
            الگوی شماره (جای‌نگهدارها: {'{year} {code} {type} {seq}'})
            <input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} dir="ltr"
              className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-2 py-1.5 font-mono text-xs dark:border-nx-navy-border dark:text-white" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-[11px] text-nx-mist">
              تعداد ارقام شمارهٔ ترتیبی
              <input value={form.padding} onChange={(e) => setForm({ ...form, padding: e.target.value })}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-2 py-1.5 text-xs dark:border-nx-navy-border dark:text-white" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([['incoming', 'وارده'], ['outgoing', 'صادره'], ['internal', 'داخلی'], ['contract', 'قرارداد']] as const).map(([key, label]) => (
                <label key={key} className="block text-[11px] text-nx-mist">
                  حرف {label}
                  <input value={form.letters[key]} placeholder={DEFAULT_LETTERS[key]}
                    onChange={(e) => setForm({ ...form, letters: { ...form.letters, [key]: e.target.value } })}
                    className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-2 py-1.5 text-center text-xs dark:border-nx-navy-border dark:text-white" />
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-nx-navy dark:text-white">
            <input type="checkbox" checked={form.persian} onChange={(e) => setForm({ ...form, persian: e.target.checked })} />
            نمایش اعداد شماره با ارقام فارسی (۰۱۲۳۴۵۶۷۸۹)
          </label>
          <div className="flex items-center justify-end gap-2">
            <button onClick={save} disabled={saving}
              className="rounded-lg bg-nx-blue px-3 py-1.5 text-xs text-white disabled:opacity-50">
              {saving ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیمات'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SecretariatPanel({ meta, onClose, embedded = false }: SecretariatPanelProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<SecretariatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ name: '', code: '' });
  const [memberDraft, setMemberDraft] = useState<Record<number, { userId: string; canRegister: boolean }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await officeApi.getSecretariats();
      setRows(res.data.data);
    } catch {
      toast('خطا در دریافت دبیرخانه‌ها', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.name.trim() || !draft.code.trim()) {
      toast('نام و کد دبیرخانه الزامی است', 'error');
      return;
    }
    try {
      await officeApi.createSecretariat({ name: draft.name, code: draft.code });
      setDraft({ name: '', code: '' });
      toast('دبیرخانه ایجاد شد', 'success');
      await load();
    } catch {
      toast('ایجاد دبیرخانه انجام نشد', 'error');
    }
  };

  const addMember = async (secretariatId: number) => {
    const entry = memberDraft[secretariatId];
    if (!entry?.userId) {
      toast('کاربر را انتخاب کنید', 'error');
      return;
    }
    try {
      await officeApi.addSecretariatMember(secretariatId, {
        user_id: Number(entry.userId), can_register: entry.canRegister,
      });
      setMemberDraft((prev) => ({ ...prev, [secretariatId]: { userId: '', canRegister: true } }));
      toast('عضو دبیرخانه ثبت شد', 'success');
      await load();
    } catch {
      toast('ثبت عضو انجام نشد', 'error');
    }
  };

  const removeMember = async (secretariatId: number, memberId: number) => {
    try {
      await officeApi.removeSecretariatMember(secretariatId, memberId);
      toast('عضو حذف شد', 'success');
      await load();
    } catch {
      toast('حذف عضو انجام نشد', 'error');
    }
  };

  return (
    <div
      className={embedded ? '' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'}
      onClick={embedded ? undefined : onClose}
    >
      <div
        className={
          embedded
            ? 'rounded-xl border border-nx-border bg-white p-5 dark:border-nx-navy-border dark:bg-nx-navy'
            : 'max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 dark:bg-nx-navy'
        }
        onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-nx-navy dark:text-white">دبیرخانه‌ها و ثبت‌کنندگان</h2>
            <p className="mt-1 text-xs text-nx-mist">
              کاربران از فهرست مرکزی کاربران شرکت انتخاب می‌شوند؛ فقط اعضای دارای حق «ثبت» می‌توانند برای نامه شماره رسمی بگیرند.
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-nx-mist hover:text-nx-danger"><X className="h-5 w-5" /></button>
          )}
        </div>

        <div className="mb-4 grid gap-2 rounded-lg border border-nx-border p-3 sm:grid-cols-3 dark:border-nx-navy-border">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="نام دبیرخانه"
            className="rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            placeholder="کد (مثلاً CEN)"
            className="rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
          <button onClick={create} className="flex items-center justify-center gap-1 rounded-lg bg-nx-blue px-3 py-2 text-sm text-white">
            <Plus className="h-4 w-4" /> ایجاد
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-nx-mist">در حال بارگذاری…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-nx-mist">دبیرخانه‌ای تعریف نشده است.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-nx-border p-3 dark:border-nx-navy-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-nx-navy dark:text-white">
                    {row.name} <span className="font-mono text-xs text-nx-mist">({row.code})</span>
                  </p>
                  {!row.is_active && <span className="text-xs text-nx-danger">غیرفعال</span>}
                </div>

                {row.members.length === 0 ? (
                  <p className="mt-2 text-xs text-nx-mist">عضوی ندارد؛ فقط مدیر/CEO می‌تواند ثبت کند.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {row.members.map((member) => (
                      <li key={member.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-nx-navy dark:text-white">{member.user_name}</span>
                        <span className="flex items-center gap-2">
                          <span className={member.can_register ? 'text-nx-teal' : 'text-nx-mist'}>
                            {member.can_register ? 'حق ثبت' : 'بدون حق ثبت'}
                          </span>
                          <button onClick={() => removeMember(row.id, member.id)} className="text-nx-mist hover:text-nx-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={memberDraft[row.id]?.userId || ''}
                    onChange={(e) => setMemberDraft((prev) => ({
                      ...prev, [row.id]: { ...prev[row.id], userId: e.target.value, canRegister: prev[row.id]?.canRegister ?? true },
                    }))}
                    className="min-w-0 flex-1 rounded-lg border border-nx-border bg-transparent px-2 py-1.5 text-xs dark:border-nx-navy-border dark:text-white">
                    <option value="">افزودن عضو…</option>
                    {meta.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                        {user.division_name ? ` — ${user.division_name}` : ''}
                        {user.role && ROLE_LABEL[user.role] ? ` (${ROLE_LABEL[user.role]})` : ''}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-nx-mist">
                    <input type="checkbox"
                      checked={memberDraft[row.id]?.canRegister ?? true}
                      onChange={(e) => setMemberDraft((prev) => ({
                        ...prev, [row.id]: { ...prev[row.id], canRegister: e.target.checked, userId: prev[row.id]?.userId || '' },
                      }))} />
                    حق ثبت
                  </label>
                  <button onClick={() => addMember(row.id)}
                    className="rounded-lg border border-nx-border px-2 py-1.5 text-xs text-nx-navy dark:border-nx-navy-border dark:text-white">
                    افزودن
                  </button>
                </div>

                <NumberingEditor
                  row={row}
                  onSaved={(updated) => setRows((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
