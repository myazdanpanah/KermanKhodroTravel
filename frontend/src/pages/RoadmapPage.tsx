import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogout } from '../hooks/useLogout'
import {
  BarChart3, DollarSign, Users, Database, Upload, Settings, Zap,
  GitBranch, Briefcase, Package, FolderKanban,
  Shield, Bell, ArrowLeft, Check, Clock, Rocket, ChevronDown, ChevronUp,
  ShoppingCart, Factory, Headphones, Ship, Tag, Brain, LineChart,
  TrendingUp
} from 'lucide-react'

interface RoadmapItem {
  id: string
  label: string
  labelEn: string
  description: string
  icon: React.ElementType
  status: 'implemented' | 'in-progress' | 'planned'
  category: string
  gradient: string
  route?: string
  features: string[]
}

const ROADMAP_ITEMS: RoadmapItem[] = [
  // ── Finished modules ─────────────────────────────────────────
  {
    id: 'bi_dashboard',
    label: 'داشبورد هوشمند',
    labelEn: 'BI Dashboard',
    description: 'داشبوردهای تعاملی با نمودارها و فیلترهای پیشرفته',
    icon: BarChart3,
    status: 'implemented',
    category: 'هسته',
    gradient: 'from-nx-blue to-nx-blue',
    route: '/dashboards',
    features: [
      'کشیدن و رها کردن ویجت‌ها',
      'چند صفحه در هر داشبورد',
      '۱۵+ نوع نمودار (ECharts)',
      'فیلتر سطح داشبورد و ویجت',
      'فیلتر متقاطع نمودارها',
      'حفره‌ای (Drill-Down)',
      'امنیت سطح ردیف (RLS)',
      'یکپارچه‌سازی Superset',
    ],
  },
  {
    id: 'finance',
    label: 'حسابداری و مالی',
    labelEn: 'Finance',
    description: 'حسابداری ایرانی با استاندارد کل → معین → تفصیلی',
    icon: DollarSign,
    status: 'implemented',
    category: 'مالی',
    gradient: 'from-nx-teal to-nx-teal',
    route: '/erp',
    features: [
      'ساختار حساب: کل → معین → تفصیلی',
      'فاکتور با شماره‌گذاری خودکار',
      'رسید و پرداخت',
      'چک با چرخه عمر کامل',
      'سند حسابداری با اعتبارسنجی',
      'مشتری و تأمین‌کننده',
      'سال مالی و تراز افتتاحیه',
      'داشبورد KPI مالی',
    ],
  },
  {
    id: 'inventory',
    label: 'مدیریت انبار',
    labelEn: 'Inventory',
    description: 'انبارها، موجودی، جابجایی‌ها و رزروها',
    icon: Package,
    status: 'implemented',
    category: 'عملیاتی',
    gradient: 'from-nx-teal to-nx-teal',
    route: '/erp/inventory',
    features: [
      'چند انباره',
      'جابجایی و انتقال بین انبارها',
      'رزرو موجودی',
      'شمارش و اصلاح موجودی',
      'هشدار کمبود موجودی',
      'داشبورد موجودی',
    ],
  },
  {
    id: 'purchasing',
    label: 'خرید',
    labelEn: 'Purchasing',
    description: 'درخواست خرید، سفارش خرید و رسید کالا',
    icon: ShoppingCart,
    status: 'implemented',
    category: 'عملیاتی',
    gradient: 'from-nx-blue to-nx-teal',
    route: '/erp/purchasing',
    features: [
      'درخواست خرید چندمرحله‌ای',
      'سفارش خرید',
      'رسید کالا',
      'تأییدیه و گردش وضعیت',
      'اتصال به انبار و تأمین‌کننده',
      'داشبورد خرید',
    ],
  },
  {
    id: 'sales',
    label: 'فروش',
    labelEn: 'Sales',
    description: 'پیش‌فاکتور، سفارش، فاکتور و برگشتی فروش',
    icon: TrendingUp,
    status: 'implemented',
    category: 'عملیاتی',
    gradient: 'from-nx-teal to-nx-teal',
    route: '/erp/sales',
    features: [
      'پیش‌فاکتور (Quotation)',
      'سفارش فروش',
      'فاکتور فروش و مطالبات',
      'برگشتی فروش',
      'تأیید و لغو سفارش',
      'داشبورد فروش',
    ],
  },
  {
    id: 'crm',
    label: 'مدیریت ارتباط با مشتری',
    labelEn: 'CRM',
    description: 'سرنخ‌ها، فرصت‌ها، فعالیت‌ها و کمپین‌ها',
    icon: Users,
    status: 'implemented',
    category: 'روابط',
    gradient: 'from-nx-blue to-nx-blue',
    route: '/erp/crm',
    features: [
      'پروفایل مشتری',
      'ردیابی سرنخ (Lead Tracking)',
      'خط لوله فروش (Pipeline)',
      'فعالیت‌ها و تعاملات',
      'کمپین‌های بازاریابی',
      'داشبورد CRM',
    ],
  },
  {
    id: 'service_management',
    label: 'مدیریت خدمات',
    labelEn: 'Service Management',
    description: 'درخواست خدمات، دستور کار، تکنسین، قرارداد و SLA',
    icon: Headphones,
    status: 'implemented',
    category: 'خدمات',
    gradient: 'from-nx-warning-500 to-nx-danger-600',
    route: '/erp/service-management',
    features: [
      'درخواست خدمات و گردش وضعیت',
      'دستور کار و تخصیص تکنسین',
      'مدیریت تکنسین‌ها',
      'قرارداد و گارانتی',
      'SLA و نگهداری پیشگیرانه',
      'داشبورد خدمات',
    ],
  },
  {
    id: 'hr',
    label: 'منابع انسانی',
    labelEn: 'HR',
    description: 'کارکنان، حضور و غیاب، مرخصی، حقوق و ارزیابی',
    icon: Briefcase,
    status: 'implemented',
    category: 'سازمانی',
    gradient: 'from-nx-blue to-nx-blue',
    route: '/erp/hr',
    features: [
      'پرونده کارکنان',
      'حضور و غیاب',
      'مرخصی و انواع مرخصی',
      'محاسبه حقوق و دستمزد',
      'ارزیابی عملکرد',
      'استخدام و بخش‌ها',
    ],
  },
  {
    id: 'reporting',
    label: 'گزارش‌ساز و تحلیل',
    labelEn: 'Reporting & Analytics',
    description: 'قالب گزارش، اجرا، خروجی، KPI و گزارش زمان‌بندی‌شده',
    icon: LineChart,
    status: 'implemented',
    category: 'تحلیلی',
    gradient: 'from-nx-blue to-nx-blue',
    route: '/erp/reports',
    features: [
      'قالب گزارش برای همه ماژول‌ها',
      'اجرای گزارش و تاریخچه',
      'خروجی PDF/Excel',
      'داشبوردهای تحلیلی',
      'KPI و شاخص‌ها',
      'گزارش‌های زمان‌بندی‌شده',
    ],
  },
  {
    id: 'ai_insights',
    label: 'هوش مصنوعی و بینش',
    labelEn: 'AI Insights',
    description: 'کشف ناهنجاری، پیش‌بینی و پرسش به زبان طبیعی',
    icon: Brain,
    status: 'implemented',
    category: 'هوش مصنوعی',
    gradient: 'from-nx-blue to-nx-blue',
    route: '/erp/ai',
    features: [
      'کشف ناهنجاری (Z-Score)',
      'پیش‌بینی با رگرسیون خطی',
      'پرسش به زبان طبیعی (NL Query)',
      'هشدارهای لحظه‌ای (WebSocket)',
      'داشبورد بینش‌ها',
      'پشتیبانی از LLM',
    ],
  },
  {
    id: 'db_manager',
    label: 'مدیریت پایگاه داده',
    labelEn: 'Database Manager',
    description: 'اتصال، مرور، ویرایش و پرس‌وجوی پایگاه داده',
    icon: Database,
    status: 'implemented',
    category: 'داده',
    gradient: 'from-nx-warning-500 to-nx-warning-600',
    route: '/db-manager',
    features: [
      'اتصال به PostgreSQL, MySQL, SQL Server',
      'ویرایش مستقیم سلول‌ها',
      'ویرایشگر SQL',
      'ورود فایل Excel/CSV به جدول جدید',
      'همگام‌سازی Google Sheets',
      'رمزنگاری اطلاعات اتصال',
    ],
  },
  {
    id: 'datasets',
    label: 'بارگذاری داده',
    labelEn: 'Data Upload',
    description: 'آپلود و پردازش فایل‌های اکسل و CSV',
    icon: Upload,
    status: 'implemented',
    category: 'داده',
    gradient: 'from-nx-blue to-nx-danger-600',
    route: '/data/upload',
    features: [
      'آپلود drag-and-drop',
      'پشتیبانی Excel (.xlsx/.xls) و CSV',
      'پردازش و پاکسازی خودکار',
      'ایجاد جدول PostgreSQL',
      'Aggregate و GROUP BY',
    ],
  },
  {
    id: 'llm',
    label: 'دروازه هوش مصنوعی',
    labelEn: 'LLM Gateway',
    description: 'یکپارچه‌سازی چندین ارائه‌دهنده AI',
    icon: Zap,
    status: 'implemented',
    category: 'هوش مصنوعی',
    gradient: 'from-nx-blue to-nx-blue',
    route: '/erp/settings/ai',
    features: [
      'پشتیبانی Ollama, OpenAI, Gemini, Anthropic',
      'رمزنگاری کلیدهای API',
      'محدودیت نرخ درخواست',
      'تاریخچه چت',
      'پیگیری مصرف توکن',
    ],
  },
  {
    id: 'settings',
    label: 'تنظیمات سازمان',
    labelEn: 'Settings',
    description: 'مدیریت ماژول‌ها، کاربران و ساختار سازمانی',
    icon: Settings,
    status: 'implemented',
    category: 'مدیریت',
    gradient: 'from-nx-muted to-nx-muted',
    route: '/erp/settings',
    features: [
      'فعال/غیرفعال کردن ماژول‌ها',
      'ساختار شرکت → بخش → تیم',
      'نمودار سازمانی',
      'نقش‌های سفارشی',
      'تخصیص دسته‌ای داشبورد',
    ],
  },
  {
    id: 'audit',
    label: 'حسابرسی و انطباق',
    labelEn: 'Audit',
    description: 'ثبت تغییرات، ردیابی فعالیت و انطباق مقرراتی',
    icon: Shield,
    status: 'implemented',
    category: 'امنیتی',
    gradient: 'from-nx-danger-500 to-nx-danger-600',
    route: '/erp/audit',
    features: [
      'لاگ تغییرات (Audit Trail)',
      'ردیابی فعالیت کاربران',
      'نمایش Diff تغییرات',
      'پیکربندی مدل‌های تحت نظارت',
      'داشبورد خلاصه حسابرسی',
    ],
  },

  // ── Partially finished modules ───────────────────────────────
  {
    id: 'manufacturing',
    label: 'تولید',
    labelEn: 'Manufacturing',
    description: 'بک‌اند کامل؛ رابط کاربری فعلاً فقط نمایشی/خواندنی است',
    icon: Factory,
    status: 'in-progress',
    category: 'عملیاتی',
    gradient: 'from-nx-warning-500 to-nx-warning-600',
    route: '/erp/manufacturing',
    features: [
      '✅ BOM، Routing و Work Center (بک‌اند)',
      '✅ دستور تولید و گردش وضعیت',
      '✅ کنترل کیفیت (بک‌اند)',
      '⏳ فرم ایجاد/ویرایش BOM در UI',
      '⏳ صفحه کنترل کیفیت هنوز فقط نمایشی است',
      '⏳ برنامه‌ریزی ظرفیت و MRP در UI',
    ],
  },
  {
    id: 'trading',
    label: 'بازرگانی',
    labelEn: 'Trading',
    description: 'بک‌اند کامل؛ صفحات فعلی فقط لیست خواندنی هستند',
    icon: Ship,
    status: 'in-progress',
    category: 'عملیاتی',
    gradient: 'from-nx-blue to-nx-blue',
    route: '/erp/trading',
    features: [
      '✅ واردات، صادرات، کانتینر و حمل (بک‌اند)',
      '✅ گردش وضعیت واردات و صادرات',
      '✅ داشبورد بازرگانی',
      '⏳ فرم ایجاد کانتینر/حمل در UI',
      '⏳ مدیریت اسناد گمرکی',
      '⏳ محاسبه هزینه‌های ارزی',
    ],
  },
  {
    id: 'service_sales',
    label: 'فروش خدمات',
    labelEn: 'Service Sales',
    description: 'بک‌اند کامل؛ بیشتر صفحات فعلی فقط لیست خواندنی هستند',
    icon: Tag,
    status: 'in-progress',
    category: 'خدمات',
    gradient: 'from-nx-danger-500 to-nx-blue',
    route: '/erp/service-sales',
    features: [
      '✅ رزرو، بلیط، تور، هتل و مسافر (بک‌اند)',
      '✅ کمیسیون و بازپرداخت (بک‌اند)',
      '✅ داشبورد فروش خدمات',
      '⏳ فرم ایجاد/ویرایش تور و هتل در UI',
      '⏳ مدیریت مسافران و صدور بلیط',
      '⏳ تسویه کمیسیون و بازپرداخت',
    ],
  },
  {
    id: 'workflow',
    label: 'گردش کار',
    labelEn: 'Workflow Engine',
    description: 'موتور و API کامل است؛ رابط کاربری هنوز ساخته نشده',
    icon: GitBranch,
    status: 'in-progress',
    category: 'خودکارسازی',
    gradient: 'from-nx-blue to-nx-blue',
    features: [
      '✅ تعریف گردش کار و انتقال وضعیت (بک‌اند)',
      '✅ قوانین SLA و پیگیری (بک‌اند)',
      '✅ تست‌های موتور گردش کار',
      '⏳ صفحه طراحی/مدیریت گردش کار',
      '⏳ صف درخواست‌های در انتظار تأیید',
      '⏳ اعلان و یادآوری',
    ],
  },
  {
    id: 'notifications',
    label: 'سیستم اعلان',
    labelEn: 'Notifications',
    description: 'اعلان درون‌برنامه‌ای موجود است؛ ایمیل/SMS هنوز نه',
    icon: Bell,
    status: 'in-progress',
    category: 'ارتباطی',
    gradient: 'from-nx-blue to-nx-blue',
    features: [
      '✅ زنگ اعلان و شمارنده خوانده‌نشده',
      '✅ اعلان تخصیص داشبورد',
      '✅ علامت‌گذاری خوانده‌شده',
      '⏳ ارسال ایمیل و SMS',
      '⏳ وبهوک و تنظیمات ترجیحی',
      '⏳ گروه‌بندی و مرکز اعلان‌ها',
    ],
  },

  // ── Planned modules ──────────────────────────────────────────
  {
    id: 'project',
    label: 'مدیریت پروژه',
    labelEn: 'Project',
    description: 'مدیریت وظایف، milestones و نمودار گانت',
    icon: FolderKanban,
    status: 'planned',
    category: 'عملیاتی',
    gradient: 'from-nx-blue to-nx-blue',
    features: [
      'تخته وظایف (Kanban)',
      'نمودار گانت',
      'زمان‌بندی پروژه',
      'گزارش پیشرفت',
      'تخصیص منابع',
    ],
  },
]

const STATUS_CONFIG = {
  'implemented': {
    label: 'پیاده‌سازی شده',
    icon: Check,
    color: 'text-nx-teal',
    bg: 'bg-nx-teal/20 border-nx-teal/30',
    dot: 'bg-nx-teal',
  },
  'in-progress': {
    label: 'در حال توسعه',
    icon: Clock,
    color: 'text-nx-warning-400',
    bg: 'bg-nx-warning-500/20 border-nx-warning-500/30',
    dot: 'bg-nx-warning-400 animate-pulse',
  },
  'planned': {
    label: 'برنامه‌ریزی شده',
    icon: Rocket,
    color: 'text-nx-mist',
    bg: 'bg-nx-muted/20 border-nx-muted/30',
    dot: 'bg-nx-mist',
  },
}

const CATEGORIES = ['همه', ...Array.from(new Set(ROADMAP_ITEMS.map((i) => i.category)))]

export default function RoadmapPage() {
  const navigate = useNavigate()
  const handleLogout = useLogout()
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('همه')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const filteredItems = useMemo(
    () =>
      ROADMAP_ITEMS.filter((item) => {
        if (selectedStatus !== 'all' && item.status !== selectedStatus) return false
        if (selectedCategory !== 'همه' && item.category !== selectedCategory) return false
        return true
      }),
    [selectedStatus, selectedCategory]
  )

  const statusCounts = useMemo(
    () => ({
      implemented: ROADMAP_ITEMS.filter((i) => i.status === 'implemented').length,
      'in-progress': ROADMAP_ITEMS.filter((i) => i.status === 'in-progress').length,
      planned: ROADMAP_ITEMS.filter((i) => i.status === 'planned').length,
    }),
    []
  )

  return (
    <div className="min-h-screen bg-nx-blue">
      {/* Header */}
      <header className="border-b border-nx-navy/50 px-6 py-4 sticky top-0 z-10 bg-nx-navy/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-nx-mist hover:text-white hover:bg-nx-navy-elevated rounded-xl transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">نقشه راه</h1>
              <p className="text-xs text-nx-mist">Nexivo Roadmap</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-nx-mist hover:text-white hover:bg-nx-navy-elevated rounded-xl transition"
            title="خروج"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-nx-navy-elevated border border-nx-navy/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-nx-teal/20 rounded-xl flex items-center justify-center">
                <Check className="w-5 h-5 text-nx-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{statusCounts.implemented}</p>
                <p className="text-xs text-nx-mist">پیاده‌سازی شده</p>
              </div>
            </div>
            <div className="w-full bg-nx-navy-elevated rounded-full h-2 mt-3">
              <div
                className="bg-nx-teal h-2 rounded-full transition-all duration-500"
                style={{ width: `${(statusCounts.implemented / ROADMAP_ITEMS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-nx-navy-elevated border border-nx-navy/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-nx-warning-500/20 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-nx-warning-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{statusCounts['in-progress']}</p>
                <p className="text-xs text-nx-mist">در حال توسعه</p>
              </div>
            </div>
            <div className="w-full bg-nx-navy-elevated rounded-full h-2 mt-3">
              <div
                className="bg-nx-warning-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(statusCounts['in-progress'] / ROADMAP_ITEMS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-nx-navy-elevated border border-nx-navy/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-nx-muted/20 rounded-xl flex items-center justify-center">
                <Rocket className="w-5 h-5 text-nx-mist" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{statusCounts.planned}</p>
                <p className="text-xs text-nx-mist">برنامه‌ریزی شده</p>
              </div>
            </div>
            <div className="w-full bg-nx-navy-elevated rounded-full h-2 mt-3">
              <div
                className="bg-nx-muted h-2 rounded-full transition-all duration-500"
                style={{ width: `${(statusCounts.planned / ROADMAP_ITEMS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-4">
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedStatus === 'all'
                  ? 'bg-nx-blue text-white shadow-lg shadow-nx-blue/25'
                  : 'bg-nx-navy-elevated text-nx-mist border border-nx-navy/50 hover:border-nx-muted'
              }`}
            >
              همه ({ROADMAP_ITEMS.length})
            </button>
            {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(
              ([key, config]) => (
                <button
                  key={key}
                  onClick={() => setSelectedStatus(key)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedStatus === key
                      ? `${config.bg} ${config.color} border`
                      : 'bg-nx-navy-elevated text-nx-mist border border-nx-navy/50 hover:border-nx-muted'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                  {config.label} ({statusCounts[key as keyof typeof statusCounts]})
                </button>
              )
            )}
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-nx-navy text-white'
                    : 'text-nx-mist hover:text-nx-mist hover:bg-nx-navy-elevated'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Roadmap Items */}
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const statusConf = STATUS_CONFIG[item.status]
            const StatusIcon = statusConf.icon
            const isExpanded = expandedItem === item.id

            return (
              <div
                key={item.id}
                className={`bg-nx-navy-elevated border rounded-2xl overflow-hidden transition-all duration-300 ${
                  item.status === 'implemented'
                    ? 'border-nx-navy/50 hover:border-nx-teal/30'
                    : item.status === 'in-progress'
                    ? 'border-nx-warning-500/20 hover:border-nx-warning-500/40'
                    : 'border-nx-navy/30 hover:border-nx-muted/50'
                }`}
              >
                <button
                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                  className="w-full p-5 text-right flex items-center gap-4"
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center flex-shrink-0 ${
                    item.status === 'planned' ? 'opacity-60' : ''
                  }`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{item.label}</h3>
                      <span className="text-xs text-nx-mist font-mono">{item.labelEn}</span>
                    </div>
                    <p className="text-sm text-nx-mist truncate">{item.description}</p>
                  </div>

                  {/* Status Badge */}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${statusConf.bg} ${statusConf.color} border flex-shrink-0`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusConf.label}
                  </div>

                  {/* Category */}
                  <span className="text-xs text-nx-mist bg-nx-navy-elevated px-2.5 py-1 rounded-lg flex-shrink-0 hidden sm:block">
                    {item.category}
                  </span>

                  {/* Expand Arrow */}
                  <div className="text-nx-mist flex-shrink-0">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-nx-navy/30">
                    <div className="pt-4">
                      <h4 className="text-sm font-semibold text-nx-mist mb-3">قابلیت‌ها</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {item.features.map((feature, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-sm text-nx-mist"
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              item.status === 'implemented'
                                ? 'bg-nx-teal'
                                : item.status === 'in-progress'
                                ? 'bg-nx-warning-400'
                                : 'bg-nx-muted'
                            }`} />
                            {feature}
                          </div>
                        ))}
                      </div>

                      {item.route && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(item.route!)
                          }}
                          className="mt-4 px-4 py-2 bg-nx-blue hover:bg-nx-blue text-white text-sm font-medium rounded-xl transition flex items-center gap-2 w-fit"
                        >
                          <span>ورود به ماژول</span>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <Rocket className="w-16 h-16 text-nx-mist mx-auto mb-4" />
            <p className="text-nx-mist text-lg">ماژولی یافت نشد</p>
            <p className="text-nx-mist text-sm mt-2">فیلترها را تغییر دهید</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-nx-navy/50 px-6 py-3 mt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-nx-mist">
          <span>Nexivo v0.16.0 — Organization OS</span>
          <span>{ROADMAP_ITEMS.length} ماژول</span>
        </div>
      </footer>
    </div>
  )
}
