import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import JalaliDateInput from '../../components/JalaliDateInput'
import { CARD, INPUT, rial, type Payer, type Payment } from './shared'
import { CreditCard, Plus, X, Trash2 } from 'lucide-react'

// One token per opened form: retries and double clicks reuse it, so the server
// can tell a replay from a second payment.
const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`

const emptyForm = {
  payer_code: '',
  amount: '',
  payment_date: '',
  tracking_number: '',
  description: '',
}

export default function BillingPaymentsPage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const privileged = user?.role === 'ceo' || user?.role === 'admin'
  const canPay = privileged || Boolean(user?.permissions?.pay)
  const canDelete = privileged || Boolean(user?.permissions?.delete_payment)

  const [rows, setRows] = useState<Payment[]>([])
  const [payers, setPayers] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()

  // Quick-add from the mobile bar lands here with ?new=1: open the form once.
  useEffect(() => {
    if (params.get('new') !== '1') return
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
    setIdempotencyKey(newIdempotencyKey())
    setOpen(true)
  }, [params, setParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [payments, payersRes] = await Promise.all([
        api.get('/billing/payments/'),
        api.get('/billing/payers/'),
      ])
      setRows(payments.data)
      setPayers(payersRes.data)
    } catch {
      toast('خطا در دریافت پرداخت‌ها', 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows])

  const toggleForm = () => {
    if (open) {
      setOpen(false)
      return
    }
    setIdempotencyKey(newIdempotencyKey())
    setOpen(true)
  }

  const submit = async () => {
    if (!form.payer_code || !form.amount) {
      toast('شرکت و مبلغ الزامی است', 'error')
      return
    }
    setSaving(true)
    try {
      await api.post(
        '/billing/payments/',
        {
          payer_code: form.payer_code,
          amount: Number(form.amount),
          payment_date: form.payment_date || undefined,
          tracking_number: form.tracking_number,
          description: form.description,
        },
        idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined
      )
      toast('پرداخت ثبت شد', 'success')
      setForm(emptyForm)
      setOpen(false)
      setIdempotencyKey(null)
      void load()
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در ثبت پرداخت', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (payment: Payment) => {
    if (!confirm('این پرداخت حذف شود؟')) return
    try {
      await api.delete(`/billing/payments/${payment.id}/`)
      toast('پرداخت حذف شد', 'success')
      void load()
    } catch {
      toast('خطا در حذف پرداخت', 'error')
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-nx-blue" />
          <div>
            <h1 className="text-lg font-bold text-white">پرداخت‌ها</h1>
            <p className="text-xs text-nx-mist">پرداخت‌های دریافتی از شرکت‌های طرف حساب</p>
          </div>
        </div>
        {canPay && (
          <button onClick={toggleForm} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nx-blue text-white text-sm hover:brightness-110 transition">
            {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {open ? 'بستن' : 'ثبت پرداخت'}
          </button>
        )}
      </div>

      {open && (
        <div className={`${CARD} p-5 grid grid-cols-1 md:grid-cols-3 gap-4`}>
          <div>
            <label className="block text-xs text-nx-mist mb-1.5">شرکت</label>
            <select value={form.payer_code} onChange={(e) => setForm({ ...form, payer_code: e.target.value })} className={INPUT}>
              <option value="">انتخاب شرکت…</option>
              {payers.map((p) => (
                <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-nx-mist mb-1.5">مبلغ (ریال)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={INPUT}
              placeholder="۰"
            />
          </div>
          <JalaliDateInput label="تاریخ پرداخت" value={form.payment_date} onChange={(iso) => setForm({ ...form, payment_date: iso })} />
          <div>
            <label className="block text-xs text-nx-mist mb-1.5">شماره پیگیری</label>
            <input value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} className={INPUT} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-nx-mist mb-1.5">توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={INPUT} />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button onClick={() => void submit()} disabled={saving} className="px-6 py-2.5 rounded-xl bg-nx-blue text-white text-sm disabled:opacity-60">
              {saving ? 'در حال ذخیره…' : 'ذخیرهٔ پرداخت'}
            </button>
          </div>
        </div>
      )}

      <div className={`${CARD} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-nx-navy text-nx-mist text-xs">
            <tr>
              <th className="text-right font-medium px-4 py-3">تاریخ</th>
              <th className="text-right font-medium px-4 py-3">شرکت</th>
              <th className="text-right font-medium px-4 py-3">شماره پیگیری</th>
              <th className="text-right font-medium px-4 py-3">توضیحات</th>
              <th className="text-right font-medium px-4 py-3">ثبت‌کننده</th>
              <th className="text-left font-medium px-4 py-3">مبلغ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-8 text-center text-xs text-nx-mist">در حال بارگذاری…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-xs text-nx-mist">پرداختی ثبت نشده است.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-nx-navy-border hover:bg-nx-navy/40">
                <td className="px-4 py-3 text-nx-mist">{row.payment_date}</td>
                <td className="px-4 py-3 text-white">{row.payer_name}</td>
                <td className="px-4 py-3 text-nx-mist">{row.tracking_number || '—'}</td>
                <td className="px-4 py-3 text-nx-mist">{row.description || '—'}</td>
                <td className="px-4 py-3 text-nx-mist">{row.created_by_name || '—'}</td>
                <td className="px-4 py-3 text-left text-white">{rial(row.amount)}</td>
                <td className="px-4 py-3">
                  {canDelete && (
                    <button onClick={() => void remove(row)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-nx-navy">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-xs text-nx-mist">جمع ({rows.length} پرداخت)</td>
              <td className="px-4 py-3 text-left font-bold text-white">{rial(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
