import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore, syncThemeClass } from '../store/themeStore'
import { useBrandLogo } from '../store/brandingStore'
import UserMenu from '../components/UserMenu'
import NotificationBell from '../components/NotificationBell'
import {
  LayoutDashboard, FileText, CreditCard, Users, Gauge, Plus,
  Calendar, Target, TrendingUp, Inbox, Mail,
  Settings, ChevronLeft, ChevronDown,
  Shield, Search, Sun, Moon, Menu, Briefcase, Check, X, FileSignature,
} from 'lucide-react';
import GlobalSearch from '../components/GlobalSearch';
import QuickCreateButton from '../components/QuickCreateButton';
import { useQuickActions } from '../lib/quickActions'

// ─── Navigation Structure ───────────────────────────────────────

interface NavSection {
  id: string
  label: string
  items: NavItem[]
}

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  end?: boolean
}

// The installation is limited to three modules: BI dashboard, finance and CRM.
const NAV_SECTIONS: NavSection[] = [
  {
    id: 'bi',
    label: 'داشبورد',
    items: [
      { to: '/erp', icon: LayoutDashboard, label: 'داشبورد مدیریتی', end: true },
    ],
  },
  {
    id: 'finance',
    label: 'مالی',
    items: [
      { to: '/erp/billing/issue', icon: Plus, label: 'صدور صورت‌حساب' },
      { to: '/erp/billing/invoices', icon: FileText, label: 'صورت‌حساب‌ها' },
      { to: '/erp/billing/payments', icon: CreditCard, label: 'پرداخت‌ها' },
      { to: '/erp/billing/performance', icon: Gauge, label: 'عملکرد' },
      { to: '/erp/billing/payers', icon: Users, label: 'مشتریان' },
      { to: '/erp/billing/services', icon: Briefcase, label: 'خدمات' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { to: '/erp/crm', icon: Users, label: 'داشبورد CRM', end: true },
      { to: '/erp/crm/leads', icon: Target, label: 'سرنخ‌ها' },
      { to: '/erp/crm/opportunities', icon: TrendingUp, label: 'فرصت‌ها' },
      { to: '/erp/crm/activities', icon: Calendar, label: 'فعالیت‌ها' },
    ],
  },
  {
    id: 'office',
    label: 'اداری',
    items: [
      { to: '/erp/office', icon: Inbox, label: 'میزکار اداری', end: true },
      { to: '/erp/office/correspondence', icon: Mail, label: 'نامه‌ها' },
      { to: '/erp/office/contracts', icon: FileSignature, label: 'قراردادها' },
    ],
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    items: [
      { to: '/erp/settings', icon: Settings, label: 'تنظیمات' },
      { to: '/erp/settings/users', icon: Shield, label: 'کاربران' },
    ],
  },
]

// Sheet slide animation; a selection waits for it before navigating.
const SHEET_TRANSITION_MS = 300

// ─── Component ───────────────────────────────────────────────────

export default function ERPLayout() {
  const [collapsed, setCollapsed] = useState(false)
  // Mobile: bottom tab bar plus the menu sheet that slides up over it.
  const [mobileOpen, setMobileOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const quickActions = useQuickActions()
  const sheetRef = useRef<HTMLDivElement>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    finance: true,
  })
  const { user, logout } = useAuthStore()
  const brandLogo = useBrandLogo()
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, toggle: toggleTheme } = useThemeStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  // Close the mobile sheets whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
    setQuickOpen(false)
  }, [location.pathname])

  // Selecting from the sheet: let it slide back down, then show the page.
  const goFromSheet = (to: string) => {
    setMobileOpen(false)
    window.setTimeout(() => navigate(to), SHEET_TRANSITION_MS)
  }

  const goFromQuickAdd = (to: string) => {
    setQuickOpen(false)
    window.setTimeout(() => navigate(to), SHEET_TRANSITION_MS)
  }

  // ⌘K / Ctrl+K opens the same search as the top-bar button.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A closed sheet is off-screen but still mounted: keep its rows out of
  // the tab order so focus cannot land in a menu nobody can see.
  useEffect(() => {
    sheetRef.current?.toggleAttribute('inert', !mobileOpen)
  }, [mobileOpen])

  // Sync dark mode class to <html>
  useEffect(() => {
    syncThemeClass(dark)
  }, [dark])

  // Auto-expand section that contains active route
  useEffect(() => {
    const activeSection = NAV_SECTIONS.find((section) =>
      section.items.some((item) =>
        item.end
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to) && item.to !== '/erp'
      )
    )
    if (activeSection) {
      setExpandedSections((prev) => ({ ...prev, [activeSection.id]: true }))
    }
  }, [location.pathname])

  // Breadcrumb data (computed once per render)
  // Only the three licensed modules (plus settings for admins) are reachable.
  const isAdmin = user?.role === 'admin' || user?.role === 'ceo'
  const allowedPrefixes = isAdmin ? ['/erp/billing', '/erp/crm', '/erp/office', '/erp/settings'] : ['/erp/billing', '/erp/crm', '/erp/office']
  const canIssue = isAdmin || Boolean(user?.permissions?.issue)
  const sections = (isAdmin ? NAV_SECTIONS : NAV_SECTIONS.filter((section) => section.id !== 'settings'))
    .map((section) =>
      section.id === 'finance'
        ? { ...section, items: section.items.filter((item) => item.to !== '/erp/billing/issue' || canIssue) }
        : section
    )

  useEffect(() => {
    const path = location.pathname.replace(/\/$/, '')
    const isRoot = path === '/erp'
    const allowed = isRoot || allowedPrefixes.some((prefix) => path.startsWith(prefix))
    if (!allowed) navigate('/erp', { replace: true })
  }, [location.pathname, allowedPrefixes, navigate])

  const activeSection = NAV_SECTIONS.find((s) =>
    s.items.some((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== '/erp'
    )
  )
  const activeItem = activeSection?.items.find((i) =>
    i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== '/erp'
  )

  return (
    <div className="min-h-screen bg-nx-cream flex dark:bg-nx-navy" dir="rtl">
      {/* Mobile backdrop for the bottom sheet */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar (desktop only; mobile uses the bottom sheet below) ─── */}
      <aside
        className={`
          ${collapsed ? 'w-16' : 'w-64'}
          bg-nx-cream border-l border-nx-border hidden lg:flex flex-col dark:bg-nx-navy dark:border-nx-navy-border
          transition-all duration-300 ease-in-out
          fixed top-0 right-0 h-screen z-40
        `}
      >
        {/* Brand Header */}
        <div className="h-14 border-b border-nx-border flex items-center justify-between px-3 dark:border-nx-navy-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img
                src={brandLogo}
                alt="Nexivo"
                draggable={false}
                className="h-7 w-auto select-none"
              />
              <div>
                <h1 className="text-sm font-bold text-nx-navy dark:text-white" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
                  Nexivo
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-nx-mist">ERP</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-slate-500 hover:text-nx-navy hover:bg-black/5 rounded-nx-btn transition dark:text-nx-mist dark:hover:text-white dark:hover:bg-white/5"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Search (when expanded) */}
        {!collapsed && (
          <div className="px-3 py-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-2 px-3 py-1.5 rounded-lg bg-black/5 text-slate-500 text-xs transition hover:bg-black/10 dark:bg-nx-mist/10 dark:text-nx-mist dark:hover:bg-nx-mist/20"
            >
              <Search className="w-3.5 h-3.5" />
              <span>جستجو... ⌘K</span>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {sections.map((section) => {
            const isExpanded = expandedSections[section.id]
            const hasActive = section.items.some((item) =>
              item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to) && item.to !== '/erp'
            )

            return (
              <div key={section.id}>
                {/* Section Header */}
                {!collapsed && (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-1.5
                      text-[11px] font-semibold uppercase tracking-wider
                      ${hasActive ? 'text-nx-teal dark:text-nx-blue' : 'text-slate-500 dark:text-nx-mist'}
                      hover:text-nx-navy dark:hover:text-white transition rounded-nx-btn
                    `}
                  >
                    <span>{section.label}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                    />
                  </button>
                )}

                {/* Section Items */}
                {(collapsed || isExpanded) && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                            isActive
                              ? 'bg-nx-teal/10 text-nx-teal border border-nx-teal/30 dark:bg-nx-blue/10 dark:text-nx-blue dark:border-nx-blue/30'
                              : 'text-slate-600 hover:bg-black/5 hover:text-nx-navy dark:text-nx-mist dark:hover:bg-white/5 dark:hover:text-white'
                          } ${collapsed ? 'justify-center' : ''}`
                        }
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

      </aside>

      {/* ─── Main Content ─────────────────────────────── */}
      <main
        className={`flex-1 min-w-0 w-full overflow-x-hidden mr-0 ${collapsed ? 'lg:mr-16' : 'lg:mr-64'} pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-0 transition-all duration-300`}
      >
        {/* Top Navigation Bar */}
        <header className="h-14 bg-nx-cream/90 backdrop-blur border-b border-nx-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 dark:bg-nx-navy/90 dark:border-nx-navy-border">
          <div className="flex items-center gap-4">
            {/* Breadcrumbs */}
            <nav className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-nx-mist">خانه</span>
              {activeSection && (
                <>
                  <span className="text-slate-400 dark:text-nx-mist">/</span>
                  <span className="text-nx-navy dark:text-white">{activeSection.label}</span>
                </>
              )}
              {activeItem && activeItem.label !== activeSection?.label && (
                <>
                  <span className="text-slate-400 dark:text-nx-mist">/</span>
                  <span className="text-slate-500 dark:text-nx-mist font-medium">{activeItem.label}</span>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {/* Global Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-slate-500 hover:text-nx-navy hover:bg-black/5 rounded-nx-btn transition dark:text-nx-mist dark:hover:text-white dark:hover:bg-white/5"
              title="جستجو (⌘K)"
            >
              <Search className="w-5 h-5" />
            </button>
            {/* Notifications: unread approvals and rejections live here */}
            <NotificationBell />
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-nx-navy hover:bg-black/5 rounded-nx-btn transition dark:text-nx-mist dark:hover:text-white dark:hover:bg-white/5"
              title={dark ? 'حالت روشن' : 'حالت تاریک'}
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {/* Account menu: profile, avatar, email, password, logout */}
            <UserMenu onLogout={handleLogout} />
          </div>
        </header>
        <div className="px-3 py-4 sm:px-4 lg:px-8 lg:py-7">
          <Outlet />
        </div>
      </main>

      {/* ─── Mobile bottom navigation ─────────────────── */}
      {/* Visual order left→right: dashboard, invoices, quick add, office, menu. */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white/95 backdrop-blur border-t border-nx-border dark:bg-nx-navy/95 dark:border-nx-navy-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5 items-end">
          <NavLink
            to="/erp"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] transition ${isActive ? 'text-nx-teal dark:text-nx-blue' : 'text-slate-500 dark:text-nx-mist'}`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>داشبورد</span>
          </NavLink>
          <NavLink
            to="/erp/billing/invoices"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] transition ${isActive ? 'text-nx-teal dark:text-nx-blue' : 'text-slate-500 dark:text-nx-mist'}`
            }
          >
            <FileText className="w-5 h-5" />
            <span>صورت‌حساب</span>
          </NavLink>
          <NavLink
            to="/erp/office"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] transition ${isActive ? 'text-nx-teal dark:text-nx-blue' : 'text-slate-500 dark:text-nx-mist'}`
            }
          >
            <Inbox className="w-5 h-5" />
            <span>میزکار اداری</span>
          </NavLink>
          <button
            onClick={() => { setQuickOpen(false); setMobileOpen(true) }}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
              mobileOpen ? 'text-nx-teal dark:text-nx-blue' : 'text-slate-500 dark:text-nx-mist'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span>منو</span>
          </button>
          <div className="relative h-full">
            <button
              onClick={() => { setMobileOpen(false); setQuickOpen((value) => !value) }}
              aria-label="ثبت جدید"
              aria-expanded={quickOpen}
              className="absolute -top-7 left-3 grid h-14 w-14 place-items-center rounded-full bg-nx-teal text-white shadow-lg ring-4 ring-white transition hover:opacity-90 dark:ring-nx-navy"
            >
              <Plus className={`h-7 w-7 transition-transform ${quickOpen ? 'rotate-45' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Quick add: bottom sheet for creating a record from anywhere ─── */}
      {quickOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setQuickOpen(false)} />
      )}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 lg:hidden will-change-transform ${
          quickOpen ? '' : 'pointer-events-none'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: quickOpen ? 'translateY(0)' : 'translateY(115%)',
          transition: `transform ${SHEET_TRANSITION_MS}ms ease-out`,
        }}
        aria-hidden={!quickOpen}
      >
        <div className="mx-2 mb-2 max-h-[80dvh] overflow-y-auto rounded-3xl bg-white border border-nx-border shadow-2xl overscroll-contain dark:bg-nx-navy-elevated dark:border-nx-navy-border">
          <div className="flex justify-center pt-2.5 pb-1">
            <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-nx-mist/40" />
          </div>
          <div className="flex items-center justify-between px-5 pb-2 pt-1">
            <h2 className="text-base font-bold text-nx-navy dark:text-white">ثبت جدید</h2>
            <button
              onClick={() => setQuickOpen(false)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-black/5 dark:text-nx-mist dark:hover:bg-white/5"
            >
              <X className="w-4 h-4" /> بستن
            </button>
          </div>
          <div className="px-3 pb-4 space-y-1">
            {quickActions.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-nx-mist">
                برای حساب شما موردی که بتوانید ثبت کنید وجود ندارد.
              </p>
            ) : quickActions.map((action) => (
              <button
                key={action.to}
                onClick={() => goFromQuickAdd(action.to)}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-right text-nx-navy hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5"
              >
                <span className="w-9 h-9 rounded-xl grid place-items-center bg-nx-teal/15 text-nx-teal">
                  <action.icon className="w-5 h-5" />
                </span>
                <span className="flex-1 text-[15px] font-medium">{action.label}</span>
                <ChevronLeft className="w-4 h-4 text-slate-400 dark:text-nx-mist" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Mobile menu: a card that slides up from the bottom ───────── */}
      <div
        ref={sheetRef}
        className={`fixed inset-x-0 bottom-0 z-50 lg:hidden will-change-transform ${
          mobileOpen ? '' : 'pointer-events-none'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: mobileOpen ? 'translateY(0)' : 'translateY(115%)',
          transition: `transform ${SHEET_TRANSITION_MS}ms ease-out`,
        }}
        aria-hidden={!mobileOpen}
      >
        <div className="mx-2 mb-2 rounded-3xl bg-white border border-nx-border shadow-2xl overflow-hidden dark:bg-nx-navy-elevated dark:border-nx-navy-border">
          <div className="flex justify-center pt-2.5 pb-1">
            <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-nx-mist/40" />
          </div>
          <div className="flex items-center justify-between px-5 pb-2 pt-1">
            <h2 className="text-base font-bold text-nx-navy dark:text-white">منو</h2>
            <button
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-black/5 dark:text-nx-mist dark:hover:bg-white/5"
            >
              <X className="w-4 h-4" /> بستن
            </button>
          </div>
          <div className="max-h-[66vh] overflow-y-auto px-3 pb-4 space-y-4">
            {sections.map((section) => (
              <div key={section.id}>
                <p className="px-2 mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 dark:text-nx-mist">{section.label}</p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = item.end
                      ? location.pathname === item.to
                      : location.pathname.startsWith(item.to) && item.to !== '/erp'
                    return (
                      <button
                        key={item.to}
                        onClick={() => goFromSheet(item.to)}
                        className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-right transition ${
                          active ? 'bg-nx-teal/10 text-nx-teal dark:bg-nx-blue/15 dark:text-white' : 'text-nx-navy hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5'
                        }`}
                      >
                        <span
                          className={`w-9 h-9 rounded-xl grid place-items-center flex-shrink-0 ${
                            active ? 'bg-nx-teal text-white dark:bg-nx-blue' : 'bg-black/5 text-slate-500 dark:bg-white/5 dark:text-nx-mist'
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                        </span>
                        <span className="flex-1 text-[15px] font-medium">{item.label}</span>
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

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickCreateButton />
    </div>
  )
}
