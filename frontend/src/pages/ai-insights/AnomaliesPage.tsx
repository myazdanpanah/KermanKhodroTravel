import { useState, useEffect, useCallback } from 'react'
import { aiApi, type Anomaly } from '../../api/aiInsights'
import { useToast } from '../../components/Toast'
import { AlertTriangle, Search, CheckCircle, Shield, RefreshCw } from 'lucide-react'

export default function AnomaliesPage() {
  const { toast } = useToast()
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [filterModule, setFilterModule] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')

  const fetchAnomalies = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (filterModule) params.module = filterModule
      if (filterSeverity) params.severity = filterSeverity
      const res = await aiApi.getAnomalies(params)
      setAnomalies(res.data)
    } catch {
      toast('خطا در بارگذاری ناهنجاری‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterModule, filterSeverity, toast])

  useEffect(() => { fetchAnomalies() }, [fetchAnomalies])

  const handleDetect = async () => {
    setDetecting(true)
    try {
      const res = await aiApi.detectAnomalies(filterModule || 'all')
      toast(`${res.data.detected} ناهنجاری جدید شناسایی شد`, 'success')
      fetchAnomalies()
    } catch {
      toast('خطا در شناسایی ناهنجاری', 'error')
    } finally {
      setDetecting(false)
    }
  }

  const handleResolve = async (id: number) => {
    try {
      await aiApi.resolveAnomaly(id)
      toast('ناهنجاری حل شد', 'success')
      fetchAnomalies()
    } catch {
      toast('خطا در حل ناهنجاری', 'error')
    }
  }

  const severityColor = (s: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-nx-danger-100 text-nx-danger-700 dark:bg-nx-danger-900 dark:text-nx-danger-300',
      high: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-warning-900 dark:text-nx-warning-300',
      medium: 'bg-nx-warning-100 text-nx-warning-700 dark:bg-nx-warning-900 dark:text-nx-warning-300',
      low: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue dark:text-nx-blue',
    }
    return colors[s] || colors.medium
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-nx-danger-500 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white dark:text-slate-100">تشخیص ناهنجاری</h1>
            <p className="text-sm text-slate-600 dark:text-slate-200">Anomaly Detection</p>
          </div>
        </div>
        <button onClick={handleDetect} disabled={detecting}
          className="flex items-center gap-2 px-4 py-2 bg-nx-danger-600 text-white rounded-xl hover:bg-nx-danger-700 transition disabled:opacity-50">
          <Shield className="w-4 h-4" />
          {detecting ? 'در حال شناسایی...' : 'شناسایی ناهنجاری'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)}
          className="px-3 py-2 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy text-sm">
          <option value="">All Modules</option>
          <option value="finance">Finance</option>
          <option value="sales">Sales</option>
          <option value="manufacturing">Manufacturing</option>
          <option value="hr">HR</option>
          <option value="service_management">Service Management</option>
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-2 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy text-sm">
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={() => { setLoading(true); fetchAnomalies() }}
          className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 dark:text-slate-200 border border-nx-mist dark:border-nx-muted rounded-xl hover:bg-white dark:hover:bg-nx-navy">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Anomalies List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue"></div>
        </div>
      ) : anomalies.length === 0 ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-200">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No anomalies found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {anomalies.map((a) => (
            <div key={a.id} className="bg-white dark:bg-nx-navy rounded-xl p-5 shadow-sm border border-nx-border dark:border-nx-navy-border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColor(a.severity)}`}>
                      {a.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-200 capitalize">{a.module}</span>
                  </div>
                  <h3 className="font-semibold text-nx-navy dark:text-slate-100">{a.metric_name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-200 mt-1">{a.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-slate-600 dark:text-slate-200">
                    <span>Expected: {a.expected_value}</span>
                    <span>Actual: {a.actual_value}</span>
                    <span>Deviation: {a.deviation_pct}%</span>
                  </div>
                </div>
                {!a.is_resolved && (
                  <button onClick={() => handleResolve(a.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-nx-teal border border-nx-teal rounded-lg hover:bg-nx-teal/10 dark:hover:bg-nx-teal/20">
                    <CheckCircle className="w-4 h-4" /> Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
