import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import JalaliDateInput from '../../components/JalaliDateInput'
import { CARD, INPUT, rial, type Invoice } from './shared'
import { Download, FileText, Filter, Trash2, Wallet, X, Receipt, Eye } from 'lucide-react'
import { todayIso } from '../../lib/jalali'
import InvoiceDetailModal from '../../components/InvoiceDetailModal'

export default function BillingInvoicesPage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const canDelete = user?.role === 'ceo' || user?.role === 'admin' || Boolean(user?.permissions?.delete_history)
  const canPay = user?.role === 'ceo' || user?.role === 'admin' || Boolean(user?.permissions?.pay)

  const [rows, setRows] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
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

  const downloadPdf = async (row: Invoice) => {
    try {
      const endpoint = `/billing/invoices/${row.id}/download-pdf/`
      const res = await api.get(endpoint, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `صورت‌حساب_${row.invoice_type}_${row.letter_number.replace(/\//g, '-')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast('صورت‌حساب PDF دانلود شد', 'success')
    } catch {
      toast('دانلود صورت‌حساب ناموفق بود', 'error')
    }
  }

  const downloadLetter = async (row: Invoice) => {
    try {
      const endpoint = `/billing/invoices/${row.id}/download-letter/`
      const res = await api.get(endpoint, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `نامه_${row.invoice_type}_${row.letter_number.replace(/\//g, '-')}.docx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast('نامه رسمی (Word) دانلود شد', 'success')
    } catch {
      toast('دانلود نامه رسمی ناموفق بود', 'error')
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
    if (!confirm(`صورت‌حساب ${invoice.letter_number} ابطال شود؟ ردیف و شمارهٔ نامه حفظ می‌شوند و شماره دوباره استفاده نمی‌شود.`)) return
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
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">صورت‌حساب‌ها</h1>
          <p className="text-xs text-slate-500 dark:text-nx-mist">صورت‌حساب‌های صادرشده به تفکیک شرکت و نوع خدمت</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', ...types].map((item) => (
          <button
            key={item}
            onClick={() => setType(item)}
            className={`px-3.5 py-1.5 rounded-full text-xs border transition ${
              type === item
                ? 'bg-nx-blue/15 text-nx-blue border-nx-blue/40 font-medium'
                : 'text-slate-600 dark:text-nx-mist border-slate-300 dark:border-nx-navy-border hover:border-nx-blue/40 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {item === 'all' ? 'همهٔ خدمات' : item}
          </button>
        ))}
      </div>

      <div className={`${CARD} p-4 grid grid-cols-1 md:grid-cols-4 gap-3`}>
        <div>
          <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">شرکت</label>
          <input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="نام شرکت" className={INPUT} />
        </div>
        <JalaliDateInput label="از تاریخ" value={start} onChange={setStart} />
        <JalaliDateInput label="تا تاریخ" value={end} onChange={setEnd} />
        <div className="flex items-end">
          <button onClick={() => void load()} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-nx-blue/15 text-nx-blue text-sm hover:bg-nx-blue/25 transition font-medium">
            <Filter className="w-4 h-4" />
            اعمال فیلتر
          </button>
        </div>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-nx-navy text-slate-700 dark:text-nx-mist text-xs">
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
              <tr><td colSpan={6} className="py-8 text-center text-xs text-slate-500 dark:text-nx-mist">در حال بارگذاری…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-xs text-slate-500 dark:text-nx-mist">صورت‌حسابی یافت نشد.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200 dark:border-nx-navy-border hover:bg-slate-50 dark:hover:bg-nx-navy/40">
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedInvoice(row)}
                    className="text-nx-blue dark:text-blue-400 font-bold hover:underline font-mono text-xs flex items-center gap-1"
                    title="مشاهده کارت و ریز اقلام صورت‌حساب"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{row.letter_number}</span>
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-nx-mist">
                  <div>{row.issue_date_jalali}</div>
                  {row.period_range && (
                    <div className="text-[10px] text-slate-400 dark:text-nx-mist/60 font-normal">
                      {row.period_range}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-800 dark:text-nx-mist">
                  {row.payer} <span className="text-[10px] text-slate-500 dark:text-nx-mist/60">({row.payer_code})</span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-nx-mist">{row.invoice_type}</td>
                <td className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">{rial(row.amount)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedInvoice(row)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-bold transition shadow-xs"
                      title="مشاهده کارت و ریز اقلام صورت‌حساب"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>کارت و ریز اقلام</span>
                    </button>
                    {canPay && (
                      <button
                        onClick={() => openPayment(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] hover:bg-emerald-500/20"
                        title="ثبت پرداخت برای این صورت‌حساب"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        پرداخت
                      </button>
                    )}
                    <button
                      onClick={() => void downloadPdf(row)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-medium transition"
                      title="دانلود صورت‌حساب (PDF)"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>صورت‌حساب</span>
                    </button>
                    <button
                      onClick={() => void downloadLetter(row)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-medium transition"
                      title="دانلود نامه رسمی (Word)"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>نامه</span>
                    </button>
                    {canDelete && (
                      <button onClick={() => void remove(row)} className="p-1.5 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-500/10" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 dark:bg-nx-navy">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-xs text-slate-600 dark:text-nx-mist">جمع ({rows.length} ردیف)</td>
              <td className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white">{rial(total)}</td>
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
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">ثبت پرداخت</h3>
                <p className="text-[11px] text-slate-500 dark:text-nx-mist mt-0.5">
                  {paying.payer} — صورت‌حساب {paying.letter_number}
                </p>
              </div>
              <button onClick={() => setPaying(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-nx-mist dark:hover:bg-nx-navy">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">مبلغ (ریال)</label>
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
                <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">شماره مرجع</label>
                <input
                  value={payForm.tracking}
                  onChange={(e) => setPayForm({ ...payForm, tracking: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">توضیحات (اختیاری)</label>
                <input
                  value={payForm.description}
                  onChange={(e) => setPayForm({ ...payForm, description: e.target.value })}
                  className={INPUT}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPaying(null)} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-nx-navy-border text-slate-600 dark:text-nx-mist hover:bg-slate-100 dark:hover:bg-nx-navy text-sm">
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

      {selectedInvoice && (
        <InvoiceDetailModal
          invoiceIdOrCode={selectedInvoice.id}
          initialData={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  )
}
