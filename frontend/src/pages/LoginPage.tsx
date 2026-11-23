import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore, DEFAULT_LOCKUP } from '../store/brandingStore'
import api from '../api/client'

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
  const branding = useBrandingStore((s) => s.branding)
  const logo = branding.logoUrl || DEFAULT_LOCKUP
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
    <div className="min-h-screen flex items-center justify-center bg-nx-navy p-6 pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+1.5rem))] pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1.5rem))]">
      <div className="w-full max-w-md p-6 bg-white rounded-nx-card border border-nx-border shadow-nx-card">
        <div className="flex flex-col items-center mb-8">
          <img
            src={logo}
            alt={branding.name || 'Nexivo'}
            draggable={false}
            className="h-28 w-auto select-none"
          />
          <p className="text-nx-muted mt-4 text-sm">سیستم‌عامل سازمانی</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-nx-navy mb-2">نام کاربری</label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-nx-btn border border-nx-border bg-white text-nx-navy placeholder:text-nx-mist focus:outline-none focus:ring-2 focus:ring-nx-blue focus:border-nx-blue transition"
              placeholder="نام کاربری خود را وارد کنید"
              dir="rtl"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-nx-navy mb-2">رمز عبور</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-nx-btn border border-nx-border bg-white text-nx-navy placeholder:text-nx-mist focus:outline-none focus:ring-2 focus:ring-nx-blue focus:border-nx-blue transition"
              placeholder="رمز عبور خود را وارد کنید"
              dir="rtl"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-nx-danger-50 border border-nx-danger-200 rounded-xl text-nx-danger-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-nx-navy text-white rounded-nx-btn font-medium hover:bg-nx-blue hover:text-nx-navy focus:outline-none focus:ring-2 focus:ring-nx-blue focus:ring-offset-2 transition disabled:bg-nx-mist disabled:text-nx-muted disabled:cursor-not-allowed"
          >
            {loading ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>

        {/* SSO Login Options */}
        {ssoProviders.length > 0 && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-nx-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-nx-muted text-sm">
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
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-nx-teal text-nx-teal rounded-nx-btn hover:bg-nx-teal/10 focus:outline-none focus:ring-2 focus:ring-nx-teal transition disabled:border-nx-mist disabled:text-nx-mist disabled:cursor-not-allowed"
                >
                  {provider.logo_url ? (
                    <img src={provider.logo_url} alt={provider.name} className="w-5 h-5 object-contain" />
                  ) : (
                    <span className="text-lg">{provider.protocol === 'oidc' ? '🔑' : '🛡️'}</span>
                  )}
                  <span className="text-sm font-medium text-nx-teal">
                    ورود با {provider.name}
                  </span>
                  {ssoLoading && (
                    <div className="w-4 h-4 border-2 border-nx-teal border-t-transparent rounded-full animate-spin" />
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
