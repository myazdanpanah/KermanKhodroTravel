import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutGrid,
  BarChart3,
  Building2,
  MessageSquare,
} from 'lucide-react'

export type AppModuleId = 'launcher' | 'erp' | 'bi' | 'orbit'

interface ModuleSwitcherNavProps {
  active?: AppModuleId
  className?: string
}

const MODULES = [
  {
    id: 'launcher' as AppModuleId,
    label: 'لانچر',
    to: '/launcher',
    icon: LayoutGrid,
    title: 'صفحه اصلی لانچر برنامه‌ها',
  },
  {
    id: 'erp' as AppModuleId,
    label: 'سامانه ERP',
    to: '/erp',
    icon: Building2,
    title: 'سامانه یکپارچه منابع سازمان (ERP)',
  },
  {
    id: 'bi' as AppModuleId,
    label: 'هوش تجاری (BI)',
    to: '/dashboards',
    icon: BarChart3,
    title: 'داشبوردها و هوش تجاری',
  },
  {
    id: 'orbit' as AppModuleId,
    label: 'پیام‌رسان (Orbit)',
    to: '/orbit',
    icon: MessageSquare,
    title: 'پیام‌رسان و همکاری تیمی سازمانی',
  },
]

export default function ModuleSwitcherNav({
  active,
  className = '',
}: ModuleSwitcherNavProps) {
  const { user } = useAuthStore()
  const isOrbitEnabled =
    user?.is_superuser ||
    user?.role === 'admin' ||
    Boolean(user?.accessible_modules?.some((m) => m === 'orbit' || m === 'messaging'))

  const isBiEnabled =
    user?.is_superuser ||
    user?.role === 'admin' ||
    Boolean(user?.accessible_modules?.some((m) => m === 'bi_dashboard' || m === 'bi'))

  const filteredModules = MODULES.filter((m) => {
    if (m.id === 'orbit') return isOrbitEnabled
    if (m.id === 'bi') return isBiEnabled
    return true
  })

  return (
    <nav
      aria-label="ماژول‌های سیستم"
      className={`hidden md:flex items-center gap-1 p-0.5 rounded-xl border border-slate-200/80 bg-slate-100/60 dark:border-nx-navy-border/60 dark:bg-nx-navy/50 ${className}`}
    >
      {filteredModules.map((item) => {
        const Icon = item.icon
        const isActive = active === item.id

        return (
          <Link
            key={item.id}
            to={item.to}
            title={item.title}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition duration-150 ${
              isActive
                ? 'bg-white text-nx-blue shadow-xs font-bold dark:bg-nx-navy-elevated dark:text-nx-blue'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-nx-mist dark:hover:text-white dark:hover:bg-nx-navy-border/40 font-medium'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
