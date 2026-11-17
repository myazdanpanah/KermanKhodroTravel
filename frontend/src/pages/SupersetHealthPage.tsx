import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { ArrowRight, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2, Database, Zap } from 'lucide-react'

interface DatasetSyncStatus {
  id: number
  name: string
  table_name: string
  synced: boolean
  superset_dataset_id: number | null
  remote_superset_id: number | null
}

interface HealthData {
  status: string
  superset_url: string
  error?: string
  datasets: DatasetSyncStatus[]
}

export default function SupersetHealthPage() {
  const { toast } = useToast()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncingId, setSyncingId] = useState<number | null>(null)

  const fetchHealth = async () => {
    setLoading(true)
    try {
      const res = await api.get('/datasets/superset/health/')
      setHealth(res.data)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast(axiosErr.response?.data?.error || 'خطا در بررسی وضعیت Superset', 'error')
      setHealth({ status: 'error', superset_url: '', error: 'Failed to connect', datasets: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSyncSingle = async (id: number) => {
    setSyncingId(id)
    try {
      const res = await api.post(`/datasets/${id}/superset/sync/`)
      const data = res.data as { status: string; superset_dataset_id?: number }
      toast(
        data.status === 'already_synced' ? 'همگام‌سازی شده' : `همگام‌سازی موفق (ID: ${data.superset_dataset_id})`,
        'success'
      )
      fetchHealth()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast(axiosErr.response?.data?.error || 'خطا در همگام‌سازی', 'error')
    } finally {
      setSyncingId(null)
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      const res = await api.post('/datasets/superset/sync-all/')
      const data = res.data as { synced: number; skipped: number; errors: Array<{ name: string; error: string }> }
      toast(`${data.synced} مجموعه داده همگام‌سازی شد، ${data.skipped} قبلاً همگام شده`, 'success')
      if (data.errors.length > 0) {
        toast(`${data.errors.length} خطا در همگام‌سازی`, 'error')
      }
      fetchHealth()
    } catch {
      toast('خطا در همگام‌سازی گروهی', 'error')
    } finally {
      setSyncingAll(false)
    }
  }

  const syncedCount = health?.datasets.filter((d) => d.synced).length ?? 0
  const unsyncedCount = health?.datasets.filter((d) => !d.synced).length ?? 0

  return (
    <div className="min-h-screen bg-white dark:bg-nx-navy" dir="rtl">
      {/* Header */}
      <header className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboards" className="p-2 text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist transition">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                health?.status === 'ok' ? 'bg-nx-teal' : health?.status === 'error' ? 'bg-nx-danger-500' : 'bg-nx-mist'
              }`}>
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-nx-navy dark:text-nx-mist/10">وضعیت Superset</h1>
                <p className="text-xs text-nx-mist dark:text-nx-mist">بررسی اتصال و همگام‌سازی مجموعه‌داده‌ها</p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted text-nx-navy dark:text-nx-mist rounded-xl hover:bg-white dark:hover:bg-nx-muted transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            بروزرسانی
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Status Banner */}
        {health && (
          <div className={`rounded-2xl border p-6 ${
            health.status === 'ok'
              ? 'bg-nx-teal/10 dark:bg-nx-teal/20 border-nx-teal/10 dark:border-nx-teal'
              : 'bg-nx-danger-50 dark:bg-nx-danger-900/20 border-nx-danger-200 dark:border-nx-danger-800'
          }`}>
            <div className="flex items-center gap-3">
              {health.status === 'ok' ? (
                <CheckCircle className="w-6 h-6 text-nx-teal dark:text-nx-teal" />
              ) : (
                <XCircle className="w-6 h-6 text-nx-danger-600 dark:text-nx-danger-400" />
              )}
              <div>
                <p className={`font-bold ${health.status === 'ok' ? 'text-nx-teal dark:text-nx-teal' : 'text-nx-danger-700 dark:text-nx-danger-300'}`}>
                  {health.status === 'ok' ? 'Superset متصل است' : 'Superset در دسترس نیست'}
                </p>
                <p className="text-xs text-nx-mist dark:text-nx-mist">{health.superset_url}</p>
                {health.error && <p className="text-xs text-nx-danger-500 mt-1">{health.error}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {health && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-4">
              <p className="text-2xl font-bold text-nx-navy dark:text-nx-mist/10">{health.datasets.length}</p>
              <p className="text-xs text-nx-mist">کل مجموعه‌داده‌ها</p>
            </div>
            <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-4">
              <p className="text-2xl font-bold text-nx-teal">{syncedCount}</p>
              <p className="text-xs text-nx-mist">همگام‌شده</p>
            </div>
            <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-4">
              <p className="text-2xl font-bold text-nx-warning-600">{unsyncedCount}</p>
              <p className="text-xs text-nx-mist">نیاز به همگام‌سازی</p>
            </div>
          </div>
        )}

        {/* Sync All Button */}
        {unsyncedCount > 0 && health?.status === 'ok' && (
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="flex items-center gap-2 px-5 py-3 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition text-sm font-medium disabled:opacity-50"
          >
            {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            همگام‌سازی همه ({unsyncedCount} مورد)
          </button>
        )}

        {/* Dataset Table */}
        <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
          <div className="px-6 py-4 border-b border-nx-border dark:border-nx-navy-border">
            <h2 className="font-bold text-nx-navy dark:text-nx-mist/10">وضعیت همگام‌سازی</h2>
          </div>
          {loading ? (
            <div className="p-12 text-center text-nx-mist">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              در حال بارگذاری...
            </div>
          ) : health?.datasets.length === 0 ? (
            <div className="p-12 text-center">
              <Database className="w-12 h-12 text-nx-mist mx-auto mb-3" />
              <p className="text-nx-mist">هنوز مجموعه‌داده‌ای وجود ندارد</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-right text-xs text-nx-mist dark:text-nx-mist border-b border-nx-border dark:border-nx-navy-border">
                  <th className="px-6 py-3 font-medium">نام</th>
                  <th className="px-6 py-3 font-medium">جدول</th>
                  <th className="px-6 py-3 font-medium">وضعیت</th>
                  <th className="px-6 py-3 font-medium">Superset ID</th>
                  <th className="px-6 py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nx-mist/70">
                {health?.datasets.map((ds) => (
                  <tr key={ds.id} className="hover:bg-white dark:hover:bg-nx-navy-elevated transition">
                    <td className="px-6 py-4 text-sm font-medium text-nx-navy dark:text-nx-mist/10">{ds.name}</td>
                    <td className="px-6 py-4 text-xs text-nx-mist font-mono">{ds.table_name}</td>
                    <td className="px-6 py-4">
                      {ds.synced ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-nx-teal/10 dark:bg-nx-teal/30 text-nx-teal dark:text-nx-teal rounded-lg text-xs font-medium">
                          <CheckCircle className="w-3 h-3" /> همگام
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-nx-warning-100 dark:bg-nx-warning-900/30 text-nx-warning-700 dark:text-nx-warning-300 rounded-lg text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" /> ناهماهنگ
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-nx-mist">{ds.superset_dataset_id ?? '-'}</td>
                    <td className="px-6 py-4">
                      {!ds.synced && health?.status === 'ok' && (
                        <button
                          onClick={() => handleSyncSingle(ds.id)}
                          disabled={syncingId === ds.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-nx-blue/10 dark:bg-nx-blue/30 text-nx-blue dark:text-nx-blue rounded-lg text-xs font-medium hover:bg-nx-blue/10 dark:hover:bg-nx-blue/40 transition disabled:opacity-50"
                        >
                          {syncingId === ds.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          همگام‌سازی
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
