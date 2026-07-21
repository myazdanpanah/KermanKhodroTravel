import { useEffect, useState } from 'react'
import { Plus, CheckCircle, XCircle } from 'lucide-react'
import client from '../../api/client'

interface PurchaseOrder {
  id: number
  order_number: string
  item_name: string
  quantity: number
  unit_price: number
  total: number
  supplier_name: string
  status: string
  order_date: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'پیش‌نویس', color: 'text-gray-400 bg-gray-500/10' },
  submitted: { label: 'ارسال شده', color: 'text-blue-400 bg-blue-500/10' },
  approved: { label: 'تأیید شده', color: 'text-emerald-400 bg-emerald-500/10' },
  confirmed: { label: 'تأیید تأمین‌کننده', color: 'text-purple-400 bg-purple-500/10' },
  partially_received: { label: 'دریافت جزئی', color: 'text-amber-400 bg-amber-500/10' },
  received: { label: 'دریافت کامل', color: 'text-emerald-400 bg-emerald-500/10' },
  closed: { label: 'بسته شده', color: 'text-gray-400 bg-gray-500/10' },
  cancelled: { label: 'لغو شده', color: 'text-red-400 bg-red-500/10' },
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    order_number: '',
    item_name: '',
    quantity: '',
    unit_price: '',
    supplier_name: '',
    unit: 'عدد',
  })

  useEffect(() => {
    client.get('/purchasing/orders/').then((res) => {
      setOrders(res.data.data)
    }).finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    const res = await client.post('/purchasing/orders/', form)
    setOrders([res.data.data, ...orders])
    setShowForm(false)
    setForm({ order_number: '', item_name: '', quantity: '', unit_price: '', supplier_name: '', unit: 'عدد' })
  }

  const handleApprove = async (id: number) => {
    await client.post(`/purchasing/orders/${id}/approve/`)
    setOrders(orders.map(o => o.id === id ? { ...o, status: 'approved' } : o))
  }

  const handleClose = async (id: number) => {
    await client.post(`/purchasing/orders/${id}/close/`)
    setOrders(orders.map(o => o.id === id ? { ...o, status: 'closed' } : o))
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">سفارشات خرید</h1>
          <p className="text-gray-400 text-sm mt-1">ایجاد و مدیریت سفارشات خرید</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm font-medium">
          <Plus className="w-4 h-4" />
          سفارش جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <h3 className="text-white font-bold">ایجاد سفارش خرید</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="شماره سفارش" value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm" />
            <input placeholder="نام کالا" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm" />
            <input placeholder="تعداد" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm" />
            <input placeholder="قیمت واحد" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm" />
            <input placeholder="نام تأمین‌کننده" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">ذخیره</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">انصراف</button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-right px-4 py-3 font-medium">شماره</th>
                <th className="text-right px-4 py-3 font-medium">کالا</th>
                <th className="text-right px-4 py-3 font-medium">تأمین‌کننده</th>
                <th className="text-left px-4 py-3 font-medium">تعداد</th>
                <th className="text-left px-4 py-3 font-medium">قیمت واحد</th>
                <th className="text-left px-4 py-3 font-medium">جمع کل</th>
                <th className="text-right px-4 py-3 font-medium">وضعیت</th>
                <th className="text-center px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">در حال بارگذاری...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">سفارشی ثبت نشده</td></tr>
              ) : (
                orders.map((o) => {
                  const statusInfo = STATUS_LABELS[o.status] || { label: o.status, color: 'text-gray-400 bg-gray-500/10' }
                  return (
                    <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3 text-white font-mono">{o.order_number}</td>
                      <td className="px-4 py-3 text-white font-medium">{o.item_name}</td>
                      <td className="px-4 py-3 text-gray-400">{o.supplier_name || '—'}</td>
                      <td className="px-4 py-3 text-left text-white">{o.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-left text-gray-400">{o.unit_price.toLocaleString()} ریال</td>
                      <td className="px-4 py-3 text-left text-white font-medium">{o.total.toLocaleString()} ریال</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusInfo.color}`}>{statusInfo.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {o.status === 'submitted' && (
                            <button onClick={() => handleApprove(o.id)} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition" title="تأیید">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {o.status === 'approved' && (
                            <button onClick={() => handleClose(o.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition" title="بستن">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
