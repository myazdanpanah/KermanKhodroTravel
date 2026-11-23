import { Link } from 'react-router-dom'
import { useBrandLogo } from '../../store/brandingStore'
import { useLogout } from '../../hooks/useLogout'
import ThemeToggle from '../../components/ThemeToggle'
import UserMenu from '../../components/UserMenu'
import NotificationBell from '../../components/NotificationBell'
import ModuleSwitcherNav from '../../components/ModuleSwitcherNav'
import MobileAppNavBar from '../../components/MobileAppNavBar'
import { useMessagingStore } from '../../store/messagingStore'
import MessagingPage from './MessagingPage'

export default function OrbitLayout() {
  const logo = useBrandLogo()
  const handleLogout = useLogout()
  const activeConversationId = useMessagingStore((s) => s.activeConversationId)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 font-vazirmatn text-slate-800 dark:bg-nx-navy dark:text-white">
      {/* Top Navbar — on mobile, hidden when an active conversation is open to give 100% full screen to chat */}
      <header
        className={`min-h-14 h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 z-20 dark:border-nx-navy-border dark:bg-nx-navy-elevated transition-all ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Right Section: Logo, Title, and Module Switcher */}
        <div className="flex items-center gap-4">
          {/* Logo & Brand */}
          <Link to="/launcher" className="flex items-center gap-2.5 transition hover:opacity-80">
            {logo ? (
              <img src={logo} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-nx-blue to-indigo-600 font-black text-white shadow-md">
                N
              </div>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                  نکسیو اوربیت
                </span>
                <span className="rounded-full bg-nx-blue/10 px-2 py-0.5 text-[10px] font-bold text-nx-blue dark:bg-nx-blue/20">
                  Orbit
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-nx-mist">
                پیام‌رسان و همکاری سازمانی
              </span>
            </div>
          </Link>

          {/* Vertical Separator */}
          <div className="hidden h-6 w-px bg-slate-200 md:block dark:bg-nx-navy-border" />

          {/* Quick Cross-Module Navigation Switcher */}
          <ModuleSwitcherNav active="orbit" />
        </div>

        {/* Left Section: Presence, Notification, Theme, UserMenu */}
        <div className="flex items-center gap-3">
          {/* Presence Status Indicator */}
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 sm:flex dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>آنلاین</span>
          </div>

          <NotificationBell />
          <ThemeToggle />
          <UserMenu onLogout={handleLogout} />
        </div>
      </header>

      {/* Main Full-Screen Orbit Messaging View */}
      <main className="flex-1 overflow-hidden">
        <MessagingPage />
      </main>

      {/* Mobile Navigation Dock — displayed when in conversation list on mobile */}
      {!activeConversationId && <MobileAppNavBar />}
    </div>
  )
}
