import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Trash2, RefreshCw, Play, Clock, CheckCircle, XCircle, Pause } from 'lucide-react'
import api from '../api/client'
import { useToast } from '../components/Toast'

interface SyncConfig {
  id: number
  name: string
  spreadsheet_id: string
  sheet_name: string
  database_source: string
  table_name: string
  sync_mode: string
  key_column: string
  schedule: string
  is_active: boolean
  last_sync_at: string | null
  last_sync_status: string
  last_error: string
}

const EMPTY_FORM = {
  name: '', spreadsheet_id: '', sheet_name: '', database_source: 'local',
  table_name: '', sync_mode: 'replace', key_column: '', schedule: '0 */6 * * *',
}

export default function SheetsSyncPage() {
  const [syncs, setSyncs] = useState<SyncConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [runningId, setRunningId] = useState<number | null>(null)
  const { toast } = useToast()

  useEffect(() => { loadSyncs() }, [])

  const loadSyncs = async () => {
    setLoading(true)
    try {
      const res = await api.get('/db-manager/syncs/')
      setSyncs(res.data)
    } catch {
      toast('خطا در بارگذاری همگام‌سازی‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      if (editingId) {
        await api.put(`/db-manager/syncs/${editingId}/`, form)
        toast('همگام‌سازی به‌روزرسانی شد', 'success')
      } else {
        await api.post('/db-manager/syncs/', form)
        toast('همگام‌سازی اضافه شد', 'success')
      }
      setForm(EMPTY_FORM)
      setEditingId(null)
      setShowForm(false)
      loadSyncs()
    } catch {
      toast('خطا در ذخیره', 'error')
    }
  }

  const handleRun = async (id: number) => {
    setRunningId(id)
    try {
      await api.post(`/db-manager/syncs/${id}/run/`)
      toast('همگام‌سازی اجرا شد', 'success')
      loadSyncs()
    } catch {
      toast('خطا در اجرای همگام‌سازی', 'error')
    } finally {
      setRunningId(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا از حذف این همگام‌سازی اطمینان دارید؟')) return
    try {
      await api.delete(`/db-manager/syncs/${id}/`)
      toast('همگام‌سازی حذف شد', 'success')
      loadSyncs()
    } catch {
      toast('خطا در حذف', 'error')
    }
  }

  const startEdit = (s: SyncConfig) => {
    setForm({
      name: s.name, spreadsheet_id: s.spreadsheet_id, sheet_name: s.sheet_name,
      database_source: s.database_source, table_name: s.table_name, sync_mode: s.sync_mode,
      key_column: s.key_column, schedule: s.schedule,
    })
    setEditingId(s.id)
    setShowForm(true)
  }

  const statusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-nx-teal" />
    if (status === 'error') return <XCircle className="w-4 h-4 text-nx-danger-500" />
    return <Pause className="w-4 h-4 text-nx-mist" />
  }

  return (
    <div className="min-h-screen bg-white dark:bg-nx-navy" dir="rtl">
      <header className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/db-manager" className="p-2 text-nx-mist hover:text-nx-muted dark:hover:text-nx-mist transition">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold text-nx-navy dark:text-slate-100">همگام‌سازی Google Sheets</h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(EMPTY_FORM) }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition"
          >
            <Plus className="w-4 h-4" />
            افزودن همگام‌سازی
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {showForm && (
          <div className="bg-white dark:bg-nx-navy border border-nx-blue/10 dark:border-nx-blue rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-nx-navy dark:text-slate-100">
              {editingId ? 'ویرایش همگام‌سازی' : 'همگام‌سازی جدید'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="px-3 py-2 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-nx-blue" />
              <input placeholder="Spreadsheet ID" value={form.spreadsheet_id} onChange={(e) => setForm({ ...form, spreadsheet_id: e.target.value })}
                className="px-3 py-2 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-nx-blue font-mono" />
              <input placeholder="Sheet name" value={form.sheet_name} onChange={(e) => setForm({ ...form, sheet_name: e.target.value })}
                className="px-3 py-2 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-nx-blue" />
              <input placeholder="Table name" value={form.table_name} onChange={(e) => setForm({ ...form, table_name: e.target.value })}
                className="px-3 py-2 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-nx-blue font-mono" />
              <select value={form.sync_mode} onChange={(e) => setForm({ ...form, sync_mode: e.target.value })}
                className="px-3 py-2 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-nx-blue">
                <option value="replace">Replace</option>
                <option value="upsert">Upsert</option>
              </select>
              {form.sync_mode === 'upsert' && (
                <input placeholder="Key column" value={form.key_column} onChange={(e) => setForm({ ...form, key_column: e.target.value })}
                  className="px-3 py-2 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-nx-blue font-mono" />
              )}
              <input placeholder="Cron schedule" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                className="px-3 py-2 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-nx-blue font-mono" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition font-medium">
                {editingId ? 'ذخیره' : 'افزودن'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 text-sm text-nx-muted hover:text-nx-navy transition">
                انصراف
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16"><RefreshCw className="w-6 h-6 text-nx-mist mx-auto animate-spin" /></div>
        ) : syncs.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-16 h-16 text-nx-mist dark:text-nx-muted mx-auto mb-4" />
            <p className="text-nx-muted dark:text-nx-mist">همگام‌سازی وجود ندارد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {syncs.map((s) => (
              <div key={s.id} className="bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-navy-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {statusIcon(s.last_sync_status)}
                    <span className="text-sm font-bold text-nx-navy dark:text-slate-100">{s.name}</span>
                    {!s.is_active && <span className="px-2 py-0.5 text-[10px] bg-nx-mist/10 dark:bg-nx-navy text-nx-muted rounded-full">غیرفعال</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleRun(s.id)} disabled={runningId === s.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs border border-nx-border dark:border-nx-muted rounded-lg hover:bg-white dark:hover:bg-nx-navy transition disabled:opacity-50">
                      {runningId === s.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      اجرای دستی
                    </button>
                    <button onClick={() => startEdit(s)} className="text-xs text-nx-blue hover:underline">ویرایش</button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 text-nx-mist hover:text-nx-danger-600 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-nx-muted dark:text-nx-mist">
                  <span className="font-mono">{s.spreadsheet_id}</span>
                  <span>→</span>
                  <span className="font-mono">{s.table_name}</span>
                  <span className="bg-nx-mist/10 dark:bg-nx-navy px-2 py-0.5 rounded">{s.sync_mode}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.schedule}</span>
                </div>
                {s.last_sync_at && (
                  <div className="text-[10px] text-nx-mist dark:text-nx-muted mt-2">
                    آخرین اجرا: {new Date(s.last_sync_at).toLocaleString('fa-IR')}
                  </div>
                )}
                {s.last_error && (
                  <div className="text-[10px] text-nx-danger-500 dark:text-nx-danger-400 mt-1 font-mono">{s.last_error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
