import { useState, useEffect, useCallback, Fragment } from 'react'
import { auditApi, type AuditLogEntry, type AuditLogSummary } from '../../api/auditLog'

type Tab = 'trail' | 'summary'

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-nx-teal/10 text-nx-teal dark:bg-nx-teal/30 dark:text-nx-teal',
  update: 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue/30 dark:text-nx-blue',
  delete: 'bg-nx-danger-100 text-nx-danger-700 dark:bg-nx-danger-900/30 dark:text-nx-danger-400',
  view: 'bg-nx-mist/10 text-nx-mist dark:bg-nx-navy dark:text-nx-mist',
}

const ACTION_ICONS: Record<string, string> = {
  create: '➕',
  update: '✏️',
  delete: '🗑️',
  view: '👁️',
}

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-nx-mist dark:text-nx-mist">{label}</div>
          <div className="text-2xl font-bold text-nx-navy dark:text-white mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-nx-blue/10 dark:bg-nx-blue/30 flex items-center justify-center text-lg">{icon}</div>
      </div>
    </div>
  )
}

function DiffViewer({ oldValues, newValues, changedFields }: { oldValues: Record<string, unknown>; newValues: Record<string, unknown>; changedFields: string[] }) {
  if (!changedFields.length) return <span className="text-nx-mist text-xs">No changes recorded</span>

  return (
    <div className="space-y-1">
      {changedFields.map(field => (
        <div key={field} className="flex items-center gap-2 text-xs">
          <span className="font-mono text-nx-mist w-24 truncate">{field}</span>
          <span className="text-nx-danger-500 line-through truncate max-w-[120px]">{String(oldValues[field] ?? '')}</span>
          <span className="text-nx-mist">→</span>
          <span className="text-nx-teal truncate max-w-[120px]">{String(newValues[field] ?? '')}</span>
        </div>
      ))}
    </div>
  )
}

function AuditTrailTable({ entries }: { entries: AuditLogEntry[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (!entries.length) {
    return (
      <div className="text-center py-16 text-nx-mist dark:text-nx-mist">
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
          <tr className="border-b border-nx-border dark:border-nx-navy-border">
            <th className="text-left py-3 px-4 font-medium text-nx-mist w-8"></th>
            <th className="text-left py-3 px-4 font-medium text-nx-mist">Action</th>
            <th className="text-left py-3 px-4 font-medium text-nx-mist">Description</th>
            <th className="text-left py-3 px-4 font-medium text-nx-mist">User</th>
            <th className="text-left py-3 px-4 font-medium text-nx-mist">IP</th>
            <th className="text-left py-3 px-4 font-medium text-nx-mist">Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <Fragment key={entry.id}>
              <tr
                className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy-elevated cursor-pointer"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <td className="py-3 px-4 text-nx-mist text-xs">{expanded === entry.id ? '▼' : '▶'}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[entry.action]}`}>
                    {ACTION_ICONS[entry.action]} {entry.action}
                  </span>
                </td>
                <td className="py-3 px-4 text-nx-navy dark:text-nx-mist/20 max-w-[300px] truncate">{entry.description}</td>
                <td className="py-3 px-4 text-nx-mist dark:text-nx-mist">{entry.user_display}</td>
                <td className="py-3 px-4 text-nx-mist font-mono text-xs">{entry.ip_address || '—'}</td>
                <td className="py-3 px-4 text-nx-mist text-xs whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
              </tr>
              {expanded === entry.id && (
                <tr key={`${entry.id}-detail`} className="bg-white dark:bg-nx-navy-elevated">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-nx-mist mb-2">Changes</div>
                        <DiffViewer oldValues={entry.old_values} newValues={entry.new_values} changedFields={entry.changed_fields} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-nx-mist mb-2">Details</div>
                        <div className="space-y-1 text-xs text-nx-mist dark:text-nx-mist">
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
          <h1 className="text-2xl font-bold text-white dark:text-white">Audit Log</h1>
          <p className="text-nx-mist dark:text-nx-mist text-sm mt-1">
            Track all model changes with before/after snapshots
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-nx-border dark:border-nx-navy-border">
        {(['trail', 'summary'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-nx-blue text-nx-blue dark:text-nx-blue dark:border-nx-blue'
                : 'border-transparent text-nx-mist hover:text-nx-navy'
            }`}
          >
            {t === 'trail' ? '📋 Audit Trail' : '📊 Summary'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-nx-danger-50 dark:bg-nx-danger-900/20 border border-nx-danger-200 dark:border-nx-danger-800 rounded-xl p-4 text-nx-danger-700 dark:text-nx-danger-400 text-sm">
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
              className="px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-sm text-nx-navy dark:text-white"
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
              className="flex-1 px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-sm text-nx-navy dark:text-white"
            />
            <button onClick={handleSearch} className="px-4 py-2 bg-nx-blue text-white rounded-lg text-sm font-medium hover:bg-nx-blue transition">Search</button>
          </div>

          <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-5 h-5 border-2 border-nx-blue border-t-transparent rounded-full animate-spin" />
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
            <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-5">
              <h3 className="font-semibold text-nx-navy dark:text-nx-mist/20 mb-4">Actions (Last 7 Days)</h3>
              <div className="space-y-3">
                {Object.entries(summary.entries_by_action).map(([action, count]) => (
                  <div key={action} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[action]}`}>
                        {ACTION_ICONS[action]} {action}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-nx-navy dark:text-nx-mist">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Users */}
            <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-5">
              <h3 className="font-semibold text-nx-navy dark:text-nx-mist/20 mb-4">Most Active Users</h3>
              <div className="space-y-2">
                {summary.recent_users.map((u, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-nx-navy dark:text-nx-mist">{u.user__username}</span>
                    <span className="text-sm font-medium text-nx-mist">{u.count} actions</span>
                  </div>
                ))}
                {summary.recent_users.length === 0 && (
                  <div className="text-nx-mist text-sm text-center py-4">No activity yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Daily Trend */}
          {summary.daily_trend.length > 0 && (
            <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-5">
              <h3 className="font-semibold text-nx-navy dark:text-nx-mist/20 mb-4">Daily Activity (Last 7 Days)</h3>
              <div className="flex items-end gap-2 h-32">
                {summary.daily_trend.map((day, i) => {
                  const maxCount = Math.max(...summary.daily_trend.map(d => d.count), 1)
                  const height = (day.count / maxCount) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-nx-mist">{day.count}</span>
                      <div
                        className="w-full bg-nx-blue rounded-t transition-all duration-300 hover:bg-nx-blue"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[10px] text-nx-mist">{day.date.slice(5)}</span>
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
