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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!data) return <div className="p-8 text-center text-gray-500">داده‌ای یافت نشد</div>

  const statCards = [
    { icon: Bell, label: 'Insights', value: data.insights.total, sub: `${data.insights.unread} خوانده نشده`, color: 'bg-blue-500' },
    { icon: AlertTriangle, label: 'Anomalies', value: data.anomalies.total, sub: `${data.anomalies.critical} بحرانی`, color: 'bg-red-500' },
    { icon: TrendingUp, label: 'Forecasts', value: data.forecasts_count, sub: 'پیش‌بینی فعال', color: 'bg-emerald-500' },
    { icon: MessageSquare, label: 'NL Queries', value: data.recent_queries.length, sub: 'پرسش اخیر', color: 'bg-purple-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">داشبورد هوش مصنوعی</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">تحلیل داده و بینش‌های خودکار</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{card.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Anomalies by Module */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" /> Anomalies by Module
        </h2>
        {data.anomalies.by_module.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No anomalies detected</p>
        ) : (
          <div className="space-y-3">
            {data.anomalies.by_module.map((m) => (
              <div key={m.module} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{m.module}</span>
                <span className="text-sm text-red-600 dark:text-red-400 font-semibold">{m.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent NL Queries */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Recent Queries
        </h2>
        {data.recent_queries.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No queries yet</p>
        ) : (
          <div className="space-y-3">
            {data.recent_queries.map((q) => (
              <div key={q.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{q.query_text}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`px-2 py-0.5 rounded-full ${q.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : q.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
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
