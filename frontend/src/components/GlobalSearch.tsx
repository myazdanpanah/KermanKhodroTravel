/**
 * Top-bar search: one field over navigation shortcuts and office letters.
 *
 * ⌘K / Ctrl+K opens it; ↑↓ move, Enter opens the highlighted result, Esc
 * closes. Letter hits come from the office API with the same access rules as
 * the workbench, so a result the user cannot open never appears.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, X } from 'lucide-react';
import { officeApi, type Letter } from '../api/office';

const DESTINATIONS = [
  { label: 'داشبورد مدیریتی', to: '/erp' },
  { label: 'صورت‌حساب‌ها', to: '/erp/billing/invoices' },
  { label: 'صدور صورت‌حساب', to: '/erp/billing/issue' },
  { label: 'پرداخت‌ها', to: '/erp/billing/payments' },
  { label: 'مشتریان', to: '/erp/customers' },
  { label: 'میزکار اداری', to: '/erp/office' },
  { label: 'نامه‌ها', to: '/erp/office/correspondence' },
  { label: 'نامه جدید', to: '/erp/office/correspondence?new=1' },
  { label: 'تنظیمات', to: '/erp/settings' },
  { label: 'کاربران', to: '/erp/settings/users' },
  { label: 'دبیرخانه‌ها', to: '/erp/settings/secretariats' },
  { label: 'CRM: سرنخ‌ها', to: '/erp/crm/leads' },
  { label: 'CRM: فرصت‌ها', to: '/erp/crm/opportunities' },
];

interface Result {
  key: string;
  label: string;
  hint: string;
  to: string;
}

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [letters, setLetters] = useState<Letter[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setLetters([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      officeApi.getLetters({ q: term })
        .then((res) => { if (!cancelled) setLetters(res.data.data.slice(0, 6)); })
        .catch(() => { if (!cancelled) setLetters([]); });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, open]);

  const results = useMemo<Result[]>(() => {
    const term = query.trim();
    const pages = DESTINATIONS
      .filter((item) => !term || item.label.includes(term))
      .slice(0, term ? 5 : 8)
      .map((item) => ({ key: `page-${item.to}`, label: item.label, hint: 'رفتن به صفحه', to: item.to }));
    const lettersResults = letters.map((letter) => ({
      key: `letter-${letter.id}`,
      label: letter.subject,
      hint: `${letter.registration_number || 'پیش‌نویس'} · ${letter.sender_display || ''}`,
      to: `/erp/office/correspondence/${letter.id}`,
    }));
    return [...pages, ...lettersResults];
  }, [query, letters]);

  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-nx-border bg-white shadow-2xl dark:border-nx-navy-border dark:bg-nx-navy-elevated"
        onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-nx-border px-4 dark:border-nx-navy-border">
          <Search className="h-4 w-4 text-nx-mist" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
              if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              if (event.key === 'Enter' && results[active]) go(results[active].to);
            }}
            placeholder="جستجوی نامه، شماره، مشتری یا صفحه…"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-nx-navy outline-none placeholder:text-nx-mist dark:text-white"
          />
          <button onClick={onClose} className="text-nx-mist hover:text-nx-danger" aria-label="بستن جستجو">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-nx-mist">نتیجه‌ای پیدا نشد.</li>
          ) : results.map((result, index) => (
            <li key={result.key}>
              <button
                onClick={() => go(result.to)}
                onMouseEnter={() => setActive(index)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-right text-sm transition ${
                  index === active ? 'bg-nx-blue/10 text-nx-blue' : 'text-nx-navy hover:bg-black/5 dark:text-white dark:hover:bg-white/5'
                }`}
              >
                <FileText className="h-4 w-4 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{result.label}</span>
                <span className="shrink-0 text-[10px] text-nx-mist">{result.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
