import { useState, useEffect, useCallback, Fragment } from 'react'
import { auditApi, type AuditLogEntry, type AuditLogSummary } from '../../api/auditLog'

type Tab = 'trail' | 'summary'

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  view: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const ACTION_ICONS: Record<string, string> = {
  create: '➕',
  update: '✏️',
  delete: '🗑️',
  view: '👁️',
}

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-lg">{icon}</div>
      </div>
    </div>
  )
}

function DiffViewer({ oldValues, newValues, changedFields }: { oldValues: Record<string, unknown>; newValues: Record<string, unknown>; changedFields: string[] }) {
  if (!changedFields.length) return <span className="text-gray-400 text-xs">No changes recorded</span>

  return (
    <div className="space-y-1">
      {changedFields.map(field => (
        <div key={field} className="flex items-center gap-2 text-xs">
          <span className="font-mono text-gray-500 w-24 truncate">{field}</span>
          <span className="text-red-500 line-through truncate max-w-[120px]">{String(oldValues[field] ?? '')}</span>
          <span className="text-gray-400">→</span>
          <span className="text-green-600 truncate max-w-[120px]">{String(newValues[field] ?? '')}</span>
        </div>
      ))}
    </div>
  )
}

function AuditTrailTable({ entries }: { entries: AuditLogEntry[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (!entries.length) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <div className="text-4xl mb-3">📋</div>
        <div className="text-lg font-medium">No audit entries found</div>
        <div className="text-sm mt-1">Activity will appear here as users make changes</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-medium text-gray-500 w-8"></th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Action</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Description</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">User</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">IP</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <Fragment key={entry.id}>
              <tr
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <td className="py-3 px-4 text-gray-400 text-xs">{expanded === entry.id ? '▼' : '▶'}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[entry.action]}`}>
                    {ACTION_ICONS[entry.action]} {entry.action}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-900 dark:text-gray-200 max-w-[300px] truncate">{entry.description}</td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{entry.user_display}</td>
                <td className="py-3 px-4 text-gray-500 font-mono text-xs">{entry.ip_address || '—'}</td>
                <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
              </tr>
              {expanded === entry.id && (
                <tr key={`${entry.id}-detail`} className="bg-gray-50 dark:bg-gray-800/30">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2">Changes</div>
                        <DiffViewer oldValues={entry.old_values} newValues={entry.new_values} changedFields={entry.changed_fields} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-2">Details</div>
                        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div><span className="font-medium">Type:</span> {entry.content_type_display}</div>
                          <div><span className="font-medium">Object ID:</span> {entry.object_id}</div>
                          {entry.module && <div><span className="font-medium">Module:</span> {entry.module}</div>}
                          {entry.user_agent && <div className="truncate max-w-[300px]"><span className="font-medium">User Agent:</span> {entry.user_agent}</div>}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AuditLogPage() {
  const [tab, setTab] = useState<Tab>('trail')
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [summary, setSummary] = useState<AuditLogSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [searchInput, setSearchInput] = useState('')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { ...filters }
      if (searchInput) params.search = searchInput
      const res = await auditApi.getEntries(params)
      setEntries((res.data as any)?.results || res.data || [])
    } catch {
      setError('Failed to load audit entries')
    } finally {
      setLoading(false)
    }
  }, [filters, searchInput])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await auditApi.getSummary()
      setSummary(res.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchEntries()
    fetchSummary()
  }, [fetchEntries, fetchSummary])

  const handleSearch = () => fetchEntries()

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Track all model changes with before/after snapshots
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['trail', 'summary'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'trail' ? '📋 Audit Trail' : '📊 Summary'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Trail Tab */}
      {tab === 'trail' && (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={filters.action || ''}
              onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            >
              <option value="">All actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search descriptions..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            />
            <button onClick={handleSearch} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Search</button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <AuditTrailTable entries={entries} />
            )}
          </div>
        </div>
      )}

      {/* Summary Tab */}
      {tab === 'summary' && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Total Entries" value={summary.total_entries} icon="📝" />
            <SummaryCard label="Today" value={summary.entries_today} icon="📅" />
            <SummaryCard label="Active Users" value={summary.recent_users.length} icon="👥" />
            <SummaryCard label="Modules Tracked" value={Object.keys(summary.entries_by_module).length} icon="📦" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Action */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Actions (Last 7 Days)</h3>
              <div className="space-y-3">
                {Object.entries(summary.entries_by_action).map(([action, count]) => (
                  <div key={action} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[action]}`}>
                        {ACTION_ICONS[action]} {action}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Users */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Most Active Users</h3>
              <div className="space-y-2">
                {summary.recent_users.map((u, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{u.user__username}</span>
                    <span className="text-sm font-medium text-gray-500">{u.count} actions</span>
                  </div>
                ))}
                {summary.recent_users.length === 0 && (
                  <div className="text-gray-400 text-sm text-center py-4">No activity yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Daily Trend */}
          {summary.daily_trend.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Daily Activity (Last 7 Days)</h3>
              <div className="flex items-end gap-2 h-32">
                {summary.daily_trend.map((day, i) => {
                  const maxCount = Math.max(...summary.daily_trend.map(d => d.count), 1)
                  const height = (day.count / maxCount) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{day.count}</span>
                      <div
                        className="w-full bg-indigo-500 rounded-t transition-all duration-300 hover:bg-indigo-400"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[10px] text-gray-400">{day.date.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
