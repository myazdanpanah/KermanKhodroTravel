import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useDashboardStore } from '../store/dashboardStore'
import api from '../api/client'
import { X, BarChart3, PieChart, TrendingUp, Table, Hash, Circle, Target, GitBranch, Grid3x3, TreePine, ArrowRightLeft, Filter, Radar, Network, Map } from 'lucide-react'
import { formatKpiValue, DEFAULT_KPI_FORMAT, type KpiFormat } from '../utils/kpiFormat'
import { PRESET_PALETTES } from '../utils/palettes'
import { DEFAULT_WIDGET_STYLE, type WidgetStyle } from '../utils/themeConfig'
import type { FontConfig } from '../utils/chartDefaults'

interface WidgetFilter {
  col: string
  op: 'eq' | 'neq' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'starts_with' | 'ends_with'
  val: string | number
}

interface ConditionalRule {
  column: string
  op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'between'
  value: number
  value2?: number
  color: string
}

interface WidgetConfigPanelProps {
  widgetId: string
  onClose: () => void
}

const chartTypes = [
  { value: 'bar', label: 'میله‌ای', icon: BarChart3 },
  { value: 'bar_horizontal', label: 'میله‌ای افقی', icon: BarChart3 },
  { value: 'stacked_bar', label: 'میله‌ای انباشته', icon: BarChart3 },
  { value: 'line', label: 'خطی', icon: TrendingUp },
  { value: 'area', label: 'سطحی', icon: TrendingUp },
  { value: 'pie', label: 'دایره‌ای', icon: PieChart },
  { value: 'donut', label: 'دونات', icon: Circle },
  { value: 'scatter', label: 'پراکنده', icon: Target },
  { value: 'gauge', label: 'گیج', icon: GitBranch },
  { value: 'heatmap', label: 'نقشه حرارتی', icon: Grid3x3 },
  { value: 'treemap', label: 'درختی', icon: TreePine },
  { value: 'sankey', label: 'جریان', icon: ArrowRightLeft },
  { value: 'funnel', label: 'قیفی', icon: Filter },
  { value: 'radar', label: 'راداری', icon: Radar },
  { value: 'graph', label: 'شبکه‌ای', icon: Network },
  { value: 'map', label: 'نقشه', icon: Map },
  { value: 'table', label: 'جدول', icon: Table },
  { value: 'kpi', label: 'شاخص کلیدی', icon: Hash },
  { value: 'leader_kpi', label: 'برترین', icon: TrendingUp },
]

const AGG_OPTIONS = ['SUM', 'COUNT', 'COUNT_DISTINCT', 'AVG', 'MIN', 'MAX'] as const

const NUMERIC_TYPES = new Set([
  'BIGINT', 'INTEGER', 'SMALLINT', 'DOUBLE PRECISION',
  'REAL', 'NUMERIC', 'DECIMAL', 'FLOAT',
  'INT64', 'FLOAT64',
])

interface Dataset {
  id: number
  name: string
  column_names: string[]
  column_types: Record<string, string>
}



export default function WidgetConfigPanel({ widgetId, onClose }: WidgetConfigPanelProps) {
  const { id: dashboardId } = useParams<{ id: string }>()
  const { widgets, pages, activePageId, updateWidget } = useDashboardStore()
  // Look up widget from active page first, then fall back to global widgets array
  const activePage = pages.find((p) => p.id === activePageId)
  const widget = activePage?.widgets.find((w) => w.id === widgetId) || widgets.find((w) => w.id === widgetId)

  const [title, setTitle] = useState(widget?.title || '')
  const [chartType, setChartType] = useState(widget?.chartType || 'bar')
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(widget?.datasetId || null)
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    (widget?.queryConfig?.columns as string[]) || []
  )
  const [metrics, setMetrics] = useState<Record<string, string>>(
    (widget?.queryConfig?.metrics as Record<string, string>) || {}
  )
  // Date granularity: { col: 'month' }
  const [dateTruncs, setDateTruncs] = useState<Record<string, string>>(
    (widget?.queryConfig?.date_truncs as Record<string, string>) || {}
  )

  // KPI formatting state
  const savedKpiFormat = (widget?.chartConfig as Record<string, unknown>)?.kpiFormat as KpiFormat | undefined
  const [kpiFormat, setKpiFormat] = useState<KpiFormat>(savedKpiFormat || DEFAULT_KPI_FORMAT)

  // Map GeoJSON URL state
  const [mapUrl, setMapUrl] = useState(
    (widget?.chartConfig as Record<string, unknown>)?.mapUrl as string || ''
  )

  // Palette & style state
  const [paletteId, setPaletteId] = useState(
    (widget?.chartConfig as Record<string, unknown>)?.paletteId as string || 'nexivo'
  )
  const [widgetStyle, setWidgetStyle] = useState<WidgetStyle>(
    ((widget?.chartConfig as Record<string, unknown>)?.widgetStyle as WidgetStyle) || DEFAULT_WIDGET_STYLE
  )

  // Chart background
  const [bgColor, setBgColor] = useState(
    (widget?.chartConfig as Record<string, unknown>)?.bgColor as string || ''
  )
  const [bgImage, setBgImage] = useState(
    (widget?.chartConfig as Record<string, unknown>)?.bgImage as string || ''
  )

  // Sort & limit
  const [sortBy, setSortBy] = useState(
    (widget?.chartConfig as Record<string, unknown>)?.sortBy as string || 'none'
  )
  const [sortLimit, setSortLimit] = useState(
    ((widget?.chartConfig as Record<string, unknown>)?.sortLimit as number) || 0
  )

  // Widget-level filters
  const [widgetFilters, setWidgetFilters] = useState<WidgetFilter[]>(
    ((widget?.queryConfig?.filters as WidgetFilter[]) || [])
  )

  // Color overrides (per-series / per-slice / single)
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>(
    ((widget?.chartConfig as Record<string, unknown>)?.seriesColors as Record<string, string>) || {}
  )
  const [sliceColors, setSliceColors] = useState<Record<string, string>>(
    ((widget?.chartConfig as Record<string, unknown>)?.sliceColors as Record<string, string>) || {}
  )
  const [singleColor, setSingleColor] = useState<string>(
    (widget?.chartConfig as Record<string, unknown>)?.singleColor as string || ''
  )

  // Font config
  const [fontConfig, setFontConfig] = useState<FontConfig>(
    ((widget?.chartConfig as Record<string, unknown>)?.fontConfig as FontConfig) || {}
  )

  // Conditional formatting rules
  const [condRules, setCondRules] = useState<ConditionalRule[]>(
    ((widget?.chartConfig as Record<string, unknown>)?.conditionalRules as ConditionalRule[]) || []
  )

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId)

  useEffect(() => {
    fetchDatasets()
  }, [])

  // When dataset changes, auto-select all columns and auto-assign metrics from column types
  const prevDatasetIdRef = useRef<number | null>(selectedDatasetId)
  useEffect(() => {
    if (selectedDatasetId !== prevDatasetIdRef.current) {
      prevDatasetIdRef.current = selectedDatasetId
      if (selectedDataset) {
        setSelectedColumns(selectedDataset.column_names)
        if (chartType !== 'table' && chartType !== 'leader_kpi') {
          const autoMetrics: Record<string, string> = {}
          for (const col of selectedDataset.column_names) {
            const pgType = (selectedDataset.column_types[col] || '').toUpperCase()
            if (NUMERIC_TYPES.has(pgType)) {
              autoMetrics[col] = 'SUM'
            }
          }
          setMetrics(autoMetrics)
        } else {
          setMetrics({})
        }
      } else {
        setSelectedColumns([])
        setMetrics({})
      }
    }
  }, [selectedDatasetId, selectedDataset, chartType])

  // When chart type changes to/from table, update metrics accordingly
  useEffect(() => {
    if (!selectedDataset) return
    if (chartType === 'table' || chartType === 'leader_kpi') {
      setMetrics({})
    } else {
      const autoMetrics: Record<string, string> = {}
      for (const col of selectedColumns) {
        const pgType = (selectedDataset.column_types[col] || '').toUpperCase()
        if (NUMERIC_TYPES.has(pgType)) {
          autoMetrics[col] = metrics[col] || 'SUM'
        }
      }
      setMetrics(autoMetrics)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType])

  const fetchDatasets = async () => {
    try {
      const res = await api.get('/datasets/')
      setDatasets(res.data)
    } catch {
      // ignore
    }
  }

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) => {
      const next = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
      // Clean up stale metrics: remove metric entries for deselected columns
      if (prev.includes(col) && !next.includes(col)) {
        setMetrics((prevMetrics) => {
          if (!(col in prevMetrics)) return prevMetrics
          const cleaned = { ...prevMetrics }
          delete cleaned[col]
          return cleaned
        })
        // Also clean up date truncs for deselected columns
        setDateTruncs((prevTruncs) => {
          if (!(col in prevTruncs)) return prevTruncs
          const cleaned = { ...prevTruncs }
          delete cleaned[col]
          return cleaned
        })
        // Also clean up widget-level filters for deselected columns
        setWidgetFilters((prevFilters) =>
          prevFilters.filter((f) => f.col !== col)
        )
      }
      return next
    })
  }

  const toggleMetric = (col: string) => {
    setMetrics((prev) => {
      const next = { ...prev }
      if (next[col]) {
        delete next[col] // metric → dimension
      } else {
        next[col] = 'SUM' // dimension → metric
      }
      return next
    })
  }

  const setAggFunc = (col: string, func: string) => {
    setMetrics((prev) => ({ ...prev, [col]: func }))
  }

  const isMetric = (col: string) => col in metrics

  const handleSave = async () => {
    if (!widget) return

    const queryConfig: Record<string, unknown> = {
      ...widget.queryConfig,
      columns: selectedColumns.length > 0 ? selectedColumns : undefined,
    }
    if (chartType !== 'table' && Object.keys(metrics).length > 0) {
      queryConfig.metrics = metrics
    } else {
      queryConfig.metrics = undefined
    }
    // Date truncs
    if (Object.keys(dateTruncs).length > 0) {
      queryConfig.date_truncs = dateTruncs
    } else {
      queryConfig.date_truncs = undefined
    }
    // Widget-level filters
    if (widgetFilters.length > 0) {
      queryConfig.filters = widgetFilters
    } else {
      queryConfig.filters = undefined
    }

    // Save chartConfig
    const chartConfig: Record<string, unknown> = {
      ...widget.chartConfig,
      paletteId,
      widgetStyle,
    }
    if (chartType === 'kpi') {
      chartConfig.kpiFormat = kpiFormat
    }
    if (chartType === 'map') {
      chartConfig.mapUrl = mapUrl
    }
    // Background
    if (bgColor) chartConfig.bgColor = bgColor
    else delete chartConfig.bgColor
    if (bgImage) chartConfig.bgImage = bgImage
    else delete chartConfig.bgImage
    // Sort & limit
    if (sortBy !== 'none') chartConfig.sortBy = sortBy
    else delete chartConfig.sortBy
    if (sortLimit > 0) chartConfig.sortLimit = sortLimit
    else delete chartConfig.sortLimit

    // Color overrides
    const isPieLike = chartType === 'pie' || chartType === 'donut'
    const isBarLike = chartType === 'bar' || chartType === 'bar_horizontal' || chartType === 'stacked_bar' || chartType === 'line' || chartType === 'area'
    const isSingle = chartType === 'kpi' || chartType === 'leader_kpi' || chartType === 'scatter'
    if (isBarLike && Object.keys(seriesColors).length > 0) chartConfig.seriesColors = seriesColors
    else delete chartConfig.seriesColors
    if (isPieLike && Object.keys(sliceColors).length > 0) chartConfig.sliceColors = sliceColors
    else delete chartConfig.sliceColors
    if (isSingle && singleColor) chartConfig.singleColor = singleColor
    else delete chartConfig.singleColor

    // Font config
    if (fontConfig.labelSize || fontConfig.valueSize || fontConfig.fontFamily) {
      chartConfig.fontConfig = fontConfig
    } else {
      delete chartConfig.fontConfig
    }

    // Conditional formatting rules
    if (condRules.length > 0) chartConfig.conditionalRules = condRules
    else delete chartConfig.conditionalRules

    try {
      await api.put(`/dashboards/${dashboardId}/widgets/${widgetId}/`, {
        title,
        chart_type: chartType,
        dataset: selectedDatasetId,
        chart_config: chartConfig,
        query_config: queryConfig,
      })

      updateWidget(widgetId, {
        title,
        chartType,
        datasetId: selectedDatasetId,
        queryConfig,
        chartConfig,
        columnTypes: selectedDataset?.column_types,
      })

      onClose()
    } catch {
      // ignore
    }
  }

  if (!widget) return null

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="absolute left-0 top-0 bottom-0 w-full max-w-96 bg-white dark:bg-nx-navy shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-nx-navy dark:text-nx-mist/10">تنظیمات نمودار</h3>
          <button onClick={onClose} className="p-1 text-nx-mist dark:text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">عنوان</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none"
              dir="rtl"
            />
          </div>

          {/* Chart Type */}
          <div>
            <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-2">نوع نمودار</label>
            <div className="grid grid-cols-2 gap-2">
              {chartTypes.map((ct) => {
                const Icon = ct.icon
                return (
                  <button
                    key={ct.value}
                    onClick={() => setChartType(ct.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition ${
                      chartType === ct.value
                        ? 'border-nx-blue bg-nx-blue/10 dark:bg-nx-blue/30 text-nx-blue dark:text-nx-blue'
                        : 'border-nx-border hover:border-nx-mist text-nx-mist dark:border-nx-muted dark:text-nx-mist dark:hover:border-nx-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{ct.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dataset */}
          <div>
            <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">مجموعه داده</label>
            <select
              value={selectedDatasetId || ''}
              onChange={(e) => setSelectedDatasetId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none"
            >
              <option value="">انتخاب کنید...</option>
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.column_names.length} ستون)
                </option>
              ))}
            </select>
          </div>

          {/* Column Layout Hints for special chart types */}
          {selectedDataset && selectedDataset.column_names.length > 0 && ['heatmap', 'sankey', 'graph'].includes(chartType) && (
            <div className="bg-nx-warning-50 dark:bg-nx-warning-900/20 border border-nx-warning-200 dark:border-nx-warning-700 rounded-xl px-4 py-3 text-xs text-nx-warning-700 dark:text-nx-warning-300 leading-relaxed">
              {chartType === 'heatmap' && '🗺️ نقشه حرارتی: ستون اول = محور X، ستون دوم = محور Y، ستون سوم = مقدار'}
              {chartType === 'sankey' && '🔄 جریان: ستون اول = مبدأ، ستون دوم = مقصد، ستون سوم = مقدار (اختیاری)'}
              {chartType === 'graph' && '🕸️ شبکه‌ای: ستون اول = مبدأ، ستون دوم = مقصد، ستون سوم = وزن (اختیاری)'}
            </div>
          )}
          {selectedDataset && selectedDataset.column_names.length > 0 && chartType === 'leader_kpi' && (
            <div className="bg-nx-warning-50 dark:bg-nx-warning-900/20 border border-nx-warning-200 dark:border-nx-warning-700 rounded-xl px-4 py-3 text-xs text-nx-warning-700 dark:text-nx-warning-300 leading-relaxed">
              🏆 برترین: ستون اول = دسته‌بندی (مثل نام فروشنده)، سیستم به صورت خودکار تعداد را شمرده و برترین را نمایش می‌دهد
            </div>
          )}

          {/* Column Picker with Dimension / Metric roles */}
          {selectedDataset && selectedDataset.column_names.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-2">
                ستون\u200cها
                {chartType !== 'table' && (
                  <span className="text-xs text-nx-mist mr-2">
                    (روی برچسب کلیک کنید تا بین دسته/مقدار تغییر کند)
                  </span>
                )}
              </label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto border border-nx-border dark:border-nx-muted rounded-xl p-3">
                {selectedDataset.column_names.map((col) => {
                  const checked = selectedColumns.includes(col)
                  const metric = isMetric(col)
                  return (
                    <div
                      key={col}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${
                        checked ? 'bg-white dark:bg-nx-navy-elevated' : 'opacity-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColumn(col)}
                        className="w-4 h-4 text-nx-blue rounded border-nx-mist focus:ring-nx-blue"
                      />
                      <span className="text-sm text-nx-navy dark:text-nx-mist flex-1">{col}</span>

                      {/* Role badge + agg picker (only for non-table charts) */}
                      {chartType !== 'table' && checked && (
                        <div className="flex items-center gap-1">
                          {metric ? (
                            <div className="flex items-center gap-0.5">
                              <select
                                value={metrics[col]}
                                onChange={(e) => setAggFunc(col, e.target.value)}
                                className="text-[10px] px-1 py-0.5 bg-nx-warning-100 dark:bg-nx-warning-900/40 text-nx-warning-700 dark:text-nx-warning-300 rounded-full border-0 outline-none cursor-pointer font-medium"
                                title="تابع تجمیع"
                              >
                                {AGG_OPTIONS.map((f) => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => toggleMetric(col)}
                                className="text-[10px] w-3.5 h-3.5 flex items-center justify-center text-nx-warning-500 hover:text-nx-warning-700 hover:bg-nx-warning-200 rounded-full transition"
                                title="تبدیل به دسته"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleMetric(col)}
                              className="text-[10px] px-1.5 py-0.5 bg-nx-blue/10 dark:bg-nx-blue/40 text-nx-blue dark:text-nx-blue rounded-full hover:bg-nx-blue/10 dark:hover:bg-nx-blue/40 transition font-medium"
                              title="تبدیل به مقدار"
                            >
                              دسته
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setSelectedColumns(selectedDataset.column_names)}
                  className="text-xs text-nx-blue hover:text-nx-blue"
                >
                  انتخاب همه
                </button>
                <span className="text-nx-mist">|</span>
                <button
                  onClick={() => {
                    setSelectedColumns([])
                    setMetrics({})
                    setDateTruncs({})
                  }}
                  className="text-xs text-nx-mist hover:text-nx-navy"
                >
                  حذف انتخاب
                </button>
              </div>
            </div>
          )}

          {/* Date Granularity Picker */}
          {selectedDataset && chartType !== 'table' && (
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-2">
                گروه‌بندی تاریخ
                <span className="text-xs text-nx-mist mr-2">
                  (ستون‌های تاریخی را خودکار گروه‌بندی کنید)
                </span>
              </label>
              <div className="space-y-1.5">
                {selectedDataset.column_names
                  .filter((col) => {
                    const pgType = (selectedDataset.column_types[col] || '').toUpperCase()
                    return pgType.includes('TIMESTAMP') || pgType.includes('DATE') || pgType.includes('TIME')
                  })
                  .map((col) => (
                    <div key={col} className="flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-nx-navy-elevated rounded-lg">
                      <span className="text-sm text-nx-navy dark:text-nx-mist flex-1">{col}</span>
                      <select
                        value={dateTruncs[col] || ''}
                        onChange={(e) => {
                          setDateTruncs((prev) => {
                            const next = { ...prev }
                            if (e.target.value) {
                              next[col] = e.target.value
                            } else {
                              delete next[col]
                            }
                            return next
                          })
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 focus:ring-1 focus:ring-nx-blue outline-none"
                      >
                        <option value="">بدون گروه‌بندی</option>
                        <option value="year">سال</option>
                        <option value="quarter">فصل</option>
                        <option value="month">ماه</option>
                        <option value="week">هفته</option>
                        <option value="day">روز</option>
                      </select>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* KPI Number Formatting */}
          {chartType === 'kpi' && (
            <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-4">
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist">قالب عدد</label>

              {/* Format type */}
              <div>
                <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">نوع قالب</label>
                <select
                  value={kpiFormat.type}
                  onChange={(e) => setKpiFormat({ ...kpiFormat, type: e.target.value as KpiFormat['type'] })}
                  className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none"
                >
                  <option value="auto">خودکار</option>
                  <option value="number">عدد</option>
                  <option value="currency">ارز</option>
                  <option value="percentage">درصد</option>
                </select>
              </div>

              {/* Currency symbol (only for currency) */}
              {kpiFormat.type === 'currency' && (
                <div>
                  <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">نماد ارز</label>
                  <input
                    type="text"
                    value={kpiFormat.currency}
                    onChange={(e) => setKpiFormat({ ...kpiFormat, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none"
                    placeholder="$"
                    maxLength={5}
                  />
                </div>
              )}

              {/* Decimal places */}
              <div>
                <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">اعداد اعشاری: {kpiFormat.decimals}</label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={kpiFormat.decimals}
                  onChange={(e) => setKpiFormat({ ...kpiFormat, decimals: parseInt(e.target.value) })}
                  className="w-full accent-nx-blue"
                />
                <div className="flex justify-between text-[10px] text-nx-mist mt-0.5">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </div>

              {/* Prefix */}
              <div>
              <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">پیشوند</label>
              <input
                type="text"
                value={kpiFormat.prefix}
                onChange={(e) => setKpiFormat({ ...kpiFormat, prefix: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none"
                placeholder="مثلاً: "
                maxLength={10}
                />
              </div>

              {/* Suffix */}
              <div>
              <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">پسوند</label>
              <input
                type="text"
                value={kpiFormat.suffix}
                onChange={(e) => setKpiFormat({ ...kpiFormat, suffix: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none"
                placeholder="مثلاً: تومان"
                maxLength={10}
                />
              </div>

              {/* Preview */}                  <div className="bg-white dark:bg-nx-navy rounded-lg p-3 text-center">
                <span className="text-[10px] text-nx-mist block mb-1">پیش‌نمایش</span>
                <span className="text-lg font-bold text-nx-blue">
                  {formatKpiValue(12345.6789, kpiFormat)}
                </span>
              </div>
            </div>
          )}

          {/* Map GeoJSON URL */}
          {chartType === 'map' && (
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">
                آدرس فایل GeoJSON نقشه
              </label>
              <input
                type="text"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}                      className="w-full px-4 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none text-sm"
                placeholder="https://example.com/maps/iran.json"
                dir="ltr"
              />
              <p className="text-xs text-nx-mist mt-1">
                فایل GeoJSON باید شامل اطلاعات جغرافیایی نقشه باشد. نام نقشه در فایل باید با نام انتخاب شده مطابقت داشته باشد.
              </p>
            </div>
          )}

          {/* Widget-Level Filters (Looker Studio-style) */}
          {selectedDataset && (
            <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-nx-navy dark:text-nx-mist">فیلترهای نمودار</label>
                <button
                  onClick={() => setWidgetFilters([...widgetFilters, { col: selectedDataset.column_names[0] || '', op: 'eq', val: '' }])}
                  className="text-xs text-nx-blue hover:text-nx-blue font-medium"
                >
                  + افزودن فیلتر
                </button>
              </div>
              <p className="text-[10px] text-nx-mist">فیلترهایی که فقط روی این نمودار اعمال می‌شوند</p>

              {widgetFilters.length === 0 && (
                <p className="text-xs text-nx-mist text-center py-2">بدون فیلتر</p>
              )}

              <div className="space-y-2">
                {widgetFilters.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-nx-navy-elevated rounded-lg p-2">
                    {/* Column */}
                    <select
                      value={f.col}
                      onChange={(e) => {
                        const next = [...widgetFilters]
                        next[idx] = { ...next[idx], col: e.target.value }
                        setWidgetFilters(next)
                      }}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                    >
                      {selectedDataset.column_names.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={f.op}
                      onChange={(e) => {
                        const next = [...widgetFilters]
                        next[idx] = { ...next[idx], op: e.target.value as WidgetFilter['op'] }
                        setWidgetFilters(next)
                      }}
                      className="w-20 px-1.5 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                    >
                      <option value="eq">برابر</option>
                      <option value="neq">نابرابر</option>
                      <option value="contains">شامل</option>
                      <option value="gt">بزرگتر</option>
                      <option value="gte">بزرگتر مساوی</option>
                      <option value="lt">کوچکتر</option>
                      <option value="lte">کوچکتر مساوی</option>
                      <option value="starts_with">شروع با</option>
                      <option value="ends_with">پایان با</option>
                    </select>

                    {/* Value */}
                    <input
                      type={['gt', 'gte', 'lt', 'lte'].includes(f.op) ? 'number' : 'text'}
                      value={f.val}
                      onChange={(e) => {
                        const next = [...widgetFilters]
                        next[idx] = { ...next[idx], val: e.target.value }
                        setWidgetFilters(next)
                      }}
                      placeholder="مقدار"
                      className="flex-1 px-2 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                    />

                    {/* Remove */}
                    <button
                      onClick={() => setWidgetFilters(widgetFilters.filter((_, i) => i !== idx))}
                      className="p-1 text-nx-mist hover:text-nx-danger-500 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chart Background */}
          <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-3">
            <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist">پس‌زمینه نمودار</label>
            <div>
              <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">رنگ پس‌زمینه</label>
              <div className="flex items-center gap-2">                  <input
                    type="color"
                    value={bgColor || '#ffffff'}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-nx-mist dark:border-nx-muted cursor-pointer"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    placeholder="#ffffff یا خالی برای شفاف"
                    className="flex-1 px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                  dir="ltr"
                />
                {bgColor && (
                  <button onClick={() => setBgColor('')} className="text-xs text-nx-danger-500 hover:text-nx-danger-700">پاک</button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">آدرس تصویر پس‌زمینه (URL)</label>
              <input
                type="text"
                value={bgImage}
                onChange={(e) => setBgImage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                placeholder="https://example.com/bg.png"
                dir="ltr"
              />
            </div>
          </div>

          {/* Sort & Limit */}
          {chartType !== 'table' && chartType !== 'kpi' && chartType !== 'leader_kpi' && (
            <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-3">
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist">مرتب‌سازی و محدودیت</label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">مرتب‌سازی</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                  >
                    <option value="none">بدون مرتب‌سازی</option>
                    <option value="asc">صعودی (کم به زیاد)</option>
                    <option value="desc">نزولی (زیاد به کم)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">تعداد نتایج</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={sortLimit}
                    onChange={(e) => setSortLimit(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                    placeholder="0 = بدون محدودیت"
                  />
                </div>
              </div>
              <p className="text-[10px] text-nx-mist dark:text-nx-mist">مثلاً: ۱۰ مورد برتر یا ۵ مورد آخر</p>
            </div>
          )}

          {/* Font sizes */}
          {chartType !== 'table' && (
            <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-3">
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist">اندازه فونت</label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">متن/برچسب (px)</label>
                  <input
                    type="number"
                    min={8}
                    max={32}
                    value={fontConfig.labelSize ?? ''}
                    onChange={(e) => setFontConfig({ ...fontConfig, labelSize: parseInt(e.target.value) || undefined })}
                    className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                    placeholder="۱۱"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">اعداد/مقادیر (px)</label>
                  <input
                    type="number"
                    min={8}
                    max={48}
                    value={fontConfig.valueSize ?? ''}
                    onChange={(e) => setFontConfig({ ...fontConfig, valueSize: parseInt(e.target.value) || undefined })}
                    className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                    placeholder="۱۴"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Per-series color override (bar/line/area) */}
          {(chartType === 'bar' || chartType === 'bar_horizontal' || chartType === 'stacked_bar' || chartType === 'line' || chartType === 'area') && selectedColumns.length > 1 && (
            <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-2">
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist">رنگ هر سری</label>
              {selectedColumns.slice(1).map((col) => (
                <div key={col} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={seriesColors[col] || '#6366f1'}
                    onChange={(e) => setSeriesColors({ ...seriesColors, [col]: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-nx-mist dark:border-nx-muted cursor-pointer"
                  />
                  <span className="text-xs text-nx-mist dark:text-nx-mist">{col}</span>
                  {seriesColors[col] && (
                    <button
                      onClick={() => {
                        const next = { ...seriesColors }
                        delete next[col]
                        setSeriesColors(next)
                      }}
                      className="text-xs text-nx-danger-500 hover:text-nx-danger-700 mr-auto"
                    >پاک</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Per-slice color override (pie/donut) */}
          {(chartType === 'pie' || chartType === 'donut') && (
            <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-2">
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist">رنگ هر برش</label>
              <p className="text-[10px] text-nx-mist">نام مقدار + رنگ دلخواه. مقادیر هنگام بارگذاری داده پدیدار می‌شوند.</p>
              {Object.entries(sliceColors).map(([name, color]) => (
                <div key={name} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setSliceColors({ ...sliceColors, [name]: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-nx-mist dark:border-nx-muted cursor-pointer"
                  />
                  <span className="text-xs text-nx-mist dark:text-nx-mist flex-1 truncate">{name}</span>
                  <button
                    onClick={() => {
                      const next = { ...sliceColors }
                      delete next[name]
                      setSliceColors(next)
                    }}
                    className="text-xs text-nx-danger-500 hover:text-nx-danger-700"
                  >پاک</button>
                </div>
              ))}
              <button
                onClick={() => {
                  const name = window.prompt('نام مقدار (مثلاً: شرق):')
                  if (name) setSliceColors({ ...sliceColors, [name]: '#6366f1' })
                }}
                className="text-xs text-nx-blue hover:text-nx-blue"
              >+ افزودن رنگ برای مقدار</button>
            </div>
          )}

          {/* Single color override (kpi/scatter) */}
          {(chartType === 'kpi' || chartType === 'leader_kpi' || chartType === 'scatter') && (
            <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-2">
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist">رنگ</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={singleColor || '#6366f1'}
                  onChange={(e) => setSingleColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-nx-mist dark:border-nx-muted cursor-pointer"
                />
                <input
                  type="text"
                  value={singleColor}
                  onChange={(e) => setSingleColor(e.target.value)}
                  placeholder="#6366f1"
                  className="flex-1 px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                  dir="ltr"
                />
                {singleColor && (
                  <button onClick={() => setSingleColor('')} className="text-xs text-nx-danger-500 hover:text-nx-danger-700">پاک</button>
                )}
              </div>
            </div>
          )}

          {/* Conditional formatting */}
          {(
            <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist">قالب‌بندی شرطی</label>
                <button
                  onClick={() => setCondRules([...condRules, { column: '', op: 'gt', value: 0, color: '#10b981' }])}
                  className="text-xs text-nx-blue hover:text-nx-blue"
                >+ قانون</button>
              </div>
              <p className="text-[10px] text-nx-mist">رنگ بر اساس مقدار: قانون اول برنده. برای جدول، KPI، میله‌ای و دایره‌ای.</p>
              {condRules.length === 0 && (
                <p className="text-xs text-nx-mist">هیچ قانونی تعریف نشده.</p>
              )}
              {condRules.map((rule, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-nx-navy-elevated rounded-lg p-2">
                  <input
                    type="color"
                    value={rule.color}
                    onChange={(e) => {
                      const next = [...condRules]
                      next[idx] = { ...rule, color: e.target.value }
                      setCondRules(next)
                    }}
                    className="w-7 h-7 rounded-lg border border-nx-mist dark:border-nx-muted cursor-pointer"
                  />
                  <select
                    value={rule.column}
                    onChange={(e) => {
                      const next = [...condRules]
                      next[idx] = { ...rule, column: e.target.value }
                      setCondRules(next)
                    }}
                    className="px-2 py-1 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                  >
                    <option value="">ستون...</option>
                    {selectedColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <select
                    value={rule.op}
                    onChange={(e) => {
                      const next = [...condRules]
                      next[idx] = { ...rule, op: e.target.value as ConditionalRule['op'] }
                      setCondRules(next)
                    }}
                    className="px-2 py-1 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                  >
                    <option value="gt">&gt;</option>
                    <option value="gte">≥</option>
                    <option value="lt">&lt;</option>
                    <option value="lte">≤</option>
                    <option value="eq">=</option>
                    <option value="between">بین</option>
                  </select>
                  <input
                    type="number"
                    value={rule.value}
                    onChange={(e) => {
                      const next = [...condRules]
                      next[idx] = { ...rule, value: parseFloat(e.target.value) || 0 }
                      setCondRules(next)
                    }}
                    className="w-20 px-2 py-1 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                    dir="ltr"
                  />
                  {rule.op === 'between' && (
                    <input
                      type="number"
                      value={rule.value2 ?? 0}
                      onChange={(e) => {
                        const next = [...condRules]
                        next[idx] = { ...rule, value2: parseFloat(e.target.value) || 0 }
                        setCondRules(next)
                      }}
                      className="w-20 px-2 py-1 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                      dir="ltr"
                    />
                  )}
                  <button
                    onClick={() => setCondRules(condRules.filter((_, i) => i !== idx))}
                    className="text-xs text-nx-danger-500 hover:text-nx-danger-700 mr-auto"
                  >حذف</button>
                </div>
              ))}
            </div>
          )}

          {/* Color Palette */}
          {chartType !== 'table' && (
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-2">پالت رنگ</label>
              <div className="space-y-2">
                {PRESET_PALETTES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPaletteId(p.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition ${
                      paletteId === p.id
                        ? 'border-nx-blue bg-nx-blue/10 dark:bg-nx-blue/30'
                        : 'border-nx-border dark:border-nx-muted hover:border-nx-mist dark:hover:border-nx-muted'
                    }`}
                  >
                    <div className="flex gap-0.5">
                      {p.colors.slice(0, 6).map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-nx-navy dark:text-nx-mist">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Widget Style */}
          {chartType !== 'table' && (
            <div className="border border-nx-border dark:border-nx-muted rounded-xl p-4 space-y-4">
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist">سبک نمودار</label>

              {/* Shadow */}
              <div>                  <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">سایه</label>
                <div className="flex gap-2">
                  {(['none', 'sm', 'md', 'lg'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setWidgetStyle({ ...widgetStyle, shadow: s })}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${
                        widgetStyle.shadow === s
                          ? 'border-nx-blue bg-nx-blue/10 dark:bg-nx-blue/30 text-nx-blue dark:text-nx-blue'
                          : 'border-nx-border dark:border-nx-muted text-nx-mist dark:text-nx-mist hover:border-nx-mist dark:hover:border-nx-muted'
                      }`}
                    >
                      {s === 'none' ? 'بدون' : s === 'sm' ? 'کم' : s === 'md' ? 'متوسط' : 'زیاد'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Radius */}
              <div>
                <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">گردی گوشه: {widgetStyle.borderRadius}px</label>
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={widgetStyle.borderRadius}
                  onChange={(e) => setWidgetStyle({ ...widgetStyle, borderRadius: parseInt(e.target.value) })}
                  className="w-full accent-nx-blue"
                />
              </div>

              {/* Legend Position */}
              <div>
                <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">موقعیت راهنما</label>
                <select
                  value={widgetStyle.legendPosition}
                  onChange={(e) => setWidgetStyle({ ...widgetStyle, legendPosition: e.target.value as WidgetStyle['legendPosition'] })}
                  className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                >
                  <option value="top">بالا</option>
                  <option value="bottom">پایین</option>
                  <option value="left">چپ</option>
                  <option value="right">راست</option>
                  <option value="hidden">مخفی</option>
                </select>
              </div>

              {/* Tooltip Style */}
              <div>
                <label className="block text-xs text-nx-mist dark:text-nx-mist mb-1">سبک راهنما</label>
                <div className="flex gap-2">
                  {(['light', 'dark'] as const).map((ts) => (
                    <button
                      key={ts}
                      onClick={() => setWidgetStyle({ ...widgetStyle, tooltipStyle: ts })}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${
                        widgetStyle.tooltipStyle === ts
                          ? 'border-nx-blue bg-nx-blue/10 dark:bg-nx-blue/30 text-nx-blue dark:text-nx-blue'
                          : 'border-nx-border dark:border-nx-muted text-nx-mist dark:text-nx-mist hover:border-nx-mist dark:hover:border-nx-muted'
                      }`}
                    >
                      {ts === 'light' ? 'روشن' : 'تاریک'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full py-3 bg-nx-blue text-white rounded-xl font-medium hover:bg-nx-blue transition"
          >
            ذخیره تنظیمات
          </button>
        </div>
      </div>
    </div>
  )
}
