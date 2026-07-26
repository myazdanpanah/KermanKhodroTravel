/**
 * SSO & Identity API Client
 */
import apiClient from './client'

export interface SSOProvider {
  id: number
  name: string
  slug: string
  protocol: 'saml' | 'oidc'
  status: 'active' | 'inactive' | 'pending'
  description: string
  is_configured: boolean
  // SAML
  saml_entity_id: string
  saml_sso_url: string
  saml_slo_url: string
  saml_certificate: string
  saml_metadata_url: string
  saml_name_id_format: string
  // OIDC
  oidc_client_id: string
  oidc_client_secret: string
  oidc_discovery_url: string
  oidc_authorization_url: string
  oidc_token_url: string
  oidc_userinfo_url: string
  oidc_jwks_url: string
  oidc_scopes: string[]
  // Provisioning
  jit_provisioning: boolean
  default_role: string
  default_modules: string[]
  attribute_mapping: Record<string, string>
  allowed_domains: string[]
  // Meta
  logo_url: string
  created_by: number
  created_by_name: string
  created_at: string
}

export interface SSOLoginAttempt {
  id: number
  provider: number
  provider_name: string
  status: 'success' | 'failed' | 'error'
  external_email: string
  external_id: string
  user: number
  username: string
  ip_address: string
  user_agent: string
  error_message: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface SSOUserMapping {
  id: number
  provider: number
  provider_name: string
  external_id: string
  external_email: string
  user: number
  username: string
  last_login_at: string | null
  created_at: string
}

export const ssoApi = {
  // Providers
  getProviders: () => apiClient.get<SSOProvider[]>('/api/v1/sso/providers/'),
  getProvider: (id: number) => apiClient.get<SSOProvider>(`/api/v1/sso/providers/${id}/`),
  createProvider: (data: Partial<SSOProvider>) => apiClient.post<SSOProvider>('/api/v1/sso/providers/', data),
  updateProvider: (id: number, data: Partial<SSOProvider>) => apiClient.put<SSOProvider>(`/api/v1/sso/providers/${id}/`, data),
  deleteProvider: (id: number) => apiClient.delete(`/api/v1/sso/providers/${id}/`),

  // Provider actions
  testConnection: (id: number) => apiClient.post<{ success: boolean; message: string; metadata?: Record<string, unknown> }>(`/api/v1/sso/providers/${id}/test_connection/`),
  toggleStatus: (id: number) => apiClient.post<{ status: string }>(`/api/v1/sso/providers/${id}/toggle_status/`),
  getLoginAttempts: (id: number) => apiClient.get<SSOLoginAttempt[]>(`/api/v1/sso/providers/${id}/login_attempts/`),

  // Auth flow
  initiateLogin: (providerSlug: string, redirectUri?: string) =>
    apiClient.post<{ redirect_url: string; state: string }>('/api/v1/sso/initiate/', { provider_slug: providerSlug, redirect_uri: redirectUri }),
  handleCallback: (providerSlug: string, data: Record<string, string>) =>
    apiClient.post<{ access: string; refresh: string; user: Record<string, unknown>; is_new_user: boolean }>(`/api/v1/sso/callback/${providerSlug}/`, data),

  // Audit
  getMappings: () => apiClient.get<SSOUserMapping[]>('/api/v1/sso/mappings/'),
  getAttempts: (statusFilter?: string) =>
    apiClient.get<SSOLoginAttempt[]>('/api/v1/sso/attempts/', { params: statusFilter ? { status: statusFilter } : {} }),
}
