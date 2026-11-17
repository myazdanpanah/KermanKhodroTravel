import { useCallback, useEffect, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import { CARD, INPUT } from './shared'
import { Briefcase, Plus, Save, Trash2, X } from 'lucide-react'

interface ServiceCategory {
  id: number
  name: string
  code: string
  parent: number | null
  is_active: boolean
}

/**
 * Service types are data, not code: visa, tour, bus and whatever comes next are
 * defined here and immediately available in the issuance screen and the letter
 * service-type label.
 */
export default function BillingServicesPage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const canManage = user?.role === 'ceo' || user?.role === 'admin' || Boolean(user?.permissions?.settings)

  const [rows, setRows] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [parentId, setParentId] = useState('')
  const [editing, setEditing] = useState<ServiceCategory | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/billing/service-categories/', { params: { include_inactive: '1' } })
      setRows(res.data)
    } catch {
      toast('خطا در دریافت خدمات', 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reset = () => {
    setName('')
    setCode('')
    setParentId('')
    setEditing(null)
  }

  const save = async () => {
    if (!name.trim()) {
      toast('نام خدمت را وارد کنید', 'error')
      return
    }
    setBusy(true)
    const payload = {
      name: name.trim(),
      code: code.trim(),
      parent: parentId ? Number(parentId) : null,
    }
    try {
      if (editing) {
        await api.put(`/billing/service-categories/${editing.id}/`, payload)
        toast('خدمت به‌روزرسانی شد', 'success')
      } else {
        await api.post('/billing/service-categories/', payload)
        toast('خدمت جدید ثبت شد', 'success')
      }
      reset()
      void load()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const first = data && typeof data === 'object'
        ? Object.values(data).flat().find((value) => typeof value === 'string')
        : undefined
      toast(String(first || (data as { error?: string } | undefined)?.error || 'خطا در ذخیرهٔ خدمت'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (row: ServiceCategory) => {
    try {
      await api.put(`/billing/service-categories/${row.id}/`, { is_active: !row.is_active })
      void load()
    } catch {
      toast('خطا در تغییر وضعیت', 'error')
    }
  }

  const remove = async (row: ServiceCategory) => {
    if (!window.confirm(`خدمت «${row.name}» حذف شود؟`)) return
    try {
      await api.delete(`/billing/service-categories/${row.id}/`)
      toast('خدمت حذف شد', 'success')
      if (editing?.id === row.id) reset()
      void load()
    } catch {
      toast('این خدمت در جایی استفاده شده و قابل حذف نیست؛ غیرفعالش کنید.', 'error')
    }
  }

  const startEdit = (row: ServiceCategory) => {
    setEditing(row)
    setName(row.name)
    setCode(row.code)
    setParentId(row.parent ? String(row.parent) : '')
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-nx-blue" />
        <div>
          <h1 className="text-lg font-bold text-white">خدمات</h1>
          <p className="text-xs text-nx-mist">تعریف انواع خدمت (ویزا، تور، اتوبوس، …) که در صدور و اعلامیه‌ها استفاده می‌شود</p>
        </div>
      </div>

      <section className={`${CARD} p-5`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs text-nx-mist mb-1.5">نام خدمت *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="مثلاً ویزا" />
          </div>
          <div>
            <label className="block text-xs text-nx-mist mb-1.5">کد (اختیاری)</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={INPUT} placeholder="VISA" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs text-nx-mist mb-1.5">خدمت مادر (اختیاری)</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={INPUT}>
              <option value="">—</option>
              {rows.filter((r) => r.id !== editing?.id).map((r) => (
                <option key={r.id} value={String(r.id)}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void save()}
              disabled={busy || !canManage}
              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-xl bg-nx-blue text-white text-sm disabled:opacity-60"
            >
              {editing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editing ? 'ذخیره' : 'افزودن'}
            </button>
            {editing && (
              <button onClick={reset} className="px-4 py-2.5 rounded-xl border border-nx-navy-border text-nx-mist text-sm">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {!canManage && <p className="text-[11px] text-amber-400 mt-3">برای تغییر خدمات به مجوز مدیریت تنظیمات نیاز است.</p>}
      </section>

      <section className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm min-w-[520px]">
          <thead className="bg-nx-navy text-nx-mist text-xs">
            <tr>
              <th className="text-right font-medium px-4 py-3">نام</th>
              <th className="text-right font-medium px-4 py-3">کد</th>
              <th className="text-right font-medium px-4 py-3">مادر</th>
              <th className="text-right font-medium px-4 py-3">وضعیت</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="py-8 text-center text-xs text-nx-mist">در حال بارگذاری…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-xs text-nx-mist">خدمتی تعریف نشده است.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-nx-navy-border hover:bg-nx-navy/40">
                <td className="px-4 py-3 text-white">{row.name}</td>
                <td className="px-4 py-3 text-nx-mist" dir="ltr">{row.code || '—'}</td>
                <td className="px-4 py-3 text-nx-mist">{rows.find((r) => r.id === row.parent)?.name || '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => void toggleActive(row)}
                    disabled={!canManage}
                    className={`px-2 py-1 rounded-lg text-[11px] ${row.is_active ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-400/10 text-slate-400'}`}
                  >
                    {row.is_active ? 'فعال' : 'غیرفعال'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(row)} disabled={!canManage} className="px-2 py-1 rounded-lg text-xs text-nx-blue hover:bg-nx-blue/10">ویرایش</button>
                    <button onClick={() => void remove(row)} disabled={!canManage} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
