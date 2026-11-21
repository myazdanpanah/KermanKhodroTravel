/**
 * Office workbench — a dashboard of the cartable, not the letter list itself.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Clock, Eye, FileEdit, Inbox, Mail, MailOpen, Plus, Send,
} from 'lucide-react';
import { officeApi, Letter, WorkbenchSummary } from '../../api/office';
import { useToast } from '../../components/Toast';
import { formatJalali } from '../../lib/jalali';

const TYPE_LABEL: Record<string, string> = { incoming: 'وارده', outgoing: 'صادره', internal: 'داخلی', contract: 'قرارداد' };
const PRIORITY_LABEL: Record<string, string> = { low: 'کم', normal: 'عادی', high: 'زیاد', urgent: 'فوری' };
const STATUS_LABEL: Record<string, string> = {
  open: 'باز', in_progress: 'در جریان', awaiting_reply: 'در انتظار پاسخ',
  answered: 'پاسخ داده‌شده', closed: 'بسته‌شده',
};

const CARD = 'rounded-xl border border-nx-border bg-white p-4 text-right transition hover:border-nx-blue/50 dark:border-nx-navy-border dark:bg-nx-navy';

interface StatCard {
  key: string;
  label: string;
  hint: string;
  value: number;
  icon: typeof Inbox;
  accent: string;
  bucket?: string;
}

export default function WorkbenchPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<WorkbenchSummary | null>(null);
  const [recent, setRecent] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([officeApi.getWorkbench(), officeApi.getWorkbenchList('inbox')])
      .then(([stats, list]) => {
        setSummary(stats.data.data);
        setRecent(list.data.data.slice(0, 6));
      })
      .catch(() => toast('خطا در دریافت کارتابل', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const cards: StatCard[] = [
    { key: 'incoming', label: 'نامه‌های وارده', hint: 'در دفتر وارده', value: summary?.types.incoming ?? 0,
      icon: Inbox, accent: 'text-nx-blue bg-nx-blue/10', bucket: 'inbox' },
    { key: 'outgoing', label: 'نامه‌های صادره', hint: 'در دفتر صادره', value: summary?.types.outgoing ?? 0,
      icon: Send, accent: 'text-nx-teal bg-nx-teal/10', bucket: 'sent' },
    { key: 'internal', label: 'نامه‌های داخلی', hint: 'مکاتبات درون‌سازمانی', value: summary?.types.internal ?? 0,
      icon: Mail, accent: 'text-nx-mist bg-black/5 dark:bg-white/10', bucket: 'inbox' },
    { key: 'action', label: 'نیازمند اقدام من', hint: 'در انتظار اقدام شما', value: summary?.buckets.action ?? 0,
      icon: AlertTriangle, accent: 'text-nx-warning bg-nx-warning-950', bucket: 'action' },
    { key: 'unread', label: 'خوانده‌نشده', hint: 'نامه‌های جدید شما', value: summary?.unread ?? 0,
      icon: MailOpen, accent: 'text-nx-blue bg-nx-blue/10', bucket: 'inbox' },
    { key: 'cc', label: 'رونوشت‌ها', hint: 'در جریان برای اطلاع', value: summary?.buckets.cc ?? 0,
      icon: Eye, accent: 'text-nx-teal bg-nx-teal/10', bucket: 'cc' },
    { key: 'drafts', label: 'پیش‌نویس‌ها', hint: 'ثبت‌نشده', value: summary?.buckets.drafts ?? 0,
      icon: FileEdit, accent: 'text-nx-mist bg-black/5 dark:bg-white/10', bucket: 'drafts' },
    { key: 'overdue', label: 'معوق', hint: 'مهلت گذشته', value: summary?.buckets.overdue ?? 0,
      icon: Clock, accent: 'text-nx-danger bg-nx-danger/10', bucket: 'overdue' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-nx-navy dark:text-white">میزکار اداری</h1>
          <p className="mt-1 text-sm text-nx-mist">نمای کلی مکاتبات، اقدام‌های باز و وضعیت کارتابل شما</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('/erp/office/correspondence')}
            className="flex items-center gap-2 rounded-lg border border-nx-border px-4 py-2 text-sm text-nx-navy dark:border-nx-navy-border dark:text-white">
            همهٔ نامه‌ها <ArrowLeft className="h-4 w-4" />
          </button>
          <button onClick={() => navigate('/erp/office/correspondence?new=1')}
            className="flex items-center gap-2 rounded-lg bg-nx-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> نامه جدید
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button key={card.key} className={CARD}
            onClick={() => navigate(`/erp/office/correspondence?bucket=${card.bucket}`)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-nx-mist">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-nx-navy dark:text-white">
                  {loading ? '—' : card.value.toLocaleString('fa-IR')}
                </p>
                <p className="mt-1 text-[11px] text-nx-mist">{card.hint}</p>
              </div>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${card.accent}`}>
                <card.icon className="h-5 w-5" />
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-nx-border bg-white dark:border-nx-navy-border dark:bg-nx-navy">
        <div className="flex items-center justify-between gap-2 border-b border-nx-border p-4 dark:border-nx-navy-border">
          <div>
            <h2 className="text-sm font-semibold text-nx-navy dark:text-white">نامه‌های اخیر کارتابل</h2>
            <p className="mt-0.5 text-[11px] text-nx-mist">آخرین نامه‌های در دسترس شما</p>
          </div>
          <button onClick={() => navigate('/erp/office/correspondence')}
            className="text-xs text-nx-blue hover:opacity-70">مشاهدهٔ همه</button>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-nx-mist">در حال بارگذاری…</p>
        ) : recent.length === 0 ? (
          <p className="p-6 text-sm text-nx-mist">هنوز نامه‌ای در کارتابل شما نیست.</p>
        ) : (
          <ul className="divide-y divide-nx-border dark:divide-nx-navy-border">
            {recent.map((letter) => (
              <li key={letter.id}>
                <button onClick={() => navigate(`/erp/office/correspondence/${letter.id}`)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-right hover:bg-nx-blue/5">
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
    </div>
  );
}
