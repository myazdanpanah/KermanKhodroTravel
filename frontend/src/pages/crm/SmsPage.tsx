/**
 * CRM SMS: compose single or bulk SMS with dynamic variable templating,
 * view delivery history and configure the gateway.
 */
import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { apiErrorMessage } from '../../lib/apiError';
import { crmApi, Campaign } from '../../api/crm';
import SmsSettingsPanel, { SMS_PROVIDERS, SmsGatewaySettings } from '../../components/SmsSettingsPanel';
import BulkSmsSender from './BulkSmsSender';
import { MessageSquare, Send, Sparkles, Sliders, RefreshCw, Mail } from 'lucide-react';

const CARD = 'rounded-xl border border-nx-border bg-white p-5 dark:border-nx-navy-border dark:bg-nx-navy shadow-sm';
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
  const [activeTab, setActiveTab] = useState<'bulk' | 'single' | 'settings'>('bulk');
  const [messages, setMessages] = useState<Message[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [settings, setSettings] = useState<SmsGatewaySettings | null>(null);

  // Single SMS state
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadMessages = () => {
    setRefreshing(true);
    api.get('/crm/sms/messages/')
      .then((response) => setMessages(response.data.data || []))
      .catch(() => toast('دریافت تاریخچهٔ پیامک انجام نشد', 'error'))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    loadMessages();
    crmApi.getCampaigns()
      .then((response) => setCampaigns(response.data.data || []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendSingle = async () => {
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
      toast('پیامک با موفقیت ارسال شد', 'success');
      setBody('');
      loadMessages();
    } catch (error) {
      toast(apiErrorMessage(error, 'ارسال پیامک انجام نشد'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-bold text-nx-navy dark:text-white">
            <MessageSquare className="h-6 w-6 text-nx-blue" /> سامانه ارسال پیامک
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-nx-mist">
            ارسال پیامک انبوه هوشمند با جایگذاری متغیرها ({'{نام}'}، {'{مبلغ}'}، {'{شماره_نامه}'})، ارسال تکی و تنظیم درگاه.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-nx-border bg-slate-100 p-1 dark:border-nx-navy-border dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('bulk')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'bulk'
                ? 'bg-white text-nx-blue shadow-sm dark:bg-nx-navy dark:text-white'
                : 'text-slate-600 hover:text-nx-navy dark:text-nx-mist dark:hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 text-nx-teal" /> ارسال انبوه هوشمند (Bulk SMS)
          </button>
          <button
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'single'
                ? 'bg-white text-nx-blue shadow-sm dark:bg-nx-navy dark:text-white'
                : 'text-slate-600 hover:text-nx-navy dark:text-nx-mist dark:hover:text-white'
            }`}
          >
            <Mail className="h-4 w-4" /> ارسال تکی
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-white text-nx-blue shadow-sm dark:bg-nx-navy dark:text-white'
                : 'text-slate-600 hover:text-nx-navy dark:text-nx-mist dark:hover:text-white'
            }`}
          >
            <Sliders className="h-4 w-4" /> تنظیمات سرویس
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'bulk' && (
        <BulkSmsSender
          campaigns={campaigns}
          isGatewayEnabled={Boolean(settings?.enabled)}
          onSent={loadMessages}
        />
      )}

      {activeTab === 'single' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className={`${CARD} xl:col-span-2`}>
            <h2 className="mb-4 text-sm font-bold text-nx-navy dark:text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-nx-blue" /> ارسال پیامک تکی
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={LABEL}>
                شمارهٔ موبایل گیرنده
                <input
                  dir="ltr"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="09123456789"
                  className={INPUT}
                />
              </label>
              <label className={LABEL}>
                کمپین مرتبط (اختیاری)
                <select
                  value={campaignId}
                  onChange={(event) => setCampaignId(event.target.value)}
                  className={INPUT}
                >
                  <option value="">— بدون کمپین —</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={`${LABEL} mt-4`}>
              متن پیامک
              <textarea
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={1000}
                className={`${INPUT} resize-y`}
                placeholder="متن پیام…"
              />
              <span className="mt-1 block text-[10px] text-slate-400 dark:text-nx-mist">
                {body.length.toLocaleString('fa-IR')} از ۱٬۰۰۰ کاراکتر
              </span>
            </label>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-nx-border pt-4 dark:border-nx-navy-border">
              <p className="text-[11px] text-slate-500 dark:text-nx-mist">
                {settings?.enabled
                  ? `درگاه فعال: ${SMS_PROVIDERS.find((p) => p.id === settings.provider)?.label || settings.provider}`
                  : 'ارسال غیرفعال است؛ ابتدا سرویس را در تنظیمات پیامک فعال کنید.'}
              </p>
              <button
                onClick={sendSingle}
                disabled={sending || !settings?.enabled}
                className="flex items-center gap-1.5 rounded-xl bg-nx-blue px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-nx-blue/90 disabled:opacity-50 transition-all"
              >
                <Send className="h-4 w-4" /> {sending ? 'در حال ارسال…' : 'ارسال پیامک'}
              </button>
            </div>
          </section>

          <SmsSettingsPanel onSaved={setSettings} />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl">
          <SmsSettingsPanel onSaved={setSettings} />
        </div>
      )}

      {/* Delivery History Section */}
      <section className={CARD}>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-nx-border dark:border-nx-navy-border">
          <h2 className="text-sm font-bold text-nx-navy dark:text-white flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-nx-blue" /> تاریخچهٔ پیامک‌های ارسالی
          </h2>
          <button
            onClick={loadMessages}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-lg border border-nx-border px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-nx-navy-border dark:text-nx-mist dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            به‌روزرسانی تاریخچه
          </button>
        </div>

        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-nx-mist py-6 text-center">هنوز پیامکی ارسال نشده است.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-nx-border dark:border-nx-navy-border">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <tr className="border-b border-nx-border text-right dark:border-nx-navy-border">
                  <th className="px-3 py-2.5 font-medium">شماره گیرنده</th>
                  <th className="px-3 py-2.5 font-medium">متن پیام</th>
                  <th className="px-3 py-2.5 font-medium">کمپین</th>
                  <th className="px-3 py-2.5 font-medium">وضعیت</th>
                  <th className="px-3 py-2.5 font-medium">زمان ارسال</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nx-border/60 dark:divide-nx-navy-border/60">
                {messages.map((message) => (
                  <tr key={message.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-nx-navy dark:text-slate-200" dir="ltr">
                      {message.phone}
                    </td>
                    <td className="max-w-[28rem] truncate px-3 py-2 text-slate-600 dark:text-nx-mist" title={message.body}>
                      {message.body}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-nx-mist">
                      {message.campaign || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                          message.status === 'sent'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                        title={message.error || undefined}
                      >
                        {message.status === 'sent' ? 'ارسال شد' : `ناموفق: ${message.error || 'خطای درگاه'}`}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-nx-mist">
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
