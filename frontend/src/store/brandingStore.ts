import { create } from 'zustand'
import api from '../api/client'

/**
 * System-wide branding — company logo + brand colors.
 *
 * The single source of truth is the backend (`/auth/company/branding/`), edited by a
 * CEO/Admin in Settings → Branding. Colors are applied as CSS variables that the
 * Tailwind tokens (`nx-blue`, `nx-teal`) resolve to, so a change is instant and
 * needs no rebuild.
 */

export interface Branding {
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  name: string
}

export const BRAND_DEFAULTS: Branding = {
  logoUrl: null,
  primaryColor: '#3678F6',
  accentColor: '#24C6B2',
  name: 'NEXIVO',
}

export const DEFAULT_MARK = '/brand/nexivo-mark.png'
export const DEFAULT_LOCKUP = '/brand/nexivo-logo.png'

const CACHE_KEY = 'nexivo-brand'

function hexToChannels(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

export function applyBranding(b: Branding) {
  const root = document.documentElement
  const primary = hexToChannels(b.primaryColor)
  const accent = hexToChannels(b.accentColor)
  if (primary) root.style.setProperty('--nx-blue', primary)
  if (accent) root.style.setProperty('--nx-teal', accent)
}

function readCache(): Branding {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return { ...BRAND_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore corrupt cache */
  }
  return BRAND_DEFAULTS
}

function fromApi(data: any): Branding {
  return {
    logoUrl: data?.logo_url ?? null,
    primaryColor: data?.primary_color || BRAND_DEFAULTS.primaryColor,
    accentColor: data?.accent_color || BRAND_DEFAULTS.accentColor,
    name: data?.name || BRAND_DEFAULTS.name,
  }
}

/** Point the browser tab icon at the uploaded logo (falls back to the NEXIVO mark). */
function applyFavicon(b: Branding) {
  const href = b.logoUrl || '/brand/nexivo-favicon.png'
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  if (!link.getAttribute('href') || !link.getAttribute('href')!.endsWith(href)) {
    link.href = href
    if (href.endsWith('.png')) link.type = 'image/png'
  }
}

function persist(b: Branding) {
  applyBranding(b)
  applyFavicon(b)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(b))
  } catch {
    /* storage may be unavailable */
  }
}

interface BrandingState {
  branding: Branding
  loaded: boolean
  load: () => Promise<void>
  setBranding: (b: Branding) => void
}

export const useBrandingStore = create<BrandingState>((set, get) => ({
  branding: readCache(),
  loaded: false,

  load: async () => {
    try {
      // Public endpoint: the login screen needs branding before authentication.
      const res = await api.get('/auth/branding/public/')
      const b = fromApi(res.data)
      persist(b)
      set({ branding: b, loaded: true })
    } catch {
      persist(get().branding)
      set({ loaded: true })
    }
  },

  setBranding: (b) => {
    persist(b)
    set({ branding: b })
  },
}))

/** Logo for dark surfaces / loaders — falls back to the Nexivo mark. */
export const useBrandLogo = (fallback: string = DEFAULT_MARK) =>
  useBrandingStore((s) => s.branding.logoUrl || fallback)
