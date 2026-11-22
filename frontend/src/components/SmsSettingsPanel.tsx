/**
 * SMS gateway configuration card, shared by the CRM SMS page and Settings.
 * Secrets are only posted when the admin types a new value; the API returns
 * `has_api_key` / `has_password` flags instead of the stored values.
 */
import { useEffect, useState } from 'react';
import api from '../api/client';
import { useToast } from './Toast';
import { apiErrorMessage } from '../lib/apiError';
import { Save, ShieldCheck } from 'lucide-react';

export interface SmsGatewaySettings {
  provider: string;
  sender: string;
  endpoint: string;
  username: string;
  enabled: boolean;
  has_api_key: boolean;
  has_password: boolean;
}

export const SMS_PROVIDERS = [
  { id: 'kavenegar', label: 'کاوه‌نگار' },
  { id: 'niksms', label: 'نیک‌اس‌ام‌اس' },
  { id: 'generic', label: 'سرویس سفارشی' },
];

const EMPTY: SmsGatewaySettings = {
  provider: 'kavenegar', sender: '', endpoint: '', username: '',
  enabled: false, has_api_key: false, has_password: false,
};

const INPUT = 'mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm text-nx-navy outline-none focus:ring-2 focus:ring-nx-blue dark:border-nx-navy-border dark:text-white';
const LABEL = 'block text-[11px] text-slate-500 dark:text-nx-mist';

export default function SmsSettingsPanel({ onSaved }: { onSaved?: (settings: SmsGatewaySettings) => void }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SmsGatewaySettings>(EMPTY);
  const [canManage, setCanManage] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/crm/sms/settings/')
      .then((response) => {
        const next = { ...EMPTY, ...(response.data.data || {}) };
        setSettings(next);
        setCanManage(Boolean(response.data.can_manage));
        onSaved?.(next);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const response = await api.put('/crm/sms/settings/', {
        provider: settings.provider,
        sender: settings.sender,
        endpoint: settings.endpoint,
        username: settings.username,
        enabled: settings.enabled,
        api_key: apiKey || undefined,
        password: password || undefined,
      });
      const next = { ...EMPTY, ...(response.data.data || {}) };
      setSettings(next);
      onSaved?.(next);
      setApiKey('');
      setPassword('');
      toast('تنظیمات پیامک ذخیره شد', 'success');
    } catch (error) {
      toast(apiErrorMessage(error, 'ذخیرهٔ تنظیمات انجام نشد'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-xl border border-nx-border bg-white p-4 text-xs text-slate-500 dark:border-nx-navy-border dark:bg-nx-navy dark:text-nx-mist">
        تغییر تنظیمات پیامک فقط برای مدیران مجاز است.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-nx-border bg-white p-4 dark:border-nx-navy-border dark:bg-nx-navy">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-nx-navy dark:text-white">
        <ShieldCheck className="h-4 w-4 text-nx-blue" /> تنظیمات سرویس پیامک
      </h2>
      <div className="space-y-3">
        <div>
          <p className={LABEL}>سرویس‌دهنده</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {SMS_PROVIDERS.map((provider) => (
              <button key={provider.id} type="button"
                onClick={() => setSettings((prev) => ({ ...prev, provider: provider.id }))}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                  settings.provider === provider.id
                    ? 'border-nx-teal bg-nx-teal/10 text-nx-teal'
                    : 'border-nx-border text-slate-600 dark:border-nx-navy-border dark:text-nx-mist'
                }`}>
                {provider.label}
              </button>
            ))}
          </div>
        </div>
        <label className={LABEL}>شمارهٔ فرستنده
          <input dir="ltr" value={settings.sender}
            onChange={(event) => setSettings((prev) => ({ ...prev, sender: event.target.value }))} className={INPUT} />
        </label>
        {settings.provider === 'niksms' && (
          <label className={LABEL}>نام کاربری پنل
            <input dir="ltr" value={settings.username}
              onChange={(event) => setSettings((prev) => ({ ...prev, username: event.target.value }))} className={INPUT} />
          </label>
        )}
        {settings.provider === 'generic' && (
          <label className={LABEL}>آدرس سرویس (URL)
            <input dir="ltr" value={settings.endpoint}
              onChange={(event) => setSettings((prev) => ({ ...prev, endpoint: event.target.value }))} className={INPUT} />
          </label>
        )}
        <label className={LABEL}>کلید API {settings.has_api_key ? '(ذخیره شده — برای تغییر مقدار جدید وارد کنید)' : ''}
          <input dir="ltr" type="password" value={apiKey} autoComplete="new-password"
            onChange={(event) => setApiKey(event.target.value)} placeholder="••••••••" className={INPUT} />
        </label>
        {settings.provider === 'niksms' && (
          <label className={LABEL}>رمز پنل {settings.has_password ? '(ذخیره شده)' : ''}
            <input dir="ltr" type="password" value={password} autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)} className={INPUT} />
          </label>
        )}
        <label className="flex items-center justify-between gap-2 text-xs text-nx-navy dark:text-white">
          فعال‌سازی ارسال پیامک
          <input type="checkbox" checked={settings.enabled}
            onChange={(event) => setSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
            className="h-4 w-4 accent-nx-teal" />
        </label>
        <button onClick={save} disabled={saving}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-nx-blue px-3 py-2 text-sm text-white disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیمات'}
        </button>
      </div>
    </section>
  );
}
