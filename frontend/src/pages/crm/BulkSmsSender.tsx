import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Users,
  Send,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Sparkles,
  Info,
  RefreshCw,
  Trash2,
  Eye,
} from 'lucide-react';
import { crmApi, Lead, Campaign } from '../../api/crm';
import { useToast } from '../../components/Toast';
import { apiErrorMessage } from '../../lib/apiError';

interface BulkSmsSenderProps {
  campaigns: Campaign[];
  isGatewayEnabled: boolean;
  onSent: () => void;
}

interface RecipientRow {
  id: string;
  phone: string;
  rawPhone: string;
  isValidPhone: boolean;
  variables: Record<string, string>;
  selected: boolean;
}

const DEFAULT_TAGS = ['نام', 'نام_خانوادگی', 'شرکت', 'شماره_نامه', 'مبلغ', 'کد_پیگیری', 'تاریخ'];

export default function BulkSmsSender({ campaigns, isGatewayEnabled, onSent }: BulkSmsSenderProps) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mode: excel | crm | manual
  const [sourceMode, setSourceMode] = useState<'excel' | 'crm' | 'manual'>('excel');

  // Template & Settings
  const [template, setTemplate] = useState('سلام {نام} عزیز، صورت‌حساب شما به شماره {شماره_نامه} صادر گردید.');
  const [campaignId, setCampaignId] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>(DEFAULT_TAGS);

  // Recipient data
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [phoneColumn, setPhoneColumn] = useState<string>('');
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');

  // CRM Leads loading
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Manual input text
  const [manualText, setManualText] = useState('');

  // Sending state
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');

  // Phone normalizer (client-side mirroring backend)
  const normalizePhone = (raw: string): { phone: string; valid: boolean } => {
    let digits = String(raw || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    digits = digits.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    digits = digits.replace(/\D/g, '');
    if (digits.startsWith('0098')) {
      digits = '0' + digits.slice(4);
    } else if (digits.startsWith('98') && digits.length === 12) {
      digits = '0' + digits.slice(2);
    } else if (digits.startsWith('9') && digits.length === 10) {
      digits = '0' + digits;
    }
    const valid = digits.length === 11 && digits.startsWith('0');
    return { phone: digits, valid };
  };

  // Interpolation helper
  const interpolate = (tpl: string, vars: Record<string, string>): string => {
    return tpl.replace(/\{\s*([^{}]+?)\s*\}/g, (_, key) => {
      const cleanKey = key.trim();
      if (vars[cleanKey] !== undefined) return String(vars[cleanKey]);
      const lower = cleanKey.toLowerCase();
      for (const [k, v] of Object.entries(vars)) {
        if (k.toLowerCase() === lower) return String(v);
      }
      return '';
    });
  };

  // Calculate SMS parts for Farsi
  const calculateSmsParts = (text: string) => {
    const len = text.length;
    if (len === 0) return { chars: 0, parts: 0 };
    if (len <= 70) return { chars: len, parts: 1 };
    return { chars: len, parts: Math.ceil(len / 67) };
  };

  // Insert tag at cursor position in textarea
  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    const tagText = `{${tag}}`;
    if (!textarea) {
      setTemplate((prev) => prev + tagText);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = template.substring(0, start);
    const after = template.substring(end);
    const updated = before + tagText + after;
    setTemplate(updated);
    setTimeout(() => {
      textarea.focus();
      const pos = start + tagText.length;
      textarea.setSelectionRange(pos, pos);
    }, 10);
  };

  // Parse Excel / CSV File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

        if (rawJson.length === 0) {
          toast('فایل اکسل انتخابی خالی است.', 'error');
          return;
        }

        const headers = Object.keys(rawJson[0]);
        setExcelColumns(headers);

        // Detect phone column
        const phoneMatch = headers.find((h) =>
          /موبایل|تلفن|شماره|همراه|phone|mobile|cell|tel/i.test(h)
        ) || headers[0];
        setPhoneColumn(phoneMatch);

        // Map tags (excluding phone)
        const newTags = Array.from(new Set([...DEFAULT_TAGS, ...headers]));
        setAvailableTags(newTags);

        // Build recipients
        const rows: RecipientRow[] = rawJson.map((row, idx) => {
          const rawP = String(row[phoneMatch] || '').trim();
          const { phone, valid } = normalizePhone(rawP);
          const variables: Record<string, string> = {};
          headers.forEach((h) => {
            variables[h] = String(row[h] ?? '').trim();
          });
          return {
            id: `row-${idx}`,
            phone,
            rawPhone: rawP,
            isValidPhone: valid,
            variables,
            selected: valid,
          };
        });

        setRecipients(rows);
        toast(`تعداد ${rows.length.toLocaleString('fa-IR')} ردیف با موفقیت از اکسل بارگذاری شد.`, 'success');
      } catch (err) {
        toast('خطا در پردازش فایل اکسل. فرمت فایل را بررسی کنید.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Update phone column if changed by user
  const handlePhoneColumnChange = (newCol: string) => {
    setPhoneColumn(newCol);
    setRecipients((prev) =>
      prev.map((r) => {
        const rawP = r.variables[newCol] || '';
        const { phone, valid } = normalizePhone(rawP);
        return {
          ...r,
          phone,
          rawPhone: rawP,
          isValidPhone: valid,
          selected: valid,
        };
      })
    );
  };

  // Download Sample Excel
  const downloadSampleExcel = () => {
    const sampleData = [
      {
        'شماره_موبایل': '09121111111',
        'نام': 'علی',
        'نام_خانوادگی': 'محمدی',
        'شرکت': 'کرمان موتور',
        'شماره_نامه': '1405/01/001',
        'مبلغ': '۲۵,۰۰۰,۰۰۰',
        'کد_پیگیری': 'TRX-8841',
      },
      {
        'شماره_موبایل': '09132222222',
        'نام': 'رضا',
        'نام_خانوادگی': 'حسینی',
        'شرکت': 'خودروسازی کارمانیا',
        'شماره_نامه': '1405/01/002',
        'مبلغ': '۱۸,۵۰۰,۰۰۰',
        'کد_پیگیری': 'TRX-8842',
      },
      {
        'شماره_موبایل': '09353333333',
        'نام': 'زهرا',
        'نام_خانوادگی': 'کریمی',
        'شرکت': 'تجارت بین‌الملل KTL',
        'شماره_نامه': '1405/01/003',
        'مبلغ': '۴۲,۰۰۰,۰۰۰',
        'کد_پیگیری': 'TRX-8843',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample');
    XLSX.writeFile(wb, 'نمونه_ارسال_پیامک_گروهی.xlsx');
  };

  // Load CRM Leads
  const loadCrmLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await crmApi.getLeads();
      const list = res.data.data || [];
      setLeads(list);
      const rows: RecipientRow[] = list.map((lead, idx) => {
        const rawP = lead.mobile || lead.phone || '';
        const { phone, valid } = normalizePhone(rawP);
        const variables: Record<string, string> = {
          'نام': lead.name || '',
          'شرکت': lead.company_name || '',
          'ایمیل': lead.email || '',
          'منبع': lead.source || '',
          'وضعیت': lead.status || '',
        };
        return {
          id: `lead-${lead.id || idx}`,
          phone,
          rawPhone: rawP,
          isValidPhone: valid,
          variables,
          selected: valid,
        };
      });
      setRecipients(rows);
      setAvailableTags(Array.from(new Set([...DEFAULT_TAGS, 'نام', 'شرکت', 'ایمیل', 'منبع', 'وضعیت'])));
      toast(`${rows.length.toLocaleString('fa-IR')} سرنخ از CRM فراخوانی شد.`, 'success');
    } catch {
      toast('دریافت سرنخ‌ها از CRM انجام نشد.', 'error');
    } finally {
      setLoadingLeads(false);
    }
  };

  // Process manual paste text
  const applyManualText = () => {
    const lines = manualText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast('متنی برای پردازش وارد نشده است.', 'error');
      return;
    }

    const rows: RecipientRow[] = lines.map((line, idx) => {
      // Split by comma, tab, or semicolon
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      const rawP = parts[0] || '';
      const { phone, valid } = normalizePhone(rawP);
      const variables: Record<string, string> = {
        'نام': parts[1] || '',
        'شرکت': parts[2] || '',
        'مبلغ': parts[3] || '',
        'کد_پیگیری': parts[4] || '',
      };
      return {
        id: `manual-${idx}`,
        phone,
        rawPhone: rawP,
        isValidPhone: valid,
        variables,
        selected: valid,
      };
    });

    setRecipients(rows);
    toast(`${rows.length.toLocaleString('fa-IR')} شماره پردازش شد.`, 'success');
  };

  // Selection toggle
  const toggleSelectAll = (checked: boolean) => {
    setRecipients((prev) => prev.map((r) => ({ ...r, selected: r.isValidPhone ? checked : false })));
  };

  const toggleRow = (id: string) => {
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  };

  // Filter preview list
  const filteredRecipients = recipients.filter((r) => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.trim().toLowerCase();
    return (
      r.phone.includes(q) ||
      r.rawPhone.includes(q) ||
      Object.values(r.variables).some((v) => v.toLowerCase().includes(q))
    );
  });

  const selectedCount = recipients.filter((r) => r.selected).length;
  const invalidCount = recipients.filter((r) => !r.isValidPhone).length;
  const { chars: tplChars, parts: tplParts } = calculateSmsParts(template);

  // Send Bulk SMS
  const handleBulkSend = async () => {
    const selectedRecipients = recipients.filter((r) => r.selected && r.isValidPhone);
    if (selectedRecipients.length === 0) {
      toast('هیچ گیرنده معتبری انتخاب نشده است.', 'error');
      return;
    }
    if (!template.trim()) {
      toast('متن الگوی پیامک خالی است.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `آیا از ارسال پیامک به ${selectedRecipients.length.toLocaleString('fa-IR')} گیرنده اطمینان دارید؟`
    );
    if (!confirmed) return;

    setSending(true);
    setProgress({ total: selectedRecipients.length, sent: 0, failed: 0 });

    try {
      const payload = {
        template: template.trim(),
        recipients: selectedRecipients.map((r) => ({
          phone: r.phone,
          variables: r.variables,
        })),
        campaign_id: campaignId || undefined,
      };

      const res = await crmApi.sendBulkSms(payload);
      const data = res.data;

      setProgress({
        total: data.total,
        sent: data.sent ?? 0,
        failed: data.failed ?? 0,
      });

      toast(
        `ارسال پیامک انبوه پایان یافت: ${data.sent?.toLocaleString('fa-IR')} موفق، ${data.failed?.toLocaleString('fa-IR')} ناموفق.`,
        data.failed === 0 ? 'success' : 'info'
      );
      onSent();
    } catch (err) {
      toast(apiErrorMessage(err, 'ارسال پیامک انبوه انجام نشد.'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Choose Source */}
      <div className="rounded-xl border border-nx-border bg-white p-5 dark:border-nx-navy-border dark:bg-nx-navy">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nx-border pb-4 dark:border-nx-navy-border">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-nx-navy dark:text-white">
              <Users className="h-4 w-4 text-nx-blue" /> مرحله ۱: انتخاب منبع مخاطبان
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-nx-mist">
              لیست مخاطبان را از فایل اکسل آپلود کنید، از سرنخ‌های CRM انتخاب نمایید یا به صورت دستی وارد کنید.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setSourceMode('excel')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                sourceMode === 'excel'
                  ? 'bg-white text-nx-blue shadow-sm dark:bg-nx-navy dark:text-white'
                  : 'text-slate-600 hover:text-nx-navy dark:text-nx-mist dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> فایل اکسل / CSV
            </button>
            <button
              onClick={() => {
                setSourceMode('crm');
                if (leads.length === 0) loadCrmLeads();
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                sourceMode === 'crm'
                  ? 'bg-white text-nx-blue shadow-sm dark:bg-nx-navy dark:text-white'
                  : 'text-slate-600 hover:text-nx-navy dark:text-nx-mist dark:hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" /> سرنخ‌های CRM
            </button>
            <button
              onClick={() => setSourceMode('manual')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                sourceMode === 'manual'
                  ? 'bg-white text-nx-blue shadow-sm dark:bg-nx-navy dark:text-white'
                  : 'text-slate-600 hover:text-nx-navy dark:text-nx-mist dark:hover:text-white'
              }`}
            >
              ورود دستی / متنی
            </button>
          </div>
        </div>

        {/* Source Content */}
        <div className="pt-4">
          {sourceMode === 'excel' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border-2 border-dashed border-nx-border p-5 text-center dark:border-nx-navy-border hover:border-nx-blue/60 transition-colors">
                <div className="flex items-center gap-3 text-right">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-nx-blue/10 text-nx-blue">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-nx-navy dark:text-white">
                      {fileName ? `فایل انتخاب شده: ${fileName}` : 'فایل اکسل (.xlsx/.xls) یا CSV را انتخاب کنید'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-nx-mist">
                      ستون‌های فایل اکسل شما خودکار شناسایی شده و به عنوان برچسب‌های متغیر در متن پیامک قابل استفاده خواهند بود.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadSampleExcel}
                    className="flex items-center gap-1.5 rounded-lg border border-nx-border bg-slate-50 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 dark:border-nx-navy-border dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Download className="h-3.5 w-3.5" /> دانلود فایل نمونه
                  </button>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-nx-blue px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-nx-blue/90 transition-colors">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> انتخاب فایل اکسل
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {excelColumns.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-nx-navy dark:text-white">ستون شماره موبایل:</span>
                    <select
                      value={phoneColumn}
                      onChange={(e) => handlePhoneColumnChange(e.target.value)}
                      className="rounded-md border border-nx-border bg-white px-2.5 py-1 text-nx-navy dark:border-nx-navy-border dark:bg-nx-navy dark:text-white"
                    >
                      {excelColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600 dark:text-nx-mist">
                    ستون‌های متغیر شناسایی شده:{' '}
                    <span className="font-mono text-nx-blue">{excelColumns.join(' ، ')}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {sourceMode === 'crm' && (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-nx-blue" />
                <div>
                  <p className="text-xs font-semibold text-nx-navy dark:text-white">
                    بارگذاری مخاطبان و سرنخ‌ها از پایگاه داده CRM
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-nx-mist">
                    نام، شرکت، ایمیل و شماره همراه از پرونده‌های CRM استخراج می‌شوند.
                  </p>
                </div>
              </div>
              <button
                onClick={loadCrmLeads}
                disabled={loadingLeads}
                className="flex items-center gap-1.5 rounded-lg bg-nx-blue px-3 py-1.5 text-xs text-white hover:bg-nx-blue/90 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLeads ? 'animate-spin' : ''}`} />
                {loadingLeads ? 'در حال بارگذاری…' : 'به‌روزرسانی سرنخ‌ها'}
              </button>
            </div>
          )}

          {sourceMode === 'manual' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-nx-mist">
                هر شماره را در یک سطر وارد کنید. برای وارد کردن متغیرها، مقادیر را با کاما جدا کنید (مثال:{' '}
                <span className="font-mono" dir="ltr">09121111111, علی, شرکت الف, 1250000</span>):
              </p>
              <textarea
                dir="ltr"
                rows={4}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="09121111111, علی, کرمان موتور&#10;09132222222, رضا, مدیران خودرو"
                className="w-full font-mono text-xs rounded-lg border border-nx-border bg-transparent p-3 outline-none focus:ring-2 focus:ring-nx-blue dark:border-nx-navy-border dark:text-white"
              />
              <button
                onClick={applyManualText}
                className="rounded-lg bg-nx-blue px-4 py-1.5 text-xs text-white hover:bg-nx-blue/90"
              >
                پردازش و بارگذاری داده‌ها
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Template Builder & Dynamic Variables */}
      <div className="rounded-xl border border-nx-border bg-white p-5 dark:border-nx-navy-border dark:bg-nx-navy">
        <div className="flex items-center justify-between border-b border-nx-border pb-3 dark:border-nx-navy-border">
          <h2 className="flex items-center gap-2 text-sm font-bold text-nx-navy dark:text-white">
            <Sparkles className="h-4 w-4 text-nx-teal" /> مرحله ۲: متن الگو و جایگذاری متغیرها
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-nx-mist">کمپین مرتبط:</span>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="rounded-md border border-nx-border bg-transparent px-2.5 py-1 text-xs text-nx-navy dark:border-nx-navy-border dark:text-white"
            >
              <option value="">— بدون کمپین —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Tag Pills */}
        <div className="pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500 dark:text-nx-mist">متغیرهای در دسترس:</span>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertTag(tag)}
                className="inline-flex items-center gap-1 rounded-full border border-nx-blue/30 bg-nx-blue/5 px-2.5 py-1 text-[11px] font-medium text-nx-blue hover:bg-nx-blue/15 transition-all dark:border-nx-blue/40 dark:bg-nx-blue/10 dark:text-blue-300"
                title={`کلیک برای درج {${tag}} در محل نشانگر`}
              >
                <span>+</span>
                <span>{`{${tag}}`}</span>
              </button>
            ))}
          </div>

          {/* Template Input */}
          <div className="mt-3">
            <textarea
              ref={textareaRef}
              rows={4}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              maxLength={1000}
              placeholder="متن پیامک خود را بنویسید و متغیرهای دلخواه را از لیست بالا کلیک کنید..."
              className="w-full resize-y rounded-xl border border-nx-border bg-slate-50/50 p-3 text-sm text-nx-navy outline-none focus:border-nx-blue focus:bg-white focus:ring-2 focus:ring-nx-blue/20 dark:border-nx-navy-border dark:bg-slate-900/60 dark:text-white dark:focus:bg-slate-900"
            />
          </div>

          {/* Character & Part Counter */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3 text-slate-500 dark:text-nx-mist">
              <span>
                تعداد کاراکتر الگو:{' '}
                <strong className="text-nx-navy dark:text-white">{tplChars.toLocaleString('fa-IR')}</strong>
              </span>
              <span>•</span>
              <span>
                صفحات برآورد شده:{' '}
                <strong className="text-nx-teal dark:text-emerald-400">{tplParts.toLocaleString('fa-IR')} صفحه</strong>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              * بخش‌های پیامک فارسی: صفحه اول ۷۰ کاراکتر، صفحات بعدی هر کدام ۶۷ کاراکتر
            </span>
          </div>
        </div>
      </div>

      {/* Step 3: Interactive Live Preview Table */}
      {recipients.length > 0 && (
        <div className="rounded-xl border border-nx-border bg-white p-5 dark:border-nx-navy-border dark:bg-nx-navy">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nx-border pb-3 dark:border-nx-navy-border">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-nx-blue" />
              <h2 className="text-sm font-bold text-nx-navy dark:text-white">
                مرحله ۳: پیش‌نمایش زنده پیام‌ها برای هر مخاطب
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {recipients.length.toLocaleString('fa-IR')} ردیف
              </span>
            </div>

            {/* Search filter in preview */}
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                placeholder="جستجو در مخاطبان…"
                className="w-48 rounded-lg border border-nx-border bg-transparent py-1 pl-2 pr-8 text-xs text-nx-navy outline-none focus:ring-1 focus:ring-nx-blue dark:border-nx-navy-border dark:text-white"
              />
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
              <p className="text-slate-500 dark:text-nx-mist">کل مخاطبان</p>
              <p className="text-base font-bold text-nx-navy dark:text-white">
                {recipients.length.toLocaleString('fa-IR')}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <p className="text-emerald-600 dark:text-emerald-400">آماده ارسال (معتبر)</p>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                {selectedCount.toLocaleString('fa-IR')}
              </p>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-2.5">
              <p className="text-rose-600 dark:text-rose-400">شماره‌های نامعتبر</p>
              <p className="text-base font-bold text-rose-700 dark:text-rose-300">
                {invalidCount.toLocaleString('fa-IR')}
              </p>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-2.5">
              <p className="text-blue-600 dark:text-blue-400">مجموع پیامک ارسالی</p>
              <p className="text-base font-bold text-blue-700 dark:text-blue-300">
                {(selectedCount * tplParts).toLocaleString('fa-IR')} پارت
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-nx-border dark:border-nx-navy-border">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <tr className="border-b border-nx-border text-right dark:border-nx-navy-border">
                  <th className="w-10 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedCount > 0 && selectedCount === recipients.filter((r) => r.isValidPhone).length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="rounded text-nx-blue focus:ring-nx-blue"
                    />
                  </th>
                  <th className="w-12 px-2 py-2 text-center">ردیف</th>
                  <th className="w-32 px-3 py-2">شماره تماس</th>
                  <th className="px-3 py-2">پیش‌نمایش متن نهایی (با مقادیر جایگزین)</th>
                  <th className="w-24 px-3 py-2 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nx-border/60 dark:divide-nx-navy-border/60">
                {filteredRecipients.map((row, idx) => {
                  const renderedText = interpolate(template, row.variables);
                  const { chars, parts } = calculateSmsParts(renderedText);
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                        !row.isValidPhone ? 'bg-rose-50/40 dark:bg-rose-950/20 opacity-75' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={!row.isValidPhone}
                          onChange={() => toggleRow(row.id)}
                          className="rounded text-nx-blue focus:ring-nx-blue"
                        />
                      </td>
                      <td className="px-2 py-2 text-center text-slate-400">{(idx + 1).toLocaleString('fa-IR')}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-nx-navy dark:text-slate-200" dir="ltr">
                        {row.phone || row.rawPhone || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="line-clamp-2 text-slate-700 dark:text-nx-mist" title={renderedText}>
                          {renderedText}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {chars.toLocaleString('fa-IR')} کاراکتر ({parts.toLocaleString('fa-IR')} پارت)
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center">
                        {row.isValidPhone ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> معتبر
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-600 dark:text-rose-400">
                            <XCircle className="h-3 w-3" /> نامعتبر
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-nx-border pt-4 dark:border-nx-navy-border">
            <div className="text-xs text-slate-500 dark:text-nx-mist">
              {!isGatewayEnabled ? (
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4" /> درگاه پیامک غیرفعال است. ابتدا در بخش تنظیمات پیامک آن را فعال کنید.
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-600 dark:text-nx-mist">
                  <Info className="h-4 w-4 text-nx-blue" />
                  آماده ارسال به{' '}
                  <strong className="text-nx-navy dark:text-white">
                    {selectedCount.toLocaleString('fa-IR')} مخاطب
                  </strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRecipients([]);
                  setFileName('');
                  setManualText('');
                }}
                className="flex items-center gap-1 rounded-lg border border-nx-border px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 dark:border-nx-navy-border dark:text-nx-mist dark:hover:bg-slate-800"
              >
                <Trash2 className="h-3.5 w-3.5" /> پاکسازی لیست
              </button>

              <button
                type="button"
                onClick={handleBulkSend}
                disabled={sending || !isGatewayEnabled || selectedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-nx-blue px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-nx-blue/90 disabled:opacity-50 transition-all"
              >
                <Send className="h-4 w-4" />
                {sending ? 'در حال ارسال گروهی…' : `ارسال پیامک انبوه (${selectedCount.toLocaleString('fa-IR')} نفر)`}
              </button>
            </div>
          </div>

          {/* Sending Progress Display */}
          {progress && (
            <div className="mt-4 rounded-xl border border-nx-blue/20 bg-nx-blue/5 p-4 dark:bg-nx-blue/10">
              <div className="flex items-center justify-between text-xs font-semibold text-nx-navy dark:text-white">
                <span>وضعیت ارسال دسته‌ای:</span>
                <span>
                  موفق: {progress.sent.toLocaleString('fa-IR')} | ناموفق: {progress.failed.toLocaleString('fa-IR')} از{' '}
                  {progress.total.toLocaleString('fa-IR')}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-nx-blue transition-all duration-300"
                  style={{
                    width: `${Math.round(((progress.sent + progress.failed) / (progress.total || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
