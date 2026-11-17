import { useCallback, useEffect, useMemo, useState } from 'react'
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

  const [payerCode, setPayerCode] = useState('')
  const [letterNumber, setLetterNumber] = useState('')
  const [letterDate, setLetterDate] = useState(todayIso())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [serviceCategoryId, setServiceCategoryId] = useState('')
  const [activeService, setActiveService] = useState<ServiceKey>('flight')
  const [blocks, setBlocks] = useState<Record<ServiceKey, Block>>(EMPTY_BLOCKS)
  const [uploading, setUploading] = useState<ServiceKey | null>(null)

  // Manual row editor
  const [manualOpen, setManualOpen] = useState(false)
  const [manualDraft, setManualDraft] = useState<Record<string, string>>({})
  const [manualDates, setManualDates] = useState<Record<string, string>>({})

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

  const uploadExcel = async (service: ServiceKey, file: File) => {
    setUploading(service)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const up = await api.post('/billing/upload/excel/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const processed = await api.post('/billing/process/excel/', {
        tmp_id: up.data.tmp_id,
        type: service,
      })
      setBlocks((prev) => ({
        ...prev,
        [service]: { columns: processed.data.columns, rows: processed.data.rows, totals: processed.data.totals },
      }))
      setActiveService(service)
      const serviceLabel = SERVICES.find((item) => item.key === service)?.label || ''
      toast(`فایل ${file.name} خوانده شد (${processed.data.rows.length} ردیف) — نوع خدمت: ${serviceLabel}`, 'success')
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در خواندن فایل اکسل', 'error')
    } finally {
      setUploading(null)
    }
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
    setManualDraft({})
    setManualDates({})
    setManualOpen(true)
  }

  const addManualRow = () => {
    const fields = MANUAL_FIELDS[activeService]
    for (const field of fields) {
      if (field.required && !String(manualDraft[field.key] || '').trim()) {
        toast(`${field.label} را وارد کنید`, 'error')
        return
      }
    }

    const row: Record<string, unknown> = {}
    for (const field of fields) {
      if (field.type === 'date') {
        const iso = manualDates[field.key] || ''
        row[field.key] = iso ? formatJalali(iso) : ''
      } else if (field.type === 'money' || field.type === 'number') {
        row[field.key] = Number(manualDraft[field.key] || 0)
      } else {
        row[field.key] = String(manualDraft[field.key] || '').trim()
      }
    }

    if (activeService === 'hotel') {
      row['تاریخ ورود و خروج'] = `ورود: ${row['تاریخ ورود'] || '—'}  خروج: ${row['تاریخ خروج'] || '—'}`
      delete row['تاریخ ورود']
      delete row['تاریخ خروج']
      row['تعداد نفرات'] = Number(row['تعداد نفرات'] || 1)
    }

    const debt = Number(row['بدهکار'] || 0)
    const credit = Number(row['بستانکار'] || 0)
    row['مانده'] = debt - credit

    setBlocks((prev) => {
      const current = prev[activeService]
      const rows: Record<string, unknown>[] = [...current.rows, row].map((item, index) => ({ ...item, ردیف: index + 1 }))
      return {
        ...prev,
        [activeService]: {
          columns: current.columns.length ? current.columns : defaultColumns(activeService),
          rows,
          totals: { debt: rows.reduce((s, r) => s + Number(r['بدهکار'] || 0), 0), credit: rows.reduce((s, r) => s + Number(r['بستانکار'] || 0), 0) },
        },
      }
    })
    setManualDraft({})
    setManualDates({})
    toast('ردیف به جدول اضافه شد', 'success')
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
          <h1 className="text-lg font-bold text-white">صدور صورت‌حساب</h1>
          <p className="text-xs text-nx-mist">ثبت فروش خدمات، محاسبهٔ مانده و تولید اعلامیهٔ رسمی</p>
        </div>
      </div>

      <section className={`${CARD} p-5 space-y-4`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-nx-mist mb-1.5">شرکت طرف حساب</label>
            <select value={payerCode} onChange={(e) => setPayerCode(e.target.value)} className={INPUT}>
              <option value="">انتخاب شرکت…</option>
              {payers.map((p) => (
                <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-nx-mist mb-1.5">شماره نامه</label>
            <input value={letterNumber} readOnly className={INPUT} placeholder="YYYY/CODE/NNNNN" dir="ltr" />
          </div>
          <JalaliDateInput label="تاریخ نامه" value={letterDate} onChange={setLetterDate} />
          <JalaliDateInput label="تاریخ شروع *" value={startDate} onChange={setStartDate} />
          <JalaliDateInput label="تاریخ پایان *" value={endDate} onChange={setEndDate} />
          <div className="md:col-span-2">
            <label className="block text-xs text-nx-mist mb-1.5">نوع خدمت (از فایل تعیین می‌شود)</label>
            <div className={`${INPUT} flex items-center min-h-[42px]`}>
              {serviceType || <span className="text-nx-mist/60">هنوز فایلی بارگذاری نشده است</span>}
            </div>
          </div>
          {blocks.service.rows.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-xs text-nx-mist mb-1.5">دستهٔ خدمت (برای نام‌گذاری دقیق)</label>
              <select value={serviceCategoryId} onChange={(e) => setServiceCategoryId(e.target.value)} className={INPUT}>
                <option value="">خدمات (عمومی)</option>
                {categories.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-b border-nx-navy-border pb-2">
          {SERVICES.map((service) => (
            <button
              key={service.key}
              onClick={() => setActiveService(service.key)}
              className={`px-4 py-2 rounded-lg text-sm transition ${activeService === service.key ? 'bg-nx-blue/15 text-nx-blue' : 'text-nx-mist hover:bg-nx-navy'}`}
            >
              {service.label}
              {blocks[service.key].rows.length > 0 && (
                <span className="mr-2 text-[10px] bg-emerald-400/15 text-emerald-400 px-1.5 py-0.5 rounded">
                  {blocks[service.key].rows.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nx-navy text-nx-mist text-sm cursor-pointer border border-nx-navy-border hover:border-nx-blue/50 transition ${uploading ? 'opacity-60' : ''}`}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            {uploading === activeService ? 'در حال خواندن…' : `بارگذاری اکسل ${SERVICES.find((s) => s.key === activeService)?.label}`}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={Boolean(uploading)}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadExcel(activeService, file)
                e.target.value = ''
              }}
            />
          </label>
          <button
            onClick={openManualEditor}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-nx-navy-border text-nx-mist text-sm hover:border-nx-blue/50"
          >
            <PencilLine className="w-4 h-4 text-nx-blue" />
            افزودن دستی خدمت
          </button>
          {active.rows.length > 0 && (
            <button onClick={() => clearBlock(activeService)} className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:bg-rose-400/10 px-3 py-2 rounded-lg">
              <Trash2 className="w-3.5 h-3.5" /> پاک کردن ردیف‌ها
            </button>
          )}
          {active.rows.length > 0 && (
            <span className="text-xs text-nx-mist">
              بدهکاری: <strong className="text-white">{rial(totals.debt)}</strong>
              {' '}— بستانکاری: <strong className="text-white">{rial(totals.credit)}</strong>
              {' '}— مانده: <strong className="text-white">{rial(totals.balance)}</strong>
            </span>
          )}
        </div>

        {active.rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-nx-navy-border">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="bg-nx-navy text-nx-mist">
                <tr>
                  {(active.columns.length ? active.columns : defaultColumns(activeService)).map((column) => (
                    <th key={column} className="px-3 py-2 text-right font-medium whitespace-nowrap">{column}</th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {active.rows.slice(0, 100).map((row, index) => (
                  <tr key={index} className="border-t border-nx-navy-border">
                    {(active.columns.length ? active.columns : defaultColumns(activeService)).map((column) => (
                      <td key={column} className="px-3 py-2 text-nx-mist whitespace-nowrap">
                        {typeof row[column] === 'number' ? rial(row[column] as number) : String(row[column] ?? '')}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button onClick={() => removeManualRow(activeService, index)} className="p-1 rounded text-rose-400 hover:bg-rose-400/10">
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
            <button onClick={() => void submit(false)} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-nx-navy border border-nx-navy-border text-nx-mist text-sm disabled:opacity-60">
              <Send className="w-4 h-4" /> ثبت و ارسال برای تأیید
            </button>
          )}
          {canApprove && (
            <button onClick={() => void submit(true)} disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-nx-blue text-white text-sm disabled:opacity-60">
              <CheckCircle2 className="w-4 h-4" /> ثبت، تأیید و صدور
            </button>
          )}
        </div>
      </section>

      <section className={`${CARD} overflow-x-auto`}>
        <div className="px-4 py-3 border-b border-nx-navy-border text-sm font-semibold text-white">درخواست‌های صدور</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-nx-navy text-nx-mist text-xs">
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
              <tr key={approval.id} className="border-t border-nx-navy-border hover:bg-nx-navy/40">
                <td className="px-4 py-3 text-white" dir="ltr">{approval.letter_number || '—'}</td>
                <td className="px-4 py-3 text-nx-mist">{approval.payer_name}</td>
                <td className="px-4 py-3 text-nx-mist">{approval.service_type}</td>
                <td className="px-4 py-3 text-nx-mist">{approval.period_range}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-[11px] ${STATUS_STYLE[approval.status] || ''}`}>{approval.status_display}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {approval.files.map((file) => (
                      <button
                        key={file.id}
                        onClick={async () => {
                          const res = await api.get(`/billing/files/${file.id}/download/`, { responseType: 'blob' })
                          const url = URL.createObjectURL(res.data)
                          const link = document.createElement('a')
                          link.href = url
                          link.download = file.file_name
                          link.click()
                          URL.revokeObjectURL(url)
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-nx-blue hover:underline"
                      >
                        <Download className="w-3 h-3" /> {file.file_name}
                      </button>
                    ))}
                    {approval.files.length === 0 && <span className="text-[11px] text-nx-mist/60">—</span>}
                  </div>
                  {approval.generation_error && <p className="text-[10px] text-rose-400 mt-1">{approval.generation_error}</p>}
                </td>
                <td className="px-4 py-3">
                  {approval.status === 'pending' && canApprove && (
                    <div className="flex gap-1">
                      <button onClick={() => void act(approval.id, 'approve')} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10" title="تأیید و صدور">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => void act(approval.id, 'reject')} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10" title="رد">
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
          <div className={`${CARD} w-full max-w-3xl p-5 my-6`} onClick={(event) => event.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">افزودن دستی خدمت — {SERVICES.find((s) => s.key === activeService)?.label}</h3>
                <p className="text-[11px] text-nx-mist mt-0.5">ردیف جدید مثل ردیف‌های اکسل به همان جدول اضافه و با ثبت درخواست در دیتابیس ذخیره می‌شود.</p>
              </div>
              <button onClick={() => setManualOpen(false)} className="p-1.5 rounded-lg text-nx-mist hover:bg-nx-navy"><X className="w-4 h-4" /></button>
            </div>

            {activeService === 'service' && categories.length > 0 && (
              <div className="mb-3">
                <label className="block text-[11px] text-nx-mist mb-1">انتخاب خدمت از فهرست</label>
                <select
                  value={manualDraft['شرح خدمات'] || ''}
                  onChange={(e) => setManualDraft({ ...manualDraft, 'شرح خدمات': e.target.value })}
                  className={INPUT}
                >
                  <option value="">انتخاب یا تایپ دستی…</option>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MANUAL_FIELDS[activeService].map((field) => (
                <div key={field.key}>
                  <label className="block text-[11px] text-nx-mist mb-1">
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  {field.type === 'date' ? (
                    <JalaliDateInput
                      value={manualDates[field.key] || ''}
                      onChange={(iso) => setManualDates({ ...manualDates, [field.key]: iso })}
                    />
                  ) : field.type === 'passenger' ? (
                    <>
                      <input
                        list="passenger-suggestions"
                        value={manualDraft[field.key] || ''}
                        onChange={(e) => setManualDraft({ ...manualDraft, [field.key]: e.target.value })}
                        className={INPUT}
                        placeholder="نام مسافر را بنویسید یا انتخاب کنید"
                      />
                      <datalist id="passenger-suggestions">
                        {passengers.map((name) => <option key={name} value={name} />)}
                      </datalist>
                    </>
                  ) : (
                    <input
                      type={field.type === 'money' || field.type === 'number' ? 'number' : 'text'}
                      value={manualDraft[field.key] || ''}
                      onChange={(e) => setManualDraft({ ...manualDraft, [field.key]: e.target.value })}
                      className={INPUT}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-[11px] text-nx-mist">مانده به‌صورت خودکار از بدهکار منهای بستانکار محاسبه می‌شود.</p>
              <div className="flex gap-2">
                <button onClick={() => setManualOpen(false)} className="px-4 py-2 rounded-xl border border-nx-navy-border text-nx-mist text-sm">بستن</button>
                <button onClick={addManualRow} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-nx-blue text-white text-sm">
                  <Save className="w-4 h-4" /> افزودن ردیف
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
