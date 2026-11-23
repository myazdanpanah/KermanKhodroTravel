import { useState, useEffect, useMemo } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore, syncThemeClass } from '../store/themeStore'
import { useBrandLogo } from '../store/brandingStore'
import UserMenu from '../components/UserMenu'
import NotificationBell from '../components/NotificationBell'
import {
  ChevronLeft,
  ChevronDown,
  Search,
  Sun,
  Moon,
} from 'lucide-react';
import GlobalSearch from '../components/GlobalSearch';
import QuickCreateButton from '../components/QuickCreateButton';
import FloatingChatWidget from '../components/FloatingChatWidget';
import ModuleSwitcherNav from '../components/ModuleSwitcherNav';
import MobileAppNavBar from '../components/MobileAppNavBar';
import { loadCompanyFonts } from '../lib/companyFonts';
import { getFilteredNavSections, getDefaultERPPath, canUserAccessERPPath } from '../lib/erpNavigation';

export default function ERPLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    bi: true,
    finance: true,
    crm: true,
    office: true,
    messaging: true,
    notifications: true,
  })
  const { user, logout } = useAuthStore()

  // Dynamic role- and organization-filtered ERP navigation sections
  const sections = useMemo(() => getFilteredNavSections(user), [user])

  // Inject the organization's uploaded fonts for DOCX/XLSX previews.
  useEffect(() => {
    void loadCompanyFonts();
  }, [user?.id]);
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

  // Sync dark mode class to <html>
  useEffect(() => {
    syncThemeClass(dark)
  }, [dark])

  // Auto-expand section that contains active route
  useEffect(() => {
    const activeSection = sections.find((section) =>
      section.items.some((item) =>
        item.end
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to) && item.to !== '/erp'
      )
    )
    if (activeSection) {
      setExpandedSections((prev) => ({ ...prev, [activeSection.id]: true }))
    }
  }, [location.pathname, sections])

  // Dynamic route access control and root resolver
  useEffect(() => {
    const path = location.pathname.replace(/\/$/, '')
    if (path === '/erp') {
      const defaultPath = getDefaultERPPath(user)
      if (defaultPath !== '/erp') {
        navigate(defaultPath, { replace: true })
      }
      return
    }

    const allowed = canUserAccessERPPath(user, path)
    if (!allowed) {
      const defaultPath = getDefaultERPPath(user)
      navigate(defaultPath, { replace: true })
    }
  }, [location.pathname, user, navigate])

  const activeSection = sections.find((s) =>
    s.items.some((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== '/erp'
    )
  )
  const activeItem = activeSection?.items.find((i) =>
    i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== '/erp'
  )

  return (
    <div className="min-h-screen bg-nx-cream flex dark:bg-nx-navy" dir="rtl">
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
        {/* Top Navigation Bar — with iPhone safe-area top padding */}
        <header className="min-h-14 h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] bg-nx-cream/90 backdrop-blur border-b border-nx-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 dark:bg-nx-navy/90 dark:border-nx-navy-border transition-all">
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

            {/* Vertical Separator */}
            <div className="hidden h-5 w-px bg-slate-200 lg:block dark:bg-nx-navy-border" />

            {/* Quick Cross-Module Navigation Switcher */}
            <ModuleSwitcherNav active="erp" />
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

      {/* ─── Global Mobile Bottom Navigation Bar ─────────────────── */}
      <MobileAppNavBar />

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickCreateButton />
      <FloatingChatWidget positionClass="bottom-7 left-24" />
    </div>
  )
}
