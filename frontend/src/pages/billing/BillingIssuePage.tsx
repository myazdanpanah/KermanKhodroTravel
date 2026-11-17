import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import JalaliDateInput from '../../components/JalaliDateInput'
import { isoToJalali, formatJalali, todayIso } from '../../lib/jalali'
import { CARD, INPUT, rial, type Payer } from './shared'
import { FileSpreadsheet, Plus, Send, CheckCircle2, XCircle, Download, Trash2 } from 'lucide-react'

type ServiceKey = 'flight' | 'hotel' | 'service'

const SERVICES: { key: ServiceKey; label: string; field: 'flight_data' | 'hotel_data' | 'service_data' }[] = [
  { key: 'flight', label: 'پرواز', field: 'flight_data' },
  { key: 'hotel', label: 'هتل', field: 'hotel_data' },
  { key: 'service', label: 'خدمات', field: 'service_data' },
]

interface ApprovalFile {
  id: number
  service_type: string
  file_name: string
  download_url: string
}

interface Approval {
  id: number
  requester_name: string
  payer_code: string
  payer_name: string
  service_type: string
  letter_number: string
  letter_date: string
  period_range: string
  status: 'pending' | 'approved' | 'rejected'
  status_display: string
  generation_error: string
  files: ApprovalFile[]
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [payerCode, setPayerCode] = useState('')
  const [letterNumber, setLetterNumber] = useState('')
  const [letterDate, setLetterDate] = useState(todayIso())
  const [startDay, setStartDay] = useState('1')
  const [endDay, setEndDay] = useState('31')
  const [serviceLabel, setServiceLabel] = useState('پرواز')
  const [activeService, setActiveService] = useState<ServiceKey>('flight')

  const [blocks, setBlocks] = useState<Record<ServiceKey, { columns: string[]; rows: Record<string, unknown>[]; totals: Record<string, number> }>>({
    flight: { columns: [], rows: [], totals: {} },
    hotel: { columns: [], rows: [], totals: {} },
    service: { columns: [], rows: [], totals: {} },
  })
  const [uploading, setUploading] = useState<ServiceKey | null>(null)

  const jalali = useMemo(() => isoToJalali(letterDate), [letterDate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [payersRes, approvalsRes] = await Promise.all([
        api.get('/billing/payers/'),
        api.get('/billing/approvals/'),
      ])
      setPayers(payersRes.data)
      setApprovals(approvalsRes.data)
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
      .get('/billing/next-letter/', { params: { payer_code: payerCode } })
      .then((res) => setLetterNumber(res.data.letter_number))
      .catch(() => setLetterNumber(''))
  }, [payerCode])

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
      toast(`فایل ${file.name} خوانده شد (${processed.data.rows.length} ردیف)`, 'success')
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در خواندن فایل اکسل', 'error')
    } finally {
      setUploading(null)
    }
  }

  const clearBlock = (service: ServiceKey) =>
    setBlocks((prev) => ({ ...prev, [service]: { columns: [], rows: [], totals: {} } }))

  const periodRange = jalali ? `${jalali.month}/${jalali.year} — روز ${startDay} تا ${endDay}` : ''

  const submit = async (approveNow: boolean) => {
    if (!payerCode) {
      toast('شرکت طرف حساب را انتخاب کنید', 'error')
      return
    }
    if (!blocks.flight.rows.length && !blocks.hotel.rows.length && !blocks.service.rows.length) {
      toast('حداقل یک فایل خدمت لازم است', 'error')
      return
    }
    setSaving(true)
    try {
      const payer = payers.find((p) => p.code === payerCode)
      const res = await api.post('/billing/approvals/', {
        payer_code: payerCode,
        payer_name: payer?.name || '',
        service_type: serviceLabel,
        letter_number: letterNumber,
        letter_date: formatJalali(letterDate),
        start_day: Number(startDay) || 1,
        end_day: Number(endDay) || 31,
        month: jalali ? String(jalali.month) : '',
        year: jalali?.year || 0,
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
      setBlocks({
        flight: { columns: [], rows: [], totals: {} },
        hotel: { columns: [], rows: [], totals: {} },
        service: { columns: [], rows: [], totals: {} },
      })
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
            <input value={letterNumber} readOnly className={INPUT} placeholder="خودکار" />
          </div>
          <JalaliDateInput label="تاریخ نامه" value={letterDate} onChange={setLetterDate} />
          <div>
            <label className="block text-xs text-nx-mist mb-1.5">از روز</label>
            <input type="number" value={startDay} onChange={(e) => setStartDay(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs text-nx-mist mb-1.5">تا روز</label>
            <input type="number" value={endDay} onChange={(e) => setEndDay(e.target.value)} className={INPUT} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-nx-mist mb-1.5">نوع خدمت (موضوع نامه)</label>
            <input value={serviceLabel} onChange={(e) => setServiceLabel(e.target.value)} className={INPUT} placeholder="پرواز، هتل، ویزا…" />
          </div>
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
          {active.rows.length > 0 && (
            <button onClick={() => clearBlock(activeService)} className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:bg-rose-400/10 px-3 py-2 rounded-lg">
              <Trash2 className="w-3.5 h-3.5" /> پاک کردن ردیف‌ها
            </button>
          )}
          {active.rows.length > 0 && (
            <span className="text-xs text-nx-mist">
              جمع بدهکار: <strong className="text-white">{rial(Number(active.totals.debt || 0))}</strong>
              {' '}— جمع بستانکار: <strong className="text-white">{rial(Number(active.totals.credit || 0))}</strong>
            </span>
          )}
        </div>

        {active.rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-nx-navy-border">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="bg-nx-navy text-nx-mist">
                <tr>
                  {active.columns.map((column) => (
                    <th key={column} className="px-3 py-2 text-right font-medium whitespace-nowrap">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.rows.slice(0, 50).map((row, index) => (
                  <tr key={index} className="border-t border-nx-navy-border">
                    {active.columns.map((column) => (
                      <td key={column} className="px-3 py-2 text-nx-mist whitespace-nowrap">
                        {typeof row[column] === 'number' ? rial(row[column] as number) : String(row[column] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {active.rows.length > 50 && (
              <p className="text-[10px] text-nx-mist p-2">۵۰ ردیف اول نمایش داده شده است؛ همهٔ {active.rows.length} ردیف ارسال می‌شوند.</p>
            )}
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
              <th className="text-right font-medium px-4 py-3">بازه</th>
              <th className="text-right font-medium px-4 py-3">درخواست‌دهنده</th>
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
                <td className="px-4 py-3 text-white">{approval.letter_number || '—'}</td>
                <td className="px-4 py-3 text-nx-mist">{approval.payer_name}</td>
                <td className="px-4 py-3 text-nx-mist">{approval.period_range}</td>
                <td className="px-4 py-3 text-nx-mist">{approval.requester_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-[11px] ${STATUS_STYLE[approval.status] || ''}`}>{approval.status_display}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {approval.files.map((file) => (
                      <a
                        key={file.id}
                        href={file.download_url}
                        onClick={async (e) => {
                          e.preventDefault()
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
                      </a>
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
    </div>
  )
}
