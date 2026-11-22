/**
 * Settings tab: upload the organization's B-series fonts (B Nazanin, B Titr…)
 * used by DOCX/XLSX previews. The family name must match the name inside the
 * document; the file name is used when no name is typed.
 */
import { useEffect, useRef, useState } from 'react';
import { FileUp, Trash2, Type } from 'lucide-react';
import api from '../api/client';
import { useToast } from './Toast';
import { apiErrorMessage } from '../lib/apiError';
import { CompanyFont, applyCompanyFonts, loadCompanyFonts } from '../lib/companyFonts';

const SAMPLE = 'بسم الله الرحمن الرحیم — نمونهٔ نمایش فونت فارسی ۱۲۳۴۵۶۷۸۹';

export default function FontsTab() {
  const { toast } = useToast();
  const [fonts, setFonts] = useState<CompanyFont[]>([]);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async (force = false) => {
    const rows = await loadCompanyFonts(force);
    setFonts(rows);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const upload = async () => {
    if (!file) {
      toast('ابتدا فایل فونت را انتخاب کنید', 'error');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (name.trim()) form.append('name', name.trim());
      await api.post('/auth/fonts/', form);
      toast('فونت آپلود و فعال شد', 'success');
      setFile(null);
      setName('');
      if (inputRef.current) inputRef.current.value = '';
      await refresh(true);
    } catch (error) {
      toast(apiErrorMessage(error, 'آپلود فونت انجام نشد'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (font: CompanyFont) => {
    if (!window.confirm(`فونت «${font.name}» حذف شود؟`)) return;
    try {
      await api.delete(`/auth/fonts/${font.id}/`);
      const rows = fonts.filter((row) => row.id !== font.id);
      setFonts(rows);
      applyCompanyFonts(rows);
      toast('فونت حذف شد', 'success');
    } catch (error) {
      toast(apiErrorMessage(error, 'حذف فونت انجام نشد'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-nx-border bg-white p-5 dark:border-nx-navy-border dark:bg-nx-navy">
        <h3 className="flex items-center gap-2 text-sm font-bold text-nx-navy dark:text-white">
          <Type className="h-4 w-4 text-nx-blue" /> فونت‌های پیش‌نمایش اسناد
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-nx-mist">
          فونت‌های سری B (مثل B Nazanin و B Titr) را این‌جا آپلود کنید تا پیش‌نمایش Word و Excel دقیقاً با همان فونت رندر شود.
          «نام فونت» باید همان نامی باشد که داخل فایل Word استفاده شده است.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-[11px] text-slate-500 dark:text-nx-mist">
            نام فونت (مثلاً B Nazanin)
            <input value={name} onChange={(event) => setName(event.target.value)}
              placeholder="B Nazanin"
              className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm text-nx-navy dark:border-nx-navy-border dark:text-white" />
          </label>
          <label className="block text-[11px] text-slate-500 dark:text-nx-mist">
            فایل فونت (ttf / otf / woff / woff2)
            <input ref={inputRef} type="file" accept=".ttf,.otf,.woff,.woff2"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-1.5 text-xs text-nx-navy file:me-2 file:rounded file:border-0 file:bg-nx-blue/10 file:px-2 file:py-1 file:text-nx-blue dark:border-nx-navy-border dark:text-white" />
          </label>
        </div>
        <button onClick={upload} disabled={uploading}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-nx-blue px-4 py-2 text-sm text-white disabled:opacity-60">
          <FileUp className="h-4 w-4" /> {uploading ? 'در حال آپلود…' : 'آپلود فونت'}
        </button>
      </div>

      <div className="rounded-xl border border-nx-border bg-white p-5 dark:border-nx-navy-border dark:bg-nx-navy">
        <h3 className="mb-3 text-sm font-bold text-nx-navy dark:text-white">
          فونت‌های فعال ({fonts.length.toLocaleString('fa-IR')})
        </h3>
        {loading ? (
          <p className="text-xs text-slate-500 dark:text-nx-mist">در حال بارگذاری…</p>
        ) : fonts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-nx-mist">هنوز فونتی آپلود نشده است؛ پیش‌نمایش‌ها با فونت پیش‌فرض نمایش داده می‌شوند.</p>
        ) : (
          <ul className="space-y-2">
            {fonts.map((font) => (
              <li key={font.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-nx-border px-3 py-2 dark:border-nx-navy-border">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-nx-navy dark:text-white" dir="ltr">{font.name}</p>
                  <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-200"
                    style={{ fontFamily: `'${font.name}', Vazirmatn, sans-serif` }} dir="rtl">
                    {SAMPLE}
                  </p>
                </div>
                <button onClick={() => remove(font)} title="حذف فونت"
                  className="text-slate-400 hover:text-rose-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
