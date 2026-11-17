import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play, RefreshCw, Copy, Download } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { useAuthStore } from '../store/authStore'

export default function SqlEditorPage() {
  const [sqlText, setSqlText] = useState('')
  const [source, setSource] = useState('local')
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
  const isAdmin = user?.role === 'admin' || user?.role === 'ceo'

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-nx-navy flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <h2 className="text-lg font-bold text-nx-navy dark:text-slate-100 mb-2">دسترسی غیرمجاز</h2>
          <p className="text-nx-muted dark:text-nx-mist">فقط مدیر سیستم و مدیرعامل به SQL Editor دسترسی دارند</p>
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
      setHistory((prev) => [sqlText, ...prev.slice(0, 19)])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در اجرای کوئری'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = () => {
    if (!result?.data || !result?.columns) return
    const header = result.columns.join(',')
    const rows = result.data.map((row) => result.columns!.map((c) => String(row[c] ?? '')).join(',')).join('\n')
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'query-result.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast('CSV دانلود شد', 'success')
  }

  const copyToClipboard = () => {
    if (!result?.data || !result?.columns) return
    const header = result.columns.join('\t')
    const rows = result.data.map((row) => result.columns!.map((c) => String(row[c] ?? '')).join('\t')).join('\n')
    navigator.clipboard.writeText(header + '\n' + rows)
    toast('در کلیپبورد کپی شد', 'success')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-nx-navy flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-6 py-3">
        <div className="max-w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/db-manager" className="p-2 text-nx-mist hover:text-nx-muted dark:hover:text-nx-mist transition">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold text-nx-navy dark:text-slate-100">SQL Editor</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="px-3 py-1.5 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-nx-blue"
            >
              <option value="local">Nexivo (local)</option>
            </select>
            <button
              onClick={executeQuery}
              disabled={loading || !sqlText.trim()}
              className="flex items-center gap-2 px-4 py-1.5 text-sm bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              اجرا
            </button>
          </div>
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        <div className="bg-nx-navy dark:bg-nx-navy border border-nx-navy-border rounded-xl overflow-hidden" style={{ minHeight: '200px' }}>
          <CodeMirror
            value={sqlText}
            onChange={(val) => setSqlText(val)}
            extensions={[sql()]}
            theme={oneDark}
            height="200px"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: true,
              autocompletion: true,
            }}
            placeholder="SELECT * FROM table_name LIMIT 100;"
          />
        </div>

        {/* Results */}
        {error && (
          <div className="bg-nx-danger-50 dark:bg-nx-danger-900/20 border border-nx-danger-200 dark:border-nx-danger-800 rounded-xl p-4">
            <p className="text-sm text-nx-danger-700 dark:text-nx-danger-300 font-mono">{error}</p>
          </div>
        )}

        {result && (
          <div className="flex-1 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-navy-border rounded-xl overflow-hidden flex flex-col">
            {/* Result header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-nx-border dark:border-nx-navy-border">
              <div className="text-sm text-nx-muted dark:text-nx-mist">
                {result.columns
                  ? `${result.row_count} ردیف · ${result.columns.length} ستون`
                  : `${result.rows_affected} ردیف تأثیر یافت`
                }
              </div>
              {result.columns && (
                <div className="flex items-center gap-2">
                  <button onClick={copyToClipboard} className="p-1.5 text-nx-mist hover:text-nx-blue transition" title="کپی">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={exportCsv} className="p-1.5 text-nx-mist hover:text-nx-blue transition" title="خروجی CSV">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Result table */}
            {result.columns && result.data && (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white dark:bg-nx-navy sticky top-0">
                    <tr>
                      {result.columns.map((col) => (
                        <th key={col} className="px-3 py-2 text-right font-medium text-nx-muted dark:text-nx-mist border-b border-nx-border dark:border-nx-navy-border whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((row, i) => (
                      <tr key={i} className="border-b border-nx-border dark:border-nx-navy-border last:border-0 hover:bg-white dark:hover:bg-nx-navy">
                        {result.columns!.map((col) => (
                          <td key={col} className="px-3 py-2 text-nx-navy dark:text-nx-mist whitespace-nowrap font-mono text-xs">
                            {row[col] === null ? <span className="text-nx-mist italic">NULL</span> : String(row[col])}
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

        {/* Query history */}
        {history.length > 0 && !result && !error && (
          <div className="bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-navy-border rounded-xl p-4">
            <h3 className="text-sm font-medium text-nx-muted dark:text-nx-mist mb-3">تاریخچه کوئری</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setSqlText(h)}
                  className="block w-full text-right px-3 py-1.5 text-xs font-mono text-nx-muted dark:text-nx-mist hover:bg-white dark:hover:bg-nx-navy rounded transition truncate"
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
