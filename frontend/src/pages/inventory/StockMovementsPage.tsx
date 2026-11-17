import { useEffect, useState } from 'react'
import { ArrowUpDown, Plus, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'
import client from '../../api/client'

interface Movement {
  id: number
  movement_type: string
  product_name: string
  product_code: string
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
  warehouse: number
  description: string
  movement_date: string
}

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  receipt: { label: 'ورود', icon: ArrowDown, color: 'text-nx-teal' },
  issue: { label: 'خروج', icon: ArrowUp, color: 'text-nx-danger-400' },
  transfer: { label: 'انتقال', icon: RefreshCw, color: 'text-nx-blue' },
}

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    movement_type: 'receipt',
    warehouse: '',
    product_name: '',
    product_code: '',
    quantity: '',
    unit_cost: '',
    unit: 'عدد',
    description: '',
  })

  useEffect(() => {
    client.get('/inventory/movements/').then((res) => {
      setMovements(res.data.data)
    }).finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    const res = await client.post('/inventory/movements/', {
      ...form,
      warehouse: parseInt(form.warehouse),
      quantity: form.quantity,
      unit_cost: form.unit_cost,
    })
    setMovements([res.data.data, ...movements])
    setShowForm(false)
    setForm({ movement_type: 'receipt', warehouse: '', product_name: '', product_code: '', quantity: '', unit_cost: '', unit: 'عدد', description: '' })
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">حرکات انبار</h1>
          <p className="text-nx-mist text-sm mt-1">ورود، خروج و انتقال کالا</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-nx-blue hover:bg-nx-blue text-white rounded-lg transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          حرکت جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-nx-navy border border-nx-navy-border rounded-xl p-4 space-y-4">
          <h3 className="text-white font-bold">ثبت حرکت جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={form.movement_type}
              onChange={(e) => setForm({ ...form, movement_type: e.target.value })}
              className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-nx-blue"
            >
              <option value="receipt">ورود</option>
              <option value="issue">خروج</option>
              <option value="transfer">انتقال</option>
            </select>
            <input placeholder="کد انبار" value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm" />
            <input placeholder="نام محصول" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm" />
            <input placeholder="کد محصول" value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm" />
            <input placeholder="تعداد" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm" />
            <input placeholder="قیمت واحد" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-nx-teal hover:bg-nx-teal text-white rounded-lg text-sm">ذخیره</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-nx-navy hover:bg-nx-muted text-white rounded-lg text-sm">انصراف</button>
          </div>
        </div>
      )}

      <div className="bg-nx-navy border border-nx-navy-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nx-navy-border text-nx-mist">
                <th className="text-right px-4 py-3 font-medium">نوع</th>
                <th className="text-right px-4 py-3 font-medium">محصول</th>
                <th className="text-right px-4 py-3 font-medium">کد</th>
                <th className="text-left px-4 py-3 font-medium">تعداد</th>
                <th className="text-left px-4 py-3 font-medium">قیمت واحد</th>
                <th className="text-left px-4 py-3 font-medium">جمع کل</th>
                <th className="text-right px-4 py-3 font-medium">توضیحات</th>
                <th className="text-right px-4 py-3 font-medium">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-nx-mist">در حال بارگذاری...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-nx-mist">حرکتی ثبت نشده</td></tr>
              ) : (
                movements.map((m) => {
                  const typeInfo = TYPE_LABELS[m.movement_type] || { label: m.movement_type, icon: ArrowUpDown, color: 'text-nx-mist' }
                  return (
                    <tr key={m.id} className="border-b border-nx-navy/50 hover:bg-nx-navy-elevated transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <typeInfo.icon className={`w-4 h-4 ${typeInfo.color}`} />
                          <span className={typeInfo.color}>{typeInfo.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{m.product_name}</td>
                      <td className="px-4 py-3 text-nx-mist font-mono">{m.product_code}</td>
                      <td className={`px-4 py-3 text-left font-medium ${m.quantity >= 0 ? 'text-nx-teal' : 'text-nx-danger-400'}`}>
                        {m.quantity >= 0 ? '+' : ''}{m.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-left text-nx-mist">{m.unit_cost.toLocaleString()} ریال</td>
                      <td className="px-4 py-3 text-left text-white font-medium">{m.total_cost.toLocaleString()} ریال</td>
                      <td className="px-4 py-3 text-nx-mist text-xs">{m.description || '—'}</td>
                      <td className="px-4 py-3 text-nx-mist text-xs">{new Date(m.movement_date).toLocaleDateString('fa-IR')}</td>
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
