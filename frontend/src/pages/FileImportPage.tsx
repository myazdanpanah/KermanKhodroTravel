import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Upload, FileSpreadsheet, RefreshCw } from 'lucide-react'
import api from '../api/client'
import { useToast } from '../components/Toast'

const MODES = [
  { value: 'replace', label: 'جایگزینی', desc: 'جدول فعلی را خالی کرده و داده جایگزین می‌شود' },
  { value: 'append', label: 'افزودن', desc: 'داده‌های جدید به انتهای جدول اضافه می‌شوند' },
  { value: 'upsert', label: 'بازنویسی', desc: 'ردیف‌های تکراری با داده جدید جایگزین می‌شوند' },
]

export default function FileImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState('local')
  const [tableName, setTableName] = useState('')
  const [mode, setMode] = useState('replace')
  const [keyColumn, setKeyColumn] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ rows_affected: number; warnings: string[] } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleFile = (f: File) => {
    setFile(f)
    if (!tableName) {
      const name = f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_')
      setTableName(`nexivo_${name}`)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleImport = async () => {
    if (!file || !tableName.trim()) {
      toast('فایل و نام جدول الزامی است', 'error')
      return
    }
    setImporting(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', mode)
      if (mode === 'upsert' && keyColumn) {
        formData.append('key_column', keyColumn)
      }
      // If table starts with "nexivo_" or is clearly new, use /import/new/
      // Otherwise try the existing-table endpoint first
      let res
      try {
        // Try existing table first
        formData.append('table_name', tableName.trim())
        res = await api.post(`/db-manager/tables/${source}/${tableName.trim()}/import/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } catch (err) {
        if (err && typeof err === 'object' && 'response' in err && (err as { response?: { status?: number } }).response?.status === 404) {
          // Table doesn't exist — create new
          const newFormData = new FormData()
          newFormData.append('file', file)
          newFormData.append('table_name', tableName.trim())
          newFormData.append('source', source)
          res = await api.post('/db-manager/import/new/', newFormData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } else {
          throw err
        }
      }
      setResult(res.data)
      toast('فایل با موفقیت وارد شد', 'success')
    } catch {
      toast('خطا در وارد کردن فایل', 'error')
    } finally {
      setImporting(false)
    }
  }

  const acceptedTypes = '.xlsx,.xls,.csv'

  return (
    <div className="min-h-screen bg-white dark:bg-nx-navy" dir="rtl">
      <header className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/db-manager" className="p-2 text-nx-mist hover:text-nx-muted dark:hover:text-nx-mist transition">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Upload className="w-5 h-5 text-nx-blue" />
          <h1 className="text-lg font-bold text-nx-navy dark:text-slate-100">وارد کردن فایل</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition ${
            dragActive
              ? 'border-nx-blue bg-nx-blue/10 dark:bg-nx-blue/20'
              : file
                ? 'border-nx-teal dark:border-nx-teal bg-nx-teal/10 dark:bg-nx-teal/10'
                : 'border-nx-mist dark:border-nx-muted hover:border-nx-blue dark:hover:border-nx-blue'
          }`}
        >
          <input
            type="file"
            accept={acceptedTypes}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer">
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-nx-teal" />
                <div className="text-right">
                  <p className="text-sm font-medium text-nx-navy dark:text-slate-100">{file.name}</p>
                  <p className="text-xs text-nx-muted dark:text-nx-mist">
                    {(file.size / 1024).toFixed(1)} KB · کلیک کنید برای تغییر
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="w-12 h-12 text-nx-mist dark:text-nx-muted mx-auto mb-3" />
                <p className="text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">
                  فایل XLSX، XLS یا CSV را اینجا رها کنید
                </p>
                <p className="text-xs text-nx-mist dark:text-nx-muted">یا کلیک کنید برای انتخاب فایل</p>
              </div>
            )}
          </label>
        </div>

        {/* Settings */}
        <div className="bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-navy-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1.5">نام جدول</label>
            <input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="nexivo_my_data یا نام جدول موجود"
              className="w-full px-4 py-2.5 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-nx-blue font-mono"
            />
            <p className="text-[10px] text-nx-mist mt-1">اگر جدول وجود نداشته باشد، ساخته می‌شود</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1.5">منبع</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-nx-blue"
            >
              <option value="local">Nexivo (local)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-2">حالت وارد کردن</label>
            <div className="grid grid-cols-3 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`p-3 rounded-xl border text-right transition ${
                    mode === m.value
                      ? 'border-nx-blue bg-nx-blue/10 dark:bg-nx-blue/30 ring-1 ring-nx-blue'
                      : 'border-nx-border dark:border-nx-muted hover:border-nx-mist dark:hover:border-nx-muted'
                  }`}
                >
                  <div className="text-sm font-medium text-nx-navy dark:text-slate-100">{m.label}</div>
                  <div className="text-[10px] text-nx-muted dark:text-nx-mist mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {mode === 'upsert' && (
            <div>
              <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1.5">ستون کلید (برای بازنویسی)</label>
              <input
                value={keyColumn}
                onChange={(e) => setKeyColumn(e.target.value)}
                placeholder="id"
                className="w-full px-4 py-2.5 text-sm border border-nx-border dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-nx-blue font-mono"
              />
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!file || !tableName.trim() || importing}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'در حال وارد کردن...' : 'وارد کردن'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-nx-teal/10 dark:bg-nx-teal/20 border border-nx-teal/10 dark:border-nx-teal rounded-xl p-6">
            <h3 className="text-sm font-bold text-nx-teal dark:text-nx-teal mb-2">✅ وارد کردن موفق</h3>
            <p className="text-sm text-nx-teal dark:text-nx-teal">
              {result.rows_affected.toLocaleString()} ردیف وارد شد
            </p>
            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-nx-warning-600 dark:text-nx-warning-400">⚠️ {w}</p>
                ))}
              </div>
            )}
            <button
              onClick={() => navigate(`/db-manager/table/${source}/${tableName}`)}
              className="mt-4 text-sm text-nx-blue dark:text-nx-blue hover:underline"
            >
              مشاهده جدول →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
