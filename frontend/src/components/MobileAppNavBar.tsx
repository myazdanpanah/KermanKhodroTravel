import { useState, useEffect } from 'react'
import { useLocation, useNavigate, NavLink } from 'react-router-dom'
import {
  LayoutGrid,
  BarChart3,
  MessageSquare,
  Menu,
  Plus,
  X,
  ChevronLeft,
  Check,
} from 'lucide-react'
import { useMessagingStore } from '../store/messagingStore'
import { useAuthStore } from '../store/authStore'
import { useQuickActions } from '../lib/quickActions'
import { ERP_NAV_SECTIONS } from '../lib/erpNavigation'
import { toPersianDigits } from '../pages/messaging/presenceUtils'

const SHEET_TRANSITION_MS = 250

export default function MobileAppNavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const conversations = useMessagingStore((s) => s.conversations)
  const quickActions = useQuickActions()

  const [quickOpen, setQuickOpen] = useState(false)
  const [erpMenuOpen, setErpMenuOpen] = useState(false)

  const totalUnreadChat = conversations.reduce(
    (sum, c) => sum + (c.unread_count || 0),
    0
  )

  // Close drawers when route changes
  useEffect(() => {
    setQuickOpen(false)
    setErpMenuOpen(false)
  }, [location.pathname])

  const isSystemAdmin = user?.role === 'admin' || user?.is_superuser === true
  const sections = isSystemAdmin
    ? ERP_NAV_SECTIONS
    : ERP_NAV_SECTIONS.filter((s) => s.id !== 'settings')

  const isOrbitEnabled =
    user?.is_superuser ||
    user?.role === 'admin' ||
    Boolean(user?.accessible_modules?.some((m) => m === 'orbit' || m === 'messaging'))

  const goFromQuick = (to: string) => {
    setQuickOpen(false)
    window.setTimeout(() => navigate(to), SHEET_TRANSITION_MS)
  }

  const goFromErpMenu = (to: string) => {
    setErpMenuOpen(false)
    window.setTimeout(() => navigate(to), SHEET_TRANSITION_MS)
  }

  const isLauncherActive = location.pathname === '/' || location.pathname === '/launcher'
  const isBiActive = location.pathname.startsWith('/dashboards') || location.pathname.startsWith('/erp/management')
  const isOrbitActive = location.pathname.startsWith('/orbit')
  const isErpActive = location.pathname.startsWith('/erp') && !location.pathname.startsWith('/erp/management')

  return (
    <>
      {/* ─── Global Mobile Bottom Navigation Bar ─────────────────── */}
      <nav
        aria-label="ناوبری اصلی موبایل"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:border-nx-navy-border dark:bg-nx-navy/95 transition-colors duration-300"
        style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom, 0px))' }}
        dir="rtl"
      >
        <div className={`grid items-end relative py-1 px-1 ${isOrbitEnabled ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {/* Tab 1: Launcher */}
          <NavLink
            to="/launcher"
            onClick={() => { setQuickOpen(false); setErpMenuOpen(false) }}
            className={`group relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all duration-200 active:scale-95 ${
              isLauncherActive
                ? 'text-nx-blue dark:text-nx-teal font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-nx-mist dark:hover:text-white'
            }`}
          >
            {isLauncherActive && (
              <span className="absolute inset-x-1 inset-y-0.5 -z-10 rounded-xl bg-nx-blue/10 dark:bg-nx-teal/15 transition-all" />
            )}
            <LayoutGrid className="w-5 h-5 transition-transform group-hover:scale-105" />
            <span className="text-[10px] mt-0.5">لانچر</span>
          </NavLink>

          {/* Tab 2: BI Dashboards */}
          <NavLink
            to="/dashboards"
            onClick={() => { setQuickOpen(false); setErpMenuOpen(false) }}
            className={`group relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all duration-200 active:scale-95 ${
              isBiActive
                ? 'text-nx-blue dark:text-nx-teal font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-nx-mist dark:hover:text-white'
            }`}
          >
            {isBiActive && (
              <span className="absolute inset-x-1 inset-y-0.5 -z-10 rounded-xl bg-nx-blue/10 dark:bg-nx-teal/15 transition-all" />
            )}
            <BarChart3 className="w-5 h-5 transition-transform group-hover:scale-105" />
            <span className="text-[10px] mt-0.5">هوش تجاری</span>
          </NavLink>

          {/* Tab 3 (Center Slot): Floating Quick Action Button (+) */}
          <div className="flex items-center justify-center relative h-10">
            <button
              onClick={() => {
                setErpMenuOpen(false)
                setQuickOpen((prev) => !prev)
              }}
              aria-label="اقدام سریع جدید"
              aria-expanded={quickOpen}
              className="absolute -top-7 left-1/2 -translate-x-1/2 grid h-14 w-14 place-items-center rounded-full bg-nx-teal text-white shadow-xl ring-4 ring-white dark:ring-nx-navy transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <Plus
                className={`h-7 w-7 transition-transform duration-300 ${
                  quickOpen ? 'rotate-45' : ''
                }`}
              />
            </button>
          </div>

          {/* Tab 4: Messenger (Orbit) — visible only if enabled for organization */}
          {isOrbitEnabled && (
            <NavLink
              to="/orbit"
              onClick={() => { setQuickOpen(false); setErpMenuOpen(false) }}
              className={`group relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all duration-200 active:scale-95 ${
                isOrbitActive
                  ? 'text-nx-blue dark:text-nx-teal font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-nx-mist dark:hover:text-white'
              }`}
            >
              {isOrbitActive && (
                <span className="absolute inset-x-1 inset-y-0.5 -z-10 rounded-xl bg-nx-blue/10 dark:bg-nx-teal/15 transition-all" />
              )}
              <div className="relative">
                <MessageSquare className="w-5 h-5 transition-transform group-hover:scale-105" />
                {totalUnreadChat > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-nx-navy animate-pulse">
                    {toPersianDigits(totalUnreadChat)}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5">پیام‌رسان</span>
            </NavLink>
          )}

          {/* Tab 5: ERP Subsystem Menu */}
          <button
            onClick={() => {
              setQuickOpen(false)
              setErpMenuOpen((prev) => !prev)
            }}
            aria-label="منوی سامانه ERP"
            aria-expanded={erpMenuOpen}
            className={`group relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all duration-200 active:scale-95 ${
              isErpActive || erpMenuOpen
                ? 'text-nx-blue dark:text-nx-teal font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-nx-mist dark:hover:text-white'
            }`}
          >
            {(isErpActive || erpMenuOpen) && (
              <span className="absolute inset-x-1 inset-y-0.5 -z-10 rounded-xl bg-nx-blue/10 dark:bg-nx-teal/15 transition-all" />
            )}
            <Menu className="w-5 h-5 transition-transform group-hover:scale-105" />
            <span className="text-[10px] mt-0.5">منوی ERP</span>
          </button>
        </div>
      </nav>

      {/* ─── Backdrop Overlay ─────────────────── */}
      {(quickOpen || erpMenuOpen) && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity duration-300"
          onClick={() => {
            setQuickOpen(false)
            setErpMenuOpen(false)
          }}
        />
      )}

      {/* ─── Quick Actions Bottom Sheet (+) ─────────────────── */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 lg:hidden will-change-transform ${
          quickOpen ? '' : 'pointer-events-none'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: quickOpen ? 'translateY(0)' : 'translateY(115%)',
          transition: `transform ${SHEET_TRANSITION_MS}ms ease-out`,
        }}
        aria-hidden={!quickOpen}
        dir="rtl"
      >
        <div className="mx-2 mb-2 max-h-[82dvh] overflow-y-auto rounded-3xl bg-white border border-slate-200 shadow-2xl overscroll-contain dark:bg-nx-navy-elevated dark:border-nx-navy-border">
          <div className="flex justify-center pt-2.5 pb-1">
            <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-nx-mist/40" />
          </div>
          <div className="flex items-center justify-between px-5 pb-2 pt-1 border-b border-slate-100 dark:border-nx-navy-border">
            <h2 className="text-base font-bold text-nx-navy dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-nx-teal/15 text-nx-teal text-xs">
                +
              </span>
              ثبت جدید و اقدام سریع
            </h2>
            <button
              onClick={() => setQuickOpen(false)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-black/5 dark:text-nx-mist dark:hover:bg-white/5"
            >
              <X className="w-4 h-4" /> بستن
            </button>
          </div>
          <div className="px-3 py-3 space-y-1.5">
            {quickActions.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-nx-mist">
                موردی برای حساب کاربری شما تعریف نشده است.
              </p>
            ) : (
              quickActions.map((action) => (
                <button
                  key={action.to}
                  onClick={() => goFromQuick(action.to)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-right text-nx-navy hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/5 transition-colors active:scale-[0.98]"
                >
                  <span className="w-10 h-10 rounded-xl grid place-items-center bg-gradient-to-tr from-nx-teal/15 to-nx-blue/15 text-nx-teal dark:text-nx-teal flex-shrink-0">
                    <action.icon className="w-5 h-5" />
                  </span>
                  <div className="flex-1">
                    <span className="text-sm font-semibold block">{action.label}</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400 dark:text-nx-mist" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── ERP Sub-Modules Bottom Sheet (منوی ERP) ─────────────────── */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 lg:hidden will-change-transform ${
          erpMenuOpen ? '' : 'pointer-events-none'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: erpMenuOpen ? 'translateY(0)' : 'translateY(115%)',
          transition: `transform ${SHEET_TRANSITION_MS}ms ease-out`,
        }}
        aria-hidden={!erpMenuOpen}
        dir="rtl"
      >
        <div className="mx-2 mb-2 rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden dark:bg-nx-navy-elevated dark:border-nx-navy-border">
          <div className="flex justify-center pt-2.5 pb-1">
            <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-nx-mist/40" />
          </div>
          <div className="flex items-center justify-between px-5 pb-2 pt-1 border-b border-slate-100 dark:border-nx-navy-border">
            <h2 className="text-base font-bold text-nx-navy dark:text-white flex items-center gap-2">
              <Menu className="w-5 h-5 text-nx-teal" />
              منوی بخش‌های سامانه ERP
            </h2>
            <button
              onClick={() => setErpMenuOpen(false)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-black/5 dark:text-nx-mist dark:hover:bg-white/5"
            >
              <X className="w-4 h-4" /> بستن
            </button>
          </div>
          <div className="max-h-[68vh] overflow-y-auto px-3 py-3 space-y-4">
            {sections.map((section) => (
              <div key={section.id}>
                <p className="px-2 mb-1.5 text-[11px] font-bold tracking-wide text-slate-400 dark:text-nx-mist">
                  {section.label}
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {section.items.map((item) => {
                    const active = item.end
                      ? location.pathname === item.to
                      : location.pathname.startsWith(item.to) && item.to !== '/erp'
                    return (
                      <button
                        key={item.to}
                        onClick={() => goFromErpMenu(item.to)}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-right transition ${
                          active
                            ? 'bg-nx-teal/10 text-nx-teal dark:bg-nx-blue/15 dark:text-white font-bold'
                            : 'text-nx-navy hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${
                            active
                              ? 'bg-nx-teal text-white dark:bg-nx-blue'
                              : 'bg-black/5 text-slate-500 dark:bg-white/5 dark:text-nx-mist'
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                        </span>
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                        {active && <Check className="w-4 h-4 text-nx-teal dark:text-nx-blue" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
