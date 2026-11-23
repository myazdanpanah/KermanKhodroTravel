import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Database,
  Table,
  Server,
  Plus,
  RefreshCw,
  Search,
  ChevronRight,
  HardDrive,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  Edit3,
} from 'lucide-react'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { useAuthStore } from '../store/authStore'

interface DatabaseEntry {
  id: number
  source: string
  name: string
  table_name?: string
  type: 'dataset' | 'external'
  host?: string
  database?: string
  is_active: boolean
  row_count?: number
  column_count?: number
}

type TabType = 'system' | 'datasets' | 'external'

export default function DatabaseManagerPage() {
  const [databases, setDatabases] = useState<DatabaseEntry[]>([])
  const [systemTables, setSystemTables] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('system')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const isMainAdmin = user?.role === 'admin' || user?.role === 'ceo' || user?.is_superuser

  useEffect(() => {
    if (isMainAdmin) {
      loadAll()
    } else {
      setLoading(false)
    }
  }, [isMainAdmin])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [dbRes, tablesRes] = await Promise.allSettled([
        api.get('/db-manager/databases/'),
        api.get('/db-manager/databases/local/tables/'),
      ])

      if (dbRes.status === 'fulfilled') {
        setDatabases(dbRes.value.data)
      }
      if (tablesRes.status === 'fulfilled') {
        setSystemTables(tablesRes.value.data)
      }
    } catch {
      toast('خطا در بارگذاری اطلاعات پایگاه‌داده', 'error')
    } finally {
      setLoading(false)
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
            محیط مدیریت و ویرایش پایگاه داده (SSMS Studio) منحصراً در اختیار ادمین اصلی سیستم (Super Admin) قرار دارد.
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

  const filteredSystemTables = systemTables.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  )

  const filteredDatabases = databases.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.table_name && d.table_name.toLowerCase().includes(search.toLowerCase())) ||
      (d.host && d.host.toLowerCase().includes(search.toLowerCase()))
  )

  const localDatasets = filteredDatabases.filter((d) => d.source === 'local')
  const externalDbs = filteredDatabases.filter((d) => d.type === 'external')

  return (
    <div className="min-h-screen bg-white dark:bg-nx-navy" dir="rtl">
      {/* Header — with iPhone notch safe-area */}
      <header className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-4 sm:px-6 pt-[max(1rem,calc(env(safe-area-inset-top,0px)+1rem))] pb-4 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/launcher" className="p-2 text-nx-mist hover:text-slate-900 dark:hover:text-white transition">
              <ChevronRight className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-nx-blue flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-nx-navy dark:text-slate-100">
                  استودیو مدیریت و ویرایش پایگاه داده (SSMS)
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  دسترسی انحصاری مدیر اصلی
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-nx-mist mt-0.5">
                مشاهده و ویرایش مستقیم داده‌های دیتابیس، جداول سیستمی PostgreSQL و کنسول SQL
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/db-manager/sql"
              className="flex items-center gap-2 px-3.5 py-2 text-sm bg-nx-blue text-white rounded-xl hover:bg-blue-600 transition shadow-xs font-semibold"
            >
              <Terminal className="w-4 h-4" />
              کنسول SQL Editor
            </Link>
            <Link
              to="/db-manager/connections"
              className="flex items-center gap-2 px-3.5 py-2 text-sm bg-slate-100 dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist rounded-xl hover:bg-slate-200 transition font-medium"
            >
              <Server className="w-4 h-4" />
              اتصالات خارجی
            </Link>
            <Link
              to="/db-manager/import"
              className="flex items-center gap-2 px-3.5 py-2 text-sm bg-slate-100 dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border text-slate-700 dark:text-nx-mist rounded-xl hover:bg-slate-200 transition font-medium"
            >
              <Plus className="w-4 h-4" />
              وارد کردن فایل
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs & Search */}
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-nx-navy-elevated p-1.5 rounded-2xl border border-slate-200 dark:border-nx-navy-border">
            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'system'
                  ? 'bg-white dark:bg-nx-navy text-nx-blue shadow-xs'
                  : 'text-slate-600 dark:text-nx-mist hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>جداول پایگاه داده ({systemTables.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('datasets')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'datasets'
                  ? 'bg-white dark:bg-nx-navy text-nx-blue shadow-xs'
                  : 'text-slate-600 dark:text-nx-mist hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>مجموعه‌داده‌های BI ({localDatasets.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('external')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'external'
                  ? 'bg-white dark:bg-nx-navy text-nx-blue shadow-xs'
                  : 'text-slate-600 dark:text-nx-mist hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>دیتابیس‌های خارجی ({externalDbs.length})</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو در نام جداول..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-10 py-2 bg-slate-50 dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-nx-blue outline-none transition"
            />
            <button
              onClick={loadAll}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-nx-blue transition"
              title="بازخوانی داده‌ها"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-nx-blue' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pb-12">
        {loading ? (
          <div className="text-center py-24 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-nx-blue animate-spin" />
            <p className="text-sm text-slate-500 dark:text-nx-mist">در حال بارگذاری اطلاعات پایگاه‌داده...</p>
          </div>
        ) : activeTab === 'system' ? (
          /* PostgreSQL System Tables */
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>جداول فعال PostgreSQL سامانه</span>
                <span className="text-xs font-normal text-slate-400">({filteredSystemTables.length} جدول)</span>
              </h2>
              <span className="text-xs text-slate-500 dark:text-nx-mist">
                جهت ویرایش مقادیر یا حذف/افزودن سطر، روی جدول کلیک کنید
              </span>
            </div>

            {filteredSystemTables.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-nx-navy-elevated rounded-3xl border border-dashed border-slate-300 dark:border-nx-navy-border">
                <Table className="w-12 h-12 text-slate-300 dark:text-nx-mist/40 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-white">جدولی یافت نشد</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSystemTables.map((tbl) => (
                  <div
                    key={tbl}
                    className="group bg-white dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border rounded-2xl p-4.5 hover:shadow-md hover:border-nx-blue/60 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-nx-blue flex items-center justify-center shrink-0">
                          <Table className="w-4 h-4" />
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate" dir="ltr">
                          {tbl}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-nx-mist mb-4">
                        جدول ساختاریافته پایگاه داده اصلی
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-nx-navy-border/50">
                      <Link
                        to={`/db-manager/table/local/${tbl}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-nx-blue text-white hover:bg-blue-600 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        ویرایش داده‌ها
                      </Link>
                      <Link
                        to={`/db-manager/sql?source=local&query=${encodeURIComponent(`SELECT * FROM "${tbl}" LIMIT 100;`)}`}
                        className="py-1.5 px-2.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-nx-navy hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-nx-mist transition"
                        title="کوئری در SQL Editor"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'datasets' ? (
          /* Datasets */
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                مجموعه‌داده‌های تحلیلی BI ({localDatasets.length})
              </h2>
            </div>
            {localDatasets.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-nx-navy-elevated rounded-3xl border border-dashed border-slate-300 dark:border-nx-navy-border">
                <Table className="w-12 h-12 text-slate-300 dark:text-nx-mist/40 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-white">مجموعه‌داده‌ای یافت نشد</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {localDatasets.map((db) => (
                  <Link
                    key={db.id}
                    to={`/db-manager/table/${db.source}/${db.table_name}`}
                    className="group bg-white dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border rounded-2xl p-5 hover:shadow-md hover:border-nx-blue transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Table className="w-5 h-5 text-nx-blue" />
                        <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-nx-blue transition">
                          {db.name}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-500 dark:text-nx-mist">
                      <div className="font-mono bg-slate-100 dark:bg-nx-navy px-2 py-0.5 rounded w-fit" dir="ltr">
                        {db.table_name}
                      </div>
                      {db.row_count !== undefined && (
                        <div>{db.row_count.toLocaleString()} ردیف · {db.column_count} ستون</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* External Databases */
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                پایگاه‌داده‌های خارجی ({externalDbs.length})
              </h2>
            </div>
            {externalDbs.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-nx-navy-elevated rounded-3xl border border-dashed border-slate-300 dark:border-nx-navy-border">
                <Server className="w-12 h-12 text-slate-300 dark:text-nx-mist/40 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-white">اتصال خارجی فعالی وجود ندارد</p>
                <Link
                  to="/db-manager/connections"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition"
                >
                  <Plus className="w-4 h-4" />
                  افزودن اتصال جدید
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {externalDbs.map((db) => (
                  <ExternalDbCard key={db.source} db={db} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ExternalDbCard({ db }: { db: DatabaseEntry }) {
  const [tables, setTables] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadTables = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }
    setLoading(true)
    try {
      const res = await api.get(`/db-manager/databases/${db.source}/tables/`)
      setTables(res.data)
      setExpanded(true)
    } catch {
      toast('خطا در بارگذاری جداول دیتابیس خارجی', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border rounded-2xl overflow-hidden shadow-xs">
      <button
        onClick={loadTables}
        className="w-full p-5 text-right hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">{db.name}</span>
          </div>
          {loading ? (
            <RefreshCw className="w-4 h-4 text-nx-mist animate-spin" />
          ) : (
            <ChevronRight className={`w-4 h-4 text-nx-mist transition-transform ${expanded ? 'rotate-90' : ''}`} />
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-nx-mist space-y-1 font-mono" dir="ltr">
          <div>Host: {db.host}</div>
          <div>DB: {db.database}</div>
        </div>
      </button>
      {expanded && tables.length > 0 && (
        <div className="border-t border-slate-200 dark:border-nx-navy-border px-4 py-3 max-h-60 overflow-y-auto space-y-1">
          {tables.map((t) => (
            <Link
              key={t}
              to={`/db-manager/table/${db.source}/${t}`}
              className="flex items-center justify-between px-3 py-2 text-xs font-mono text-slate-800 dark:text-nx-mist hover:bg-nx-blue/10 rounded-xl transition"
              dir="ltr"
            >
              <span>{t}</span>
              <Edit3 className="w-3.5 h-3.5 text-nx-blue" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
