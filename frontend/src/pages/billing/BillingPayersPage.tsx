import { useCallback, useEffect, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import { CARD, INPUT, rial, toPersianDigits, type Payer } from './shared'
import { Users, Plus, X, Pencil, Trash2, Power, AlertTriangle } from 'lucide-react'

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
  const canManage =
    user?.role === 'ceo' ||
    user?.role === 'admin' ||
    user?.role === 'finance' ||
    Boolean(user?.permissions?.manage_companies)

  const [rows, setRows] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [deletingPayer, setDeletingPayer] = useState<Payer | null>(null)

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

  const toggleActive = async (payer: Payer) => {
    const isCurrentlyActive = payer.is_active !== false
    const balance = payer.balance?.balance || 0
    if (isCurrentlyActive && balance !== 0) {
      toast(
        `امکان غیرفعال‌سازی مشتری با مانده حساب غیرصفر وجود ندارد. مانده فعلی: ${balance.toLocaleString('fa-IR')} ریال`,
        'error'
      )
      return
    }

    try {
      await api.patch(`/billing/payers/${payer.code}/`, { is_active: !isCurrentlyActive })
      toast(isCurrentlyActive ? 'مشتری غیرفعال شد' : 'مشتری با موفقیت فعال شد', 'success')
      void load()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data
      const first = data && Object.values(data)[0]
      toast((Array.isArray(first) ? first[0] : first) || 'خطا در تغییر وضعیت مشتری', 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deletingPayer) return
    const balance = deletingPayer.balance?.balance || 0
    if (balance !== 0) {
      toast(
        `امکان حذف مشتری با مانده حساب غیرصفر وجود ندارد. مانده فعلی: ${balance.toLocaleString('fa-IR')} ریال`,
        'error'
      )
      setDeletingPayer(null)
      return
    }

    try {
      await api.delete(`/billing/payers/${deletingPayer.code}/`)
      toast('مشتری با موفقیت حذف شد', 'success')
      setDeletingPayer(null)
      void load()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data
      const first = data && Object.values(data)[0]
      toast((Array.isArray(first) ? first[0] : first) || 'خطا در حذف مشتری', 'error')
    }
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
            <h1 className="text-lg font-bold text-nx-navy dark:text-white">مشتریان</h1>
            <p className="text-xs text-slate-500 dark:text-nx-mist">شرکت‌های طرف حساب و زیرمجموعه‌ها با مانده حساب</p>
          </div>
        </div>
        {canManage && (
          <button onClick={startCreate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nx-blue text-white text-sm hover:brightness-110 transition shadow-sm">
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
            <h2 className="text-sm font-semibold text-nx-navy dark:text-white">{editing ? `ویرایش ${editing}` : 'مشتری جدید'}</h2>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-nx-mist dark:hover:bg-nx-navy"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">کد شرکت</label>
              <input value={form.code} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, code: e.target.value })} className={INPUT} placeholder="۱ تا ۵ رقم" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">نام شرکت</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">شرکت مادر</label>
              <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} className={INPUT}>
                <option value="">— بدون شرکت مادر —</option>
                {rows.filter((r) => r.code !== form.code).map((r) => (
                  <option key={r.code} value={r.code}>{r.code} — {r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">نوع مشتری</label>
              <select value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value as 'legal' | 'individual' })} className={INPUT}>
                <option value="legal">حقوقی</option>
                <option value="individual">حقیقی</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">شناسه ملی</label>
              <input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">کد اقتصادی</label>
              <input value={form.economic_code} onChange={(e) => setForm({ ...form, economic_code: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">شماره ثبت</label>
              <input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">تلفن</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">موبایل</label>
              <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">ایمیل</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT} dir="ltr" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">آدرس</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-nx-mist mb-1.5">کد پستی</label>
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

      {/* Delete confirmation modal */}
      {deletingPayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`${CARD} max-w-md w-full p-6 shadow-xl`}>
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-nx-navy dark:text-white">تأیید حذف مشتری</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-nx-mist mb-4 leading-6">
              آیا از حذف مشتری <strong className="text-slate-900 dark:text-white">«{deletingPayer.name}»</strong> با کد <span className="font-medium text-slate-800 dark:text-slate-200">{toPersianDigits(deletingPayer.code)}</span> اطمینان دارید؟
              {deletingPayer.balance && deletingPayer.balance.balance === 0 ? (
                <span className="block mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ مانده حساب این مشتری صفر (تسویه کامل) است.</span>
              ) : null}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingPayer(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-nx-navy-border text-sm text-slate-700 dark:text-nx-mist hover:bg-slate-100 dark:hover:bg-nx-navy"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm hover:bg-rose-700 font-medium"
              >
                حذف قطعی
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-100 dark:bg-nx-navy text-slate-600 dark:text-nx-mist text-xs">
            <tr>
              <th className="text-right font-medium px-4 py-3">کد</th>
              <th className="text-right font-medium px-4 py-3">نام</th>
              <th className="text-right font-medium px-4 py-3">شرکت مادر</th>
              <th className="text-center font-medium px-4 py-3">وضعیت</th>
              <th className="text-right font-medium px-4 py-3">تلفن</th>
              <th className="text-left font-medium px-4 py-3">مانده</th>
              <th className="px-4 py-3 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-nx-mist">در حال بارگذاری…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-nx-mist">شرکتی یافت نشد.</td></tr>}
            {rows.map((row) => {
              const isActive = row.is_active !== false
              return (
                <tr key={row.code} className="border-t border-slate-200 dark:border-nx-navy-border hover:bg-slate-50/70 dark:hover:bg-nx-navy/40">
                  <td className="px-4 py-3 text-slate-600 dark:text-nx-mist">{toPersianDigits(row.code)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {row.name}
                    {row.children_count > 0 && <span className="text-[10px] text-slate-500 dark:text-nx-mist/70"> • {row.children_count} زیرمجموعه</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-nx-mist">{row.parent_name || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                    }`}>
                      {isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-nx-mist" dir="ltr">{row.phone || row.mobile || '—'}</td>
                  <td className={`px-4 py-3 text-left font-medium ${(row.balance?.balance || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {rial(row.balance?.balance || 0)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {canManage && (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          title="ویرایش مشتری"
                          className="p-1.5 rounded-lg text-nx-blue hover:bg-nx-blue/10 transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(row)}
                          title={isActive ? 'غیرفعال‌سازی مشتری' : 'فعال‌سازی مشتری'}
                          className={`p-1.5 rounded-lg transition ${
                            isActive
                              ? 'text-amber-500 hover:bg-amber-500/10'
                              : 'text-emerald-600 hover:bg-emerald-500/10'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPayer(row)}
                          title="حذف مشتری (مشروط به مانده صفر)"
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
