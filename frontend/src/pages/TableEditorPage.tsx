import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowRight,
  RefreshCw,
  Settings,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Terminal,
  ShieldAlert,
  Key,
  X,
  Check,
} from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  colorSchemeDark,
} from 'ag-grid-community'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'

ModuleRegistry.registerModules([AllCommunityModule])

interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  default: string | null
  max_length: number | null
  is_pk?: boolean
}

interface CellUpdate {
  pk_column: string
  pk_value: unknown
  column: string
  value: unknown
}

export default function TableEditorPage() {
  const { source, table } = useParams<{ source: string; table: string }>()
  const user = useAuthStore((s) => s.user)
  const isMainAdmin = user?.role === 'admin' || user?.role === 'ceo' || user?.is_superuser
  const dark = useThemeStore((s) => s.dark)

  const gridTheme = useMemo(() => {
    const base = themeQuartz.withParams({
      fontFamily: 'Vazirmatn, sans-serif',
      accentColor: '#1d4ed8',
      headerFontWeight: 700,
    })
    return dark ? base.withPart(colorSchemeDark) : base
  }, [dark])

  const [rowData, setRowData] = useState<Record<string, unknown>[]>([])
  const [colDefs, setColDefs] = useState<Array<Record<string, unknown>>>([])
  const [schema, setSchema] = useState<SchemaColumn[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<CellUpdate[]>([])
  const [selectedRows, setSelectedRows] = useState<Record<string, unknown>[]>([])

  // Insert Row Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newRowForm, setNewRowForm] = useState<Record<string, string>>({})
  const [inserting, setInserting] = useState(false)

  // Delete Confirm Modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { toast } = useToast()
  const gridRef = useRef<AgGridReact>(null)
  const pageSize = 100

  const pkColumn = schema.find((c) => c.is_pk)?.name || (schema.length > 0 ? schema[0].name : 'id')

  const loadData = useCallback(async () => {
    if (!source || !table || !isMainAdmin) return
    setLoading(true)
    try {
      const [dataRes, schemaRes, countRes] = await Promise.all([
        api.get(`/db-manager/tables/${source}/${table}/data/`, {
          params: { offset: page * pageSize, limit: pageSize },
        }),
        api.get(`/db-manager/tables/${source}/${table}/schema/`),
        api.get(`/db-manager/tables/${source}/${table}/count/`),
      ])
      setRowData(dataRes.data.rows)
      setSchema(schemaRes.data)
      setTotalCount(countRes.data.count)

      const activePk = schemaRes.data.find((c: SchemaColumn) => c.is_pk)?.name ||
        (schemaRes.data.length > 0 ? schemaRes.data[0].name : 'id')

      // Build AG-Grid column definitions
      const defs: Array<Record<string, unknown>> = []

      schemaRes.data.forEach((col: SchemaColumn) => {
        const isPk = col.name === activePk
        const colLower = col.name.toLowerCase()
        const isAmount = colLower.includes('amount') || colLower.includes('price') || colLower.includes('cost') ||
          colLower.includes('debt') || colLower.includes('credit') || colLower.includes('total')
        const isDate = colLower.includes('date') || colLower.includes('_at')
        const isLetter = colLower.includes('letter')

        defs.push({
          field: col.name,
          headerName: isPk ? `${col.name} 🔑` : col.name,
          editable: !isPk, // Primary key is locked from direct editing
          minWidth: isPk ? 90 : isLetter || isDate ? 160 : isAmount ? 140 : 130,
          pinned: isPk ? 'right' : undefined,
          cellClass: isPk
            ? 'font-mono text-nx-blue font-bold bg-slate-50 dark:bg-slate-900/40 text-center'
            : isAmount
            ? 'font-mono font-medium text-emerald-700 dark:text-emerald-400'
            : isDate || isLetter
            ? 'font-mono text-xs'
            : undefined,
          valueFormatter: isAmount
            ? (p: { value: unknown }) =>
                p.value !== null && p.value !== undefined && p.value !== '' && !isNaN(Number(p.value))
                  ? Number(p.value).toLocaleString('fa-IR')
                  : (p.value ?? '—')
            : undefined,
        })
      })

      setColDefs(defs)
    } catch {
      toast('خطا در بارگذاری داده‌های جدول', 'error')
    } finally {
      setLoading(false)
    }
  }, [source, table, page, isMainAdmin, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Track cell modifications accurately
  const handleCellValueChanged = useCallback(
    (event: { colDef: { field?: string }; data: Record<string, unknown>; newValue: unknown }) => {
      const col = event.colDef.field
      if (!col || col === pkColumn) return

      const pkVal = event.data[pkColumn]

      setPendingChanges((prev) => {
        const filtered = prev.filter((c) => !(c.pk_value === pkVal && c.column === col))
        return [
          ...filtered,
          {
            pk_column: pkColumn,
            pk_value: pkVal,
            column: col,
            value: event.newValue,
          },
        ]
      })
    },
    [pkColumn]
  )

  // Save all pending cell changes
  const saveChanges = async () => {
    if (!source || !table || pendingChanges.length === 0) return
    setSaving(true)
    try {
      await api.patch(`/db-manager/tables/${source}/${table}/batch/`, {
        updates: pendingChanges,
      })
      toast(`${pendingChanges.length} تغییر سلول با موفقیت در دیتابیس اعمال شد`, 'success')
      setPendingChanges([])
      loadData()
    } catch {
      toast('خطا در ذخیره تغییرات دیتابیس', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle row insertion
  const handleInsertRow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!source || !table) return
    setInserting(true)
    try {
      // Clean empty string values for optional columns
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(newRowForm)) {
        if (v.trim() !== '') {
          payload[k] = v.trim()
        }
      }

      await api.post(`/db-manager/tables/${source}/${table}/rows/`, payload)
      toast('سطر جدید با موفقیت درج شد', 'success')
      setShowAddModal(false)
      setNewRowForm({})
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در درج سطر جدید'
      toast(msg, 'error')
    } finally {
      setInserting(false)
    }
  }

  // Handle row deletion
  const handleDeleteSelected = async () => {
    if (!source || !table || selectedRows.length === 0) return
    setDeleting(true)
    try {
      const pkValues = selectedRows.map((r) => r[pkColumn]).filter((v) => v !== undefined && v !== null)
      await api.delete(`/db-manager/tables/${source}/${table}/rows/delete/`, {
        data: {
          pk_column: pkColumn,
          pk_values: pkValues,
        },
      })
      toast(`${pkValues.length} سطر با موفقیت از جدول حذف شد`, 'success')
      setShowDeleteConfirm(false)
      setSelectedRows([])
      loadData()
    } catch {
      toast('خطا در حذف سطرها', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Export CSV
  const exportCsv = () => {
    if (rowData.length === 0 || schema.length === 0) return
    const cols = schema.map((c) => c.name)
    const header = cols.join(',')
    const rows = rowData.map((row) => cols.map((c) => JSON.stringify(row[c] ?? '')).join(',')).join('\n')
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${table}_export.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('فایل CSV با موفقیت دانلود شد', 'success')
  }

  if (!isMainAdmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-nx-navy flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full bg-slate-50 dark:bg-nx-navy-elevated border border-rose-200 dark:border-rose-900/40 rounded-3xl p-8 text-center shadow-lg">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">دسترسی غیرمجاز</h2>
          <p className="text-sm text-slate-600 dark:text-nx-mist mb-6 leading-relaxed">
            ویرایش جداول پایگاه داده منحصراً برای ادمین ارشد سیستم مجاز است.
          </p>
          <Link
            to="/launcher"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-nx-blue text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition"
          >
            بازگشت به لانچر
          </Link>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="h-screen bg-slate-50 dark:bg-nx-navy flex flex-col overflow-hidden" dir="rtl">
      {/* Header — with iPhone notch safe-area */}
      <header className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-4 sm:px-6 pt-[max(0.875rem,calc(env(safe-area-inset-top,0px)+0.875rem))] pb-3.5 shrink-0 transition-all">
        <div className="max-w-full mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/db-manager"
              className="p-2 text-nx-mist hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-nx-navy dark:text-slate-100 font-mono" dir="ltr">
                  {table}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-nx-blue dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                  <Key className="w-3 h-3" />
                  PK: {pkColumn}
                </span>
                <span className="text-xs text-slate-400">
                  ({source === 'local' ? 'PostgreSQL Local' : `External: ${source}`})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-nx-mist mt-0.5">
                مجموع ردیف‌ها: {totalCount.toLocaleString()} · تعداد ستون‌ها: {schema.length} · برای ویرایش مقادیر روی هر سلول دوبار کلیک کنید
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {pendingChanges.length > 0 && (
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-sm animate-pulse"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                ذخیره تغییرات ({pendingChanges.length})
              </button>
            )}

            <button
              onClick={() => {
                setNewRowForm({})
                setShowAddModal(true)
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-nx-blue text-white rounded-xl hover:bg-blue-600 transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              افزودن سطر جدید
            </button>

            {selectedRows.length > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                حذف ({selectedRows.length}) سطر
              </button>
            )}

            <Link
              to={`/db-manager/sql?source=${source}&query=${encodeURIComponent(`SELECT * FROM "${table}" LIMIT 100;`)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist rounded-xl hover:bg-slate-200 transition"
              title="باز کردن در کنسول SQL"
            >
              <Terminal className="w-3.5 h-3.5" />
              کنسول SQL
            </Link>

            <Link
              to={`/db-manager/table/${source}/${table}/schema`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist rounded-xl hover:bg-slate-200 transition"
            >
              <Settings className="w-3.5 h-3.5" />
              اسکیما
            </Link>

            <button
              onClick={exportCsv}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-nx-mist rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="خروجی CSV"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={loadData}
              className="p-2 text-slate-500 hover:text-nx-blue rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="بازخوانی داده‌ها"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-nx-blue' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* AG Grid Studio Container */}
      <div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 bg-white dark:bg-nx-navy-elevated border border-nx-border dark:border-nx-navy-border rounded-2xl overflow-hidden flex flex-col shadow-sm min-h-0">
          <div className="flex-1 w-full h-full min-h-[400px]" dir="rtl" style={{ height: '100%', width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              theme={gridTheme}
              enableRtl={true}
              rowData={rowData}
              columnDefs={colDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 120,
              }}
              rowSelection={{ mode: 'multiRow' }}
              onCellValueChanged={handleCellValueChanged}
              onSelectionChanged={() => {
                if (gridRef.current?.api) {
                  const nodes = gridRef.current.api.getSelectedNodes()
                  setSelectedRows(nodes.map((n) => n.data).filter(Boolean))
                }
              }}
              enableCellTextSelection={true}
              loading={loading}
              pagination={false}
              getRowId={(params) => String(params.data[pkColumn] ?? Math.random())}
              overlayNoRowsTemplate='<span style="font-family: Vazirmatn; font-size: 13px; color: #64748b;">هیچ داده‌ای در این جدول یافت نشد</span>'
              overlayLoadingTemplate='<span style="font-family: Vazirmatn; font-size: 13px; color: #2563eb;">در حال بارگذاری داده‌ها...</span>'
            />
          </div>

          {/* Pagination Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-nx-border dark:border-nx-navy-border bg-slate-50 dark:bg-nx-navy-elevated shrink-0">
            <div className="text-xs text-slate-500 dark:text-nx-mist">
              صفحه {page + 1} از {totalPages} · نمایش ردیف‌های {page * pageSize + 1} تا{' '}
              {Math.min((page + 1) * pageSize, totalCount)} از مجموع {totalCount.toLocaleString()} سطر
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-nx-navy-border text-slate-600 dark:text-nx-mist hover:text-nx-blue disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 dark:text-white px-2">{page + 1}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-nx-navy-border text-slate-600 dark:text-nx-mist hover:text-nx-blue disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Row Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-nx-navy-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-nx-blue flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">درج سطر جدید در جدول {table}</h3>
                  <p className="text-xs text-slate-500 dark:text-nx-mist">مقادیر فیلدهای مورد نظر را وارد نمایید</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInsertRow} className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {schema.map((col) => {
                  const isPk = col.name === pkColumn
                  return (
                    <div key={col.name} className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                        <span className="font-mono" dir="ltr">
                          {col.name} {isPk && '🔑 (PK)'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {col.type} {!col.nullable && '· اجباری'}
                        </span>
                      </label>
                      <input
                        type="text"
                        placeholder={isPk && col.default ? 'تولید خودکار (اختیاری)' : col.default ? `پیش‌فرض: ${col.default}` : ''}
                        value={newRowForm[col.name] ?? ''}
                        onChange={(e) =>
                          setNewRowForm((prev) => ({
                            ...prev,
                            [col.name]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-nx-navy border border-slate-200 dark:border-nx-navy-border rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-nx-blue outline-none"
                      />
                    </div>
                  )
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-nx-navy-border flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-nx-mist hover:bg-slate-100 rounded-xl transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={inserting}
                  className="px-5 py-2 text-xs font-semibold bg-nx-blue text-white rounded-xl hover:bg-blue-600 transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {inserting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  ثبت سطر جدید
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-nx-navy-elevated border border-rose-200 dark:border-rose-900/40 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              تأیید حذف {selectedRows.length} سطر از جدول
            </h3>
            <p className="text-xs text-slate-500 dark:text-nx-mist mb-6 leading-relaxed">
              آیا از حذف سطرهای انتخابی از جدول <span className="font-mono font-bold">{table}</span> اطمینان دارید؟ این عمل غیرقابل بازگشت است.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-nx-mist hover:bg-slate-100 rounded-xl transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-5 py-2 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                بله، حذف کن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
