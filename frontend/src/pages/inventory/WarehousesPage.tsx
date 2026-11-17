import { useEffect, useState } from 'react'
import { Plus, Edit2 } from 'lucide-react'
import client from '../../api/client'

interface WarehouseItem {
  id: number
  code: string
  name: string
  warehouse_type: string
  branch_name: string
  address: string
  is_active: boolean
}

const TYPE_LABELS: Record<string, string> = {
  main: 'انبار اصلی',
  branch: 'انبار شعبه',
  production: 'انبار تولید',
  returned: 'انبار برگشتی',
  damaged: 'انبار ضایعاتی',
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', warehouse_type: 'main', address: '' })

  useEffect(() => {
    client.get('/inventory/warehouses/').then((res) => {
      setWarehouses(res.data.data)
    }).finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    const res = await client.post('/inventory/warehouses/', form)
    setWarehouses([res.data.data, ...warehouses])
    setShowForm(false)
    setForm({ code: '', name: '', warehouse_type: 'main', address: '' })
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">انبارها</h1>
          <p className="text-nx-mist text-sm mt-1">مدیریت انبارهای سازمان</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-nx-blue hover:bg-nx-blue text-white rounded-lg transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          انبار جدید
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-nx-navy border border-nx-navy-border rounded-xl p-4 space-y-4">
          <h3 className="text-white font-bold">ایجاد انبار جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              placeholder="کد انبار"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-nx-blue"
            />
            <input
              placeholder="نام انبار"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-nx-blue"
            />
            <select
              value={form.warehouse_type}
              onChange={(e) => setForm({ ...form, warehouse_type: e.target.value })}
              className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-nx-blue"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              placeholder="آدرس"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="bg-nx-navy border border-nx-navy-border rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-nx-blue"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-nx-teal hover:bg-nx-teal text-white rounded-lg text-sm">
              ذخیره
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-nx-navy hover:bg-nx-muted text-white rounded-lg text-sm">
              انصراف
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-nx-navy border border-nx-navy-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nx-navy-border text-nx-mist">
                <th className="text-right px-4 py-3 font-medium">کد</th>
                <th className="text-right px-4 py-3 font-medium">نام</th>
                <th className="text-right px-4 py-3 font-medium">نوع</th>
                <th className="text-right px-4 py-3 font-medium">آدرس</th>
                <th className="text-right px-4 py-3 font-medium">وضعیت</th>
                <th className="text-center px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-nx-mist">در حال بارگذاری...</td></tr>
              ) : warehouses.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-nx-mist">انباری یافت نشد</td></tr>
              ) : (
                warehouses.map((wh) => (
                  <tr key={wh.id} className="border-b border-nx-navy/50 hover:bg-nx-navy-elevated transition">
                    <td className="px-4 py-3 text-white font-mono">{wh.code}</td>
                    <td className="px-4 py-3 text-white font-medium">{wh.name}</td>
                    <td className="px-4 py-3 text-nx-mist">{TYPE_LABELS[wh.warehouse_type] || wh.warehouse_type}</td>
                    <td className="px-4 py-3 text-nx-mist text-xs">{wh.address || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${wh.is_active ? 'bg-nx-teal/10 text-nx-teal' : 'bg-nx-danger-500/10 text-nx-danger-400'}`}>
                        {wh.is_active ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className="p-1.5 text-nx-mist hover:text-white hover:bg-nx-navy rounded-lg transition">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
