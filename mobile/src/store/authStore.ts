/**
 * Nexivo ERP Mobile - Auth Store
 * Phase 17: Mobile App (React Native)
 */

import { create } from 'zustand'
import { api } from '../api/client'

interface User {
  id: number
  username: string
  email: string
  role: string
  company?: { id: number; name: string }
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null })
    try {
      const data = await api.login(username, password)
      set({ user: data.user, isAuthenticated: true, isLoading: false })
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Login failed'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  logout: async () => {
    await api.logout()
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    set({ isLoading: true })
    try {
      const isLoggedIn = await api.isLoggedIn()
      if (isLoggedIn) {
        const user = await api.getCurrentUser()
        set({ user, isAuthenticated: !!user, isLoading: false })
      } else {
        set({ isAuthenticated: false, isLoading: false })
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
