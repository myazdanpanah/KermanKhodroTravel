import { useState, useEffect, useCallback } from 'react'
import { ssoApi, type SSOProvider, type SSOLoginAttempt, type SSOUserMapping } from '../../api/sso'

// ─── Types ──────────────────────────────────────────────────────
type Tab = 'providers' | 'audit' | 'mappings' | 'settings'
type ProviderForm = Partial<SSOProvider> & { protocol: 'oidc' | 'saml' }

// ─── Provider Card ──────────────────────────────────────────────
function ProviderCard({
  provider,
  onEdit,
  onToggle,
  onTest,
  onDelete,
}: {
  provider: SSOProvider
  onEdit: (p: SSOProvider) => void
  onToggle: (id: number) => void
  onTest: (id: number) => void
  onDelete: (id: number) => void
}) {
  const statusColor = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }[provider.status]

  const protocolIcon = provider.protocol === 'oidc' ? '🔑' : '🛡️'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-2xl">
            {protocolIcon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{provider.name}</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span>{provider.protocol.toUpperCase()}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-xs font-mono text-gray-400">{provider.slug}</span>
            </div>
          </div>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {provider.status}
        </span>
      </div>

      {provider.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{provider.description}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {provider.is_configured && (
          <span className="px-2 py-0.5 rounded text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
            ✓ Configured
          </span>
        )}
        {provider.jit_provisioning && (
          <span className="px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            JIT Provisioning
          </span>
        )}
        {provider.allowed_domains.length > 0 && (
          <span className="px-2 py-0.5 rounded text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
            {provider.allowed_domains.length} domain{provider.allowed_domains.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => onEdit(provider)}
          className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onTest(provider.id)}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Test
        </button>
        <button
          onClick={() => onToggle(provider.id)}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {provider.status === 'active' ? 'Disable' : 'Enable'}
        </button>
        <button
          onClick={() => onDelete(provider.id)}
          className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ─── Provider Form Modal ────────────────────────────────────────
function ProviderFormModal({
  provider,
  onClose,
  onSave,
}: {
  provider: SSOProvider | null
  onClose: () => void
  onSave: (data: ProviderForm) => void
}) {
  const [form, setForm] = useState<ProviderForm>({
    name: '',
    slug: '',
    protocol: 'oidc',
    status: 'pending',
    description: '',
    saml_entity_id: '',
    saml_sso_url: '',
    saml_slo_url: '',
    saml_certificate: '',
    saml_metadata_url: '',
    saml_name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    oidc_client_id: '',
    oidc_client_secret: '',
    oidc_discovery_url: '',
    oidc_authorization_url: '',
    oidc_token_url: '',
    oidc_userinfo_url: '',
    oidc_jwks_url: '',
    oidc_scopes: ['openid', 'email', 'profile'],
    jit_provisioning: true,
    default_role: 'updater',
    default_modules: [],
    attribute_mapping: { email: 'email', first_name: 'first_name', last_name: 'last_name' },
    allowed_domains: [],
    logo_url: '',
    ...provider,
  })

  const [domainsInput, setDomainsInput] = useState(form.allowed_domains?.join(', ') || '')
  const [scopesInput, setScopesInput] = useState(form.oidc_scopes?.join(', ') || '')

  useEffect(() => {
    if (provider) {
      setForm({ ...form, ...provider })
      setDomainsInput(provider.allowed_domains?.join(', ') || '')
      setScopesInput(provider.oidc_scopes?.join(', ') || '')
    }
  }, [provider])

  const handleSave = () => {
    onSave({
      ...form,
      allowed_domains: domainsInput.split(',').map(d => d.trim()).filter(Boolean),
      oidc_scopes: scopesInput.split(',').map(s => s.trim()).filter(Boolean),
    })
  }

  const update = (field: keyof ProviderForm, value: unknown) => setForm(f => ({ ...f, [field]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {provider ? 'Edit Provider' : 'Add SSO Provider'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  value={form.name || ''}
                  onChange={e => update('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g. Okta Production"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Protocol *</label>
                <select
                  value={form.protocol}
                  onChange={e => update('protocol', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="oidc">OpenID Connect (OIDC)</option>
                  <option value="saml">SAML 2.0</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input
                  value={form.description || ''}
                  onChange={e => update('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Optional description"
                />
              </div>
            </div>
          </div>

          {/* OIDC Fields */}
          {form.protocol === 'oidc' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">OpenID Connect</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discovery URL *</label>
                  <input
                    value={form.oidc_discovery_url || ''}
                    onChange={e => update('oidc_discovery_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                    placeholder="https://your-idp.com/.well-known/openid-configuration"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client ID *</label>
                    <input
                      value={form.oidc_client_id || ''}
                      onChange={e => update('oidc_client_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client Secret *</label>
                    <input
                      type="password"
                      value={form.oidc_client_secret || ''}
                      onChange={e => update('oidc_client_secret', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scopes (comma-separated)</label>
                  <input
                    value={scopesInput}
                    onChange={e => setScopesInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="openid, email, profile"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SAML Fields */}
          {form.protocol === 'saml' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">SAML 2.0</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Entity ID *</label>
                    <input
                      value={form.saml_entity_id || ''}
                      onChange={e => update('saml_entity_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                      placeholder="https://your-app.com/saml/metadata"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SSO URL *</label>
                    <input
                      value={form.saml_sso_url || ''}
                      onChange={e => update('saml_sso_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                      placeholder="https://your-idp.com/sso/saml"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metadata URL</label>
                  <input
                    value={form.saml_metadata_url || ''}
                    onChange={e => update('saml_metadata_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">X.509 Certificate (PEM)</label>
                  <textarea
                    value={form.saml_certificate || ''}
                    onChange={e => update('saml_certificate', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                    placeholder="-----BEGIN CERTIFICATE-----"
                  />
                </div>
              </div>
            </div>
          )}

          {/* User Provisioning */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">User Provisioning</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => update('jit_provisioning', !form.jit_provisioning)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.jit_provisioning ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.jit_provisioning ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">JIT Provisioning</div>
                  <div className="text-xs text-gray-500">Auto-create users on first SSO login</div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allowed Email Domains (comma-separated)</label>
                <input
                  value={domainsInput}
                  onChange={e => setDomainsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="acme.com, example.org"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {provider ? 'Save Changes' : 'Add Provider'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Audit Table ────────────────────────────────────────────────
function AuditTable({ attempts }: { attempts: SSOLoginAttempt[] }) {
  const statusColor = (s: string) => ({
    success: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    failed: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    error: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  }[s] || 'text-gray-600')

  if (!attempts.length) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <div className="text-3xl mb-2">📋</div>
        <div>No login attempts recorded yet</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Provider</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">User</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">IP</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Time</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map(a => (
            <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-3 px-4">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a.status)}`}>
                  {a.status}
                </span>
              </td>
              <td className="py-3 px-4 text-gray-900 dark:text-gray-200">{a.external_email || '—'}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{a.provider_name}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{a.username || '—'}</td>
              <td className="py-3 px-4 text-gray-500 font-mono text-xs">{a.ip_address || '—'}</td>
              <td className="py-3 px-4 text-gray-500 text-xs">{new Date(a.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────
export default function SSOSettingsPage() {
  const [tab, setTab] = useState<Tab>('providers')
  const [providers, setProviders] = useState<SSOProvider[]>([])
  const [attempts, setAttempts] = useState<SSOLoginAttempt[]>([])
  const [mappings, setMappings] = useState<SSOUserMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState<SSOProvider | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null)

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await ssoApi.getProviders()
      setProviders((res.data as any)?.results || res.data || [])
    } catch {
      setError('Failed to load SSO providers')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAttempts = useCallback(async () => {
    try {
      const res = await ssoApi.getAttempts()
      setAttempts((res.data as any)?.results || res.data || [])
    } catch { /* ignore */ }
  }, [])

  const fetchMappings = useCallback(async () => {
    try {
      const res = await ssoApi.getMappings()
      setMappings((res.data as any)?.results || res.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchProviders()
    fetchAttempts()
    fetchMappings()
  }, [fetchProviders, fetchAttempts, fetchMappings])

  const handleSave = async (data: ProviderForm) => {
    try {
      if (editingProvider) {
        await ssoApi.updateProvider(editingProvider.id, data)
      } else {
        await ssoApi.createProvider(data)
      }
      setShowForm(false)
      setEditingProvider(null)
      fetchProviders()
    } catch (err) {
      setError('Failed to save provider')
    }
  }

  const handleTest = async (id: number) => {
    try {
      const res = await ssoApi.testConnection(id)
      setTestResult({ id, ...res.data })
      setTimeout(() => setTestResult(null), 5000)
    } catch {
      setTestResult({ id, success: false, message: 'Connection test failed' })
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  const handleToggle = async (id: number) => {
    try {
      await ssoApi.toggleStatus(id)
      fetchProviders()
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this SSO provider? This cannot be undone.')) return
    try {
      await ssoApi.deleteProvider(id)
      fetchProviders()
    } catch { /* ignore */ }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'providers', label: 'Providers', icon: '🏢' },
    { key: 'audit', label: 'Login Audit', icon: '📋' },
    { key: 'mappings', label: 'User Mappings', icon: '🔗' },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SSO & Identity</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Configure SAML and OIDC identity providers for single sign-on
          </p>
        </div>
        <button
          onClick={() => { setEditingProvider(null); setShowForm(true) }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <span>+</span> Add Provider
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between">
          <span className="text-red-700 dark:text-red-400 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Test Result Toast */}
      {testResult && (
        <div className={`rounded-xl p-4 flex items-center gap-3 text-sm font-medium ${
          testResult.success
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>
          <span>{testResult.success ? '✅' : '❌'}</span>
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
            {t.key === 'audit' && attempts.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                {attempts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Providers Tab */}
          {tab === 'providers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map(p => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  onEdit={pp => { setEditingProvider(pp); setShowForm(true) }}
                  onToggle={handleToggle}
                  onTest={handleTest}
                  onDelete={handleDelete}
                />
              ))}
              {providers.length === 0 && (
                <div className="col-span-full text-center py-16 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-3">🔐</div>
                  <div className="text-lg font-medium mb-1">No SSO providers configured</div>
                  <div className="text-sm">Add an identity provider to enable single sign-on for your team</div>
                </div>
              )}
            </div>
          )}

          {/* Audit Tab */}
          {tab === 'audit' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <AuditTable attempts={attempts} />
            </div>
          )}

          {/* Mappings Tab */}
          {tab === 'mappings' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {mappings.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-500">External ID</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-500">Provider</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-500">Local User</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-500">Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map(m => (
                        <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-400">{m.external_id}</td>
                          <td className="py-3 px-4 text-gray-900 dark:text-gray-200">{m.external_email}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{m.provider_name}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{m.username}</td>
                          <td className="py-3 px-4 text-xs text-gray-500">{m.last_login_at ? new Date(m.last_login_at).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-3xl mb-2">🔗</div>
                  <div>No user mappings yet</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <ProviderFormModal
          provider={editingProvider}
          onClose={() => { setShowForm(false); setEditingProvider(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
