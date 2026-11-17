import { useState, useEffect } from 'react'
import { getPayments, createPayment, deletePayment, getSuppliers, getBankAccounts } from '../../api/finance'
import { useToast } from '../../components/Toast'
import { Plus, CreditCard, Trash2 } from 'lucide-react'

interface PaymentItem {
  id: number
  number: number
  date_jalali: string
  supplier_name: string
  bank_account_name: string
  amount: number
  payment_method: string
  reference: string
  description: string
  status: string
}

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'نقدی',
  bank_transfer: 'انتقال بانکی',
  cheque: 'چک',
  pos: 'کارت خوان',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'تأیید شده',
  cancelled: 'لغو شده',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-nx-warning-500/10 text-nx-warning-400 border-nx-warning-500/20',
  confirmed: 'bg-nx-teal/10 text-nx-teal border-nx-teal/20',
  cancelled: 'bg-nx-danger-500/10 text-nx-danger-400 border-nx-danger-500/20',
}

const formatIRR = (n: number) => new Intl.NumberFormat('fa-IR').format(n) + ' ریال'

interface Party { id: number; name: string }
interface Bank { id: number; name: string }

export default function PaymentsPage() {
  const { toast } = useToast()
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [form, setForm] = useState({
    date_jalali: '',
    supplier: '',
    bank_account: '',
    amount: '',
    payment_method: 'cash',
    reference: '',
    description: '',
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    try {
      const [pRes, sRes, bRes] = await Promise.all([getPayments(), getSuppliers(), getBankAccounts()])
      setPayments(pRes.data)
      setSuppliers(sRes.data)
      setBanks(bRes.data)
    } catch {
      toast('خطا در دریافت اطلاعات', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!form.supplier || !form.bank_account || !form.amount) {
      toast('لطفاً فیلدهای ضروری را پر کنید', 'error')
      return
    }
    try {
      await createPayment({
        ...form,
        amount: Number(form.amount),
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
      })
      toast('پرداخت ایجاد شد', 'success')
      setShowCreate(false)
      setForm({ date_jalali: '', supplier: '', bank_account: '', amount: '', payment_method: 'cash', reference: '', description: '' })
      fetchAll()
    } catch {
      toast('خطا در ایجاد پرداخت', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف مطمئن هستید؟')) return
    try {
      await deletePayment(id)
      toast('پرداخت حذف شد', 'success')
      fetchAll()
    } catch {
      toast('خطا در حذف', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-nx-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">پرداخت‌ها</h1>
          <p className="text-nx-mist mt-1">{payments.length} پرداخت</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-nx-teal hover:bg-nx-teal text-white rounded-xl font-medium transition"
        >
          <Plus className="w-4 h-4" />
          پرداخت جدید
        </button>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-16 text-nx-mist">
          <CreditCard className="w-16 h-16 mx-auto mb-4 text-nx-mist" />
          <p className="text-lg">هنوز پرداختی ثبت نشده</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(p => (
            <div key={p.id} className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl p-5 hover:border-nx-navy-border transition-all flex items-center gap-4">
              <div className="w-10 h-10 bg-nx-blue rounded-xl flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold">پرداخت شماره {p.number}</span>
                  <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[p.status] || ''}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </div>
                <div className="text-sm text-nx-mist mt-1">
                  {p.date_jalali} — {p.supplier_name} — {p.bank_account_name}
                  {p.reference && <span className="mr-2">({p.reference})</span>}
                </div>
              </div>
              <div className="text-left">
                <p className="text-nx-danger-400 font-bold text-lg">{formatIRR(p.amount)}</p>
                <p className="text-xs text-nx-mist">{PAYMENT_METHODS[p.payment_method]}</p>
              </div>
              <button onClick={() => handleDelete(p.id)} className="p-2 text-nx-mist hover:text-nx-danger-400 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-nx-navy border border-nx-navy-border rounded-2xl w-full max-w-lg p-6" dir="rtl">
            <h2 className="text-xl font-bold text-white mb-6">پرداخت جدید</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-nx-mist mb-1">تاریخ</label>
                  <input type="text" value={form.date_jalali} onChange={e => setForm(f => ({ ...f, date_jalali: e.target.value }))} placeholder="۱۴۰۴/۰۴/۲۵"
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
                </div>
                <div>
                  <label className="block text-sm text-nx-mist mb-1">مبلغ (ریال)</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-nx-mist mb-1">تأمین‌کننده</label>
                <select value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                  className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal">
                  <option value="">انتخاب تأمین‌کننده...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-nx-mist mb-1">حساب بانکی</label>
                <select value={form.bank_account} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))}
                  className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal">
                  <option value="">انتخاب حساب...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-nx-mist mb-1">روش پرداخت</label>
                <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                  className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal">
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-nx-mist mb-1">مرجع</label>
                  <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
                </div>
                <div>
                  <label className="block text-sm text-nx-mist mb-1">توضیحات</label>
                  <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleCreate} className="flex-1 px-4 py-2.5 bg-nx-teal hover:bg-nx-teal text-white rounded-xl font-medium transition">
                  ایجاد پرداخت
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 bg-nx-navy hover:bg-nx-navy text-nx-mist rounded-xl transition">
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
