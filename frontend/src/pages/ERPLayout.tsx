import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore, syncThemeClass } from '../store/themeStore'
import {
  LayoutDashboard, BookOpen, FileText, Receipt,
  CreditCard, Landmark, Users, Truck, Package,
  ShoppingCart, ClipboardList, RotateCcw,
  BarChart3, Warehouse, ArrowRightLeft,
  Play, Box, GitBranch, Wrench, FlaskConical,
  Upload, Download,
  Calendar, Tag, Home,
  Percent, Wallet,
  Settings, ChevronLeft, ChevronDown, LogOut, Zap,
  Shield, Building2, Search, Ship, Bell, Sun, Moon, Menu, X,
  Headphones, Clock, TrendingUp, Target, DollarSign,
  FileBarChart, Gauge, Brain, AlertTriangle, MessageSquare,
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

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'finance',
    label: 'مالی',
    items: [
      { to: '/erp', icon: LayoutDashboard, label: 'داشبورد', end: true },
      { to: '/erp/chart-of-accounts', icon: BookOpen, label: 'حساب‌ها' },
      { to: '/erp/invoices', icon: FileText, label: 'فاکتورها' },
      { to: '/erp/receipts', icon: Receipt, label: 'دریافت‌ها' },
      { to: '/erp/payments', icon: CreditCard, label: 'پرداخت‌ها' },
      { to: '/erp/cheques', icon: Landmark, label: 'چک‌ها' },
      { to: '/erp/customers', icon: Users, label: 'مشتریان' },
      { to: '/erp/suppliers', icon: Truck, label: 'تأمین‌کنندگان' },
      { to: '/erp/vouchers', icon: Receipt, label: 'اسناد حسابداری' },
    ],
  },
  {
    id: 'inventory',
    label: 'انبار',
    items: [
      { to: '/erp/inventory', icon: Warehouse, label: 'داشبورد انبار' },
      { to: '/erp/inventory/warehouses', icon: Package, label: 'انبارها' },
      { to: '/erp/inventory/movements', icon: ArrowRightLeft, label: 'جابجایی‌ها' },
      { to: '/erp/inventory/reservations', icon: ClipboardList, label: 'رزروها' },
    ],
  },
  {
    id: 'purchasing',
    label: 'خرید',
    items: [
      { to: '/erp/purchasing', icon: ShoppingCart, label: 'داشبورد خرید' },
      { to: '/erp/purchasing/requests', icon: ClipboardList, label: 'درخواست‌ها' },
      { to: '/erp/purchasing/orders', icon: ShoppingCart, label: 'سفارشات' },
      { to: '/erp/purchasing/receipts', icon: Package, label: 'رسید کالا' },
    ],
  },
  {
    id: 'sales',
    label: 'فروش',
    items: [
      { to: '/erp/sales', icon: BarChart3, label: 'داشبورد فروش' },
      { to: '/erp/sales/quotations', icon: FileText, label: 'پیش‌فاکتور' },
      { to: '/erp/sales/orders', icon: ShoppingCart, label: 'سفارشات' },
      { to: '/erp/sales/invoices', icon: CreditCard, label: 'فاکتورها' },
      { to: '/erp/sales/returns', icon: RotateCcw, label: 'برگشتی‌ها' },
    ],
  },
  {
    id: 'manufacturing',
    label: 'تولید',
    items: [
      { to: '/erp/manufacturing', icon: Box, label: 'داشبورد تولید' },
      { to: '/erp/manufacturing/boms', icon: Box, label: 'لیست مواد' },
      { to: '/erp/manufacturing/routings', icon: GitBranch, label: 'مسیر تولید' },
      { to: '/erp/manufacturing/work-centers', icon: Wrench, label: 'مراكز كار' },
      { to: '/erp/manufacturing/production-orders', icon: Play, label: 'دستورات تولید' },
      { to: '/erp/manufacturing/quality', icon: FlaskConical, label: 'کنترل کیفیت' },
    ],
  },
  {
    id: 'trading',
    label: 'بازرگانی',
    items: [
      { to: '/erp/trading', icon: BarChart3, label: 'داشبورد بازرگانی' },
      { to: '/erp/trading/imports', icon: Upload, label: 'واردات' },
      { to: '/erp/trading/exports', icon: Download, label: 'صادرات' },
      { to: '/erp/trading/containers', icon: Package, label: 'کانتینرها' },
      { to: '/erp/trading/shipments', icon: Ship, label: 'حمل و نقل' },
    ],
  },
  {
    id: 'service_sales',
    label: 'فروش خدمات',
    items: [
      { to: '/erp/service-sales', icon: Tag, label: 'داشبورد خدمات' },
      { to: '/erp/service-sales/bookings', icon: Calendar, label: 'رزروها' },
      { to: '/erp/service-sales/services', icon: Tag, label: 'خدمات' },
      { to: '/erp/service-sales/tickets', icon: FileText, label: 'بلیط‌ها' },
      { to: '/erp/service-sales/tours', icon: Home, label: 'تورها' },
      { to: '/erp/service-sales/hotels', icon: Home, label: 'هتل‌ها' },
      { to: '/erp/service-sales/passengers', icon: Users, label: 'مسافران' },
      { to: '/erp/service-sales/commissions', icon: Percent, label: 'كميسيون‌ها' },
      { to: '/erp/service-sales/refunds', icon: Wallet, label: 'بازپرداخت‌ها' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { to: '/erp/crm', icon: Users, label: 'داشبورد CRM', end: true },
      { to: '/erp/crm/leads', icon: Users, label: 'سرنخ‌ها' },
      { to: '/erp/crm/opportunities', icon: TrendingUp, label: 'فرصت‌ها' },
      { to: '/erp/crm/activities', icon: Calendar, label: 'فعالیت‌ها' },
      { to: '/erp/crm/campaigns', icon: Target, label: 'کمپین‌ها' },
    ],
  },
  {
    id: 'service_management',
    label: 'مدیریت خدمات',
    items: [
      { to: '/erp/service-management', icon: Headphones, label: 'داشبورد خدمات', end: true },
      { to: '/erp/service-management/requests', icon: ClipboardList, label: 'درخواست‌ها' },
      { to: '/erp/service-management/work-orders', icon: Wrench, label: 'دستور کارها' },
      { to: '/erp/service-management/technicians', icon: Users, label: 'تکنسین‌ها' },
      { to: '/erp/service-management/warranties', icon: Shield, label: 'گارانتی' },
      { to: '/erp/service-management/contracts', icon: FileText, label: 'قراردادها' },
      { to: '/erp/service-management/sla', icon: Clock, label: 'SLA' },
      { to: '/erp/service-management/maintenance', icon: Settings, label: 'نگهداری' },
    ],
  },
  {
    id: 'hr',
    label: 'منابع انسانی',
    items: [
      { to: '/erp/hr', icon: Users, label: 'داشبورد HR', end: true },
      { to: '/erp/hr/employees', icon: Users, label: 'کارکنان' },
      { to: '/erp/hr/attendance', icon: Calendar, label: 'حضور و غیاب' },
      { to: '/erp/hr/departments', icon: Building2, label: 'بخش‌ها' },
      { to: '/erp/hr/payroll', icon: DollarSign, label: 'حقوق' },
      { to: '/erp/hr/evaluations', icon: TrendingUp, label: 'ارزیابی' },
      { to: '/erp/hr/recruitment', icon: Target, label: 'استخدام' },
    ],
  },
  {
    id: 'reporting',
    label: 'گزارش‌ها و تحلیل',
    items: [
      { to: '/erp/reports', icon: FileBarChart, label: 'گزارش‌ها', end: true },
      { to: '/erp/reports/dashboards', icon: LayoutDashboard, label: 'داشبوردها' },
      { to: '/erp/reports/kpis', icon: Gauge, label: 'شاخص‌ها' },
      { to: '/erp/reports/scheduled', icon: Calendar, label: 'زمان‌بندی' },
    ],
  },
  {
    id: 'ai_insights',
    label: 'هوش مصنوعی',
    items: [
      { to: '/erp/ai', icon: Brain, label: 'داشبورد AI', end: true },
      { to: '/erp/ai/anomalies', icon: AlertTriangle, label: 'تشخیص ناهنجاری' },
      { to: '/erp/ai/forecasts', icon: TrendingUp, label: 'پیش‌بینی' },
      { to: '/erp/ai/nl-query', icon: MessageSquare, label: 'پرسش طبیعی' },
    ],
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    items: [
      { to: '/erp/settings', icon: Settings, label: 'تنظیمات' },
      { to: '/erp/settings/users', icon: Shield, label: 'كاربران' },
      { to: '/erp/settings/org', icon: Building2, label: 'ساختار سازمانی' },
    ],
  },
]

// ─── Component ───────────────────────────────────────────────────

export default function ERPLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    finance: true,
  })
  const { user, logout } = useAuthStore()
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
  const activeSection = NAV_SECTIONS.find((s) =>
    s.items.some((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== '/erp'
    )
  )
  const activeItem = activeSection?.items.find((i) =>
    i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== '/erp'
  )

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      {/* ─── Sidebar ──────────────────────────────────── */}
      <aside
        className={`
          ${collapsed ? 'w-16' : 'w-64'}
          bg-white border-l border-gray-200 flex flex-col
          transition-all duration-300 ease-in-out
          fixed h-screen z-30
        `}
      >
        {/* Brand Header */}
        <div className="h-14 border-b border-gray-200 flex items-center justify-between px-3">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #F16724, #e55a1b)' }}
              >
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Inter, Vazirmatn, sans-serif' }}>
                  Nexivo
                </h1>
                <p className="text-[10px] text-gray-400">ERP</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Search (when expanded) */}
        {!collapsed && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-400 text-xs">
              <Search className="w-3.5 h-3.5" />
              <span>جستجو... ⌘K</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {NAV_SECTIONS.map((section) => {
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
                      ${hasActive ? 'text-orange-600' : 'text-gray-400'}
                      hover:text-gray-600 transition rounded-lg
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
                              ? 'bg-orange-50 text-orange-600 border border-orange-200'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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

        {/* User Footer */}
        <div className="border-t border-gray-200 p-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                {(user?.username?.[0] || 'U').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {user?.first_name || user?.username}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{user?.company_name || 'ERP'}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition text-sm ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>خروج</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────── */}
      <main
        className={`flex-1 ${collapsed ? 'mr-16' : 'mr-64'} transition-all duration-300`}
      >
        {/* Top Navigation Bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 text-gray-400 hover:text-gray-600 lg:hidden rounded-lg hover:bg-gray-100 transition"
            >
              {collapsed ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            {/* Breadcrumbs */}
            <nav className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-gray-400">خانه</span>
              {activeSection && (
                <>
                  <span className="text-gray-300">/</span>
                  <span className="text-gray-500">{activeSection.label}</span>
                </>
              )}
              {activeItem && activeItem.label !== activeSection?.label && (
                <>
                  <span className="text-gray-300">/</span>
                  <span className="text-gray-600 font-medium">{activeItem.label}</span>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {/* Global Search */}
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <Search className="w-5 h-5" />
            </button>
            {/* Notifications */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title={dark ? 'حالت روشن' : 'حالت تاریک'}
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {/* User Menu */}
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                {(user?.username?.[0] || 'U').toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-gray-900">{user?.first_name || user?.username}</p>
                <p className="text-[10px] text-gray-400">{user?.company_name || 'ERP'}</p>
              </div>
            </div>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
