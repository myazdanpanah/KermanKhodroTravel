import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../components/Toast'
import { useLogout } from '../hooks/useLogout'
import api from '../api/client'
import SplashScreen from '../components/SplashScreen'
import { useBrandLogo } from '../store/brandingStore'
import {
  BarChart3, DollarSign, Users, Database, Upload,
  Settings, ArrowLeft, LogOut, Map,
  Package, ShoppingCart, Factory, Ship, Headphones,
  Briefcase, LineChart, Brain, Workflow, TrendingUp,
  Tag, Inbox
} from 'lucide-react'

interface ModuleInfo {
  id: string
  label: string
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  bi_dashboard: BarChart3,
  finance: DollarSign,
  crm: Users,
  office: Inbox,
  db_manager: Database,
  datasets: Upload,
  llm: Brain,
  settings: Settings,
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
}

const MODULE_ROUTES: Record<string, string> = {
  bi_dashboard: '/dashboards',
  finance: '/erp',
  crm: '/erp/crm',
  office: '/erp/office',
  db_manager: '/db-manager',
  datasets: '/data/upload',
  llm: '/erp/settings/ai',
  settings: '/erp/settings',
  manufacturing: '/erp/manufacturing',
  inventory: '/erp/inventory',
  workflow: '/erp',
  purchasing: '/erp/purchasing',
  sales: '/erp/sales',
  trading: '/erp/trading',
  service_sales: '/erp/service-sales',
  service_management: '/erp/service-management',
  hr: '/erp/hr',
  reporting: '/erp/reports',
  ai_insights: '/erp/ai',
}

// This installation is licensed for three modules only: BI, finance and CRM.
// Everything else in the upstream navigation stays hidden.
const DELIVERED_MODULES = new Set(['bi_dashboard', 'finance', 'crm', 'office'])

const MODULE_DESCRIPTIONS: Record<string, string> = {
  bi_dashboard: 'داشبوردها و نمودارهای هوشمند',
  finance: 'صورتحساب، پرداخت‌ها و مدیریت مالی',
  crm: 'مدیریت ارتباط با مشتریان',
  office: 'اتوماسیون اداری، نامه‌ها و کارتابل',
  db_manager: 'مدیریت پایگاه داده و جداول',
  datasets: 'آپلود و مدیریت داده‌ها',
  llm: 'درگاه هوش مصنوعی و تنظیمات مدل',
  settings: 'تنظیمات سازمان و ماژول‌ها',
  manufacturing: 'تولید، لیست مواد و کنترل کیفیت',
  inventory: 'انبارها، موجودی و جابجایی‌ها',
  workflow: 'موتور گردش‌کار و تأییدیه‌ها',
  purchasing: 'درخواست خرید، سفارش و رسید کالا',
  sales: 'پیش‌فاکتور، سفارش و فاکتور فروش',
  trading: 'واردات، صادرات، کانتینر و حمل',
  service_sales: 'رزرو، بلیط، تور و هتل',
  service_management: 'درخواست خدمات، دستور کار و SLA',
  hr: 'کارکنان، حضور و غیاب و حقوق',
  reporting: 'گزارش‌ها، داشبوردها و KPI',
  ai_insights: 'تحلیل ناهنجاری، پیش‌بینی و پرسش طبیعی',
}

export default function LauncherPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const handleLogout = useLogout()
  const { toast } = useToast()
  const [modules, setModules] = useState<ModuleInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [splashGone, setSplashGone] = useState(false)
  const logo = useBrandLogo()

  useEffect(() => {
    fetchModules()
  }, [])

  const fetchModules = async () => {
    try {
      const res = await api.get('/auth/user-modules/')
      const delivered = res.data.filter((m: ModuleInfo) => DELIVERED_MODULES.has(m.id))
      // Settings is not a licensed module but the admins need a direct entry.
      if ((user?.role === 'ceo' || user?.role === 'admin') && !delivered.some((m: ModuleInfo) => m.id === 'settings')) {
        delivered.push({ id: 'settings', label: 'تنظیمات' })
      }
      setModules(delivered)
    } catch {
      toast('خطا در دریافت ماژول‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleModuleClick = (moduleId: string) => {
    const route = MODULE_ROUTES[moduleId]
    if (route) {
      navigate(route)
    } else {
      toast(`ماژول ${moduleId} هنوز فعال نیست`, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-nx-navy flex flex-col">
      {/* Glowing brand splash while modules load, then a subtle flash reveals the grid */}
      {!splashGone && <SplashScreen show={loading} onExited={() => setSplashGone(true)} />}

      {/* Header */}
      <header className="border-b border-nx-navy-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Nexivo"
              draggable={false}
              className="h-8 w-auto select-none"
            />
            <div>
              <h1 className="text-lg font-bold text-white">Nexivo</h1>
              <p className="text-xs text-nx-mist">سازمان هوشمند</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className="text-sm font-medium text-white">
                {user?.first_name || user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.username}
              </p>
              <p className="text-xs text-nx-mist">{user?.company_name || 'بدون شرکت'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-nx-mist hover:text-white hover:bg-white/5 rounded-nx-btn transition"
              title="خروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl w-full">
          {/* Welcome */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">
              خوش آمدید، {user?.first_name || user?.username}
            </h2>
            <p className="text-nx-mist text-lg">
              ماژول مورد نظر خود را انتخاب کنید
            </p>
          </div>

          {/* Module Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-nx-blue border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-nx-mist mt-4">در حال بارگذاری ماژول‌ها...</p>
            </div>
          ) : modules.length === 0 ? (
            <div className="text-center py-12">
              <Database className="w-16 h-16 text-nx-mist/50 mx-auto mb-4" />
              <p className="text-nx-mist text-lg">هیچ ماژولی فعال نیست</p>
              <p className="text-nx-mist/70 text-sm mt-2">
                با مدیر سیستم تماس بگیرید تا ماژول‌ها را فعال کند
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((mod) => {
                const Icon = MODULE_ICONS[mod.id] || Database
                const description = MODULE_DESCRIPTIONS[mod.id] || ''
                return (
                  <button
                    key={mod.id}
                    onClick={() => handleModuleClick(mod.id)}
                    className="group relative overflow-hidden bg-nx-navy-elevated border border-nx-navy-border rounded-nx-card p-6 text-right hover:border-nx-blue transition-all duration-300 hover:shadow-nx-elevated"
                  >
                    {/* Hover accent — token-driven, no gradients */}
                    <div className="absolute inset-0 bg-nx-blue/0 group-hover:bg-nx-blue/5 transition-colors duration-300" />
                    
                    <div className="relative">
                      <div className="w-12 h-12 bg-nx-blue/10 border border-nx-blue/40 rounded-nx-btn flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-nx-blue group-hover:text-nx-teal transition-colors duration-300" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">{mod.label}</h3>
                      {description && (
                        <p className="text-sm text-nx-mist">{description}</p>
                      )}
                      <div className="mt-4 flex items-center gap-1 text-nx-teal text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>ورود</span>
                        <ArrowLeft className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-nx-navy-border px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-nx-mist/70">
          <span>Nexivo v0.4.0</span>
          <div className="flex items-center gap-4">
            <span>پلتفرم سازمان هوشمند</span>
            <button
              onClick={() => navigate('/roadmap')}
              className="text-nx-teal hover:text-nx-blue transition flex items-center gap-1"
            >
              <Map className="w-3 h-3" />
              نقشه راه
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
