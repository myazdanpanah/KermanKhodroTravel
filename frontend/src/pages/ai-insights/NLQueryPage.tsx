import { useState, useEffect, useCallback } from 'react'
import { aiApi, type NLQuery } from '../../api/aiInsights'
import { useToast } from '../../components/Toast'
import { MessageSquare, Send, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function NLQueryPage() {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [queries, setQueries] = useState<NLQuery[]>([])
  const [currentResult, setCurrentResult] = useState<NLQuery | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await aiApi.getQueries()
      setQueries(res.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchHistory() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSubmitting(true)
    try {
      const res = await aiApi.createQuery(query.trim())
      setCurrentResult(res.data)
      setQuery('')
      fetchHistory()
      if (res.data.status === 'completed') {
        toast('پرسش با موفقیت اجرا شد', 'success')
      } else {
        toast('پرسش با خطا مواجه شد', 'error')
      }
    } catch {
      toast('خطا در ارسال پرسش', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle className="w-4 h-4 text-nx-teal" />
    if (s === 'failed') return <XCircle className="w-4 h-4 text-nx-danger-500" />
    return <Clock className="w-4 h-4 text-nx-warning-500" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-nx-blue rounded-xl flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-nx-mist/10">پرسش به زبان طبیعی</h1>
          <p className="text-sm text-nx-mist dark:text-nx-mist">Natural Language Query</p>
        </div>
      </div>

      {/* Query Input */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-nx-navy rounded-xl p-6 shadow-sm border border-nx-border dark:border-nx-navy-border">
        <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-2">
          سوال خود را به فارسی یا انگلیسی بنویسید
        </label>
        <div className="flex gap-3">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="مثلاً: مجموع فاکتورهای این ماه چقدر است؟"
            className="flex-1 px-4 py-3 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-nx-mist/10 focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none transition"
            dir="rtl"
          />
          <button type="submit" disabled={submitting || !query.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition disabled:opacity-50">
            <Send className="w-4 h-4" />
            {submitting ? 'در حال پردازش...' : 'ارسال'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['مجموع فاکتورها', 'تعداد سفارشات', 'کارمندان فعال', 'درخواست‌های سرویس', 'هزینه تولید'].map((s) => (
            <button key={s} type="button" onClick={() => setQuery(s)}
              className="px-3 py-1 text-xs rounded-full border border-nx-mist dark:border-nx-muted text-nx-mist dark:text-nx-mist hover:bg-nx-blue/10 dark:hover:bg-nx-blue/20 transition">
              {s}
            </button>
          ))}
        </div>
      </form>

      {/* Current Result */}
      {currentResult && (
        <div className="bg-white dark:bg-nx-navy rounded-xl p-6 shadow-sm border border-nx-border dark:border-nx-navy-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-nx-navy dark:text-nx-mist/10">Result</h3>
            <div className="flex items-center gap-2 text-xs text-nx-mist">
              {statusIcon(currentResult.status)}
              <span>{currentResult.execution_time_ms}ms</span>
            </div>
          </div>
          {currentResult.status === 'completed' && currentResult.result_data?.rows?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-nx-border dark:border-nx-navy-border">
                    {currentResult.result_data.headers.map((h: string, i: number) => (
                      <th key={i} className="text-left py-2 px-3 text-nx-mist dark:text-nx-mist font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentResult.result_data.rows.map((row: unknown[], ri: number) => (
                    <tr key={ri} className="border-b border-nx-border dark:border-nx-navy/50">
                      {row.map((cell: unknown, ci: number) => (
                        <td key={ci} className="py-2 px-3 text-nx-navy dark:text-nx-mist">
                          {typeof cell === 'number' ? cell.toLocaleString() : String(cell ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : currentResult.status === 'failed' ? (
            <p className="text-sm text-nx-danger-600 dark:text-nx-danger-400">{currentResult.error_message}</p>
          ) : (
            <p className="text-sm text-nx-mist">No data returned.</p>
          )}
        </div>
      )}

      {/* Query History */}
      <div className="bg-white dark:bg-nx-navy rounded-xl p-6 shadow-sm border border-nx-border dark:border-nx-navy-border">
        <h3 className="font-semibold text-nx-navy dark:text-nx-mist/10 mb-4">Query History</h3>
        {queries.length === 0 ? (
          <p className="text-sm text-nx-mist dark:text-nx-mist">No queries yet.</p>
        ) : (
          <div className="space-y-2">
            {queries.map((q) => (
              <button key={q.id} onClick={() => setCurrentResult(q)}
                className="w-full text-left p-3 rounded-lg hover:bg-white dark:hover:bg-nx-navy transition flex items-center gap-3">
                {statusIcon(q.status)}
                <span className="flex-1 text-sm text-nx-navy dark:text-nx-mist truncate">{q.query_text}</span>
                <span className="text-xs text-nx-mist">{q.execution_time_ms}ms</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
