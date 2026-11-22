import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import JalaliDateInput from '../../components/JalaliDateInput'
import { isoToJalali, formatJalali, todayIso } from '../../lib/jalali'
import { CARD, INPUT, rial, type Payer } from './shared'
import {
  FileSpreadsheet, Plus, Send, CheckCircle2, XCircle, Download, Trash2,
  PencilLine, X, Save,
} from 'lucide-react'

type ServiceKey = 'flight' | 'hotel' | 'service'

const SERVICES: { key: ServiceKey; label: string; field: 'flight_data' | 'hotel_data' | 'service_data' }[] = [
  { key: 'flight', label: 'پرواز', field: 'flight_data' },
  { key: 'hotel', label: 'هتل', field: 'hotel_data' },
  { key: 'service', label: 'خدمات', field: 'service_data' },
]

type FieldType = 'text' | 'passenger' | 'money' | 'number' | 'date'

interface ManualField {
  key: string
  label: string
  type: FieldType
  required?: boolean
}

// Every column of the three Excel layouts, so a manual row is indistinguishable
// from an uploaded one.
const MANUAL_FIELDS: Record<ServiceKey, ManualField[]> = {
  flight: [
    { key: 'قرارداد', label: 'شماره قرارداد', type: 'text' },
    { key: 'نام مسافر', label: 'نام مسافر', type: 'passenger', required: true },
    { key: 'مسیر', label: 'مسیر', type: 'text' },
    { key: 'شماره بلیط', label: 'شماره بلیط', type: 'text' },
    { key: 'تاریخ پرواز', label: 'تاریخ پرواز', type: 'date' },
    { key: 'بدهکار', label: 'بدهکار', type: 'money' },
    { key: 'بستانکار', label: 'بستانکار', type: 'money' },
  ],
  hotel: [
    { key: 'قرارداد', label: 'شماره قرارداد', type: 'text' },
    { key: 'نام مسافر', label: 'نام مسافر', type: 'passenger', required: true },
    { key: 'هتل', label: 'هتل', type: 'text' },
    { key: 'نوع اتاق', label: 'نوع اتاق', type: 'text' },
    { key: 'تعداد نفرات', label: 'تعداد نفرات', type: 'number' },
    { key: 'تاریخ ورود', label: 'تاریخ ورود', type: 'date' },
    { key: 'تاریخ خروج', label: 'تاریخ خروج', type: 'date' },
    { key: 'بدهکار', label: 'بدهکار', type: 'money' },
    { key: 'بستانکار', label: 'بستانکار', type: 'money' },
  ],
  service: [
    { key: 'قرارداد', label: 'شماره قرارداد', type: 'text' },
    { key: 'نام مسافر', label: 'نام مسافر', type: 'passenger', required: true },
    { key: 'شرح خدمات', label: 'شرح خدمات', type: 'text' },
    { key: 'تاریخ', label: 'تاریخ', type: 'date' },
    { key: 'توضیحات', label: 'توضیحات', type: 'text' },
    { key: 'بدهکار', label: 'بدهکار', type: 'money' },
    { key: 'بستانکار', label: 'بستانکار', type: 'money' },
  ],
}

type Block = { columns: string[]; rows: Record<string, unknown>[]; totals: Record<string, number> }
const EMPTY_BLOCK: Block = { columns: [], rows: [], totals: {} }
const EMPTY_BLOCKS: Record<ServiceKey, Block> = { flight: EMPTY_BLOCK, hotel: EMPTY_BLOCK, service: EMPTY_BLOCK }

interface ApprovalFile {
  id: number
  service_type: string
  file_name: string
}

interface Approval {
  id: number
  requester_name: string
  payer_code: string
  payer_name: string
  service_type: string
  letter_number: string
  service_letters?: Record<string, string>
  service_category?: string
  period_range: string
  status: 'pending' | 'approved' | 'rejected'
  status_display: string
  generation_error: string
  files: ApprovalFile[]
}

interface ServiceCategory {
  id: number
  name: string
  code: string
  parent: number | null
  is_active: boolean
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-400/10 text-amber-400',
  approved: 'bg-emerald-400/10 text-emerald-400',
  rejected: 'bg-rose-400/10 text-rose-400',
}

export default function BillingIssuePage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const privileged = user?.role === 'ceo' || user?.role === 'admin'
  const canIssue = privileged || Boolean(user?.permissions?.issue)
  const canApprove = privileged || Boolean(user?.permissions?.approve)

  const [payers, setPayers] = useState<Payer[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [passengers, setPassengers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Arriving from a notification: ?request=<id> points at the approval row.
  const [searchParams] = useSearchParams()
  const focusedRequest = searchParams.get('request')
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({})

  useEffect(() => {
    if (!focusedRequest) return
    const row = rowRefs.current[Number(focusedRequest)]
    if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusedRequest, approvals])

  const [payerCode, setPayerCode] = useState('')
  const [letterNumber, setLetterNumber] = useState('')
  const [letterDate, setLetterDate] = useState(todayIso())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [serviceCategoryId, setServiceCategoryId] = useState('')
  const [activeService, setActiveService] = useState<ServiceKey>('flight')
  const [blocks, setBlocks] = useState<Record<ServiceKey, Block>>(EMPTY_BLOCKS)
  const [uploading, setUploading] = useState<ServiceKey | null>(null)

  // Manual row editor — a grid, so several passengers can be entered at once.
  const [manualOpen, setManualOpen] = useState(false)
  const [draftRows, setDraftRows] = useState<Record<string, string>[]>([])

  const startJalali = useMemo(() => isoToJalali(startDate), [startDate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [payersRes, approvalsRes, categoriesRes, passengersRes] = await Promise.all([
        api.get('/billing/payers/'),
        api.get('/billing/approvals/'),
        api.get('/billing/service-categories/'),
        api.get('/billing/passengers/'),
      ])
      setPayers(payersRes.data)
      setApprovals(approvalsRes.data)
      setCategories(categoriesRes.data)
      setPassengers(passengersRes.data)
    } catch {
      toast('خطا در دریافت اطلاعات صدور', 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!payerCode) {
      setLetterNumber('')
      return
    }
    api
      .get('/billing/next-letter/', {
        params: { payer_code: payerCode, year: isoToJalali(startDate)?.year ?? '' },
      })
      .then((res) => setLetterNumber(res.data.letter_number))
      .catch(() => setLetterNumber(''))
  }, [payerCode, startDate])

  // The service type is derived from what was actually uploaded.
  const uploadedLabels = SERVICES.filter((service) => blocks[service.key].rows.length > 0).map((service) => {
    if (service.key !== 'service') return service.label
    const category = categories.find((item) => String(item.id) === serviceCategoryId)
    return category?.name || service.label
  })
  const serviceType = uploadedLabels.join('، ')

  // A batch may mix flight, hotel and service workbooks: each file is typed by
  // the server from its own columns and merged into its block, so one approval
  // produces one invoice and one letter per service.
  const uploadExcels = async (files: File[]) => {
    setUploading(activeService)
    const merged: Record<ServiceKey, { columns: string[]; rows: Record<string, unknown>[] }> = {
      flight: { columns: [], rows: [] },
      hotel: { columns: [], rows: [] },
      service: { columns: [], rows: [] },
    }
    const labels: string[] = []
    let failures = 0

    for (const file of files) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        const up = await api.post('/billing/upload/excel/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const detected = (up.data.detected_type || activeService) as ServiceKey
        const processed = await api.post('/billing/process/excel/', {
          tmp_id: up.data.tmp_id,
          type: detected,
        })
        merged[detected].columns = processed.data.columns
        merged[detected].rows.push(...processed.data.rows)
        labels.push(`${SERVICES.find((item) => item.key === detected)?.label || detected}: ${processed.data.rows.length} ردیف`)
      } catch (err: unknown) {
        failures += 1
        const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        toast(`${file.name}: ${apiError || 'خطای خواندن فایل'}`, 'error')
      }
    }

    setBlocks((prev) => {
      const next = { ...prev }
      for (const key of SERVICES.map((service) => service.key)) {
        if (merged[key].rows.length === 0) continue
        const existing = prev[key]
        const rows = [...existing.rows, ...merged[key].rows].map((row, index) => ({ ...row, ردیف: index + 1 }))
        next[key] = {
          columns: merged[key].columns.length ? merged[key].columns : existing.columns,
          rows,
          totals: {},
        }
      }
      return next
    })
    if (labels.length) toast(`خوانده شد — ${labels.join('، ')}`, 'success')
    if (failures && labels.length === 0) toast('هیچ فایلی خوانده نشد', 'error')
    setUploading(null)
  }

  const clearBlock = (service: ServiceKey) =>
    setBlocks((prev) => ({ ...prev, [service]: { ...EMPTY_BLOCK } }))

  const blockTotals = (service: ServiceKey) => {
    const rows = blocks[service].rows
    const debt = rows.reduce((sum, row) => sum + Number(row['بدهکار'] || 0), 0)
    const credit = rows.reduce((sum, row) => sum + Number(row['بستانکار'] || 0), 0)
    return { debt, credit, balance: debt - credit }
  }

  const openManualEditor = () => {
    // Start with three blank lines: the common case is a group, not one person.
    setDraftRows([{}, {}, {}])
    setManualOpen(true)
  }

  const blankRow = (): Record<string, string> =>
    Object.fromEntries(MANUAL_FIELDS[activeService].map((field) => [field.key, '']))

  const addDraftRow = () => setDraftRows((rows) => [...rows, blankRow()])

  const setDraftCell = (index: number, key: string, value: string) =>
    setDraftRows((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))

  const removeDraftRow = (index: number) =>
    setDraftRows((rows) => rows.filter((_, i) => i !== index))

  const commitDrafts = () => {
    const fields = MANUAL_FIELDS[activeService]
    const filled = draftRows.filter((row) => Object.values(row).some((value) => String(value || '').trim()))
    if (filled.length === 0) {
      toast('حداقل یک ردیف را پر کنید', 'error')
      return
    }
    for (const [index, draft] of filled.entries()) {
      const missing = fields.find((field) => field.required && !String(draft[field.key] || '').trim())
      if (missing) {
        toast(`ردیف ${index + 1}: ${missing.label} را وارد کنید`, 'error')
        return
      }
    }

    const newRows = filled.map((draft) => {
      const row: Record<string, unknown> = {}
      for (const field of fields) {
        const raw = String(draft[field.key] || '').trim()
        if (field.type === 'money' || field.type === 'number') {
          row[field.key] = Number(raw.replace(/[,٬\s]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))) || 0
        } else {
          row[field.key] = raw
        }
      }
      if (activeService === 'hotel') {
        row['تاریخ ورود و خروج'] = `ورود: ${row['تاریخ ورود'] || '—'}  خروج: ${row['تاریخ خروج'] || '—'}`
        delete row['تاریخ ورود']
        delete row['تاریخ خروج']
        row['تعداد نفرات'] = Number(row['تعداد نفرات'] || 1)
      }
      row['مانده'] = Number(row['بدهکار'] || 0) - Number(row['بستانکار'] || 0)
      return row as Record<string, unknown>
    })

    setBlocks((prev) => {
      const current = prev[activeService]
      const rows: Record<string, unknown>[] = [...current.rows, ...newRows].map((item, index) => ({ ...item, ردیف: index + 1 }))
      return {
        ...prev,
        [activeService]: {
          columns: current.columns.length ? current.columns : defaultColumns(activeService),
          rows,
          totals: {},
        },
      }
    })
    setDraftRows([{}, {}, {}])
    setManualOpen(false)
    toast(`${newRows.length} ردیف به جدول اضافه شد`, 'success')
  }

  const removeManualRow = (service: ServiceKey, index: number) => {
    setBlocks((prev) => {
      const rows = prev[service].rows.filter((_, i) => i !== index).map((item, i) => ({ ...item, ردیف: i + 1 }))
      return { ...prev, [service]: { ...prev[service], rows } }
    })
  }

  const periodRange =
    startDate && endDate ? `از ${formatJalali(startDate)} تا ${formatJalali(endDate)}` : ''

  const submit = async (approveNow: boolean) => {
    if (!payerCode) {
      toast('شرکت طرف حساب را انتخاب کنید', 'error')
      return
    }
    if (!letterDate || !startDate || !endDate) {
      toast('تاریخ نامه، تاریخ شروع و تاریخ پایان الزامی است', 'error')
      return
    }
    if (endDate < startDate) {
      toast('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد', 'error')
      return
    }
    if (!serviceType) {
      toast('حداقل یک فایل یا ردیف خدمت لازم است', 'error')
      return
    }
    setSaving(true)
    try {
      const payer = payers.find((p) => p.code === payerCode)
      const res = await api.post('/billing/approvals/', {
        payer_code: payerCode,
        payer_name: payer?.name || '',
        service_type: serviceType,
        letter_number: letterNumber,
        letter_date: formatJalali(letterDate),
        service_category: categories.find((item) => String(item.id) === serviceCategoryId)?.name || '',
        start_day: startJalali?.day || 1,
        end_day: isoToJalali(endDate)?.day || 1,
        month: startJalali ? String(startJalali.month) : '',
        year: startJalali?.year || 0,
        period_range: periodRange,
        flight_data: blocks.flight.rows,
        hotel_data: blocks.hotel.rows,
        service_data: blocks.service.rows,
      })
      toast('درخواست صدور ثبت شد', 'success')

      if (approveNow) {
        await api.post(`/billing/approvals/${res.data.id}/approve/`, {})
        toast('تأیید شد و فایل‌ها تولید شدند', 'success')
      }
      setBlocks({ flight: { ...EMPTY_BLOCK }, hotel: { ...EMPTY_BLOCK }, service: { ...EMPTY_BLOCK } })
      setServiceCategoryId('')
      void load()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string } } })?.response?.data
      toast(data?.error || 'خطا در ثبت درخواست', 'error')
    } finally {
      setSaving(false)
    }
  }

  const downloadFile = async (file: { id: number; file_name: string }) => {
    try {
      const res = await api.get(`/billing/files/${file.id}/download/`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = file.file_name
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'دانلود فایل ناموفق بود؛ دوباره تلاش کنید.', 'error')
    }
  }

  const act = async (id: number, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? window.prompt('دلیل رد درخواست:') || '' : ''
    if (action === 'reject' && !reason) return
    try {
      await api.post(`/billing/approvals/${id}/${action}/`, action === 'reject' ? { reason } : {})
      toast(action === 'approve' ? 'درخواست تأیید و فایل‌ها تولید شد' : 'درخواست رد شد', 'success')
      void load()
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در انجام عملیات', 'error')
    }
  }

  const active = blocks[activeService]
  const totals = blockTotals(activeService)

  if (!canIssue && !canApprove) {
    return <div className="p-10 text-center text-sm text-nx-mist">برای صدور صورت‌حساب مجوز لازم است.</div>
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Plus className="w-5 h-5 text-nx-blue" />
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">صدور صورت‌حساب</h1>
          <p className="text-xs text-slate-500 dark:text-nx-mist">ثبت فروش خدمات، محاسبهٔ مانده و تولید اعلامیهٔ رسمی</p>
        </div>
      </div>

      <section className={`${CARD} p-5 space-y-4`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">شرکت طرف حساب</label>
            <select value={payerCode} onChange={(e) => setPayerCode(e.target.value)} className={INPUT}>
              <option value="">انتخاب شرکت…</option>
              {payers.map((p) => (
                <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">شماره نامه</label>
            <input value={letterNumber} readOnly className={INPUT} placeholder="YYYY/CODE/NNNNN" dir="ltr" />
          </div>
          <JalaliDateInput label="تاریخ نامه" value={letterDate} onChange={setLetterDate} />
          <JalaliDateInput label="تاریخ شروع *" value={startDate} onChange={setStartDate} />
          <JalaliDateInput label="تاریخ پایان *" value={endDate} onChange={setEndDate} />
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">نوع خدمت (از فایل تعیین می‌شود)</label>
            <div className={`${INPUT} flex items-center min-h-[42px]`}>
              {serviceType || <span className="text-slate-400 dark:text-nx-mist/60">هنوز فایلی بارگذاری نشده است</span>}
            </div>
          </div>
          {blocks.service.rows.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">دستهٔ خدمت (برای نام‌گذاری دقیق)</label>
              <select value={serviceCategoryId} onChange={(e) => setServiceCategoryId(e.target.value)} className={INPUT}>
                <option value="">خدمات (عمومی)</option>
                {categories.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-b border-slate-200 dark:border-nx-navy-border pb-2">
          {SERVICES.map((service) => (
            <button
              key={service.key}
              onClick={() => setActiveService(service.key)}
              className={`px-4 py-2 rounded-lg text-sm transition ${activeService === service.key ? 'bg-nx-blue/15 text-nx-blue font-medium' : 'text-slate-600 dark:text-nx-mist hover:bg-slate-100 dark:hover:bg-nx-navy hover:text-slate-900 dark:hover:text-white'}`}
            >
              {service.label}
              {blocks[service.key].rows.length > 0 && (
                <span className="mr-2 text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                  {blocks[service.key].rows.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-nx-navy text-slate-700 dark:text-nx-mist text-sm cursor-pointer border border-slate-300 dark:border-nx-navy-border hover:border-nx-blue/50 hover:bg-slate-200 dark:hover:bg-nx-navy/80 transition ${uploading ? 'opacity-60' : ''}`}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            {uploading ? 'در حال خواندن…' : 'بارگذاری اکسل (چند فایل هم‌زمان)'}
            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              disabled={Boolean(uploading)}
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length) void uploadExcels(files)
                e.target.value = ''
              }}
            />
          </label>
          <button
            onClick={openManualEditor}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist text-sm hover:border-nx-blue/50 hover:bg-slate-100 dark:hover:bg-nx-navy transition"
          >
            <PencilLine className="w-4 h-4 text-nx-blue" />
            افزودن دستی خدمت
          </button>
          {active.rows.length > 0 && (
            <button onClick={() => clearBlock(activeService)} className="inline-flex items-center gap-1.5 text-xs text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 px-3 py-2 rounded-lg">
              <Trash2 className="w-3.5 h-3.5" /> پاک کردن ردیف‌ها
            </button>
          )}
          {active.rows.length > 0 && (
            <span className="text-xs text-slate-600 dark:text-nx-mist">
              بدهکاری: <strong className="text-slate-900 dark:text-white">{rial(totals.debt)}</strong>
              {' '}— بستانکاری: <strong className="text-slate-900 dark:text-white">{rial(totals.credit)}</strong>
              {' '}— مانده: <strong className="text-slate-900 dark:text-white">{rial(totals.balance)}</strong>
            </span>
          )}
        </div>

        {active.rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-nx-navy-border">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="bg-slate-100 dark:bg-nx-navy text-slate-700 dark:text-nx-mist">
                <tr>
                  {(active.columns.length ? active.columns : defaultColumns(activeService)).map((column) => (
                    <th key={column} className="px-3 py-2 text-right font-medium whitespace-nowrap">{column}</th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {active.rows.slice(0, 100).map((row, index) => (
                  <tr key={index} className="border-t border-slate-200 dark:border-nx-navy-border">
                    {(active.columns.length ? active.columns : defaultColumns(activeService)).map((column) => (
                      <td key={column} className="px-3 py-2 text-slate-700 dark:text-nx-mist whitespace-nowrap">
                        {typeof row[column] === 'number' ? rial(row[column] as number) : String(row[column] ?? '')}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button onClick={() => removeManualRow(activeService, index)} className="p-1 rounded text-rose-500 dark:text-rose-400 hover:bg-rose-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-3">
          {canIssue && (
            <button onClick={() => void submit(false)} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-nx-navy border border-slate-300 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist text-sm font-medium hover:bg-slate-200 dark:hover:bg-nx-navy/80 disabled:opacity-60">
              <Send className="w-4 h-4" /> ثبت و ارسال برای تأیید
            </button>
          )}
          {canApprove && (
            <button onClick={() => void submit(true)} disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-nx-blue text-white text-sm font-medium disabled:opacity-60 shadow-sm">
              <CheckCircle2 className="w-4 h-4" /> ثبت، تأیید و صدور
            </button>
          )}
        </div>
      </section>

      <section className={`${CARD} overflow-x-auto`}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-nx-navy-border text-sm font-semibold text-slate-900 dark:text-white">درخواست‌های صدور</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-100 dark:bg-nx-navy text-slate-700 dark:text-nx-mist text-xs">
            <tr>
              <th className="text-right font-medium px-4 py-3">شماره نامه</th>
              <th className="text-right font-medium px-4 py-3">شرکت</th>
              <th className="text-right font-medium px-4 py-3">نوع خدمت</th>
              <th className="text-right font-medium px-4 py-3">بازه</th>
              <th className="text-right font-medium px-4 py-3">وضعیت</th>
              <th className="text-right font-medium px-4 py-3">فایل‌ها</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-8 text-center text-xs text-nx-mist">در حال بارگذاری…</td></tr>}
            {!loading && approvals.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-xs text-nx-mist">درخواستی ثبت نشده است.</td></tr>}
            {approvals.map((approval) => (
              <tr
                key={approval.id}
                ref={(el) => {
                  rowRefs.current[approval.id] = el
                }}
                className={`border-t border-slate-200 dark:border-nx-navy-border hover:bg-slate-50 dark:hover:bg-nx-navy/40 ${
                  String(approval.id) === focusedRequest ? 'bg-nx-blue/10 ring-1 ring-inset ring-nx-blue/60' : ''
                }`}
              >
                <td className="px-4 py-3 text-slate-900 dark:text-white font-medium" dir="ltr">
                  {approval.service_letters && Object.keys(approval.service_letters).length > 0
                    ? Object.entries(approval.service_letters).map(([key, letter]) => (
                        <div key={key} className="text-[11px]">
                          {letter}
                          <span className="text-slate-500 dark:text-nx-mist mr-1">({SERVICES.find((s) => s.key === key)?.label || key})</span>
                        </div>
                      ))
                    : approval.letter_number || '—'}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-nx-mist">{approval.payer_name}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-nx-mist">{approval.service_type}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-nx-mist">{approval.period_range}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-[11px] ${STATUS_STYLE[approval.status] || ''}`}>{approval.status_display}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {approval.files.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => void downloadFile(file)}
                        className="inline-flex items-center gap-1 text-[11px] text-nx-blue hover:underline"
                      >
                        <Download className="w-3 h-3" /> {file.file_name}
                      </button>
                    ))}
                    {approval.files.length === 0 && <span className="text-[11px] text-slate-400 dark:text-nx-mist/60">—</span>}
                  </div>
                  {approval.generation_error && <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1">{approval.generation_error}</p>}
                </td>
                <td className="px-4 py-3">
                  {approval.status === 'pending' && canApprove && (
                    <div className="flex gap-1">
                      <button onClick={() => void act(approval.id, 'approve')} className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10" title="تأیید و صدور">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => void act(approval.id, 'reject')} className="p-1.5 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-500/10" title="رد">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {manualOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setManualOpen(false)}>
          <div className={`${CARD} w-full max-w-5xl p-5 my-6`} onClick={(event) => event.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">افزودن دستی خدمت — {SERVICES.find((s) => s.key === activeService)?.label}</h3>
                <p className="text-[11px] text-slate-500 dark:text-nx-mist mt-0.5">ردیف‌ها مثل ردیف‌های اکسل به همان جدول اضافه و با ثبت درخواست در دیتابیس ذخیره می‌شوند.</p>
              </div>
              <button onClick={() => setManualOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-nx-mist dark:hover:bg-nx-navy"><X className="w-4 h-4" /></button>
            </div>

            <datalist id="passenger-suggestions">
              {passengers.map((name) => <option key={name} value={name} />)}
            </datalist>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-nx-navy-border">
              <table className="w-full text-xs min-w-[720px]">
                <thead className="bg-slate-100 dark:bg-nx-navy text-slate-700 dark:text-nx-mist">
                  <tr>
                    <th className="px-2 py-2 text-right font-medium">#</th>
                    {MANUAL_FIELDS[activeService].map((field) => (
                      <th key={field.key} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                        {field.label}{field.required ? ' *' : ''}
                      </th>
                    ))}
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {draftRows.map((draft, index) => (
                    <tr key={index} className="border-t border-slate-200 dark:border-nx-navy-border">
                      <td className="px-2 py-1.5 text-slate-600 dark:text-nx-mist">{index + 1}</td>
                      {MANUAL_FIELDS[activeService].map((field) => (
                        <td key={field.key} className="px-1.5 py-1.5">
                          <input
                            type={field.type === 'money' || field.type === 'number' ? 'number' : 'text'}
                            list={field.type === 'passenger' ? 'passenger-suggestions' : undefined}
                            value={draft[field.key] || ''}
                            onChange={(e) => setDraftCell(index, field.key, e.target.value)}
                            placeholder={field.type === 'date' ? '1404/03/02' : undefined}
                            className={`${INPUT} !py-1.5 !text-xs min-w-[90px]`}
                            dir={field.type === 'money' || field.type === 'number' || field.type === 'date' ? 'ltr' : 'rtl'}
                          />
                        </td>
                      ))}
                      <td className="px-1.5 py-1.5">
                        <button onClick={() => removeDraftRow(index)} className="p-1 rounded text-rose-500 dark:text-rose-400 hover:bg-rose-500/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activeService === 'service' && categories.length > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-nx-mist mt-2">
                شرح خدمات را می‌توانید از فهرست خدمات هم انتخاب کنید؛ دستهٔ انتخابی صفحه به‌عنوان نوع صورت‌حساب استفاده می‌شود.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
              <div className="flex items-center gap-2">
                <button onClick={addDraftRow} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist text-xs hover:border-nx-blue/50 hover:bg-slate-100 dark:hover:bg-nx-navy transition">
                  <Plus className="w-3.5 h-3.5" /> ردیف جدید
                </button>
                <p className="text-[11px] text-slate-500 dark:text-nx-mist">هر تعداد مسافر را می‌توانید در یک نشست وارد کنید؛ مانده خودکار محاسبه می‌شود.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setManualOpen(false)} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist hover:bg-slate-100 dark:hover:bg-nx-navy text-sm">بستن</button>
                <button onClick={commitDrafts} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-nx-blue text-white text-sm font-medium shadow-sm">
                  <Save className="w-4 h-4" /> ثبت ردیف‌ها
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function defaultColumns(service: ServiceKey): string[] {
  return {
    flight: ['ردیف', 'قرارداد', 'نام مسافر', 'مسیر', 'شماره بلیط', 'تاریخ پرواز', 'بدهکار', 'بستانکار', 'مانده'],
    hotel: ['ردیف', 'قرارداد', 'نام مسافر', 'هتل', 'نوع اتاق', 'تعداد نفرات', 'تاریخ ورود و خروج', 'بدهکار', 'بستانکار', 'مانده'],
    service: ['ردیف', 'قرارداد', 'نام مسافر', 'شرح خدمات', 'تاریخ', 'توضیحات', 'بدهکار', 'بستانکار', 'مانده'],
  }[service]
}
