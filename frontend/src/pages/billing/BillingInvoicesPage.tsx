import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import JalaliDateInput from '../../components/JalaliDateInput'
import { CARD, INPUT, rial, type Invoice } from './shared'
import { FileText, Filter, Trash2 } from 'lucide-react'

export default function BillingInvoicesPage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const canDelete = Boolean(user?.permissions?.can_delete_history)

  const [rows, setRows] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [payer, setPayer] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/billing/invoices/', {
        params: { payer: payer || undefined, start_date: start || undefined, end_date: end || undefined },
      })
      setRows(res.data)
    } catch {
      toast('خطا در دریافت صورت‌حساب‌ها', 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payer, start, end])

  useEffect(() => {
    void load()
  }, [load])

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows])

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
                  {canDelete && (
                    <button onClick={() => void remove(row)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10" title="حذف">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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
    </div>
  )
}
