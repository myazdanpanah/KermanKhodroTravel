import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getLLMProviders, createLLMProvider, deleteLLMProvider,
  activateLLMProvider, testLLMProvider, getLLMUsageStats
} from '../api/llm'
import { useToast } from '../components/Toast'
import {
  ArrowRight, Bot, Plus, Trash2, Check, Zap,
  Server, Activity, X
} from 'lucide-react'

interface LLMProvider {
  id: number
  provider_type: string
  name: string
  model_name: string
  api_base_url: string
  has_key: boolean
  temperature: number
  max_tokens: number
  is_active: boolean
  is_default: boolean
  created_at: string
}

interface UsageStats {
  total_tokens: number
  total_requests: number
  avg_duration_ms: number
  by_feature: Array<{ feature: string; total: number; count: number }>
}

const PROVIDER_INFO: Record<string, { label: string; icon: string; color: string; defaultModel: string; defaultUrl: string }> = {
  ollama: { label: 'Ollama (Local)', icon: '🦙', color: 'from-nx-teal to-nx-teal', defaultModel: 'gemma3:1b', defaultUrl: 'http://localhost:11434' },
  openai: { label: 'OpenAI', icon: '🤖', color: 'from-nx-teal to-nx-teal', defaultModel: 'gpt-4o-mini', defaultUrl: '' },
  gemini: { label: 'Google Gemini', icon: '✨', color: 'from-nx-blue to-nx-blue', defaultModel: 'gemini-2.0-flash', defaultUrl: '' },
  anthropic: { label: 'Anthropic Claude', icon: '🧠', color: 'from-nx-warning-500 to-nx-warning-600', defaultModel: 'claude-3-5-sonnet-20241022', defaultUrl: '' },
  deepseek: { label: 'DeepSeek', icon: '🔍', color: 'from-nx-blue to-nx-blue', defaultModel: 'deepseek-chat', defaultUrl: '' },
}



export default function LLMSettingsPage() {
  const { toast } = useToast()
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [form, setForm] = useState({
    provider_type: 'ollama',
    name: '',
    model_name: '',
    api_base_url: '',
    api_key: '',
    temperature: 0.7,
    max_tokens: 4096,
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [pRes, sRes] = await Promise.all([getLLMProviders(), getLLMUsageStats()])
      setProviders(pRes.data)
      setStats(sRes.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const handleTypeChange = (type: string) => {
    const info = PROVIDER_INFO[type]
    setForm(f => ({
      ...f,
      provider_type: type,
      model_name: info?.defaultModel || '',
      api_base_url: info?.defaultUrl || '',
    }))
  }

  const handleCreate = async () => {
    if (!form.name || !form.model_name) {
      toast('نام و مدل الزامی هستند', 'error')
      return
    }
    try {
      await createLLMProvider(form)
      toast('ارائه‌دهنده LLM ایجاد شد', 'success')
      setShowCreate(false)
      setForm({ provider_type: 'ollama', name: '', model_name: '', api_base_url: '', api_key: '', temperature: 0.7, max_tokens: 4096 })
      fetchData()
    } catch {
      toast('خطا در ایجاد', 'error')
    }
  }

  const handleActivate = async (id: number) => {
    try {
      await activateLLMProvider(id)
      toast('ارائه‌دهنده فعال شد', 'success')
      fetchData()
    } catch {
      toast('خطا در فعال‌سازی', 'error')
    }
  }

  const handleTest = async (id: number) => {
    setTesting(id)
    setTestResult(null)
    try {
      const res = await testLLMProvider(id)
      setTestResult({ success: res.data.success, message: res.data.success ? res.data.response : res.data.error })
    } catch {
      setTestResult({ success: false, message: 'خطا در اتصال' })
    } finally {
      setTesting(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف این ارائه‌دهنده مطمئن هستید؟')) return
    try {
      await deleteLLMProvider(id)
      toast('حذف شد', 'success')
      fetchData()
    } catch {
      toast('خطا در حذف', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-nx-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">تنظیمات هوش مصنوعی</h1>
          <p className="text-nx-mist mt-1">مدیریت ارائه‌دهندگان LLM و نظارت بر مصرف</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/settings" className="flex items-center gap-2 px-4 py-2 bg-nx-navy hover:bg-nx-navy text-nx-mist rounded-xl text-sm transition">
            <ArrowRight className="w-4 h-4" /> بازگشت
          </Link>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-nx-blue hover:bg-nx-blue text-white rounded-xl font-medium transition">
            <Plus className="w-4 h-4" /> ارائه‌دهنده جدید
          </button>
        </div>
      </div>

      {/* Usage Stats */}
      {stats && stats.total_requests > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-5 h-5 text-nx-blue" />
              <span className="text-sm text-nx-mist">کل درخواست‌ها</span>
            </div>
            <p className="text-2xl font-bold text-white">{new Intl.NumberFormat('fa-IR').format(stats.total_requests)}</p>
          </div>
          <div className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-nx-warning-400" />
              <span className="text-sm text-nx-mist">کل توکن‌ها</span>
            </div>
            <p className="text-2xl font-bold text-white">{new Intl.NumberFormat('fa-IR').format(stats.total_tokens)}</p>
          </div>
          <div className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Server className="w-5 h-5 text-nx-blue" />
              <span className="text-sm text-nx-mist">میانگین پاسخ</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.avg_duration_ms}ms</p>
          </div>
        </div>
      )}

      {/* Provider List */}
      <div className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-nx-navy-border">
          <h3 className="font-bold text-white">ارائه‌دهندگان LLM</h3>
        </div>
        {providers.length === 0 ? (
          <div className="p-12 text-center text-nx-mist">
            <Bot className="w-16 h-16 mx-auto mb-4 text-nx-mist" />
            <p className="text-lg mb-2">هنوز ارائه‌دهنده‌ای تنظیم نشده</p>
            <p className="text-sm">برای شروع، اولین ارائه‌دهنده LLM را اضافه کنید</p>
          </div>
        ) : (
          <div className="divide-y divide-nx-navy">
            {providers.map(p => {
              const info = PROVIDER_INFO[p.provider_type] || PROVIDER_INFO.ollama
              return (
                <div key={p.id} className="px-6 py-4 hover:bg-nx-navy-elevated transition">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{info.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{p.name}</span>
                        {p.is_active && (
                          <span className="px-2 py-0.5 bg-nx-teal/10 text-nx-teal border border-nx-teal/20 rounded text-xs font-medium">
                            فعال
                          </span>
                        )}
                        <span className="text-xs text-nx-mist">{p.model_name}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-nx-mist">
                        <span>دمای {p.temperature}</span>
                        <span>{p.max_tokens} توکن</span>
                        {p.has_key ? <span className="text-nx-teal">🔑 کلید تنظیم شده</span> : <span className="text-nx-mist">بدون کلید (Ollama)</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!p.is_active && (
                        <button onClick={() => handleActivate(p.id)} className="px-3 py-1.5 bg-nx-teal/10 text-nx-teal rounded-lg text-xs font-medium hover:bg-nx-teal/20 transition">
                          <Check className="w-3.5 h-3.5 inline ml-1" /> فعال‌سازی
                        </button>
                      )}
                      <button
                        onClick={() => handleTest(p.id)}
                        disabled={testing === p.id}
                        className="px-3 py-1.5 bg-nx-blue/10 text-nx-blue rounded-lg text-xs font-medium hover:bg-nx-blue/20 transition disabled:opacity-50"
                      >
                        {testing === p.id ? '...' : 'تست'}
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-nx-mist hover:text-nx-danger-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Test result */}
                  {testResult && testing === null && (
                    <div className={`mt-3 p-3 rounded-xl text-sm ${testResult.success ? 'bg-nx-teal/10 text-nx-teal' : 'bg-nx-danger-500/10 text-nx-danger-400'}`}>
                      {testResult.message}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-nx-navy border border-nx-navy-border rounded-2xl w-full max-w-lg p-6" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">ارائه‌دهنده جدید</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-nx-mist hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {/* Provider Type */}
              <div>
                <label className="block text-sm text-nx-mist mb-2">نوع ارائه‌دهنده</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => handleTypeChange(key)}
                      className={`p-3 rounded-xl border-2 text-right transition ${
                        form.provider_type === key
                          ? 'border-nx-blue bg-nx-blue/10'
                          : 'border-nx-navy-border hover:border-nx-muted'
                      }`}
                    >
                      <span className="text-lg">{info.icon}</span>
                      <p className="text-xs text-white mt-1">{info.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-nx-mist mb-1">نام مستعار *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثلاً Gemma 4 Local"
                  className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-blue" />
              </div>
              <div>
                <label className="block text-sm text-nx-mist mb-1">نام مدل *</label>
                <input type="text" value={form.model_name} onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))}
                  className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-blue" />
              </div>
              {form.provider_type !== 'ollama' && (
                <div>
                  <label className="block text-sm text-nx-mist mb-1">API Key *</label>
                  <input type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-blue" />
                </div>
              )}
              {form.provider_type === 'ollama' && (
                <div>
                  <label className="block text-sm text-nx-mist mb-1">آدرس Ollama</label>
                  <input type="text" value={form.api_base_url} onChange={e => setForm(f => ({ ...f, api_base_url: e.target.value }))}
                    placeholder="http://localhost:11434"
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-blue" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-nx-mist mb-1">Temperature</label>
                  <input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: Number(e.target.value) }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-blue" />
                </div>
                <div>
                  <label className="block text-sm text-nx-mist mb-1">Max Tokens</label>
                  <input type="number" value={form.max_tokens} onChange={e => setForm(f => ({ ...f, max_tokens: Number(e.target.value) }))}
                    className="w-full bg-nx-navy border border-nx-navy-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-nx-blue" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleCreate} className="flex-1 px-4 py-2.5 bg-nx-blue hover:bg-nx-blue text-white rounded-xl font-medium transition">
                  ایجاد ارائه‌دهنده
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 bg-nx-navy hover:bg-nx-navy text-nx-mist rounded-xl transition">
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
