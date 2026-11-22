import { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { rial, num, toPersianDigits } from './shared';
import {
  X, Download, FileText, Wallet, ArrowUpRight, ArrowDownLeft,
  Building2, Search, Loader2, Hash
} from 'lucide-react';

interface StatementRow {
  date: string;
  date_jalali: string;
  kind: string;
  payer_code: string;
  payer_name: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

interface StatementData {
  payer: {
    code: string;
    name: string;
    national_id?: string;
    economic_code?: string;
    phone?: string;
    mobile?: string;
    address?: string;
  };
  breakdown: {
    invoices: number;
    debts: number;
    debit: number;
    payments: number;
    credits: number;
    credit: number;
    balance: number;
  };
  rows: StatementRow[];
}

interface Props {
  payerCode: string | null;
  payerName?: string;
  onClose: () => void;
}

const KIND_BADGES: Record<string, { label: string; cls: string; icon: any }> = {
  'صورتحساب': { label: 'صورت‌حساب', cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800', icon: FileText },
  'بدهی دستی': { label: 'بدهی دستی', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800', icon: ArrowUpRight },
  'پرداخت': { label: 'پرداخت وجه', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800', icon: Wallet },
  'بستانکاری': { label: 'اعلامیه بستانکاری', cls: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800', icon: ArrowDownLeft },
};

export default function PayerStatementModal({ payerCode, payerName, onClose }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!payerCode) return;
    setLoading(true);
    let active = true;

    api.get(`/billing/payers/${encodeURIComponent(payerCode)}/statement/`)
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch((err) => {
        console.error('Error fetching statement:', err);
        if (active) toast('خطا در دریافت ریز حساب طرف حساب', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [payerCode, toast]);

  // Handle ESC key to close modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownloadExcel = async () => {
    if (!payerCode) return;
    setExporting(true);
    try {
      const response = await api.get('/billing/statements/excel/', {
        params: { payer: payerCode },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement-${payerCode}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast('فایل اکسل صورت وضعیت با موفقیت دانلود شد.', 'success');
    } catch {
      toast('خطا در دانلود فایل اکسل صورت وضعیت', 'error');
    } finally {
      setExporting(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((row) => {
      const matchKind = kindFilter === 'all' || row.kind === kindFilter;
      const term = search.trim();
      if (!term) return matchKind;
      const matchText =
        row.description.includes(term) ||
        row.reference.includes(term) ||
        row.date_jalali.includes(term);
      return matchKind && matchText;
    });
  }, [data?.rows, kindFilter, search]);

  if (!payerCode) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs transition-opacity"
      dir="rtl"
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-nx-navy border border-slate-200 dark:border-nx-navy-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-nx-navy-border bg-slate-50/70 dark:bg-nx-navy-elevated/40">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-nx-blue/10 text-nx-blue dark:bg-nx-blue/20">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {data?.payer.name || payerName || 'ریز گردش حساب'}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300">
                  کد: {toPersianDigits(payerCode)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-nx-mist mt-0.5">
                ریز کامل تراکنش‌ها، بدهی‌ها، پرداخت‌ها و مانده گردش حساب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-nx-navy-border dark:bg-nx-navy dark:text-slate-200 dark:hover:bg-white/5 transition shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'در حال خروجی…' : 'دانلود اکسل'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:text-white dark:hover:bg-white/10 transition"
              title="بستن (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-nx-mist gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-nx-blue" />
              <p className="text-xs">در حال دریافت ریز گردش حساب…</p>
            </div>
          ) : !data ? (
            <div className="text-center py-16 text-slate-500 dark:text-nx-mist text-sm">
              اطلاعاتی برای این طرف حساب یافت نشد.
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                  <span className="text-[11px] text-slate-500 dark:text-nx-mist">کل صورت‌حساب‌ها و بدهی</span>
                  <p className="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400 mt-1 truncate">
                    {rial(data.breakdown.debit)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                  <span className="text-[11px] text-slate-500 dark:text-nx-mist">کل پرداخت‌ها و بستانکاری</span>
                  <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                    {rial(data.breakdown.credit)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                  <span className="text-[11px] text-slate-500 dark:text-nx-mist">مانده حساب نهایی</span>
                  <p className={`text-sm sm:text-base font-bold mt-1 truncate ${
                    data.breakdown.balance > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : data.breakdown.balance < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    {rial(data.breakdown.balance)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                  <span className="text-[11px] text-slate-500 dark:text-nx-mist">تعداد کل تراکنش‌ها</span>
                  <p className="text-sm sm:text-base font-bold text-nx-blue dark:text-blue-400 mt-1">
                    {num(data.rows.length)} تراکنش
                  </p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="جستجو در شرح، شماره نامه، پیگیری..."
                    className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-nx-blue outline-none transition dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-white"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 overflow-x-auto text-xs">
                  {[
                    ['all', 'همه اسناد'],
                    ['صورتحساب', 'صورت‌حساب'],
                    ['پرداخت', 'پرداخت'],
                    ['بدهی دستی', 'بدهی دستی'],
                    ['بستانکاری', 'بستانکاری'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setKindFilter(key)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        kindFilter === key
                          ? 'bg-nx-blue text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Ledger Table */}
              <div className="rounded-xl border border-slate-200 dark:border-nx-navy-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[760px]">
                    <thead className="bg-slate-100 dark:bg-nx-navy-elevated text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-nx-navy-border">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12 font-semibold">ردیف</th>
                        <th className="py-2.5 px-3 text-right w-24 font-semibold">تاریخ</th>
                        <th className="py-2.5 px-3 text-right w-32 font-semibold">نوع سند</th>
                        <th className="py-2.5 px-3 text-right w-36 font-semibold">شماره مرجع / نامه</th>
                        <th className="py-2.5 px-3 text-right font-semibold">شرح و توضیحات</th>
                        <th className="py-2.5 px-3 text-left w-32 font-semibold">بدهکار</th>
                        <th className="py-2.5 px-3 text-left w-32 font-semibold">بستانکار</th>
                        <th className="py-2.5 px-3 text-left w-36 font-semibold">مانده لحظه‌ای</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-nx-mist">
                            تراکنشی مطابق با فیلتر انتخابی یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, idx) => {
                          const badge = KIND_BADGES[row.kind] || {
                            label: row.kind,
                            cls: 'bg-slate-100 text-slate-700 border-slate-200',
                            icon: Hash,
                          };
                          const Icon = badge.icon;
                          return (
                            <tr
                              key={`${row.date}-${row.reference}-${idx}`}
                              className="hover:bg-slate-50 dark:hover:bg-white/5 transition"
                            >
                              <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400">
                                {toPersianDigits(idx + 1)}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {toPersianDigits(row.date_jalali || row.date)}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${badge.cls}`}>
                                  <Icon className="w-3 h-3" />
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[160px]" title={row.reference}>
                                {toPersianDigits(row.reference) || '—'}
                              </td>
                              <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={row.description}>
                                {row.description || '—'}
                              </td>
                              <td className="py-2 px-3 text-left font-mono font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                {row.debit > 0 ? num(row.debit) : '—'}
                              </td>
                              <td className="py-2 px-3 text-left font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {row.credit > 0 ? num(row.credit) : '—'}
                              </td>
                              <td className={`py-2 px-3 text-left font-mono font-bold whitespace-nowrap ${
                                row.balance > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : row.balance < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}>
                                {rial(row.balance)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {filteredRows.length > 0 && (
                      <tfoot className="bg-slate-50 dark:bg-nx-navy-elevated font-semibold text-slate-800 dark:text-white border-t border-slate-200 dark:border-nx-navy-border">
                        <tr>
                          <td colSpan={5} className="py-2.5 px-3 text-left text-xs">
                            مجموع صفحه ({num(filteredRows.length)} مورد):
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {rial(filteredRows.reduce((acc, r) => acc + r.debit, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {rial(filteredRows.reduce((acc, r) => acc + r.credit, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-slate-900 dark:text-white whitespace-nowrap">
                            {rial(data.breakdown.balance)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-nx-navy-border bg-slate-50/70 dark:bg-nx-navy-elevated/40 text-xs text-slate-500 dark:text-nx-mist">
          <span>کلید Esc یا دکمه بستن را برای خروج بزنید.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 transition font-medium"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
