/**
 * Contract registry — each contract gets its own office letter automatically.
 *
 * Documents attach to that generated letter, so they inherit the same private
 * storage, download checks and audit trail as any other letter attachment.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle2, FileSignature, FileText, Link2, Loader2, Paperclip, Plus, Search, X,
} from 'lucide-react';
import { officeApi, type ContractRecord, type OfficeMeta } from '../../api/office';
import { useToast } from '../../components/Toast';
import JalaliDateInput from '../../components/JalaliDateInput';
import { apiErrorMessage } from '../../lib/apiError';
import { formatJalali } from '../../lib/jalali';

const CARD = 'rounded-xl border border-nx-border bg-white p-4 dark:border-nx-navy-border dark:bg-nx-navy';
const CURRENCIES = [
  { value: 'IRR', label: 'ریال' },
  { value: 'IRT', label: 'تومان' },
  { value: 'USD', label: 'دلار' },
  { value: 'EUR', label: 'یورو' },
];

function money(value: string | null, currency: string) {
  if (value === null || value === '') return '—';
  const label = CURRENCIES.find((item) => item.value === currency)?.label || currency;
  return `${Number(value).toLocaleString('fa-IR')} ${label}`;
}

type UploadRow = { file: File; progress: number; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string };

export default function ContractsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<OfficeMeta | null>(null);
  const [rows, setRows] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [rowUpload, setRowUpload] = useState<{ id: number; percent: number; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const rowFileInput = useRef<HTMLInputElement>(null);
  const rowUploadTarget = useRef<ContractRecord | null>(null);
  const [form, setForm] = useState({
    title: '', counterparty: '', contract_number: '', amount: '', currency: 'IRR',
    start_date_jalali: '', end_date_jalali: '', description: '', secretariat_id: '',
  });

  const load = async (term = '') => {
    setLoading(true);
    try {
      const res = await officeApi.getContracts(term || undefined);
      setRows(res.data.data);
    } catch (error) {
      toast(apiErrorMessage(error, 'دریافت قراردادها انجام نشد'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    officeApi.getMeta().then((res) => setMeta(res.data.data)).catch(() => undefined);
  }, []);

  const patchUpload = (index: number, patch: Partial<UploadRow>) => {
    setUploads((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setUploads((prev) => [
      ...prev,
      ...Array.from(list).map<UploadRow>((file) => ({ file, progress: 0, status: 'pending' })),
    ]);
  };

  const submit = async () => {
    if (!form.title.trim() || !form.counterparty.trim()) {
      toast('عنوان قرارداد و طرف قرارداد الزامی است', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await officeApi.createContract({
        title: form.title.trim(),
        counterparty: form.counterparty.trim(),
        contract_number: form.contract_number.trim(),
        amount: form.amount ? form.amount.replace(/[^\d]/g, '') : null,
        currency: form.currency,
        start_date_jalali: form.start_date_jalali,
        end_date_jalali: form.end_date_jalali,
        description: form.description.trim(),
        secretariat_id: form.secretariat_id ? Number(form.secretariat_id) : null,
      });
      const contract = res.data.data;
      toast(res.data.message || 'قرارداد ثبت شد', 'success');

      const letterId = contract.letter_id;
      if (letterId) {
        for (let index = 0; index < uploads.length; index += 1) {
          patchUpload(index, { status: 'uploading', progress: 0 });
          const data = new FormData();
          data.append('file', uploads[index].file);
          try {
            await officeApi.uploadAttachment(letterId, data, (percent) => patchUpload(index, { progress: percent }));
            patchUpload(index, { status: 'done', progress: 100 });
          } catch (error) {
            patchUpload(index, { status: 'error', error: apiErrorMessage(error, 'بارگذاری انجام نشد') });
          }
        }
      }

      setShowForm(false);
      setUploads([]);
      setForm({
        title: '', counterparty: '', contract_number: '', amount: '', currency: 'IRR',
        start_date_jalali: '', end_date_jalali: '', description: '', secretariat_id: '',
      });
      await load(query);
      if (letterId) navigate(`/erp/office/correspondence/${letterId}`);
    } catch (error) {
      toast(apiErrorMessage(error, 'ثبت قرارداد انجام نشد'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const pickRowFile = (contract: ContractRecord) => {
    rowUploadTarget.current = contract;
    rowFileInput.current?.click();
  };

  const uploadRowFile = async (file: File) => {
    const contract = rowUploadTarget.current;
    if (!contract?.letter_id) return;
    setRowUpload({ id: contract.id, percent: 0, name: file.name });
    const data = new FormData();
    data.append('file', file);
    try {
      await officeApi.uploadAttachment(contract.letter_id, data, (percent) => {
        setRowUpload({ id: contract.id, percent, name: file.name });
      });
      setRowUpload({ id: contract.id, percent: 100, name: file.name });
      toast(`«${file.name}» به مدارک قرارداد افزوده شد`, 'success');
      window.setTimeout(() => setRowUpload(null), 900);
    } catch (error) {
      setRowUpload(null);
      toast(apiErrorMessage(error, 'بارگذاری سند انجام نشد'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-nx-navy dark:text-white">
            <FileSignature className="h-5 w-5 text-nx-teal" /> قراردادها
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-nx-mist">
            ثبت قرارداد همراه با شماره و مبلغ؛ نامهٔ رسمی آن به‌صورت خودکار در دبیرخانه صادر می‌شود.
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-xl bg-nx-teal px-3 py-2 text-sm text-white transition hover:opacity-90">
          <Plus className="h-4 w-4" /> قرارداد جدید
        </button>
      </div>

      <div className={CARD}>
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-nx-border px-3 py-2 dark:border-nx-navy-border">
          <Search className="h-4 w-4 text-nx-mist" />
          <input value={query}
            onChange={(event) => { setQuery(event.target.value); void load(event.target.value); }}
            placeholder="جستجو در عنوان، طرف قرارداد یا شماره…"
            className="min-w-0 flex-1 bg-transparent text-sm text-nx-navy outline-none placeholder:text-nx-mist dark:text-white" />
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-nx-mist">در حال بارگذاری…</p>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <FileSignature className="mx-auto mb-2 h-8 w-8 text-nx-mist/60" />
            <p className="text-sm text-slate-500 dark:text-nx-mist">هنوز قراردادی ثبت نشده است.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((contract) => (
              <li key={contract.id} className="rounded-xl border border-nx-border p-3 dark:border-nx-navy-border">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-nx-navy dark:text-white">{contract.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-nx-mist">
                      {contract.counterparty}
                      {contract.contract_number ? ` · شمارهٔ قرارداد: ${contract.contract_number}` : ''}
                    </p>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-[10px] ${
                    contract.registration_status === 'registered'
                      ? 'bg-nx-teal/10 text-nx-teal'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {contract.registration_status === 'registered' ? 'نامه صادر شد' : 'پیش‌نویس نامه'}
                  </span>
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
                  <div><dt className="text-nx-mist">مبلغ</dt><dd className="text-nx-navy dark:text-white">{money(contract.amount, contract.currency)}</dd></div>
                  <div><dt className="text-nx-mist">شروع</dt><dd className="text-nx-navy dark:text-white">{contract.start_date_jalali ? formatJalali(contract.start_date_jalali) : '—'}</dd></div>
                  <div><dt className="text-nx-mist">پایان</dt><dd className="text-nx-navy dark:text-white">{contract.end_date_jalali ? formatJalali(contract.end_date_jalali) : '—'}</dd></div>
                  <div><dt className="text-nx-mist">شمارهٔ نامه</dt><dd className="nx-number text-nx-navy dark:text-white">{contract.letter_number || '—'}</dd></div>
                </dl>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {contract.letter_id && (
                    <Link to={`/erp/office/correspondence/${contract.letter_id}`}
                      className="flex items-center gap-1 rounded-lg border border-nx-border px-2 py-1.5 text-[11px] text-nx-navy dark:border-nx-navy-border dark:text-white">
                      <Link2 className="h-3.5 w-3.5" /> نامه و مدارک
                    </Link>
                  )}
                  {contract.letter_id && (
                    <button onClick={() => pickRowFile(contract)}
                      className="flex items-center gap-1 rounded-lg border border-nx-border px-2 py-1.5 text-[11px] text-nx-navy dark:border-nx-navy-border dark:text-white">
                      <Paperclip className="h-3.5 w-3.5" /> افزودن سند
                    </button>
                  )}
                  {rowUpload?.id === contract.id && (
                    <span className="flex items-center gap-1 text-[10px] text-nx-mist">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {rowUpload.percent === 100 ? 'بارگذاری شد' : `${rowUpload.percent}٪`}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <input ref={rowFileInput} type="file" className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void uploadRowFile(file);
          }} />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[8vh]"
          onClick={() => !saving && setShowForm(false)}>
          <div className={`w-full max-w-2xl ${CARD}`} onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-nx-navy dark:text-white">قرارداد جدید</h2>
              <button onClick={() => !saving && setShowForm(false)} className="text-nx-mist hover:text-nx-danger">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] text-nx-mist">
                عنوان قرارداد *
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              </label>
              <label className="block text-[11px] text-nx-mist">
                طرف قرارداد *
                <input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              </label>
              <label className="block text-[11px] text-nx-mist">
                شمارهٔ قرارداد
                <input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
                  dir="ltr"
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              </label>
              <label className="block text-[11px] text-nx-mist">
                مبلغ قرارداد
                <div className="mt-1 flex gap-2">
                  <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    inputMode="numeric" dir="ltr" placeholder="0"
                    className="min-w-0 flex-1 rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="rounded-lg border border-nx-border bg-transparent px-2 text-xs dark:border-nx-navy-border dark:text-white">
                    {CURRENCIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
              </label>
              <label className="block text-[11px] text-nx-mist">
                تاریخ شروع
                <div className="mt-1"><JalaliDateInput value={form.start_date_jalali}
                  onChange={(value) => setForm({ ...form, start_date_jalali: value })} /></div>
              </label>
              <label className="block text-[11px] text-nx-mist">
                تاریخ پایان
                <div className="mt-1"><JalaliDateInput value={form.end_date_jalali}
                  onChange={(value) => setForm({ ...form, end_date_jalali: value })} /></div>
              </label>
              <label className="block text-[11px] text-nx-mist">
                دبیرخانهٔ صادرکنندهٔ نامه
                <select value={form.secretariat_id} onChange={(e) => setForm({ ...form, secretariat_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
                  <option value="">— انتخاب دبیرخانه —</option>
                  {(meta?.secretariats || []).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-nx-mist sm:col-span-2">
                توضیحات
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white" />
              </label>
            </div>

            <div className="mt-3 rounded-lg border border-dashed border-nx-border p-3 dark:border-nx-navy-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-nx-navy dark:text-white">
                  <Paperclip className="h-3.5 w-3.5 text-nx-blue" /> مدارک مرتبط
                </p>
                <button onClick={() => fileInput.current?.click()}
                  className="flex items-center gap-1 rounded-lg border border-nx-border px-2 py-1.5 text-[11px] dark:border-nx-navy-border">
                  <Plus className="h-3.5 w-3.5" /> افزودن فایل
                </button>
                <input ref={fileInput} type="file" multiple className="hidden"
                  onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
              </div>
              {uploads.length === 0 ? (
                <p className="mt-1 text-[10px] text-nx-mist">فایل‌ها پس از ثبت قرارداد به نامهٔ آن پیوست می‌شوند.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {uploads.map((row, index) => (
                    <li key={`${row.file.name}-${index}`} className="rounded-lg border border-nx-border p-2 text-[11px] dark:border-nx-navy-border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-nx-mist" />
                        <span className="min-w-0 flex-1 truncate text-nx-navy dark:text-white">{row.file.name}</span>
                        {row.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-nx-blue" />}
                        {row.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-nx-teal" />}
                        {row.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-nx-danger" />}
                        {row.status === 'pending' && (
                          <button onClick={() => setUploads((prev) => prev.filter((_, i) => i !== index))}
                            className="text-nx-mist hover:text-nx-danger"><X className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                      {(row.status === 'uploading' || row.status === 'done') && (
                        <div className="mt-1 h-1 overflow-hidden rounded bg-black/10 dark:bg-white/10">
                          <div className={`h-full rounded ${row.status === 'done' ? 'bg-nx-teal' : 'bg-nx-blue'}`}
                            style={{ width: `${row.progress}%` }} />
                        </div>
                      )}
                      {row.error && <p className="mt-1 text-[10px] text-nx-danger">{row.error}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => !saving && setShowForm(false)}
                className="rounded-lg border border-nx-border px-3 py-2 text-sm dark:border-nx-navy-border dark:text-white">
                انصراف
              </button>
              <button onClick={submit} disabled={saving}
                className="rounded-lg bg-nx-teal px-4 py-2 text-sm text-white disabled:opacity-60">
                {saving ? 'در حال ثبت…' : 'ثبت قرارداد و صدور نامه'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
