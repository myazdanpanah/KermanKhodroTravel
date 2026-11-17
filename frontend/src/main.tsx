// Self-hosted Vazirmatn (Persian/Farsi) — no CDN at runtime
import '@fontsource/vazirmatn/300.css'
import '@fontsource/vazirmatn/400.css'
import '@fontsource/vazirmatn/500.css'
import '@fontsource/vazirmatn/600.css'
import '@fontsource/vazirmatn/700.css'
// Jalali calendar/date-picker styles (themed with nx-* tokens in index.css)
import '@seydanloo/persian-calendar/styles.css'
import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/Toast'
import { useThemeStore, syncThemeClass } from './store/themeStore'
import { useBrandingStore, applyBranding } from './store/brandingStore'
import './utils/resizeObserverPolyfill'
import './index.css'

function ThemeSync() {
  const dark = useThemeStore((s) => s.dark)
  useEffect(() => { syncThemeClass(dark) }, [dark])
  return null
}

// Apply cached branding before first paint, then refresh from the server.
applyBranding(useBrandingStore.getState().branding)
void useBrandingStore.getState().load()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ThemeSync />
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
