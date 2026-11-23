/**
 * Unified Global Search:
 * Searches across all system entities:
 * - Office Correspondence (letters)
 * - Billing Invoices & Payments
 * - Payers & Customers
 * - CRM Leads & Opportunities
 * - Users & Employees
 * - Contracts
 * - System navigation destinations
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  X,
  CreditCard,
  Building2,
  Users,
  User,
  FileSignature,
  RefreshCw,
  Compass,
} from 'lucide-react';
import api from '../api/client';

const DESTINATIONS = [
  { label: 'داشبورد مدیریتی ERP', to: '/erp', category: 'page' },
  { label: 'داشبورد هوش تجاری (BI)', to: '/dashboards', category: 'page' },
  { label: 'پیام‌رسان و گفتگوها (Orbit)', to: '/orbit', category: 'page' },
  { label: 'صورت‌حساب‌های مالی', to: '/erp/billing/invoices', category: 'page' },
  { label: 'صدور صورت‌حساب جدید', to: '/erp/billing/issue', category: 'page' },
  { label: 'پرداخت‌ها و تراکنش‌ها', to: '/erp/billing/payments', category: 'page' },
  { label: 'طرف‌های حساب و شرکت‌ها', to: '/erp/billing/payers', category: 'page' },
  { label: 'مشتریان مالی', to: '/erp/customers', category: 'page' },
  { label: 'میزکار اداری و کارتابل', to: '/erp/office', category: 'page' },
  { label: 'فهرست نامه‌ها و مکاتبات', to: '/erp/office/correspondence', category: 'page' },
  { label: 'ثبت و پیش‌نویس نامه جدید', to: '/erp/office/correspondence?new=1', category: 'page' },
  { label: 'قراردادهای دبیرخانه', to: '/erp/office/contracts', category: 'page' },
  { label: 'مدیریت و ویرایش پایگاه داده (SSMS)', to: '/db-manager', category: 'page' },
  { label: 'کنسول کوئری SQL', to: '/db-manager/sql', category: 'page' },
  { label: 'ارسال پیامک تکی و انبوه (SMS)', to: '/erp/crm/sms', category: 'page' },
  { label: 'CRM: سرنخ‌ها', to: '/erp/crm/leads', category: 'page' },
  { label: 'CRM: فرصت‌های فروش', to: '/erp/crm/opportunities', category: 'page' },
  { label: 'CRM: کمپین‌ها', to: '/erp/crm/campaigns', category: 'page' },
  { label: 'تنظیمات سامانه', to: '/erp/settings', category: 'page' },
  { label: 'کاربران و پرسنل', to: '/erp/settings/users', category: 'page' },
  { label: 'دبیرخانه‌ها', to: '/erp/settings/secretariats', category: 'page' },
];

interface ServerSearchResult {
  key: string;
  category: 'correspondence' | 'invoice' | 'payment' | 'customer' | 'crm' | 'user' | 'contract' | 'page';
  category_label: string;
  title: string;
  subtitle: string;
  to: string;
}

interface ResultItem {
  key: string;
  category: string;
  category_label: string;
  title: string;
  subtitle: string;
  to: string;
}

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [serverResults, setServerResults] = useState<ServerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setServerResults([]);
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Execute search against backend
  const executeSearch = (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term) {
      setServerResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    api.get<{ success: boolean; results: ServerSearchResult[] }>('/search/', {
      params: { q: term },
    })
      .then((res) => {
        setServerResults(res.data.results || []);
      })
      .catch(() => {
        setServerResults([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (!term) {
      setServerResults([]);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      executeSearch(term);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [query, open]);

  // Merge static destination shortcuts with live backend search results
  const results = useMemo<ResultItem[]>(() => {
    const term = query.trim().toLowerCase();

    // Matching static pages
    const matchingPages = DESTINATIONS
      .filter((item) => !term || item.label.toLowerCase().includes(term))
      .slice(0, term ? 4 : 8)
      .map<ResultItem>((item) => ({
        key: `page-${item.to}`,
        category: 'page',
        category_label: 'بخش‌های سیستم',
        title: item.label,
        subtitle: 'رفتن به صفحه',
        to: item.to,
      }));

    // Server results
    const items = serverResults.map<ResultItem>((item) => ({
      key: item.key,
      category: item.category,
      category_label: item.category_label,
      title: item.title,
      subtitle: item.subtitle,
      to: item.to,
    }));

    return [...matchingPages, ...items];
  }, [query, serverResults]);

  useEffect(() => {
    setActive(0);
  }, [results]);

  if (!open) return null;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'correspondence':
        return <FileText className="h-4 w-4 text-nx-blue" />;
      case 'invoice':
        return <FileText className="h-4 w-4 text-emerald-500" />;
      case 'payment':
        return <CreditCard className="h-4 w-4 text-nx-teal" />;
      case 'customer':
        return <Building2 className="h-4 w-4 text-amber-500" />;
      case 'crm':
        return <Users className="h-4 w-4 text-purple-500" />;
      case 'user':
        return <User className="h-4 w-4 text-indigo-500" />;
      case 'contract':
        return <FileSignature className="h-4 w-4 text-rose-500" />;
      case 'page':
      default:
        return <Compass className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[10vh] backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-nx-border bg-white shadow-2xl dark:border-nx-navy-border dark:bg-nx-navy"
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-nx-border px-4 py-1 dark:border-nx-navy-border">
          <Search className="h-5 w-5 text-nx-blue shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (event.key === 'Enter') {
                if (results[active]) {
                  go(results[active].to);
                } else if (query.trim()) {
                  executeSearch(query.trim());
                }
              }
            }}
            placeholder="جستجوی همه‌جانبه: موضوع یا شماره نامه، صورت‌حساب، پرداخت، شرکت، مشتری، سرنخ یا صفحه…"
            className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-nx-navy outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-nx-mist"
          />
          {loading && <RefreshCw className="h-4 w-4 text-nx-blue animate-spin shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => {
                setQuery('');
                setServerResults([]);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-500 dark:bg-slate-800 dark:text-nx-mist">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-nx-mist">
              <Search className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-sm text-nx-navy dark:text-slate-200">
                {query ? 'موردی برای جستجوی شما یافت نشد.' : 'عبارتی برای جستجو تایپ کنید…'}
              </p>
              <p className="mt-1 text-slate-400">
                می‌توانید شماره نامه، نام شرکت، شماره پیگیری، نام پرسنل یا عنوان صفحه را جستجو نمایید.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {results.map((result, index) => {
                const isSelected = index === active;
                return (
                  <li key={result.key}>
                    <button
                      onClick={() => go(result.to)}
                      onMouseEnter={() => setActive(index)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-right text-xs transition-all ${
                        isSelected
                          ? 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue/20 dark:text-blue-300 ring-1 ring-nx-blue/30'
                          : 'text-nx-navy hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                        {getCategoryIcon(result.category)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{result.title}</span>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-nx-mist">
                            {result.category_label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-nx-mist truncate mt-0.5">
                          {result.subtitle}
                        </p>
                      </div>

                      <span className="shrink-0 text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 sm:opacity-100">
                        ⏎ اینتر
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="flex items-center justify-between border-t border-nx-border px-4 py-2 text-[11px] text-slate-400 dark:border-nx-navy-border dark:text-nx-mist">
          <span>
            نتایج فعال: <strong className="text-nx-navy dark:text-white">{results.length}</strong> مورد
          </span>
          <div className="flex items-center gap-3">
            <span>↑↓ جهت جابجایی</span>
            <span>⏎ باز کردن</span>
            <span>ESC بستن</span>
          </div>
        </div>
      </div>
    </div>
  );
}
