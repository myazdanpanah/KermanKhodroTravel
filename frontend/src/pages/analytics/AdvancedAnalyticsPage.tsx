import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../api/client'

// ─── Types ──────────────────────────────────────────────────────
interface AnalyticsMetric {
  id: string
  name: string
  value: number
  change: number
  trend: 'up' | 'down' | 'flat'
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

// ─── Simple SVG Chart Components ────────────────────────────────

function LineChart({ data, width = 600, height = 300 }: { data: AnalyticsDataPoint[]; width?: number; height?: number }) {
  if (!data.length) return <div className="text-gray-400 text-sm p-4">No data</div>

  const maxVal = Math.max(...data.map(d => d.value))
  const minVal = Math.min(...data.map(d => d.value))
  const range = maxVal - minVal || 1
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={padding.top + chartHeight * (1 - pct)}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight * (1 - pct)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={padding.top + chartHeight * (1 - pct) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#9ca3af"
          >
            {(minVal + range * pct).toFixed(0)}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaD} fill="url(#areaGradient)" opacity={0.3} />

      {/* Line */}
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2} />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6366f1" />
      ))}

      {/* X-axis labels */}
      {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d, i) => {
        const idx = data.indexOf(d)
        return (
          <text
            key={i}
            x={padding.left + (idx / (data.length - 1)) * chartWidth}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#9ca3af"
          >
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
  if (!data.length) return <div className="text-gray-400 text-sm p-4">No data</div>

  const maxVal = Math.max(...data.map(d => d.value))
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const barWidth = (chartWidth / data.length) * 0.7
  const barGap = (chartWidth / data.length) * 0.3

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={padding.top + chartHeight * (1 - pct)}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight * (1 - pct)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={padding.top + chartHeight * (1 - pct) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#9ca3af"
          >
            {(maxVal * pct).toFixed(0)}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const barHeight = (d.value / maxVal) * chartHeight
        const x = padding.left + i * (barWidth + barGap) + barGap / 2
        return (
          <g key={i}>
            <rect
              x={x}
              y={padding.top + chartHeight - barHeight}
              width={barWidth}
              height={barHeight}
              fill="#6366f1"
              rx={4}
              className="transition-all duration-300 hover:fill-indigo-500"
            />
            <text
              x={x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#9ca3af"
            >
              {d.label || d.date.slice(5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function PieChart({ data, width = 300, height = 300 }: { data: AnalyticsDataPoint[]; width?: number; height?: number }) {
  if (!data.length) return <div className="text-gray-400 text-sm p-4">No data</div>

  const total = data.reduce((sum, d) => sum + d.value, 0)
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
  const trendIcon = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{metric.name}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value.toLocaleString()}</div>
      <div className={`text-sm mt-1 ${trendColor}`}>
        {trendIcon} {Math.abs(metric.change).toFixed(1)}%
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{widget.title}</h3>
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

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch analytics data from multiple endpoints
      const [dashboardRes, aiRes] = await Promise.allSettled([
        api.get('/reporting/dashboards/'),
        api.get('/ai/dashboard/'),
      ])

      // Build metrics from available data
      const dashboardData = dashboardRes.status === 'fulfilled' ? dashboardRes.value.data : []
      const aiData = aiRes.status === 'fulfilled' ? aiRes.value.data : {}

      const sampleMetrics: AnalyticsMetric[] = [
        { id: 'dashboards', name: 'Dashboards', value: dashboardData.length || 0, change: 5.2, trend: 'up' },
        { id: 'insights', name: 'AI Insights', value: aiData.total_insights || 0, change: 12.3, trend: 'up' },
        { id: 'anomalies', name: 'Active Anomalies', value: aiData.active_anomalies || 0, change: -8.1, trend: 'down' },
        { id: 'forecasts', name: 'Forecasts', value: aiData.total_forecasts || 0, change: 3.5, trend: 'up' },
      ]

      // Build sample widget data
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const sampleLineData: AnalyticsDataPoint[] = Array.from({ length: days }, (_, i) => ({
        date: new Date(Date.now() - (days - i) * 86400000).toISOString().slice(0, 10),
        value: Math.floor(Math.random() * 1000) + 500,
      }))

      const moduleData: AnalyticsDataPoint[] = [
        { date: 'Finance', value: 150, label: 'Finance' },
        { date: 'Sales', value: 120, label: 'Sales' },
        { date: 'Inventory', value: 90, label: 'Inventory' },
        { date: 'HR', value: 60, label: 'HR' },
        { date: 'CRM', value: 45, label: 'CRM' },
      ]

      const statusData: AnalyticsDataPoint[] = [
        { date: 'Active', value: 65, label: 'Active' },
        { date: 'Pending', value: 20, label: 'Pending' },
        { date: 'Resolved', value: 15, label: 'Resolved' },
      ]

      const widgets: AnalyticsWidget[] = [
        { id: 'revenue-trend', title: 'Revenue Trend', type: 'line', data: sampleLineData },
        { id: 'module-activity', title: 'Module Activity', type: 'bar', data: moduleData },
        { id: 'status-dist', title: 'Status Distribution', type: 'pie', data: statusData },
      ]

      setMetrics(sampleMetrics)
      const newDashboard: AnalyticsDashboard = {
        id: 'default',
        name: 'Executive Overview',
        widgets,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setDashboards([newDashboard])
      setSelectedDashboard(newDashboard)
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
            Interactive data visualizations and insights
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
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
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

      {/* Dashboard Widgets */}
      {selectedDashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {selectedDashboard.widgets.map(widget => (
            <AnalyticsWidgetComponent key={widget.id} widget={widget} />
          ))}
        </div>
      )}

      {/* Dashboard List */}
      {dashboards.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Available Dashboards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboards.map(dashboard => (
              <button
                key={dashboard.id}
                onClick={() => setSelectedDashboard(dashboard)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedDashboard?.id === dashboard.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
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
