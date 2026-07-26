import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/client'
import { LogIn } from 'lucide-react'

interface SSOProviderInfo {
  id: number
  name: string
  slug: string
  protocol: 'oidc' | 'saml'
  logo_url: string
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoProviders, setSsoProviders] = useState<SSOProviderInfo[]>([])
  const [ssoLoading, setSsoLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  // Fetch available SSO providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await api.get('/sso/providers/public/')
        const data = (res.data as any)?.results || res.data
        if (Array.isArray(data)) {
          setSsoProviders(data.filter((p: SSOProviderInfo) => p.protocol === 'oidc' || p.protocol === 'saml'))
        }
      } catch {
        // SSO not configured or not available — silently ignore
      }
    }
    fetchProviders()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.post('/auth/login/', { username, password })
      setAuth(res.data.token, { ...res.data.user, isStaff: res.data.user.is_staff })
      navigate('/')
    } catch (err: unknown) {
      let message = 'خطای ورود'
      if (err instanceof Error) {
        message = err.message
      } else if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string; detail?: string } } }
        message = axiosErr.response?.data?.error || axiosErr.response?.data?.detail || message
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSSOLogin = async (provider: SSOProviderInfo) => {
    setSsoLoading(true)
    setError('')
    try {
      const res = await api.post('/sso/initiate/', {
        provider_slug: provider.slug,
        redirect_uri: `${window.location.origin}/sso/callback/${provider.slug}/`,
      })
      const { redirect_url } = res.data
      if (redirect_url) {
        window.location.href = redirect_url
      } else {
        setError('SSO initiation failed: no redirect URL')
        setSsoLoading(false)
      }
    } catch (err: unknown) {
      let message = 'SSO login failed'
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string; detail?: string } } }
        message = axiosErr.response?.data?.error || axiosErr.response?.data?.detail || message
      }
      setError(message)
      setSsoLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">نکسیوو</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">سیستم‌عامل سازمانی</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام کاربری</label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              placeholder="نام کاربری خود را وارد کنید"
              dir="rtl"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رمز عبور</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              placeholder="رمز عبور خود را وارد کنید"
              dir="rtl"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>

        {/* SSO Login Options */}
        {ssoProviders.length > 0 && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  یا ورود با SSO
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {ssoProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleSSOLogin(provider)}
                  disabled={ssoLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {provider.logo_url ? (
                    <img src={provider.logo_url} alt={provider.name} className="w-5 h-5 object-contain" />
                  ) : (
                    <span className="text-lg">{provider.protocol === 'oidc' ? '🔑' : '🛡️'}</span>
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ورود با {provider.name}
                  </span>
                  {ssoLoading && (
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
