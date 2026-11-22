/**
 * CRM SMS: compose an SMS, see the delivery history and configure the gateway.
 * The gateway card itself is shared with Settings (SmsSettingsPanel).
 */
import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { apiErrorMessage } from '../../lib/apiError';
import { crmApi, Campaign } from '../../api/crm';
import SmsSettingsPanel, { SMS_PROVIDERS, SmsGatewaySettings } from '../../components/SmsSettingsPanel';
import { MessageSquare, Send } from 'lucide-react';

const CARD = 'rounded-xl border border-nx-border bg-white p-4 dark:border-nx-navy-border dark:bg-nx-navy';
const INPUT = 'mt-1 w-full rounded-lg border border-nx-border bg-transparent px-3 py-2 text-sm text-nx-navy outline-none focus:ring-2 focus:ring-nx-blue dark:border-nx-navy-border dark:text-white';
const LABEL = 'block text-[11px] text-slate-500 dark:text-nx-mist';

interface Message {
  id: number;
  phone: string;
  body: string;
  provider: string;
  status: 'sent' | 'failed';
  error: string;
  campaign: string;
  created_at: string;
}

export default function SmsPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [settings, setSettings] = useState<SmsGatewaySettings | null>(null);
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = () => {
    api.get('/crm/sms/messages/')
      .then((response) => setMessages(response.data.data || []))
      .catch(() => toast('دریافت تاریخچهٔ پیامک انجام نشد', 'error'));
  };

  useEffect(() => {
    loadMessages();
    crmApi.getCampaigns()
      .then((response) => setCampaigns(response.data.data || []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    if (!phone.trim() || !body.trim()) {
      toast('شماره و متن پیامک را وارد کنید', 'error');
      return;
    }
    setSending(true);
    try {
      await api.post('/crm/sms/send/', {
        phone: phone.trim(),
        message: body.trim(),
        campaign_id: campaignId || undefined,
      });
      toast('پیامک ارسال شد', 'success');
      setBody('');
      loadMessages();
    } catch (error) {
      toast(apiErrorMessage(error, 'ارسال پیامک انجام نشد'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-nx-navy dark:text-white">
          <MessageSquare className="h-5 w-5 text-nx-teal" /> پیامک‌ها
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-nx-mist">
          ارسال پیامک به مشتریان و سرنخ‌ها از طریق سرویس پیامکی شرکت.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className={`${CARD} xl:col-span-2`}>
          <h2 className="mb-3 text-sm font-semibold text-nx-navy dark:text-white">ارسال پیامک</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={LABEL}>شمارهٔ موبایل
              <input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)}
                placeholder="09123456789" className={INPUT} />
            </label>
            <label className={LABEL}>کمپین مرتبط (اختیاری)
              <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className={INPUT}>
                <option value="">— بدون کمپین —</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={`${LABEL} mt-3`}>متن پیامک
            <textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)}
              maxLength={1000} className={`${INPUT} resize-y`} placeholder="متن پیام…" />
            <span className="mt-1 block text-[10px] text-slate-400 dark:text-nx-mist">
              {body.length.toLocaleString('fa-IR')} از ۱٬۰۰۰ کاراکتر
            </span>
          </label>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500 dark:text-nx-mist">
              {settings?.enabled
                ? `سرویس فعال: ${SMS_PROVIDERS.find((provider) => provider.id === settings.provider)?.label || settings.provider}`
                : 'ارسال غیرفعال است؛ ابتدا سرویس را در تنظیمات پیامک فعال کنید.'}
            </p>
            <button onClick={send} disabled={sending || !settings?.enabled}
              className="flex items-center gap-1.5 rounded-lg bg-nx-teal px-4 py-2 text-sm text-white disabled:opacity-50">
              <Send className="h-4 w-4" /> {sending ? 'در حال ارسال…' : 'ارسال'}
            </button>
          </div>
        </section>

        <SmsSettingsPanel onSaved={setSettings} />
      </div>

      <section className={CARD}>
        <h2 className="mb-3 text-sm font-semibold text-nx-navy dark:text-white">تاریخچهٔ ارسال</h2>
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-nx-mist">هنوز پیامکی ارسال نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-nx-border text-right text-slate-500 dark:border-nx-navy-border dark:text-nx-mist">
                  <th className="px-2 py-2 font-medium">شماره</th>
                  <th className="px-2 py-2 font-medium">متن</th>
                  <th className="px-2 py-2 font-medium">کمپین</th>
                  <th className="px-2 py-2 font-medium">وضعیت</th>
                  <th className="px-2 py-2 font-medium">زمان</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.id} className="border-b border-nx-border/60 dark:border-nx-navy-border/60">
                    <td className="whitespace-nowrap px-2 py-2 text-nx-navy dark:text-slate-200" dir="ltr">{message.phone}</td>
                    <td className="max-w-[22rem] truncate px-2 py-2 text-slate-600 dark:text-nx-mist" title={message.body}>{message.body}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-slate-600 dark:text-nx-mist">{message.campaign || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                        message.status === 'sent'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`} title={message.error || undefined}>
                        {message.status === 'sent' ? 'ارسال شد' : 'ناموفق'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-slate-500 dark:text-nx-mist">
                      {new Date(message.created_at).toLocaleString('fa-IR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
