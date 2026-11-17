import { useCallback, useEffect, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import { CARD, INPUT, rial, type Payer } from './shared'
import { Users, Plus, X, Pencil } from 'lucide-react'

const empty = {
  code: '',
  name: '',
  parent: '',
  national_id: '',
  economic_code: '',
  registration_number: '',
  address: '',
  postal_code: '',
  phone: '',
  mobile: '',
  email: '',
  customer_type: 'legal' as 'legal' | 'individual',
}

export default function BillingPayersPage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const canManage = user?.role === 'ceo' || user?.role === 'admin' || Boolean(user?.permissions?.manage_companies)

  const [rows, setRows] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/billing/payers/', { params: { search: search || undefined } })
      setRows(res.data)
    } catch {
      toast('خطا در دریافت شرکت‌ها', 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    void load()
  }, [load])

  const startCreate = () => {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  const startEdit = (payer: Payer) => {
    setEditing(payer.code)
    setForm({
      code: payer.code,
      name: payer.name,
      parent: payer.parent || '',
      national_id: payer.national_id || '',
      economic_code: payer.economic_code || '',
      registration_number: payer.registration_number || '',
      address: payer.address || '',
      postal_code: payer.postal_code || '',
      phone: payer.phone || '',
      mobile: payer.mobile || '',
      email: payer.email || '',
      customer_type: payer.customer_type || 'legal',
    })
    setOpen(true)
  }

  const submit = async () => {
    if (!form.code || !form.name) {
      toast('کد و نام شرکت الزامی است', 'error')
      return
    }
    setSaving(true)
    const payload = { ...form, parent: form.parent || null }
    try {
      if (editing) {
        await api.put(`/billing/payers/${editing}/`, payload)
        toast('اطلاعات شرکت به‌روزرسانی شد', 'success')
      } else {
        await api.post('/billing/payers/', payload)
        toast('شرکت ثبت شد', 'success')
      }
      setOpen(false)
      void load()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data
      const first = data && Object.values(data)[0]
      toast((Array.isArray(first) ? first[0] : first) || 'خطا در ذخیرهٔ شرکت', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-nx-blue" />
          <div>
            <h1 className="text-lg font-bold text-white">مشتریان</h1>
            <p className="text-xs text-nx-mist">شرکت‌های طرف حساب و زیرمجموعه‌ها با مانده حساب</p>
          </div>
        </div>
        {canManage && (
          <button onClick={startCreate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nx-blue text-white text-sm hover:brightness-110 transition">
            <Plus className="w-4 h-4" />
            مشتری جدید
          </button>
        )}
      </div>

      <div className={`${CARD} p-4`}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو بر اساس نام یا کد شرکت…" className={INPUT} />
      </div>

      {open && (
        <div className={`${CARD} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">{editing ? `ویرایش ${editing}` : 'مشتری جدید'}</h2>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-nx-mist hover:bg-nx-navy"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">کد شرکت</label>
              <input value={form.code} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, code: e.target.value })} className={INPUT} placeholder="۱ تا ۵ رقم" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-nx-mist mb-1.5">نام شرکت</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">شرکت مادر</label>
              <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} className={INPUT}>
                <option value="">— بدون شرکت مادر —</option>
                {rows.filter((r) => r.code !== form.code).map((r) => (
                  <option key={r.code} value={r.code}>{r.code} — {r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">نوع مشتری</label>
              <select value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value as 'legal' | 'individual' })} className={INPUT}>
                <option value="legal">حقوقی</option>
                <option value="individual">حقیقی</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">شناسه ملی</label>
              <input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">کد اقتصادی</label>
              <input value={form.economic_code} onChange={(e) => setForm({ ...form, economic_code: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">شماره ثبت</label>
              <input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">تلفن</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">موبایل</label>
              <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">ایمیل</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT} dir="ltr" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-nx-mist mb-1.5">آدرس</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-nx-mist mb-1.5">کد پستی</label>
              <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className={INPUT} />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={() => void submit()} disabled={saving} className="px-6 py-2.5 rounded-xl bg-nx-blue text-white text-sm disabled:opacity-60">
              {saving ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </div>
        </div>
      )}

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-nx-navy text-nx-mist text-xs">
            <tr>
              <th className="text-right font-medium px-4 py-3">کد</th>
              <th className="text-right font-medium px-4 py-3">نام</th>
              <th className="text-right font-medium px-4 py-3">شرکت مادر</th>
              <th className="text-right font-medium px-4 py-3">تلفن</th>
              <th className="text-left font-medium px-4 py-3">مانده</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="py-8 text-center text-xs text-nx-mist">در حال بارگذاری…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-xs text-nx-mist">شرکتی یافت نشد.</td></tr>}
            {rows.map((row) => (
              <tr key={row.code} className="border-t border-nx-navy-border hover:bg-nx-navy/40">
                <td className="px-4 py-3 text-nx-mist">{row.code}</td>
                <td className="px-4 py-3 text-white">
                  {row.name}
                  {row.children_count > 0 && <span className="text-[10px] text-nx-mist/70"> • {row.children_count} زیرمجموعه</span>}
                </td>
                <td className="px-4 py-3 text-nx-mist">{row.parent_name || '—'}</td>
                <td className="px-4 py-3 text-nx-mist" dir="ltr">{row.phone || row.mobile || '—'}</td>
                <td className={`px-4 py-3 text-left font-medium ${(row.balance?.balance || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {rial(row.balance?.balance || 0)}
                </td>
                <td className="px-4 py-3">
                  {canManage && (
                    <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg text-nx-blue hover:bg-nx-blue/10">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
