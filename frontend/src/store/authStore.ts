import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name?: string
  role: 'finance' | 'sales' | 'ceo' | 'admin'
  department: string
  isStaff?: boolean
  is_superuser?: boolean
  company_name?: string | null
  accessible_modules?: string[]
  /** Billing permission flags (spec §6.1); drives UI visibility. */
  permissions?: Record<string, boolean>
  avatar_url?: string | null
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  updateUser: (patch: Partial<User>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (patch) =>
        set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user })),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'nexivo-auth',
    }
  )
)
