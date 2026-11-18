import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import JalaliDateInput from '../../components/JalaliDateInput'
import { CARD, INPUT, rial, type Invoice } from './shared'
import { Download, FileText, Filter, Trash2, Wallet, X } from 'lucide-react'
import { todayIso } from '../../lib/jalali'

export default function BillingInvoicesPage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const canDelete = user?.role === 'ceo' || user?.role === 'admin' || Boolean(user?.permissions?.delete_history)
  const canPay = user?.role === 'ceo' || user?.role === 'admin' || Boolean(user?.permissions?.pay)

  const [rows, setRows] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', date: '', tracking: '', description: '' })
  const [savingPay, setSavingPay] = useState(false)
  const [payer, setPayer] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [type, setType] = useState('all')
  const [types, setTypes] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/billing/invoices/', {
        params: {
          payer: payer || undefined,
          start_date: start || undefined,
          end_date: end || undefined,
          type: type === 'all' ? undefined : type,
        },
      })
      setRows(res.data)
    } catch {
      toast('خطا در دریافت صورت‌حساب‌ها', 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payer, start, end, type])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    api.get('/billing/invoices/types/')
      .then((res) => setTypes(res.data))
      .catch(() => undefined)
  }, [])

  const download = async (row: Invoice) => {
    try {
      const endpoint = row.file_id
        ? `/billing/files/${row.file_id}/download/`
        : `/billing/files/by-letter/${encodeURIComponent(row.letter_number)}/`
      const res = await api.get(endpoint, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `${row.invoice_type}_${row.letter_number.replace(/\//g, '-')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      toast('دانلود فایل ناموفق بود', 'error')
    }
  }

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows])

  const openPayment = (invoice: Invoice) => {
    setPaying(invoice)
    setPayForm({
      amount: String(invoice.amount || ''),
      date: todayIso(),
      tracking: invoice.letter_number,
      description: '',
    })
  }

  const submitPayment = async () => {
    if (!paying) return
    if (!payForm.amount || Number(payForm.amount) <= 0) {
      toast('مبلغ پرداخت را وارد کنید', 'error')
      return
    }
    setSavingPay(true)
    try {
      await api.post('/billing/payments/', {
        payer_code: paying.payer_code,
        payer_name: paying.payer,
        amount: Number(payForm.amount),
        payment_date: payForm.date || undefined,
        tracking_number: payForm.tracking,
        description: payForm.description,
      })
      toast('پرداخت ثبت شد', 'success')
      setPaying(null)
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در ثبت پرداخت', 'error')
    } finally {
      setSavingPay(false)
    }
  }

  const remove = async (invoice: Invoice) => {
    if (!confirm(`صورت‌حساب ${invoice.letter_number} حذف شود؟ شمارهٔ نامه آزاد می‌شود.`)) return
    try {
      await api.delete(`/billing/invoices/${invoice.id}/`)
      toast('صورت‌حساب حذف شد', 'success')
      void load()
    } catch {
      toast('خطا در حذف صورت‌حساب', 'error')
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-nx-blue" />
        <div>
          <h1 className="text-lg font-bold text-white">صورت‌حساب‌ها</h1>
          <p className="text-xs text-nx-mist">صورت‌حساب‌های صادرشده به تفکیک شرکت و نوع خدمت</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', ...types].map((item) => (
          <button
            key={item}
            onClick={() => setType(item)}
            className={`px-3.5 py-1.5 rounded-full text-xs border transition ${
              type === item
                ? 'bg-nx-blue/15 text-nx-blue border-nx-blue/40'
                : 'text-nx-mist border-nx-navy-border hover:border-nx-blue/40'
            }`}
          >
            {item === 'all' ? 'همهٔ خدمات' : item}
          </button>
        ))}
      </div>

      <div className={`${CARD} p-4 grid grid-cols-1 md:grid-cols-4 gap-3`}>
        <div>
          <label className="block text-xs text-nx-mist mb-1.5">شرکت</label>
          <input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="نام شرکت" className={INPUT} />
        </div>
        <JalaliDateInput label="از تاریخ" value={start} onChange={setStart} />
        <JalaliDateInput label="تا تاریخ" value={end} onChange={setEnd} />
        <div className="flex items-end">
          <button onClick={() => void load()} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-nx-blue/15 text-nx-blue text-sm hover:bg-nx-blue/25 transition">
            <Filter className="w-4 h-4" />
            اعمال فیلتر
          </button>
        </div>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-nx-navy text-nx-mist text-xs">
            <tr>
              <th className="text-right font-medium px-4 py-3">شماره نامه</th>
              <th className="text-right font-medium px-4 py-3">تاریخ</th>
              <th className="text-right font-medium px-4 py-3">شرکت</th>
              <th className="text-right font-medium px-4 py-3">نوع خدمت</th>
              <th className="text-left font-medium px-4 py-3">مبلغ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="py-8 text-center text-xs text-nx-mist">در حال بارگذاری…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-xs text-nx-mist">صورت‌حسابی یافت نشد.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-nx-navy-border hover:bg-nx-navy/40">
                <td className="px-4 py-3 text-white">{row.letter_number}</td>
                <td className="px-4 py-3 text-nx-mist">{row.issue_date_jalali}</td>
                <td className="px-4 py-3 text-nx-mist">
                  {row.payer} <span className="text-[10px] text-nx-mist/60">({row.payer_code})</span>
                </td>
                <td className="px-4 py-3 text-nx-mist">{row.invoice_type}</td>
                <td className="px-4 py-3 text-left text-white">{rial(row.amount)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {canPay && (
                      <button
                        onClick={() => openPayment(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-400/10 text-emerald-400 text-[11px] hover:bg-emerald-400/20"
                        title="ثبت پرداخت برای این صورت‌حساب"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        ثبت پرداخت
                      </button>
                    )}
                    <button
                      onClick={() => void download(row)}
                      className="p-1.5 rounded-lg text-nx-blue hover:bg-nx-blue/10"
                      title="دانلود فایل نامه"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {canDelete && (
                      <button onClick={() => void remove(row)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-nx-navy">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-xs text-nx-mist">جمع ({rows.length} ردیف)</td>
              <td className="px-4 py-3 text-left font-bold text-white">{rial(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {paying && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4" onClick={() => setPaying(null)}>
          <div
            className={`${CARD} w-full max-w-md p-5`}
            onClick={(event) => event.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">ثبت پرداخت</h3>
                <p className="text-[11px] text-nx-mist mt-0.5">
                  {paying.payer} — صورت‌حساب {paying.letter_number}
                </p>
              </div>
              <button onClick={() => setPaying(null)} className="p-1.5 rounded-lg text-nx-mist hover:bg-nx-navy">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-nx-mist mb-1.5">مبلغ (ریال)</label>
                  <input
                    type="number"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    className={INPUT}
                  />
                </div>
                <JalaliDateInput
                  label="تاریخ پرداخت"
                  value={payForm.date}
                  onChange={(iso) => setPayForm({ ...payForm, date: iso })}
                />
              </div>
              <div>
                <label className="block text-xs text-nx-mist mb-1.5">شماره مرجع</label>
                <input
                  value={payForm.tracking}
                  onChange={(e) => setPayForm({ ...payForm, tracking: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs text-nx-mist mb-1.5">توضیحات (اختیاری)</label>
                <input
                  value={payForm.description}
                  onChange={(e) => setPayForm({ ...payForm, description: e.target.value })}
                  className={INPUT}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPaying(null)} className="px-4 py-2 rounded-xl border border-nx-navy-border text-nx-mist text-sm">
                انصراف
              </button>
              <button
                onClick={() => void submitPayment()}
                disabled={savingPay}
                className="px-5 py-2 rounded-xl bg-nx-blue text-white text-sm disabled:opacity-60"
              >
                {savingPay ? 'در حال ثبت…' : 'ثبت پرداخت'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
