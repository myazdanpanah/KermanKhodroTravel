import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../components/Toast'
import { useLogout } from '../hooks/useLogout'
import api from '../api/client'
import SplashScreen from '../components/SplashScreen'
import { useBrandLogo, useBrandingStore } from '../store/brandingStore'
import { useThemeStore, syncThemeClass } from '../store/themeStore'
import UserMenu from '../components/UserMenu'
import MobileAppNavBar from '../components/MobileAppNavBar'
import {
  BarChart3,
  DollarSign,
  Users,
  Database,
  Upload,
  Settings,
  Package,
  ShoppingCart,
  Factory,
  Ship,
  Headphones,
  Briefcase,
  LineChart,
  Brain,
  Workflow,
  TrendingUp,
  Tag,
  Inbox,
  MessageSquare,
  Search,
  Sun,
  Moon,
  Calendar,
  Sparkles,
  Layers,
  Activity,
  X,
  ChevronLeft,
} from 'lucide-react'

interface ModuleInfo {
  id: string
  label: string
}

type CategoryType = 'all' | 'finance' | 'bi' | 'office' | 'system'

interface ModuleConfig {
  id: string
  label: string
  sublabel: string
  category: 'finance' | 'bi' | 'office' | 'system'
  categoryName: string
  description: string
  icon: React.ElementType
  route: string
  gradient: string
  badgeText: string
  shortcuts: Array<{ label: string; route: string }>
}

const MODULE_DEFINITIONS: Record<string, ModuleConfig> = {
  finance: {
    id: 'finance',
    label: 'سامانه مدیریت مالی و صورت‌حساب',
    sublabel: 'صورت‌حساب، پرداخت‌ها و پیگیری بدهی',
    category: 'finance',
    categoryName: 'امور مالی',
    description: 'صدور رسمی صورت‌حساب، ثبت پرداخت‌ها و چک‌ها، اعلامیه بدهی و تسویه‌حساب مشتریان',
    icon: DollarSign,
    route: '/erp/billing',
    gradient: 'from-blue-600 to-indigo-600',
    badgeText: 'عملیاتی و حیاتی',
    shortcuts: [
      { label: 'صدور صورت‌حساب', route: '/erp/billing/issue' },
      { label: 'صورت‌حساب‌ها', route: '/erp/billing/invoices' },
      { label: 'ثبت پرداخت‌ها', route: '/erp/billing/payments' },
    ],
  },
  bi_dashboard: {
    id: 'bi_dashboard',
    label: 'هوش تجاری و داشبوردها (BI)',
    sublabel: 'تحلیل داده، نمودارها و KPIهای سازمان',
    category: 'bi',
    categoryName: 'هوش تجاری',
    description: 'مشاهده و تحلیل شاخص‌های عملکرد، نمودارهای فروش و خدمات، و طراحی داشبوردهای پویا',
    icon: BarChart3,
    route: '/dashboards',
    gradient: 'from-emerald-600 to-teal-600',
    badgeText: 'تحلیل داده زنده',
    shortcuts: [
      { label: 'داشبوردهای فعال', route: '/dashboards' },
      { label: 'سازنده داشبورد', route: '/dashboards/builder' },
      { label: 'داشبورد مدیریتی', route: '/management' },
    ],
  },
  orbit: {
    id: 'orbit',
    label: 'پیام‌رسان سازمانی نکسِیو اوربیت (Orbit)',
    sublabel: 'گفتگوی تیمی، کانال‌ها و پیوست اسناد',
    category: 'office',
    categoryName: 'ارتباطات',
    description: 'پیام‌رسانی یکپارچه با قابلیت پیوست مستقیم نامه‌های اتوماسیون، صورت‌حساب‌ها و پرداخت‌ها',
    icon: MessageSquare,
    route: '/orbit',
    gradient: 'from-violet-600 to-purple-600',
    badgeText: 'همکاری و چت تیمی',
    shortcuts: [
      { label: 'ورود به پیام‌رسان', route: '/orbit' },
      { label: 'گفتگوهای کاری', route: '/orbit' },
    ],
  },
  messaging: {
    id: 'messaging',
    label: 'پیام‌رسان سازمانی نکسِیو اوربیت (Orbit)',
    sublabel: 'گفتگوی تیمی، کانال‌ها و پیوست اسناد',
    category: 'office',
    categoryName: 'ارتباطات',
    description: 'پیام‌رسانی یکپارچه با قابلیت پیوست مستقیم نامه‌های اتوماسیون، صورت‌حساب‌ها و پرداخت‌ها',
    icon: MessageSquare,
    route: '/orbit',
    gradient: 'from-violet-600 to-purple-600',
    badgeText: 'همکاری و چت تیمی',
    shortcuts: [
      { label: 'ورود به پیام‌رسان', route: '/orbit' },
      { label: 'گفتگوهای کاری', route: '/orbit' },
    ],
  },
  office: {
    id: 'office',
    label: 'اتوماسیون اداری و دبیرخانه',
    sublabel: 'مکاتبات، کارتابل، قراردادها و گردش نامه',
    category: 'office',
    categoryName: 'اتوماسیون',
    description: 'مدیریت یکپارچه نامه‌های اداری وارده و صادره، ثبت در دبیرخانه، گردش کار و بایگانی اسناد',
    icon: Inbox,
    route: '/erp/office',
    gradient: 'from-amber-600 to-orange-600',
    badgeText: 'دبیرخانه متمرکز',
    shortcuts: [
      { label: 'کارتابل مکاتبات', route: '/erp/office' },
      { label: 'نامه‌های صادره', route: '/erp/office/correspondence' },
      { label: 'قراردادها', route: '/erp/office/contracts' },
    ],
  },
  crm: {
    id: 'crm',
    label: 'مدیریت ارتباط با مشتریان (CRM)',
    sublabel: 'پیگیری سرنخ‌ها، مشتریان و فرصت‌های فروش',
    category: 'finance',
    categoryName: 'مشتریان و فروش',
    description: 'مدیریت پرونده مشتریان، ثبت فرصت‌های فروش و تحلیل رضایت‌مندی مشتریان سازمان',
    icon: Users,
    route: '/erp/crm',
    gradient: 'from-rose-600 to-pink-600',
    badgeText: 'فروش و تعامل',
    shortcuts: [{ label: 'فرصت‌های تجاری', route: '/erp/crm' }],
  },
  settings: {
    id: 'settings',
    label: 'تنظیمات سامانه و هویت سازمانی',
    sublabel: 'پیکربندی سازمان، برندینگ، کاربران و نقش‌ها',
    category: 'system',
    categoryName: 'مدیریت سیستم',
    description: 'شخصی‌سازی لوگو و رنگ‌های سازمانی، مدیریت دسترسی کاربران و فونت‌های سربرگ',
    icon: Settings,
    route: '/erp/settings',
    gradient: 'from-slate-700 to-zinc-800',
    badgeText: 'سطح دسترسی مدیران',
    shortcuts: [
      { label: 'هویت سازمانی و برندینگ', route: '/erp/settings' },
      { label: 'مدیریت کاربران و دسترسی‌ها', route: '/erp/settings' },
    ],
  },
  db_manager: {
    id: 'db_manager',
    label: 'استودیو مدیریت و ویرایش پایگاه داده (SSMS)',
    sublabel: 'ویرایش مستقیم سطرها، جداول سیستم و کنسول SQL',
    category: 'system',
    categoryName: 'زیرساخت دیتابیس',
    description: 'محیط اختصاصی ادمین اصلی (مشابه SSMS) جهت مشاهده، ویرایش ردیف‌ها، حذف، درج داده و اجرای کوئری‌های مستقیم SQL',
    icon: Database,
    route: '/db-manager',
    gradient: 'from-slate-800 via-indigo-950 to-blue-900',
    badgeText: 'مخصوص ادمین اصلی',
    shortcuts: [
      { label: 'مدیریت و ویرایش جداول', route: '/db-manager' },
      { label: 'کنسول اجرای کوئری (SQL Editor)', route: '/db-manager/sql' },
    ],
  },
  datasets: {
    id: 'datasets',
    label: 'بارگذاری و همگام‌سازی فایل‌های داده',
    sublabel: 'ورود فایل‌های اکسل، CSV و پردازش',
    category: 'system',
    categoryName: 'زیرساخت داده',
    description: 'آپلود داده‌های تجاری، تطبیق ستون‌ها و تبدیل فرمت به جداول ساختاریافته',
    icon: Upload,
    route: '/data/upload',
    gradient: 'from-teal-600 to-emerald-700',
    badgeText: 'ورود داده',
    shortcuts: [{ label: 'آپلود فایل جدید', route: '/data/upload' }],
  },
}

// Fallback icons for any other dynamic module
const FALLBACK_ICONS: Record<string, React.ElementType> = {
  manufacturing: Factory,
  inventory: Package,
  workflow: Workflow,
  purchasing: ShoppingCart,
  sales: TrendingUp,
  trading: Ship,
  service_sales: Tag,
  service_management: Headphones,
  hr: Briefcase,
  reporting: LineChart,
  ai_insights: Brain,
  llm: Brain,
}

// Licensed modules in this deployment
const DELIVERED_MODULES = new Set(['bi_dashboard', 'finance', 'crm', 'office', 'orbit', 'messaging'])

export default function LauncherPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const handleLogout = useLogout()
  const { toast } = useToast()

  const [modules, setModules] = useState<ModuleInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [splashGone, setSplashGone] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all')

  // Theme & Branding
  const { dark, toggle: toggleTheme } = useThemeStore()
  const { branding } = useBrandingStore()
  const logo = useBrandLogo()

  useEffect(() => {
    syncThemeClass(dark)
  }, [dark])

  useEffect(() => {
    fetchModules()
  }, [])

  const processAndSetModules = (rawModules: ModuleInfo[]) => {
    let delivered = (rawModules || []).filter((m: ModuleInfo) => DELIVERED_MODULES.has(m.id))
    const isSysAdmin = user?.role === 'admin' || user?.is_superuser === true

    // Settings is EXCLUSIVELY for main system admin
    if (isSysAdmin && !delivered.some((m: ModuleInfo) => m.id === 'settings')) {
      delivered.push({ id: 'settings', label: 'تنظیمات' })
    }
    // db_manager is EXCLUSIVELY for main system admin
    if (isSysAdmin && !delivered.some((m: ModuleInfo) => m.id === 'db_manager')) {
      delivered.push({ id: 'db_manager', label: 'استودیو پایگاه داده (SSMS)' })
    }

    // For non-admin users (including CEO, finance, sales), strictly remove settings and db_manager
    if (!isSysAdmin) {
      delivered = delivered.filter((m) => m.id !== 'settings' && m.id !== 'db_manager')
    }

    // Role-based filtering so non-finance/non-crm users don't see modules they can't access
    const canViewFinance = isSysAdmin || user?.role === 'ceo' || user?.role === 'finance' || Boolean(user?.permissions?.view)
    if (!canViewFinance) {
      delivered = delivered.filter((m) => m.id !== 'finance' && m.id !== 'billing')
    }

    const canAccessCrm = isSysAdmin || user?.role === 'ceo' || user?.role === 'sales' || user?.department === 'sales' || Boolean(user?.permissions?.crm)
    if (!canAccessCrm) {
      delivered = delivered.filter((m) => m.id !== 'crm')
    }

    // Orbit messaging is a toggleable module per organization (only shown if present in delivered list)
    setModules(delivered)
  }

  const fetchModules = async () => {
    try {
      const res = await api.get('/auth/user-modules/')
      processAndSetModules(res.data)
    } catch {
      // Fallback: If network issue or rate limit occurs, use user.accessible_modules
      const accessible = user?.accessible_modules || ['bi_dashboard', 'finance', 'crm', 'office']
      const fallbackList: ModuleInfo[] = accessible.map((id) => ({
        id,
        label: MODULE_DEFINITIONS[id]?.label || id,
      }))
      processAndSetModules(fallbackList)
    } finally {
      setLoading(false)
    }
  }

  const handleModuleClick = (route: string) => {
    if (route) {
      navigate(route)
    } else {
      toast('این ماژول در حال حاضر در دسترس نیست.', 'error')
    }
  }

  // Current Persian date & greeting
  const todayPersian = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date())
    } catch {
      return 'امروز'
    }
  }, [])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'صبح بخیر'
    if (hour < 17) return 'عصر بخیر'
    return 'وقت بخیر'
  }, [])

  const isSysAdmin = user?.role === 'admin' || user?.is_superuser === true
  const canIssue = isSysAdmin || user?.role === 'ceo' || Boolean(user?.permissions?.issue)
  const canAccessManagement = isSysAdmin || user?.role === 'ceo' || (user?.role === 'finance' && Boolean(user?.permissions?.view))

  // Build resolved module list
  const resolvedModules = useMemo(() => {
    return modules.map((mod) => {
      const def = MODULE_DEFINITIONS[mod.id]
      if (def) {
        const shortcuts = (def.shortcuts || []).filter((sc) => {
          if (sc.route === '/erp/billing/issue') return canIssue
          if (sc.route === '/management' || sc.route === '/erp/management') return canAccessManagement
          return true
        })
        return { ...def, shortcuts }
      }
      const FallbackIcon = FALLBACK_ICONS[mod.id] || Database
      return {
        id: mod.id,
        label: mod.label,
        sublabel: 'ماژول فعال سازمانی',
        category: 'system' as const,
        categoryName: 'سایر ماژول‌ها',
        description: `سامانه و ابزارهای مرتبط با ${mod.label}`,
        icon: FallbackIcon,
        route: `/erp/${mod.id}`,
        gradient: 'from-slate-600 to-slate-700',
        badgeText: 'فعال',
        shortcuts: [],
      }
    })
  }, [modules, canIssue, canAccessManagement])

  // Filter modules based on search query and category
  const filteredModules = useMemo(() => {
    return resolvedModules.filter((mod) => {
      // Category filter
      if (activeCategory !== 'all' && mod.category !== activeCategory) {
        return false
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const matchTitle = mod.label.toLowerCase().includes(query)
        const matchDesc = mod.description.toLowerCase().includes(query)
        const matchCat = mod.categoryName.toLowerCase().includes(query)
        const matchShortcuts = mod.shortcuts.some((s) => s.label.toLowerCase().includes(query))
        return matchTitle || matchDesc || matchCat || matchShortcuts
      }
      return true
    })
  }, [resolvedModules, activeCategory, searchQuery])

  const companyName = branding.name || user?.company_name || 'کرمان خودرو'
  const userFullName =
    user?.first_name || user?.last_name
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
      : user?.username || 'کاربر گرامی'

  return (
    <div className="relative min-h-screen bg-slate-100/70 text-slate-900 transition-colors duration-300 dark:bg-nx-navy dark:text-white flex flex-col font-sans overflow-x-hidden" dir="rtl">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 right-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl dark:bg-nx-blue/15" />
      <div className="pointer-events-none absolute top-1/3 -left-20 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl dark:bg-nx-teal/10" />

      {/* SplashScreen on initial load */}
      {!splashGone && <SplashScreen show={loading} onExited={() => setSplashGone(true)} />}

      {/* Header Bar — Responsive and safe for iPhone notch / Dynamic Island */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 px-4 sm:px-6 pt-[max(0.875rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-3.5 backdrop-blur-md transition-all dark:border-nx-navy-border dark:bg-nx-navy/85 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          {/* Right: Organizational Logo & Name */}
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm border border-slate-200/80 dark:bg-nx-navy-elevated dark:border-nx-navy-border">
              <img
                src={logo}
                alt={companyName}
                draggable={false}
                className="h-7 w-auto object-contain select-none"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight tracking-tight truncate">
                  {companyName}
                </h1>
                <span className="hidden sm:inline-block shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-nx-blue/20 dark:text-blue-300 border border-blue-200/60 dark:border-blue-700/40">
                  سازمان هوشمند
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-nx-mist truncate">
                درگاه یکپارچه خدمات، ماژول‌ها و هوش سازمانی
              </p>
            </div>
          </div>

          {/* Left: Date, Theme Toggle, Profile Menu */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Persian Date Pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-1.5 text-xs text-slate-600 shadow-xs dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-nx-mist">
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-nx-teal" />
              <span>{todayPersian}</span>
            </div>

            {/* Dark / Light Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-nx-mist dark:hover:text-white transition shadow-xs"
              title={dark ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
              aria-label="تغییر تم"
            >
              {dark ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700 transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* User Profile Menu */}
            <UserMenu onLogout={handleLogout} />
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 pb-20 lg:pb-10">
        <div className="mx-auto max-w-7xl">
          {/* Hero Banner Section */}
          <div className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 sm:p-8 shadow-sm backdrop-blur-md dark:border-nx-navy-border dark:bg-nx-navy-elevated/85 dark:shadow-nx-elevated transition">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    <Sparkles className="h-3 w-3 text-blue-500" />
                    <span>مرکز فرماندهی سازمانی (Command Center)</span>
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
                  {greeting}، {userFullName}
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-nx-mist max-w-xl">
                  به سامانه یکپارچه <span className="font-semibold text-slate-800 dark:text-slate-200">{companyName}</span> خوش آمدید. ماژول یا ابزار مورد نظر خود را جهت شروع فعالیت انتخاب فرمایید.
                </p>
              </div>

              {/* Status / Quick Summary Badge */}
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-slate-50/90 p-3 px-4 dark:border-nx-navy-border dark:bg-nx-navy/60 shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800 dark:text-white">وضعیت سیستم: پایدار</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-nx-mist">
                    {resolvedModules.length} سامانه سازمانی در دسترس
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Search & Filter Controls */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-nx-navy-border/70 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی سریع ماژول‌ها، خدمات، گزارش‌ها و ابزارها..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-10 pl-9 text-xs sm:text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-nx-navy-border dark:bg-nx-navy dark:text-white dark:focus:border-blue-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                {[
                  { key: 'all', label: 'همه سامانه‌ها' },
                  { key: 'finance', label: 'مالی و مشتریان' },
                  { key: 'bi', label: 'هوش تجاری و آمار' },
                  { key: 'office', label: 'مکاتبات و ارتباطات' },
                  { key: 'system', label: 'مدیریت و زیرساخت' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveCategory(tab.key as CategoryType)}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      activeCategory === tab.key
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 dark:bg-nx-blue'
                        : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 dark:bg-nx-navy dark:border-nx-navy-border dark:text-nx-mist dark:hover:text-white dark:hover:bg-nx-navy-elevated'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Module Cards Grid */}
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400 dark:text-nx-mist">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent dark:border-nx-teal" />
              <p className="text-sm font-medium">در حال فراخوانی دسترسی‌ها و ماژول‌های سازمان...</p>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-nx-navy-border">
              <Layers className="h-12 w-12 text-slate-300 dark:text-nx-mist/40 mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-white">
                ماژولی با این مشخصات یافت نشد
              </h3>
              <p className="text-xs text-slate-400 dark:text-nx-mist mt-1 max-w-sm">
                عبارت جستجو یا فیلتر دسته‌بندی را تغییر دهید، یا با مدیر سیستم تماس بگیرید.
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 rounded-xl border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-nx-navy-border dark:text-white dark:hover:bg-nx-navy-elevated"
                >
                  پاک کردن جستجو
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredModules.map((mod) => {
                const IconComponent = mod.icon
                return (
                  <div
                    key={mod.id}
                    onClick={() => handleModuleClick(mod.route)}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/80 hover:shadow-xl dark:border-nx-navy-border dark:bg-nx-navy-elevated/90 dark:hover:border-nx-blue dark:hover:shadow-nx-elevated cursor-pointer"
                  >
                    {/* Top ambient color edge accent */}
                    <div
                      className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${mod.gradient} opacity-80 group-hover:opacity-100 transition-opacity`}
                    />

                    <div>
                      {/* Card Top: Category Pill + Status */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-nx-navy dark:text-nx-mist">
                          {mod.categoryName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            {mod.badgeText}
                          </span>
                        </div>
                      </div>

                      {/* Icon & Title */}
                      <div className="flex items-start gap-4 mb-3">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${mod.gradient} text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300`}
                        >
                          <IconComponent className="h-6 w-6 stroke-[1.8]" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-nx-teal transition-colors">
                            {mod.label}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-nx-mist mt-0.5">
                            {mod.sublabel}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300/90 line-clamp-2 mb-4">
                        {mod.description}
                      </p>

                      {/* Direct Shortcuts Pills */}
                      {mod.shortcuts && mod.shortcuts.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 dark:border-nx-navy-border/60">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-nx-mist/80 block mb-2">
                            دسترسی سریع به بخش‌ها:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {mod.shortcuts.map((sc, idx) => (
                              <button
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(sc.route)
                                }}
                                className="rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-nx-navy-border dark:bg-nx-navy dark:text-slate-300 dark:hover:border-nx-teal dark:hover:text-white transition"
                              >
                                {sc.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="mt-5 pt-3 border-t border-slate-100 dark:border-nx-navy-border/60 flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-600 dark:text-nx-teal flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
                        <span>ورود به سامانه</span>
                        <ChevronLeft className="h-4 w-4" />
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-nx-mist">
                        مجوز دسترسی فعال
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/60 px-6 pt-4 pb-[calc(90px+env(safe-area-inset-bottom,0px))] lg:pb-4 backdrop-blur-sm dark:border-nx-navy-border dark:bg-nx-navy/80 text-xs text-slate-500 dark:text-nx-mist transition">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-white">{companyName}</span>
            <span>•</span>
            <span>سامانه جامع مدیریت و هوش تجاری سازمانی</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>نسخه نرم‌افزار: V 1.0.0</span>
            <span>پشتیبانی فنی و نگهداری داده فعال</span>
          </div>
        </div>
      </footer>

      {/* Mobile Navigation Dock */}
      <MobileAppNavBar />
    </div>
  )
}
