/**
 * Nexivo ERP Mobile API Client
 * Phase 17: Mobile App (React Native)
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

class ApiClient {
  private client: AxiosInstance
  private token: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor - attach token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (!this.token) {
          this.token = await SecureStore.getItemAsync('auth_token')
        }
        if (this.token && config.headers) {
          config.headers.Authorization = `Bearer ${this.token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor - handle 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.logout()
        }
        return Promise.reject(error)
      }
    )
  }

  // ─── Auth ────────────────────────────────────────────────

  async login(username: string, password: string) {
    const response = await this.client.post('/auth/login/', { username, password })
    const { access, refresh, user } = response.data

    this.token = access
    await SecureStore.setItemAsync('auth_token', access)
    await SecureStore.setItemAsync('refresh_token', refresh)
    await SecureStore.setItemAsync('user', JSON.stringify(user))

    return response.data
  }

  async logout() {
    this.token = null
    await SecureStore.deleteItemAsync('auth_token')
    await SecureStore.deleteItemAsync('refresh_token')
    await SecureStore.deleteItemAsync('user')
  }

  async refreshToken() {
    const refreshToken = await SecureStore.getItemAsync('refresh_token')
    if (!refreshToken) throw new Error('No refresh token')

    const response = await this.client.post('/auth/token/refresh/', { refresh: refreshToken })
    const { access } = response.data

    this.token = access
    await SecureStore.setItemAsync('auth_token', access)

    return access
  }

  async getCurrentUser() {
    const userStr = await SecureStore.getItemAsync('user')
    return userStr ? JSON.parse(userStr) : null
  }

  async isLoggedIn(): Promise<boolean> {
    const token = await SecureStore.getItemAsync('auth_token')
    return !!token
  }

  // ─── Dashboard ───────────────────────────────────────────

  async getDashboard() {
    return this.client.get('/ai/dashboard/')
  }

  async getInsights(params?: { module?: string; severity?: string }) {
    return this.client.get('/ai/insights/', { params })
  }

  // ─── Anomalies ───────────────────────────────────────────

  async getAnomalies(params?: { module?: string; severity?: string; is_resolved?: boolean }) {
    return this.client.get('/ai/anomalies/', { params })
  }

  async detectAnomalies(module: string) {
    return this.client.post('/ai/anomalies/detect/', { module })
  }

  async resolveAnomaly(id: number) {
    return this.client.post(`/ai/anomalies/${id}/resolve/`)
  }

  // ─── Forecasts ───────────────────────────────────────────

  async getForecasts(params?: { module?: string }) {
    return this.client.get('/ai/forecasts/', { params })
  }

  async generateForecast(module: string, metric: string, periods: number = 12) {
    return this.client.post('/ai/forecasts/generate/', { module, metric, periods })
  }

  // ─── NL Queries ──────────────────────────────────────────

  async sendNLQuery(query: string) {
    return this.client.post('/ai/nl-queries/', { query })
  }

  async getNLHistory() {
    return this.client.get('/ai/nl-queries/history/')
  }

  // ─── Alerts ──────────────────────────────────────────────

  async getAlerts(params?: { is_read?: boolean }) {
    return this.client.get('/ai/alerts/', { params })
  }

  async markAlertRead(id: number) {
    return this.client.post(`/ai/alerts/${id}/read/`)
  }

  async markAllAlertsRead() {
    return this.client.post('/ai/alerts/mark-all-read/')
  }

  async getAlertSummary() {
    return this.client.get('/ai/alerts/summary/')
  }

  // ─── Finance ─────────────────────────────────────────────

  async getInvoices(params?: Record<string, unknown>) {
    return this.client.get('/finance/invoices/', { params })
  }

  async getExpenses(params?: Record<string, unknown>) {
    return this.client.get('/finance/expenses/', { params })
  }

  // ─── Sales ───────────────────────────────────────────────

  async getOrders(params?: Record<string, unknown>) {
    return this.client.get('/sales/orders/', { params })
  }

  async getCustomers(params?: Record<string, unknown>) {
    return this.client.get('/sales/customers/', { params })
  }

  // ─── Inventory ───────────────────────────────────────────

  async getProducts(params?: Record<string, unknown>) {
    return this.client.get('/inventory/products/', { params })
  }

  async getStockLevels(params?: Record<string, unknown>) {
    return this.client.get('/inventory/stock-levels/', { params })
  }

  // ─── Generic GET ─────────────────────────────────────────

  async get(path: string, params?: Record<string, unknown>) {
    return this.client.get(path, { params })
  }

  async post(path: string, data?: Record<string, unknown>) {
    return this.client.post(path, data)
  }
}

export const api = new ApiClient()
export default api
