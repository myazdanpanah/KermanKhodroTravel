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

function setFaviconLink(href: string, type = 'image/png') {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = type
  link.href = href

  // Update Apple touch icon for iOS devices
  let appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (!appleLink) {
    appleLink = document.createElement('link')
    appleLink.rel = 'apple-touch-icon'
    document.head.appendChild(appleLink)
  }
  appleLink.href = href

  const applePrecomposed = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon-precomposed"]')
  if (applePrecomposed) {
    applePrecomposed.href = href
  }
}

export function applyMetadata(b: Branding) {
  if (b.name) {
    let titleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    if (!titleMeta) {
      titleMeta = document.createElement('meta')
      titleMeta.name = 'apple-mobile-web-app-title'
      document.head.appendChild(titleMeta)
    }
    titleMeta.content = b.name

    let appNameMeta = document.querySelector<HTMLMetaElement>('meta[name="application-name"]')
    if (!appNameMeta) {
      appNameMeta = document.createElement('meta')
      appNameMeta.name = 'application-name'
      document.head.appendChild(appNameMeta)
    }
    appNameMeta.content = b.name

    if (!document.title.includes(b.name)) {
      document.title = `${b.name} | سامانه مدیریت سازمانی`
    }
  }
}

/**
 * Point the browser tab icon and iOS Apple Touch icon at the uploaded organizational logo.
 *
 * Uses 192x192 canvas with `contain` scaling and padding so it looks crisp on
 * Retina iOS home screen icons, Safari webclips, and browser tabs.
 */
function applyFavicon(b: Branding) {
  const src = b.logoUrl
  if (!src) {
    setFaviconLink('/brand/nexivo-favicon.png')
    return
  }

  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    const size = 192
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx || !image.width || !image.height) {
      setFaviconLink(src)
      return
    }
    const scale = Math.min((size - 16) / image.width, (size - 16) / image.height)
    const width = image.width * scale
    const height = image.height * scale
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
    setFaviconLink(canvas.toDataURL('image/png'))
  }
  image.onerror = () => setFaviconLink(src)
  image.src = src
}

function persist(b: Branding) {
  applyBranding(b)
  applyFavicon(b)
  applyMetadata(b)
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
