import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Play,
  RefreshCw,
  Copy,
  Download,
  Table,
  Search,
  ChevronRight,
  ChevronLeft,
  Terminal,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { useAuthStore } from '../store/authStore'

export default function SqlEditorPage() {
  const [searchParams] = useSearchParams()
  const [sqlText, setSqlText] = useState('')
  const [source, setSource] = useState('local')
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([
    { id: 'local', name: 'PostgreSQL اصلی سامانه (Local)' },
  ])
  const [tables, setTables] = useState<string[]>([])
  const [tableSearch, setTableSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [result, setResult] = useState<{
    columns?: string[]
    data?: Record<string, unknown>[]
    row_count?: number
    rows_affected?: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const isMainAdmin = user?.role === 'admin' || user?.role === 'ceo' || user?.is_superuser

  // Read URL params
  useEffect(() => {
    const q = searchParams.get('query')
    if (q) setSqlText(q)
    const s = searchParams.get('source')
    if (s) setSource(s)
  }, [searchParams])

  // Load tables & external sources
  useEffect(() => {
    if (!isMainAdmin) return
    loadSourcesAndTables(source)
  }, [isMainAdmin, source])

  const loadSourcesAndTables = async (src: string) => {
    try {
      const [tablesRes, dbsRes] = await Promise.allSettled([
        api.get(`/db-manager/databases/${src}/tables/`),
        api.get('/db-manager/databases/'),
      ])

      if (tablesRes.status === 'fulfilled') {
        setTables(tablesRes.value.data)
      }
      if (dbsRes.status === 'fulfilled') {
        const ext = dbsRes.value.data
          .filter((d: { type: string }) => d.type === 'external')
          .map((d: { source: string; name: string }) => ({ id: d.source, name: d.name }))
        setSources([{ id: 'local', name: 'PostgreSQL اصلی سامانه (Local)' }, ...ext])
      }
    } catch {
      // Ignored
    }
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
            کنسول اجرای دستورات SQL منحصراً در اختیار ادمین اصلی سیستم (Super Admin) قرار دارد.
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

  const executeQuery = async () => {
    if (!sqlText.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.post('/db-manager/sql/', { source, sql: sqlText.trim() })
      setResult(res.data)
      setHistory((prev) => [sqlText.trim(), ...prev.filter((h) => h !== sqlText.trim()).slice(0, 19)])
      if (res.data.rows_affected !== undefined) {
        toast(`دستور با موفقیت اجرا شد (${res.data.rows_affected} سطر تأثیر یافت)`, 'success')
      }
    } catch (err: unknown) {
      const respError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      const msg = respError || (err instanceof Error ? err.message : 'خطا در اجرای کوئری')
      setError(msg)
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Keyboard shortcut Ctrl+Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      executeQuery()
    }
  }

  const exportCsv = () => {
    if (!result?.data || !result?.columns) return
    const header = result.columns.join(',')
    const rows = result.data
      .map((row) => result.columns!.map((c) => JSON.stringify(row[c] ?? '')).join(','))
      .join('\n')
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'query-result.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast('فایل CSV با موفقیت دانلود شد', 'success')
  }

  const copyToClipboard = () => {
    if (!result?.data || !result?.columns) return
    const header = result.columns.join('\t')
    const rows = result.data
      .map((row) => result.columns!.map((c) => String(row[c] ?? '')).join('\t'))
      .join('\n')
    navigator.clipboard.writeText(header + '\n' + rows)
    toast('نتایج در کلیپبورد کپی شد', 'success')
  }

  const filteredTables = tables.filter((t) => t.toLowerCase().includes(tableSearch.toLowerCase()))

  return (
    <div className="min-h-screen bg-white dark:bg-nx-navy flex flex-col" dir="rtl" onKeyDown={handleKeyDown}>
      {/* Top Header — with iPhone notch safe-area */}
      <header className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-4 sm:px-6 pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-3 shrink-0 transition-all">
        <div className="max-w-full mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/db-manager"
              className="p-2 text-nx-mist hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-nx-blue flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-nx-navy dark:text-slate-100">
                کنسول مدیریت و اجرای کوئری SQL (SSMS Studio)
              </h1>
              <p className="text-[11px] text-slate-400">
                اجرای مستقیم فرامین DML/SELECT روی PostgreSQL با پشتیبانی از کلید میانبر (Ctrl + Enter)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-nx-navy-border bg-slate-50 dark:bg-nx-navy-elevated text-slate-800 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-nx-blue"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <button
              onClick={executeQuery}
              disabled={loading || !sqlText.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-bold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>اجرا (Execute)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Body: Sidebar (Object Explorer) + Editor/Results */}
      <div className="flex-1 flex overflow-hidden">
        {/* Object Explorer Sidebar (SSMS-like) */}
        <aside
          className={`bg-slate-50 dark:bg-nx-navy-elevated border-l border-slate-200 dark:border-nx-navy-border flex flex-col transition-all duration-200 shrink-0 ${
            sidebarOpen ? 'w-64' : 'w-10'
          }`}
        >
          {sidebarOpen ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-nx-navy-border flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-nx-blue" />
                  جداول پایگاه داده ({tables.length})
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  title="بستن سایدبار"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Table search */}
              <div className="p-2.5 border-b border-slate-200 dark:border-nx-navy-border shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="فیلتر نام جدول..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-full pr-8 pl-2 py-1.5 bg-white dark:bg-nx-navy border border-slate-200 dark:border-nx-navy-border rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-nx-blue"
                  />
                </div>
              </div>

              {/* Table list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredTables.map((tbl) => (
                  <div
                    key={tbl}
                    className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition text-xs font-mono"
                    dir="ltr"
                  >
                    <button
                      onClick={() => setSqlText(`SELECT * FROM "${tbl}" LIMIT 100;`)}
                      className="flex-1 text-left truncate text-slate-700 dark:text-nx-mist hover:text-nx-blue"
                      title={`ایجاد SELECT برای ${tbl}`}
                    >
                      {tbl}
                    </button>
                    <Link
                      to={`/db-manager/table/${source}/${tbl}`}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-nx-blue hover:underline px-1 shrink-0"
                      title="مشاهده در جدول"
                    >
                      ویرایش
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4 flex flex-col items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                title="باز کردن سایدبار جداول"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          )}
        </aside>

        {/* Right workspace: Editor + Results */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          {/* CodeMirror SQL Editor */}
          <div className="border border-slate-700 rounded-2xl overflow-hidden shadow-xs shrink-0" style={{ height: '220px' }}>
            <CodeMirror
              value={sqlText}
              onChange={(val) => setSqlText(val)}
              extensions={[sql()]}
              theme={oneDark}
              height="220px"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                foldGutter: true,
                autocompletion: true,
              }}
              placeholder="-- کوئری SQL خود را بنویسید (مثال: SELECT * FROM accounts_user LIMIT 50;)"
            />
          </div>

          {/* Quick Query Templates */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              قالب‌های سریع:
            </span>
            <button
              onClick={() => setSqlText('SELECT * FROM "accounts_user" LIMIT 50;')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-100 dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist hover:bg-slate-200 transition shrink-0"
            >
              SELECT users
            </button>
            <button
              onClick={() => setSqlText('SELECT * FROM "billing_invoice" ORDER BY id DESC LIMIT 50;')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-100 dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist hover:bg-slate-200 transition shrink-0"
            >
              SELECT invoices
            </button>
            <button
              onClick={() => setSqlText('SELECT * FROM "office_letter" ORDER BY id DESC LIMIT 50;')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-100 dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist hover:bg-slate-200 transition shrink-0"
            >
              SELECT letters
            </button>
            <button
              onClick={() => setSqlText('UPDATE "table_name" SET "column_name" = \'value\' WHERE "id" = 1;')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition shrink-0"
            >
              قالب UPDATE
            </button>
            <button
              onClick={() => setSqlText('DELETE FROM "table_name" WHERE "id" = 1;')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition shrink-0"
            >
              قالب DELETE
            </button>
          </div>

          {/* Results Area */}
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 shrink-0" dir="ltr">
              <p className="text-xs text-rose-700 dark:text-rose-300 font-mono">{error}</p>
            </div>
          )}

          {result && (
            <div className="flex-1 bg-white dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border rounded-2xl overflow-hidden flex flex-col shadow-xs min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-nx-navy-border bg-slate-50 dark:bg-nx-navy shrink-0">
                <div className="text-xs font-semibold text-slate-700 dark:text-nx-mist">
                  {result.columns
                    ? `تعداد سطرها: ${result.row_count?.toLocaleString()} · تعداد ستون‌ها: ${result.columns.length}`
                    : `تعداد سطرهای تغییریافته: ${result.rows_affected?.toLocaleString()}`
                  }
                </div>
                {result.columns && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="p-1.5 text-slate-500 hover:text-nx-blue rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="کپی نتایج"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={exportCsv}
                      className="p-1.5 text-slate-500 hover:text-nx-blue rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="خروجی CSV"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Table */}
              {result.columns && result.data && (
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs text-right" dir="ltr">
                    <thead className="bg-slate-100 dark:bg-nx-navy sticky top-0 border-b border-slate-200 dark:border-nx-navy-border">
                      <tr>
                        {result.columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left font-mono font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-nx-navy-border">
                      {result.data.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 font-mono">
                          {result.columns!.map((col) => (
                            <td key={col} className="px-3 py-1.5 whitespace-nowrap text-slate-800 dark:text-nx-mist">
                              {row[col] === null ? (
                                <span className="text-slate-400 italic">NULL</span>
                              ) : (
                                String(row[col])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {history.length > 0 && !result && !error && (
            <div className="bg-white dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border rounded-2xl p-4 shrink-0">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">تاریخچه کوئری‌های اخیر</h3>
              <div className="space-y-1 max-h-36 overflow-y-auto" dir="ltr">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setSqlText(h)}
                    className="block w-full text-left px-3 py-1 text-xs font-mono text-slate-600 dark:text-nx-mist hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition truncate"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
