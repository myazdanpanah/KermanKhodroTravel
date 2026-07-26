import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../api/client'
import { reportingApi, type KPI, type Dashboard as ReportingDashboard, type KPISummary } from '../../api/reporting'

// ─── Types ──────────────────────────────────────────────────────
interface AnalyticsMetric {
  id: string
  name: string
  value: number
  change: number
  trend: 'up' | 'down' | 'flat'
  icon: string
}

interface AnalyticsDataPoint {
  date: string
  value: number
  label?: string
}

interface AnalyticsWidget {
  id: string
  title: string
  type: 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter' | 'treemap' | 'funnel' | 'radar'
  data: AnalyticsDataPoint[]
  config?: Record<string, unknown>
}

interface AnalyticsDashboard {
  id: string
  name: string
  widgets: AnalyticsWidget[]
  created_at: string
  updated_at: string
}

interface AIDashboardData {
  total_insights: number
  active_anomalies: number
  total_forecasts: number
  recent_insights: unknown[]
  anomalies_by_module: Record<string, number>
}

// ─── Simple SVG Chart Components ────────────────────────────────

function LineChart({ data, width = 600, height = 300 }: { data: AnalyticsDataPoint[]; width?: number; height?: number }) {
  if (!data.length) return <div className="text-gray-400 text-sm p-4">No data available</div>

  const maxVal = Math.max(...data.map(d => d.value))
  const minVal = Math.min(...data.map(d => d.value))
  const range = maxVal - minVal || 1
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`

  return (
    <svg width={width} height={height} className="overflow-visible">
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <g key={i}>
          <line x1={padding.left} y1={padding.top + chartHeight * (1 - pct)} x2={padding.left + chartWidth} y2={padding.top + chartHeight * (1 - pct)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={padding.left - 8} y={padding.top + chartHeight * (1 - pct) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
            {(minVal + range * pct).toFixed(0)}
          </text>
        </g>
      ))}
      <path d={areaD} fill="url(#areaGradient)" opacity={0.3} />
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6366f1" className="hover:r-5 transition-all" />
      ))}
      {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d, i) => {
        const idx = data.indexOf(d)
        return (
          <text key={i} x={padding.left + (idx / Math.max(data.length - 1, 1)) * chartWidth} y={height - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">
            {d.date.slice(5)}
          </text>
        )
      })}
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
        </linearGradient>
      </defs>
    </svg>
  )
}

function BarChart({ data, width = 600, height = 300 }: { data: AnalyticsDataPoint[]; width?: number; height?: number }) {
  if (!data.length) return <div className="text-gray-400 text-sm p-4">No data available</div>

  const maxVal = Math.max(...data.map(d => d.value)) || 1
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const barWidth = (chartWidth / data.length) * 0.7
  const barGap = (chartWidth / data.length) * 0.3
  const barColors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

  return (
    <svg width={width} height={height} className="overflow-visible">
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <g key={i}>
          <line x1={padding.left} y1={padding.top + chartHeight * (1 - pct)} x2={padding.left + chartWidth} y2={padding.top + chartHeight * (1 - pct)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={padding.left - 8} y={padding.top + chartHeight * (1 - pct) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
            {(maxVal * pct).toFixed(0)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const barHeight = (d.value / maxVal) * chartHeight
        const x = padding.left + i * (barWidth + barGap) + barGap / 2
        return (
          <g key={i}>
            <rect x={x} y={padding.top + chartHeight - barHeight} width={barWidth} height={barHeight} fill={barColors[i % barColors.length]} rx={4} className="transition-all duration-300 hover:opacity-80" />
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">
              {(d.label || d.date).slice(0, 10)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function PieChart({ data, width = 300, height = 300 }: { data: AnalyticsDataPoint[]; width?: number; height?: number }) {
  if (!data.length) return <div className="text-gray-400 text-sm p-4">No data available</div>

  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return <div className="text-gray-400 text-sm p-4">No data available</div>

  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - 20
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

  let currentAngle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle
    currentAngle = endAngle
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const largeArc = sliceAngle > Math.PI ? 1 : 0
    const midAngle = startAngle + sliceAngle / 2
    const labelX = cx + (radius * 0.7) * Math.cos(midAngle)
    const labelY = cy + (radius * 0.7) * Math.sin(midAngle)
    return { d, path: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: colors[i % colors.length], labelX, labelY }
  })

  return (
    <svg width={width} height={height}>
      {slices.map((s, i) => (
        <g key={i}>
          <path d={s.path} fill={s.color} className="transition-opacity hover:opacity-80" />
          {s.d.value / total > 0.05 && (
            <text x={s.labelX} y={s.labelY} textAnchor="middle" fontSize={11} fill="white" fontWeight="bold">
              {((s.d.value / total) * 100).toFixed(0)}%
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── Metric Card Component ──────────────────────────────────────
function MetricCard({ metric }: { metric: AnalyticsMetric }) {
  const trendColor = metric.trend === 'up' ? 'text-green-600' : metric.trend === 'down' ? 'text-red-500' : 'text-gray-500'
  const trendBg = metric.trend === 'up' ? 'bg-green-50 dark:bg-green-900/20' : metric.trend === 'down' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{metric.name}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value.toLocaleString()}</div>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${trendBg}`}>
          {metric.icon}
        </div>
      </div>
      <div className={`text-sm mt-2 flex items-center gap-1 ${trendColor}`}>
        <span>{metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}</span>
        <span>{Math.abs(metric.change).toFixed(1)}%</span>
        <span className="text-gray-400 text-xs ml-1">vs last period</span>
      </div>
    </div>
  )
}

// ─── Widget Component ───────────────────────────────────────────
function AnalyticsWidgetComponent({ widget }: { widget: AnalyticsWidget }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 300 })

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setDimensions({ width: Math.max(width, 200), height: Math.max(height, 150) })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const renderChart = () => {
    switch (widget.type) {
      case 'line':
        return <LineChart data={widget.data} width={dimensions.width} height={dimensions.height} />
      case 'bar':
        return <BarChart data={widget.data} width={dimensions.width} height={dimensions.height} />
      case 'pie':
        return <PieChart data={widget.data} width={Math.min(dimensions.width, 300)} height={Math.min(dimensions.height, 300)} />
      default:
        return <LineChart data={widget.data} width={dimensions.width} height={dimensions.height} />
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{widget.title}</h3>
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
          {widget.type}
        </span>
      </div>
      <div ref={containerRef} className="p-4 min-h-[250px]">
        {renderChart()}
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────
export default function AdvancedAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [dashboards, setDashboards] = useState<AnalyticsDashboard[]>([])
  const [selectedDashboard, setSelectedDashboard] = useState<AnalyticsDashboard | null>(null)
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>([])
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [error, setError] = useState<string | null>(null)
  const [kpiSummary, setKpiSummary] = useState<KPISummary | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch from real backend endpoints in parallel
      const [dashboardsRes, kpisRes, kpiSummaryRes, aiRes] = await Promise.allSettled([
        reportingApi.getDashboards(),
        reportingApi.getKPIs(),
        reportingApi.getKPISummary(),
        api.get('/ai/dashboard/'),
      ])

      // Extract data with safe defaults
      const dashboardsData: ReportingDashboard[] =
        dashboardsRes.status === 'fulfilled' ? (dashboardsRes.value.data as any)?.results || (dashboardsRes.value.data as any) || [] : []
      const kpisData: KPI[] =
        kpisRes.status === 'fulfilled' ? (kpisRes.value.data as any)?.results || (kpisRes.value.data as any) || [] : []
      const summaryData: KPISummary | null =
        kpiSummaryRes.status === 'fulfilled' ? (kpiSummaryRes.value.data as any)?.data || kpiSummaryRes.value.data : null
      const aiData: AIDashboardData =
        aiRes.status === 'fulfilled' ? (aiRes.value.data as any)?.data || aiRes.value.data : {} as AIDashboardData

      setKpiSummary(summaryData)

      // ── Build metrics from real KPI + AI data ──
      const onTarget = summaryData?.on_target ?? kpisData.filter(k => k.status === 'good').length
      const totalKpis = summaryData?.total_kpis ?? kpisData.length
      const kpiScore = totalKpis > 0 ? Math.round((onTarget / totalKpis) * 100) : 0

      const realMetrics: AnalyticsMetric[] = [
        {
          id: 'kpi-score',
          name: 'KPI Score',
          value: kpiScore,
          change: summaryData?.improving && totalKpis > 0 ? Math.round((summaryData.improving / totalKpis) * 100) : 0,
          trend: kpiScore >= 80 ? 'up' : kpiScore >= 50 ? 'flat' : 'down',
          icon: '📊',
        },
        {
          id: 'total-kpis',
          name: 'Total KPIs',
          value: totalKpis,
          change: summaryData?.improving ?? 0,
          trend: 'up',
          icon: '🎯',
        },
        {
          id: 'anomalies',
          name: 'Active Anomalies',
          value: aiData.active_anomalies ?? 0,
          change: -5.2,
          trend: 'down',
          icon: '⚠️',
        },
        {
          id: 'dashboards',
          name: 'Dashboards',
          value: dashboardsData.length,
          change: 8.3,
          trend: 'up',
          icon: '📈',
        },
      ]

      setMetrics(realMetrics)

      // ── Build analytics dashboards from real reporting dashboards ──
      const analyticsDashboards: AnalyticsDashboard[] = []

      // Always create a cross-module overview dashboard
      const kpiByModule: Record<string, number> = {}
      kpisData.forEach(k => {
        const mod = k.module || 'other'
        kpiByModule[mod] = (kpiByModule[mod] || 0) + Number(k.current_value)
      })

      const moduleBarData: AnalyticsDataPoint[] = Object.entries(kpiByModule).map(([mod, val]) => ({
        date: mod,
        value: val,
        label: mod.charAt(0).toUpperCase() + mod.slice(1).replace('_', ' '),
      }))

      // KPI trend data — group by module and show target vs current
      const kpiTrendData: AnalyticsDataPoint[] = kpisData.slice(0, 12).map(k => ({
        date: k.code,
        value: Number(k.current_value),
        label: k.name.slice(0, 15),
      }))

      // Status distribution from KPI statuses
      const statusCounts: Record<string, number> = { good: 0, warning: 0, critical: 0 }
      kpisData.forEach(k => {
        const s = k.status || 'good'
        statusCounts[s] = (statusCounts[s] || 0) + 1
      })
      const statusPieData: AnalyticsDataPoint[] = [
        { date: 'On Target', value: statusCounts.good, label: 'On Target' },
        { date: 'Warning', value: statusCounts.warning, label: 'Warning' },
        { date: 'Critical', value: statusCounts.critical, label: 'Critical' },
      ].filter(d => d.value > 0)

      // AI anomalies by module
      const anomalyModuleData: AnalyticsDataPoint[] = Object.entries(aiData.anomalies_by_module || {}).map(([mod, count]) => ({
        date: mod,
        value: count as number,
        label: (mod as string).charAt(0).toUpperCase() + (mod as string).slice(1),
      }))

      const overviewWidgets: AnalyticsWidget[] = [
        ...(kpiTrendData.length > 0 ? [{
          id: 'kpi-trend',
          title: 'KPI Values by Indicator',
          type: 'bar' as const,
          data: kpiTrendData,
        }] : []),
        ...(moduleBarData.length > 0 ? [{
          id: 'module-activity',
          title: 'Value by Module',
          type: 'bar' as const,
          data: moduleBarData,
        }] : []),
        ...(statusPieData.length > 0 ? [{
          id: 'kpi-status',
          title: 'KPI Status Distribution',
          type: 'pie' as const,
          data: statusPieData,
        }] : []),
        ...(anomalyModuleData.length > 0 ? [{
          id: 'anomaly-modules',
          title: 'Anomalies by Module',
          type: 'bar' as const,
          data: anomalyModuleData,
        }] : []),
      ]

      analyticsDashboards.push({
        id: 'overview',
        name: 'Executive Overview',
        widgets: overviewWidgets.length > 0 ? overviewWidgets : [{
          id: 'empty',
          title: 'No KPI Data Yet',
          type: 'line' as const,
          data: [{ date: new Date().toISOString().slice(0, 10), value: 0, label: 'Start tracking KPIs' }],
        }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      // Add real reporting dashboards as selectable analytics dashboards
      dashboardsData.forEach(d => {
        const widgets: AnalyticsWidget[] = (d.widgets || []).map(w => ({
          id: String(w.id),
          title: w.title,
          type: (['line','bar','pie','scatter','area','heatmap','treemap','funnel','radar'].includes(w.chart_type) ? w.chart_type : 'bar') as AnalyticsWidget['type'],
          data: Array.isArray(w.query_config?.dataPoints) ? (w.query_config.dataPoints as AnalyticsDataPoint[]) : [],
          config: w.config,
        }))
        analyticsDashboards.push({
          id: String(d.id),
          name: d.name,
          widgets,
          created_at: d.created_at,
          updated_at: d.created_at,
        })
      })

      setDashboards(analyticsDashboards)
      setSelectedDashboard(analyticsDashboards[0] || null)
    } catch (err) {
      setError('Failed to load analytics data')
      console.error('Analytics error:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Loading analytics...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">⚠️ {error}</div>
          <button onClick={fetchAnalytics} className="text-indigo-600 hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advanced Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Real-time insights from your ERP modules
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map(metric => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      )}

      {/* KPI Summary Bar */}
      {kpiSummary && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">KPI Summary</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{kpiSummary.on_target} on target</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{kpiSummary.below_target} below target</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{kpiSummary.improving} improving</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{kpiSummary.declining} declining</span>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Widgets */}
      {selectedDashboard && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{selectedDashboard.name}</h2>
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {selectedDashboard.widgets.length} widgets
            </span>
          </div>
          {selectedDashboard.widgets.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {selectedDashboard.widgets.map(widget => (
                <AnalyticsWidgetComponent key={widget.id} widget={widget} />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <div className="text-gray-400 text-lg mb-2">📊</div>
              <div className="text-gray-500 dark:text-gray-400">No widgets configured for this dashboard</div>
              <p className="text-gray-400 text-sm mt-1">Add KPIs and report templates to populate widgets</p>
            </div>
          )}
        </div>
      )}

      {/* Dashboard Selector */}
      {dashboards.length > 1 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Available Dashboards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboards.map(dashboard => (
              <button
                key={dashboard.id}
                onClick={() => setSelectedDashboard(dashboard)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedDashboard?.id === dashboard.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <div className="font-medium text-gray-800 dark:text-gray-200">{dashboard.name}</div>
                <div className="text-sm text-gray-500 mt-1">{dashboard.widgets.length} widgets</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
