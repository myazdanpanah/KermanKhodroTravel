import { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboardStore, controlFiltersToQuery, type DashboardFilterControl } from '../store/dashboardStore'
import { X, Plus, Filter, ChevronDown, ChevronUp, Calendar, Search, CheckSquare, Sliders, Trash2, Shield, RotateCcw } from 'lucide-react'
import api from '../api/client'
import { useAuthStore } from '../store/authStore'

interface Dataset {
  id: number
  name: string
  column_names: string[]
  column_types: Record<string, string>
}

const CONTROL_TYPES = [
  { value: 'dropdown', label: 'لیست کشویی', icon: ChevronDown },
  { value: 'date_range', label: 'محدوده تاریخ', icon: Calendar },
  { value: 'text_search', label: 'جستجوی متن', icon: Search },
  { value: 'checkbox', label: 'چک‌باکس', icon: CheckSquare },
  { value: 'slider', label: 'اسلایدر', icon: Sliders },
] as const

const FILTER_ROLE_OPTIONS = [
  { value: 'ceo', label: 'مدیرعامل' },
  { value: 'finance', label: 'مالی' },
  { value: 'sales', label: 'فروش' },
  { value: 'admin', label: 'مدیر سیستم' },
]

function generateId(): string {
  return `fc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default function DashboardFilterBar() {
  const {
    filterControls,
    setFilterControls,
    addFilterControl,
    updateFilterControl,
    removeFilterControl,
    clearFilters,
    filters,
    removeFilter,
    widgets,
    pages,
  } = useDashboardStore()

  const dashboardId = useDashboardStore((s) => s.dashboardId)
  const activePageId = useDashboardStore((s) => s.activePageId)
  const updatePage = useDashboardStore((s) => s.updatePage)
  const hasLoadedRef = useRef(false)
  const lastPersistedRef = useRef('')
  const [expanded, setExpanded] = useState(true)
  const [addingControl, setAddingControl] = useState(false)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [newControlCol, setNewControlCol] = useState('')
  const [newControlType, setNewControlType] = useState<DashboardFilterControl['type']>('dropdown')
  const [newControlLabel, setNewControlLabel] = useState('')
  const [newControlDatasetId, setNewControlDatasetId] = useState<number | null>(null)
  const [newControlRoles, setNewControlRoles] = useState<string[]>([])
  const [editingFilterRoles, setEditingFilterRoles] = useState<string | null>(null)
  const editingFilterRef = useRef<HTMLDivElement>(null)

  // Close filter role popover on outside click
  useEffect(() => {
    if (!editingFilterRoles) return
    const handler = (e: MouseEvent) => {
      if (editingFilterRef.current && !editingFilterRef.current.contains(e.target as Node)) {
        setEditingFilterRoles(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [editingFilterRoles])

  // Get unique dataset IDs from widgets — prefer the active page's widgets
  // (top-level `widgets` stays empty for dashboards that use pages).
  const activePageWidgets = pages.find((p) => p.id === activePageId)?.widgets || widgets
  const datasetIds = [...new Set(activePageWidgets.map((w) => w.datasetId).filter(Boolean))] as number[]

  useEffect(() => {
    fetchDatasets()
  }, [])

  // Persist filter controls to backend on user edits (skip initial mount and page switches)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      return
    }
    const json = JSON.stringify(filterControls)
    if (json === lastPersistedRef.current) return // Skip redundant PUTs (e.g. from page switches)
    lastPersistedRef.current = json
    if (activePageId) {
      updatePage(activePageId, { filterControls: [...filterControls] })
    }
    if (dashboardId && activePageId) {
      api.put(`/dashboards/${dashboardId}/pages/${activePageId}/`, {
        filter_controls: filterControls,
      }).catch(() => {})
    }
  }, [filterControls, dashboardId, activePageId, updatePage])

  const fetchDatasets = async () => {
    try {
      const res = await api.get('/datasets/')
      setDatasets(res.data as Dataset[])
    } catch {
      // ignore
    }
  }

  // Fetch unique values for dropdown/checkbox controls
  const fetchUniqueValues = useCallback(async (datasetId: number, col: string): Promise<string[]> => {
    try {
      const res = await api.post(`/datasets/${datasetId}/query/`, {
        columns: [col],
        metrics: {},
      })
      const rows = res.data.data as Record<string, unknown>[]
      const uniqueVals = [...new Set(rows.map((r) => String(r[col] ?? '')))]
      return uniqueVals.sort()
    } catch {
      return []
    }
  }, [])

  // Fetch min/max for slider controls
  const fetchNumericRange = useCallback(async (datasetId: number, col: string): Promise<{ min: number; max: number }> => {
    try {
      const res = await api.post(`/datasets/${datasetId}/query/`, {
        columns: [col],
        metrics: { [col]: 'MIN' },
      })
      const min = Number(res.data.data[0]?.[col]) || 0
      const resMax = await api.post(`/datasets/${datasetId}/query/`, {
        columns: [col],
        metrics: { [col]: 'MAX' },
      })
      const max = Number(resMax.data.data[0]?.[col]) || 100
      return { min, max }
    } catch {
      return { min: 0, max: 100 }
    }
  }, [])

  const handleAddControl = async () => {
    if (!newControlCol || !newControlDatasetId) return

    const ds = datasets.find((d) => d.id === newControlDatasetId)
    const colType = (ds?.column_types[newControlCol] || '').toUpperCase()
    const isDate = colType.includes('TIMESTAMP') || colType.includes('DATE') || colType.includes('TIME')
    const isNumeric = ['BIGINT', 'INTEGER', 'SMALLINT', 'DOUBLE PRECISION', 'REAL', 'NUMERIC', 'DECIMAL', 'FLOAT', 'INT64', 'FLOAT64'].includes(colType)

    // Auto-select type based on column type
    let autoType = newControlType
    if (isDate) autoType = 'date_range'
    else if (isNumeric) autoType = 'slider'

    const control: DashboardFilterControl = {
      id: generateId(),
      col: newControlCol,
      type: autoType,
      label: newControlLabel || newControlCol,
      datasetId: newControlDatasetId,
      value: null,
    }

    // Pre-fetch options for dropdown/checkbox
    if (autoType === 'dropdown' || autoType === 'checkbox') {
      const options = await fetchUniqueValues(newControlDatasetId, newControlCol)
      control.options = options
      if (autoType === 'checkbox') {
        control.multiSelect = true
      }
    }

    // Pre-fetch range for slider
    if (autoType === 'slider') {
      const range = await fetchNumericRange(newControlDatasetId, newControlCol)
      control.min = range.min
      control.max = range.max
      control.step = Math.max(1, Math.round((range.max - range.min) / 100))
      control.value = [range.min, range.max]
    }

    // Apply selected role restrictions to the new filter control
    if (newControlRoles.length > 0) {
      control.allowedRoles = newControlRoles
    }

    addFilterControl(control)
    setAddingControl(false)
    setNewControlCol('')
    setNewControlType('dropdown')
    setNewControlLabel('')
    setNewControlDatasetId(null)
    setNewControlRoles([])
  }

  const handleControlValueChange = (controlId: string, value: string | number | string[] | [number, number] | null) => {
    updateFilterControl(controlId, { value: value as DashboardFilterControl['value'] })
  }

  // Compute active control filters using shared utility
  const activeControlFilters = controlFiltersToQuery(filterControls)

  // Find which dataset to show columns for
  const selectedDs = newControlDatasetId ? datasets.find((d) => d.id === newControlDatasetId) : null
  const dsForNewControl = selectedDs || (datasets.find((d) => datasetIds.includes(d.id)))

  // Enforce filter-level access: only show controls the current user's role has access to
  const userRole = useAuthStore((s) => s.user?.role)
  const visibleControls = filterControls.filter((c) => {
    if (!c.allowedRoles || c.allowedRoles.length === 0) return true
    if (!userRole) return false
    return c.allowedRoles.includes(userRole)
  })

  const hasActiveFilters = activeControlFilters.length > 0 || filters.length > 0

  // Find widget title by id for filter origin tooltip
  const allWidgets = pages.flatMap((p) => p.widgets)
  const getWidgetTitle = (widgetId: string) => {
    const w = allWidgets.find((w) => w.id === widgetId)
    return w?.title || widgetId
  }

  return (
    <div className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border" dir="rtl">
      {/* Filter bar header + inline active filter items */}
      <div className="flex items-center gap-2 px-6 py-2 flex-wrap">
        <Filter className="w-4 h-4 text-nx-mist dark:text-nx-muted flex-shrink-0" />
        <span className="text-sm font-medium text-nx-muted dark:text-nx-mist flex-shrink-0">فیلترها</span>

        {/* Inline active control filters — shown directly in the bar */}
        {filterControls
          .filter((c) => c.value !== null && c.value !== '' && c.value !== undefined)
          .map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-nx-blue/10 dark:bg-nx-blue/30 text-nx-blue dark:text-nx-blue rounded-full text-xs border border-nx-blue/10 dark:border-nx-blue"
            >
              <span className="font-medium">{c.label}:</span>
              <span>
                {c.type === 'slider' && Array.isArray(c.value)
                  ? `${c.value[0]} – ${c.value[1]}`
                  : c.type === 'checkbox' && Array.isArray(c.value)
                  ? c.value.join(', ')
                  : String(c.value)}
              </span>
              <button
                onClick={() => handleControlValueChange(c.id, null)}
                className="hover:text-nx-blue dark:hover:text-nx-blue/10 ml-0.5"
                title="حذف فیلتر"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

        {/* Inline cross-chart filters — with origin tooltip */}
        {filters.map((f, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-nx-warning-50 dark:bg-nx-warning-900/30 text-nx-warning-700 dark:text-nx-warning-300 rounded-full text-xs border border-nx-warning-200 dark:border-nx-warning-700"
            title={`فیلتر اعمال شده توسط: ${getWidgetTitle(f.sourceWidgetId)}`}
          >
            <span className="font-medium">{f.col}:</span>
            <span>{String(f.val)}</span>
            <button
              onClick={() => removeFilter(f.col)}
              className="hover:text-nx-warning-900 dark:hover:text-nx-warning-100 ml-0.5"
              title="حذف فیلتر"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Clear all button — right next to filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterControls(filterControls.map((c) => ({ ...c, value: null })))
              clearFilters()
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-nx-danger-500 hover:text-nx-danger-700 dark:text-nx-danger-400 dark:hover:text-nx-danger-300 transition flex-shrink-0"
            title="پاک کردن همه فیلترها"
          >
            <RotateCcw className="w-3 h-3" />
            پاک کردن
          </button>
        )}

        {/* Expand/collapse toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-nx-mist hover:text-nx-muted dark:hover:text-nx-mist transition flex-shrink-0"
          title={expanded ? 'بستن تنظیمات فیلتر' : 'باز کردن تنظیمات فیلتر'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div className="px-6 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            {visibleControls.map((control) => (
                <div key={control.id} className="relative">
                  <FilterControlWidget
                    control={control}
                    onChange={(value) => handleControlValueChange(control.id, value)}
                  />
                  {/* Filter access indicator */}
                  {control.allowedRoles && control.allowedRoles.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-nx-warning-100 text-nx-warning-600 rounded-full flex items-center justify-center z-10" title={`فقط برای: ${control.allowedRoles.join(', ')}`}>
                      <Shield className="w-2 h-2" />
                    </span>
                  )}
                  <button
                    onClick={() => setEditingFilterRoles(editingFilterRoles === control.id ? null : control.id)}
                    className="absolute -top-1.5 left-6 w-4 h-4 bg-nx-warning-100 hover:bg-nx-warning-200 text-nx-warning-600 rounded-full flex items-center justify-center text-[8px] transition z-10"
                    title="دسترسی فیلتر"
                  >
                    <Shield className="w-2 h-2" />
                  </button>
                  <button
                    onClick={() => removeFilterControl(control.id)}
                    className="absolute -top-1 -left-1 w-4 h-4 bg-nx-mist/20 hover:bg-nx-danger-400 hover:text-white rounded-full flex items-center justify-center text-[8px] text-nx-muted transition z-10"
                    title="حذف فیلتر"
                  >
                    <Trash2 className="w-2 h-2" />
                  </button>
                  {/* Inline role picker for filter */}
                  {editingFilterRoles === control.id && (
                    <div ref={editingFilterRef} className="absolute top-full left-0 mt-1 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted rounded-lg shadow-lg p-2 z-50 min-w-[140px]">
                      <div className="text-[10px] font-medium text-nx-muted dark:text-nx-mist mb-1">دسترسی فیلتر:</div>
                      {FILTER_ROLE_OPTIONS.map((r) => (
                        <label key={r.value} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-white dark:hover:bg-nx-navy cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!control.allowedRoles || control.allowedRoles.length === 0 || control.allowedRoles.includes(r.value)}
                            onChange={(e) => {
                              const current = control.allowedRoles || []
                              const allRoles = FILTER_ROLE_OPTIONS.map((x) => x.value)
                              let newRoles: string[]
                              if (e.target.checked) {
                                newRoles = [...current, r.value]
                                if (newRoles.length === allRoles.length) newRoles = []
                              } else {
                                newRoles = current.filter((x) => x !== r.value)
                              }
                              updateFilterControl(control.id, { allowedRoles: newRoles })
                            }}
                            className="w-3 h-3 text-nx-blue rounded border-nx-mist dark:border-nx-muted focus:ring-nx-blue"
                          />
                          <span className="text-[10px] text-nx-muted dark:text-nx-mist">{r.label}</span>
                        </label>
                      ))}
                      <p className="text-[9px] text-nx-mist mt-1">بدون انتخاب = همه</p>
                    </div>
                  )}
                </div>
            ))}

            {/* Add control button */}
            {!addingControl ? (
              <button
                onClick={() => setAddingControl(true)}
                className="flex items-center gap-1.5 px-3 py-2 border-2 border-dashed border-nx-mist dark:border-nx-muted rounded-xl text-sm text-nx-muted hover:border-nx-blue hover:text-nx-blue transition"
              >
                <Plus className="w-4 h-4" />
                افزودن فیلتر
              </button>
            ) : (
              <div className="bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted rounded-xl p-3 space-y-2 min-w-[280px]">
                <div className="text-xs font-medium text-nx-navy dark:text-nx-mist">فیلتر جدید</div>

                {/* Dataset selector */}
                <select
                  value={newControlDatasetId || ''}
                  onChange={(e) => setNewControlDatasetId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-2 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                >
                  <option value="">مجموعه داده...</option>
                  {datasets.filter((d) => datasetIds.includes(d.id)).map((ds) => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>

                {/* Column selector */}
                {dsForNewControl && (
                  <select
                    value={newControlCol}
                    onChange={(e) => setNewControlCol(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                  >
                    <option value="">ستون...</option>
                    {dsForNewControl.column_names.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                )}

                {/* Type selector */}
                <select
                  value={newControlType}
                  onChange={(e) => setNewControlType(e.target.value as DashboardFilterControl['type'])}
                  className="w-full px-2 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                >
                  {CONTROL_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>

                {/* Label */}
                <input
                  type="text"
                  value={newControlLabel}
                  onChange={(e) => setNewControlLabel(e.target.value)}
                  placeholder="برچسب (اختیاری)"
                  className="w-full px-2 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/20 text-xs focus:ring-1 focus:ring-nx-blue outline-none"
                />

                {/* Filter access control */}
                <div>
                  <div className="text-[10px] text-nx-muted dark:text-nx-mist mb-1 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    دسترسی فیلتر (اختیاری)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FILTER_ROLE_OPTIONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setNewControlRoles((prev) => prev.includes(r.value) ? prev.filter((v) => v !== r.value) : [...prev, r.value])}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${
                          newControlRoles.includes(r.value)
                            ? 'bg-nx-blue/10 dark:bg-nx-blue/40 text-nx-blue dark:text-nx-blue border-nx-blue dark:border-nx-blue'
                            : 'bg-white dark:bg-nx-navy text-nx-mist dark:text-nx-muted border-nx-border dark:border-nx-muted'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-nx-mist mt-0.5">بدون انتخاب = همه</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddControl}
                    disabled={!newControlCol || !newControlDatasetId}
                    className="flex-1 py-1.5 bg-nx-blue text-white text-xs rounded-lg hover:bg-nx-blue transition disabled:opacity-50"
                  >
                    افزودن
                  </button>
                  <button
                    onClick={() => setAddingControl(false)}
                    className="px-3 py-1.5 text-nx-muted dark:text-nx-mist text-xs rounded-lg hover:bg-nx-mist/10 dark:hover:bg-nx-navy transition"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Individual filter control widget */
function FilterControlWidget({
  control,
  onChange,
}: {
  control: DashboardFilterControl
  onChange: (value: string | number | string[] | [number, number] | null) => void
}) {
  if (control.type === 'dropdown') {
    return (
      <div className="min-w-[160px]">
        <label className="block text-[10px] text-nx-muted mb-0.5 font-medium">{control.label}</label>
        <div className="relative">
          <select
            value={String(control.value || '')}
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full px-2 py-1.5 pr-6 rounded-lg border border-nx-mist dark:border-nx-muted text-xs bg-white dark:bg-nx-navy dark:text-nx-mist/20 focus:ring-1 focus:ring-nx-blue outline-none appearance-none"
          >
            <option value="">همه</option>
            {(control.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-nx-mist pointer-events-none" />
          {control.value && (
            <button
              onClick={() => onChange(null)}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-nx-mist hover:text-nx-muted"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    )
  }

  if (control.type === 'date_range') {
    const val = control.value as [number, number] | null
    const startStr = val ? new Date(val[0]).toISOString().split('T')[0] : ''
    const endStr = val ? new Date(val[1]).toISOString().split('T')[0] : ''
    return (
      <div className="min-w-[240px]">
        <label className="block text-[10px] text-nx-muted mb-0.5 font-medium">{control.label}</label>
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={startStr}
            onChange={(e) => {
              const start = e.target.value ? new Date(e.target.value).getTime() : null
              if (start !== null && val) onChange([start, val[1]])
              else if (start !== null) onChange([start, Date.now()])
            }}
            className="flex-1 px-2 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted text-xs focus:ring-1 focus:ring-nx-blue outline-none"
          />
          <span className="text-nx-mist text-xs">تا</span>
          <input
            type="date"
            value={endStr}
            onChange={(e) => {
              const end = e.target.value ? new Date(e.target.value).getTime() + 86400000 : null
              if (end !== null && val) onChange([val[0], end])
              else if (end !== null) onChange([0, end])
            }}
            className="flex-1 px-2 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted text-xs focus:ring-1 focus:ring-nx-blue outline-none"
          />
        </div>
      </div>
    )
  }

  if (control.type === 'text_search') {
    return (
      <div className="min-w-[160px]">
        <label className="block text-[10px] text-nx-muted mb-0.5 font-medium">{control.label}</label>
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-nx-mist pointer-events-none" />
          <input
            type="text"
            value={String(control.value || '')}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder="جستجو..."
            className="w-full pr-7 pl-6 py-1.5 rounded-lg border border-nx-mist dark:border-nx-muted text-xs focus:ring-1 focus:ring-nx-blue outline-none"
          />
          {control.value && (
            <button
              onClick={() => onChange(null)}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-nx-mist hover:text-nx-muted"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    )
  }

  if (control.type === 'checkbox') {
    const selected = (control.value as string[] | null) || []
    return (
      <div className="min-w-[160px]">
        <label className="block text-[10px] text-nx-muted mb-0.5 font-medium">{control.label}</label>
        <div className="max-h-32 overflow-y-auto border border-nx-mist dark:border-nx-muted rounded-lg p-1.5 space-y-0.5">
          {(control.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-white dark:hover:bg-nx-navy cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  const next: string[] = e.target.checked
                    ? [...selected, opt]
                    : selected.filter((s) => s !== opt)
                  onChange(next.length > 0 ? (next as string[]) : null)
                }}
                className="w-3 h-3 text-nx-blue rounded border-nx-mist dark:border-nx-muted focus:ring-nx-blue"
              />
              <span className="text-xs text-nx-navy dark:text-nx-mist truncate">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (control.type === 'slider') {
    const val = control.value as [number, number] | null
    const min = control.min ?? 0
    const max = control.max ?? 100
    const currentMin = val ? val[0] : min
    const currentMax = val ? val[1] : max
    return (
      <div className="min-w-[200px]">
        <label className="block text-[10px] text-nx-muted mb-0.5 font-medium">
          {control.label}: {currentMin} – {currentMax}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={currentMin}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange([v, currentMax])
            }}
            className="w-16 px-1.5 py-1 rounded border border-nx-mist dark:border-nx-muted text-xs text-center focus:ring-1 focus:ring-nx-blue outline-none"
          />
          <input
            type="range"
            min={min}
            max={max}
            step={control.step || 1}
            value={currentMax}
            onChange={(e) => onChange([currentMin, Number(e.target.value)])}
            className="flex-1 accent-nx-blue"
          />
          <input
            type="number"
            value={currentMax}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange([currentMin, v])
            }}
            className="w-16 px-1.5 py-1 rounded border border-nx-mist dark:border-nx-muted text-xs text-center focus:ring-1 focus:ring-nx-blue outline-none"
          />
        </div>
      </div>
    )
  }

  return null
}
