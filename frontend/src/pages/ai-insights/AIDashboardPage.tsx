import { useState, useEffect, useCallback } from 'react'
import { aiApi, type AIDashboard } from '../../api/aiInsights'
import { useToast } from '../../components/Toast'
import { Brain, AlertTriangle, TrendingUp, MessageSquare, Bell, Activity } from 'lucide-react'

export default function AIDashboardPage() {
  const { toast } = useToast()
  const [data, setData] = useState<AIDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await aiApi.getDashboard()
      setData(res.data)
    } catch {
      toast('خطا در بارگذاری داشبورد هوش مصنوعی', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nx-blue"></div>
      </div>
    )
  }

  if (!data) return <div className="p-8 text-center text-nx-mist">داده‌ای یافت نشد</div>

  const statCards = [
    { icon: Bell, label: 'Insights', value: data.insights.total, sub: `${data.insights.unread} خوانده نشده`, color: 'bg-nx-blue' },
    { icon: AlertTriangle, label: 'Anomalies', value: data.anomalies.total, sub: `${data.anomalies.critical} بحرانی`, color: 'bg-nx-danger-500' },
    { icon: TrendingUp, label: 'Forecasts', value: data.forecasts_count, sub: 'پیش‌بینی فعال', color: 'bg-nx-teal' },
    { icon: MessageSquare, label: 'NL Queries', value: data.recent_queries.length, sub: 'پرسش اخیر', color: 'bg-nx-blue' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-nx-blue rounded-xl flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-slate-100">داشبورد هوش مصنوعی</h1>
          <p className="text-sm text-slate-600 dark:text-slate-200">تحلیل داده و بینش‌های خودکار</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-nx-navy rounded-xl p-5 shadow-sm border border-nx-border dark:border-nx-navy-border">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-nx-navy dark:text-slate-100">{card.value}</p>
                <p className="text-xs text-slate-600 dark:text-slate-200">{card.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Anomalies by Module */}
      <div className="bg-white dark:bg-nx-navy rounded-xl p-6 shadow-sm border border-nx-border dark:border-nx-navy-border">
        <h2 className="text-lg font-semibold text-nx-navy dark:text-slate-100 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" /> Anomalies by Module
        </h2>
        {data.anomalies.by_module.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-200 text-sm">No anomalies detected</p>
        ) : (
          <div className="space-y-3">
            {data.anomalies.by_module.map((m) => (
              <div key={m.module} className="flex items-center justify-between p-3 bg-white dark:bg-nx-navy rounded-lg">
                <span className="text-sm font-medium text-nx-navy dark:text-nx-mist capitalize">{m.module}</span>
                <span className="text-sm text-nx-danger-600 dark:text-nx-danger-400 font-semibold">{m.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent NL Queries */}
      <div className="bg-white dark:bg-nx-navy rounded-xl p-6 shadow-sm border border-nx-border dark:border-nx-navy-border">
        <h2 className="text-lg font-semibold text-nx-navy dark:text-slate-100 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Recent Queries
        </h2>
        {data.recent_queries.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-200 text-sm">No queries yet</p>
        ) : (
          <div className="space-y-3">
            {data.recent_queries.map((q) => (
              <div key={q.id} className="p-3 bg-white dark:bg-nx-navy rounded-lg">
                <p className="text-sm font-medium text-nx-navy dark:text-nx-mist">{q.query_text}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-200">
                  <span className={`px-2 py-0.5 rounded-full ${q.status === 'completed' ? 'bg-nx-teal/10 text-nx-teal' : q.status === 'failed' ? 'bg-nx-danger-100 text-nx-danger-700' : 'bg-nx-warning-100 text-nx-warning-700'}`}>
                    {q.status}
                  </span>
                  <span>{q.execution_time_ms}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
