import { useState, useEffect } from 'react'
import { getSuppliers, createSupplier, deleteSupplier } from '../../api/finance'
import { useToast } from '../../components/Toast'
import { Plus, Truck, Trash2, Search } from 'lucide-react'

interface SupplierItem {
  id: number
  name: string
  national_id: string
  phone: string
  mobile: string
  balance: number
  is_active: boolean
}

const formatIRR = (n: number) => new Intl.NumberFormat('fa-IR').format(n) + ' ریال'

export default function SuppliersPage() {
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '', national_id: '', phone: '', mobile: '', email: '', address: '',
  })

  useEffect(() => { fetchSuppliers() }, [])

  const fetchSuppliers = async () => {
    try {
      const res = await getSuppliers(search || undefined)
      setSuppliers(res.data)
    } catch {
      toast('خطا در دریافت تأمین‌کنندگان', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!form.name) { toast('نام تأمین‌کننده الزامی است', 'error'); return }
    try {
      await createSupplier(form)
      toast('تأمین‌کننده ایجاد شد', 'success')
      setShowCreate(false)
      setForm({ name: '', national_id: '', phone: '', mobile: '', email: '', address: '' })
      fetchSuppliers()
    } catch {
      toast('خطا در ایجاد تأمین‌کننده', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف مطمئن هستید؟')) return
    try {
      await deleteSupplier(id)
      toast('تأمین‌کننده حذف شد', 'success')
      fetchSuppliers()
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
          <h1 className="text-2xl font-bold text-white">تأمین‌کنندگان</h1>
          <p className="text-nx-mist mt-1">{suppliers.length} تأمین‌کننده</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-nx-teal hover:bg-nx-teal text-white rounded-xl font-medium transition">
          <Plus className="w-4 h-4" />
          تأمین‌کننده جدید
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-mist" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchSuppliers()}
            placeholder="جستجو بر اساس نام یا کد ملی..."
            className="w-full bg-nx-navy border border-nx-navy-border rounded-xl pr-10 pl-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
        </div>
        <button onClick={fetchSuppliers} className="px-4 py-2.5 bg-nx-navy hover:bg-nx-navy text-nx-mist rounded-xl text-sm transition">
          جستجو
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="text-center py-16 text-nx-mist">
          <Truck className="w-16 h-16 mx-auto mb-4 text-nx-mist" />
          <p className="text-lg">هنوز تأمین‌کننده‌ای ثبت نشده</p>
        </div>
      ) : (
        <div className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-navy-border">
                  <th className="px-5 py-3 text-right text-nx-mist font-medium">نام</th>
                  <th className="px-5 py-3 text-right text-nx-mist font-medium">کد ملی</th>
                  <th className="px-5 py-3 text-right text-nx-mist font-medium">تلفن</th>
                  <th className="px-5 py-3 text-right text-nx-mist font-medium">مانده حساب</th>
                  <th className="px-5 py-3 text-center text-nx-mist font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-b border-nx-navy/50 hover:bg-nx-navy-elevated transition">
                    <td className="px-5 py-3 text-white font-medium">{s.name}</td>
                    <td className="px-5 py-3 text-nx-mist font-mono">{s.national_id || '—'}</td>
                    <td className="px-5 py-3 text-nx-mist">{s.phone || s.mobile || '—'}</td>
                    <td className="px-5 py-3 text-nx-warning-400 font-bold">{formatIRR(s.balance)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-nx-mist hover:text-nx-danger-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-nx-navy border border-nx-navy-border rounded-2xl w-full max-w-lg p-6" dir="rtl">
            <h2 className="text-xl font-bold text-white mb-6">تأمین‌کننده جدید</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-nx-mist mb-1">نام *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-nx-mist mb-1">کد ملی / اقتصادی</label>
                  <input type="text" value={form.national_id} onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
                </div>
                <div>
                  <label className="block text-sm text-nx-mist mb-1">تلفن</label>
                  <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-nx-mist mb-1">موبایل</label>
                  <input type="text" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
                </div>
                <div>
                  <label className="block text-sm text-nx-mist mb-1">ایمیل</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-nx-mist mb-1">آدرس</label>
                <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-teal" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleCreate} className="flex-1 px-4 py-2.5 bg-nx-teal hover:bg-nx-teal text-white rounded-xl font-medium transition">
                  ایجاد تأمین‌کننده
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
