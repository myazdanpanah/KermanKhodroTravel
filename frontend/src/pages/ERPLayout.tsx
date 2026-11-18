import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore, syncThemeClass } from '../store/themeStore'
import { useBrandLogo } from '../store/brandingStore'
import UserMenu from '../components/UserMenu'
import {
  LayoutDashboard, FileText, CreditCard, Users, Gauge, Plus,
  Calendar, Target, TrendingUp,
  Settings, ChevronLeft, ChevronDown,
  Shield, Search, Bell, Sun, Moon, Menu, Briefcase,
} from 'lucide-react'

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
    id: 'settings',
    label: 'تنظیمات',
    items: [
      { to: '/erp/settings', icon: Settings, label: 'تنظیمات' },
      { to: '/erp/settings/users', icon: Shield, label: 'کاربران' },
    ],
  },
]

// ─── Component ───────────────────────────────────────────────────

export default function ERPLayout() {
  const [collapsed, setCollapsed] = useState(false)
  // Mobile: off-canvas drawer plus the bottom tab bar (PWA-style navigation).
  const [mobileOpen, setMobileOpen] = useState(false)
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

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

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
  const allowedPrefixes = isAdmin ? ['/erp/billing', '/erp/crm', '/erp/settings'] : ['/erp/billing', '/erp/crm']
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
    <div className="min-h-screen bg-nx-navy flex" dir="rtl">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ──────────────────────────────────── */}
      <aside
        className={`
          ${collapsed ? 'w-16' : 'w-64'}
          bg-nx-navy border-l border-nx-navy-border flex flex-col
          transition-transform lg:transition-all duration-300 ease-in-out
          fixed top-0 right-0 h-screen z-40
          ${mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className="h-14 border-b border-nx-navy-border flex items-center justify-between px-3">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img
                src={brandLogo}
                alt="Nexivo"
                draggable={false}
                className="h-7 w-auto select-none"
              />
              <div>
                <h1 className="text-sm font-bold text-white" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
                  Nexivo
                </h1>
                <p className="text-[10px] text-nx-mist">ERP</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-nx-mist hover:text-white hover:bg-white/5 rounded-nx-btn transition"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Search (when expanded) */}
        {!collapsed && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-nx-mist/10 rounded-lg text-nx-mist text-xs">
              <Search className="w-3.5 h-3.5" />
              <span>جستجو... ⌘K</span>
            </div>
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
                      ${hasActive ? 'text-nx-blue' : 'text-nx-mist'}
                      hover:text-white transition rounded-nx-btn
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
                              ? 'bg-nx-blue/10 text-nx-blue border border-nx-blue/30'
                              : 'text-nx-mist hover:bg-white/5 hover:text-white'
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
        className={`flex-1 min-w-0 w-full overflow-x-hidden mr-0 ${collapsed ? 'lg:mr-16' : 'lg:mr-64'} pb-[76px] lg:pb-0 transition-all duration-300`}
      >
        {/* Top Navigation Bar */}
        <header className="h-14 bg-nx-navy border-b border-nx-navy-border flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => {
                setCollapsed(false)
                setMobileOpen(true)
              }}
              className="p-2 text-nx-mist hover:text-white lg:hidden rounded-nx-btn hover:bg-white/5 transition"
              aria-label="منو"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Breadcrumbs */}
            <nav className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-nx-mist">خانه</span>
              {activeSection && (
                <>
                  <span className="text-nx-mist">/</span>
                  <span className="text-white">{activeSection.label}</span>
                </>
              )}
              {activeItem && activeItem.label !== activeSection?.label && (
                <>
                  <span className="text-nx-mist">/</span>
                  <span className="text-nx-mist font-medium">{activeItem.label}</span>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {/* Global Search */}
            <button className="p-2 text-nx-mist hover:text-white hover:bg-white/5 rounded-nx-btn transition">
              <Search className="w-5 h-5" />
            </button>
            {/* Notifications */}
            <button className="relative p-2 text-nx-mist hover:text-white hover:bg-white/5 rounded-nx-btn transition">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-nx-danger-500 rounded-full"></span>
            </button>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-nx-mist hover:text-white hover:bg-white/5 rounded-nx-btn transition"
              title={dark ? 'حالت روشن' : 'حالت تاریک'}
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {/* Account menu: profile, avatar, email, password, logout */}
            <UserMenu onLogout={handleLogout} />
          </div>
        </header>
        <Outlet />
      </main>

      {/* ─── Mobile bottom navigation ─────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-nx-navy/95 backdrop-blur border-t border-nx-navy-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5">
          {[
            { to: '/erp', icon: LayoutDashboard, label: 'داشبورد', end: true },
            ...(canIssue ? [{ to: '/erp/billing/issue', icon: Plus, label: 'صدور', end: false }] : []),
            { to: '/erp/billing/invoices', icon: FileText, label: 'صورت‌حساب', end: false },
            { to: '/erp/billing/payments', icon: CreditCard, label: 'پرداخت', end: false },
          ].map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] transition ${
                  active ? 'text-nx-blue' : 'text-nx-mist'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
          <button
            onClick={() => {
              setCollapsed(false)
              setMobileOpen(true)
            }}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
              mobileOpen ? 'text-nx-blue' : 'text-nx-mist'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span>منو</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
