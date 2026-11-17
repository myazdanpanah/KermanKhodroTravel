import { useState, useEffect } from 'react'
import { getInvoices, createInvoice, confirmInvoice, deleteInvoice, getCustomers, getSuppliers } from '../../api/finance'
import { useToast } from '../../components/Toast'
import { Plus, FileText, Check, Trash2, Filter } from 'lucide-react'

interface InvoiceItem {
  id: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  total: number
}

interface Invoice {
  id: number
  number: number
  type: string
  date_jalali: string
  customer_name: string | null
  supplier_name: string | null
  subtotal: number
  discount: number
  tax_rate: number
  tax_amount: number
  total: number
  description: string
  status: string
  items: InvoiceItem[]
  created_at: string
}

interface Party {
  id: number
  name: string
}

const TYPE_LABELS: Record<string, string> = {
  sales: 'فروش',
  purchase: 'خرید',
  sales_return: 'برگشت از فروش',
  purchase_return: 'برگشت از خرید',
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

export default function InvoicesPage() {
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [customers, setCustomers] = useState<Party[]>([])
  const [suppliers, setSuppliers] = useState<Party[]>([])

  // Create form
  const [form, setForm] = useState({
    type: 'sales',
    date_jalali: '',
    customer: '',
    supplier: '',
    description: '',
    items: [{ description: '', quantity: 1, unit: 'عدد', unit_price: 0 }] as Array<{
      description: string
      quantity: number
      unit: string
      unit_price: number
    }>,
  })

  useEffect(() => { fetchInvoices(); fetchParties() }, [typeFilter])

  const fetchInvoices = async () => {
    try {
      const params: Record<string, string> = {}
      if (typeFilter) params.type = typeFilter
      const res = await getInvoices(params)
      setInvoices(res.data)
    } catch {
      toast('خطا در دریافت فاکتورها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchParties = async () => {
    try {
      const [cRes, sRes] = await Promise.all([getCustomers(), getSuppliers()])
      setCustomers(cRes.data)
      setSuppliers(sRes.data)
    } catch { /* silent */ }
  }

  const handleConfirm = async (id: number) => {
    try {
      await confirmInvoice(id)
      toast('فاکتور تأیید شد', 'success')
      fetchInvoices()
    } catch {
      toast('خطا در تأیید فاکتور', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف این فاکتور مطمئن هستید؟')) return
    try {
      await deleteInvoice(id)
      toast('فاکتور حذف شد', 'success')
      fetchInvoices()
    } catch {
      toast('خطا در حذف فاکتور', 'error')
    }
  }

  const handleCreate = async () => {
    try {
      const today = new Date().toLocaleDateString('fa-IR').replace(/\//g, '/')
      const payload: Record<string, unknown> = {
        type: form.type,
        date_jalali: form.date_jalali || today,
        date: new Date().toISOString().split('T')[0],
        description: form.description,
        items: form.items.map(item => ({
          ...item,
          total: item.quantity * item.unit_price,
        })),
        subtotal: form.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
        total: form.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
      }
      if (form.type.includes('sales') && form.customer) payload.customer = Number(form.customer)
      if (form.type.includes('purchase') && form.supplier) payload.supplier = Number(form.supplier)
      await createInvoice(payload)
      toast('فاکتور ایجاد شد', 'success')
      setShowCreate(false)
      fetchInvoices()
    } catch {
      toast('خطا در ایجاد فاکتور', 'error')
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
          <h1 className="text-2xl font-bold text-white">فاکتورها</h1>
          <p className="text-nx-mist mt-1">{invoices.length} فاکتور</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-nx-teal hover:bg-nx-teal text-white rounded-xl font-medium transition"
        >
          <Plus className="w-4 h-4" />
          فاکتور جدید
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-nx-mist" />
        {['', 'sales', 'purchase', 'sales_return', 'purchase_return'].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              typeFilter === t
                ? 'bg-nx-teal/10 text-nx-teal border border-nx-teal/20'
                : 'bg-nx-navy-elevated text-nx-mist hover:text-white border border-transparent'
            }`}
          >
            {t ? TYPE_LABELS[t] : 'همه'}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {invoices.length === 0 ? (
        <div className="text-center py-16 text-nx-mist">
          <FileText className="w-16 h-16 mx-auto mb-4 text-nx-mist" />
          <p className="text-lg">هنوز فاکتوری ثبت نشده</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {invoices.map(inv => (
            <div key={inv.id} className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl p-5 hover:border-nx-navy-border transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs text-nx-mist">شماره {inv.number}</span>
                  <h3 className="text-lg font-bold text-white">
                    {TYPE_LABELS[inv.type] || inv.type}
                  </h3>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${STATUS_COLORS[inv.status] || ''}`}>
                  {STATUS_LABELS[inv.status] || inv.status}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-nx-mist">تاریخ</span>
                  <span className="text-white">{inv.date_jalali}</span>
                </div>
                {inv.customer_name && (
                  <div className="flex justify-between">
                    <span className="text-nx-mist">مشتری</span>
                    <span className="text-white">{inv.customer_name}</span>
                  </div>
                )}
                {inv.supplier_name && (
                  <div className="flex justify-between">
                    <span className="text-nx-mist">تأمین‌کننده</span>
                    <span className="text-white">{inv.supplier_name}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-nx-navy-border">
                  <span className="text-nx-mist">جمع کل</span>
                  <span className="text-nx-teal font-bold">{formatIRR(inv.total)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-nx-navy-border">
                {inv.status === 'draft' && (
                  <button
                    onClick={() => handleConfirm(inv.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-nx-teal/10 text-nx-teal rounded-lg text-xs font-medium hover:bg-nx-teal/20 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    تأیید
                  </button>
                )}
                <button
                  onClick={() => handleDelete(inv.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-nx-danger-500/10 text-nx-danger-400 rounded-lg text-xs font-medium hover:bg-nx-danger-500/20 transition mr-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-nx-navy border border-nx-navy-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" dir="rtl">
            <h2 className="text-xl font-bold text-white mb-6">فاکتور جدید</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-nx-mist mb-1">نوع فاکتور</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal"
                  >
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-nx-mist mb-1">تاریخ</label>
                  <input
                    type="text"
                    value={form.date_jalali}
                    onChange={e => setForm(f => ({ ...f, date_jalali: e.target.value }))}
                    placeholder="۱۴۰۴/۰۴/۲۵"
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal"
                  />
                </div>
              </div>
              {form.type.includes('sales') && (
                <div>
                  <label className="block text-sm text-nx-mist mb-1">مشتری</label>
                  <select
                    value={form.customer}
                    onChange={e => setForm(f => ({ ...f, customer: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal"
                  >
                    <option value="">انتخاب مشتری...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.type.includes('purchase') && (
                <div>
                  <label className="block text-sm text-nx-mist mb-1">تأمین‌کننده</label>
                  <select
                    value={form.supplier}
                    onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal"
                  >
                    <option value="">انتخاب تأمین‌کننده...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-nx-mist mb-1">توضیحات</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal"
                />
              </div>

              {/* Line Items */}
              <div>
                <label className="block text-sm text-nx-mist mb-2">ردیف‌ها</label>
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                    <input
                      placeholder="شرح"
                      value={item.description}
                      onChange={e => {
                        const items = [...form.items]
                        items[idx].description = e.target.value
                        setForm(f => ({ ...f, items }))
                      }}
                      className="col-span-5 bg-nx-navy border border-nx-navy-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-nx-teal"
                    />
                    <input
                      type="number"
                      placeholder="تعداد"
                      value={item.quantity}
                      onChange={e => {
                        const items = [...form.items]
                        items[idx].quantity = Number(e.target.value)
                        setForm(f => ({ ...f, items }))
                      }}
                      className="col-span-2 bg-nx-navy border border-nx-navy-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-nx-teal"
                    />
                    <input
                      type="number"
                      placeholder="قیمت واحد"
                      value={item.unit_price}
                      onChange={e => {
                        const items = [...form.items]
                        items[idx].unit_price = Number(e.target.value)
                        setForm(f => ({ ...f, items }))
                      }}
                      className="col-span-4 bg-nx-navy border border-nx-navy-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-nx-teal"
                    />
                    <button
                      onClick={() => {
                        setForm(f => ({
                          ...f,
                          items: f.items.filter((_, i) => i !== idx),
                        }))
                      }}
                      className="col-span-1 text-nx-danger-400 hover:text-nx-danger-300 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setForm(f => ({
                      ...f,
                      items: [...f.items, { description: '', quantity: 1, unit: 'عدد', unit_price: 0 }],
                    }))
                  }
                  className="text-sm text-nx-teal hover:text-nx-teal"
                >
                  + افزودن ردیف
                </button>
              </div>

              {/* Total */}
              <div className="bg-nx-navy-elevated rounded-xl p-4">
                <div className="flex justify-between">
                  <span className="text-nx-mist">جمع کل</span>
                  <span className="text-white font-bold">
                    {formatIRR(form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0))}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2.5 bg-nx-teal hover:bg-nx-teal text-white rounded-xl font-medium transition"
                >
                  ایجاد فاکتور
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 bg-nx-navy hover:bg-nx-navy text-nx-mist rounded-xl transition"
                >
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
