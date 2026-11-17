import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { Plus, BarChart3, LogOut, ChevronLeft, LayoutTemplate, TrendingUp, DollarSign, Megaphone, Users, ShoppingBag, Trash2, Copy, Share2, MoreVertical, X, UserCheck, Pencil } from 'lucide-react'
import NotificationBell from '../components/NotificationBell'
import ThemeToggle from '../components/ThemeToggle'
import { ALL_ROLES } from '../utils/roles'

interface Dashboard {
  id: number
  name: string
  description: string
  owner_name: string
  is_published: boolean
  allowed_roles: string[]
  widgets: unknown[]
  pages?: Array<{ id: number; name: string; widgets: unknown[] }>
  created_at: string
  assignment_id?: number
  assigned_by_name?: string
  assignment_data_filters?: unknown[]
}

interface Template {
  id: string
  name: string
  description: string
  page_count: number
  widget_count: number
}

const TEMPLATE_ICONS: Record<string, typeof BarChart3> = {
  sales: TrendingUp,
  finance: DollarSign,
  marketing: Megaphone,
  hr: Users,
  retail: ShoppingBag,
  blank: BarChart3,
}

const TEMPLATE_COLORS: Record<string, string> = {
  sales: 'bg-nx-teal',
  finance: 'bg-nx-blue',
  marketing: 'bg-nx-blue',
  hr: 'bg-nx-blue',
  retail: 'bg-nx-blue',
  blank: 'bg-nx-mist',
}



export default function DashboardListPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<number | null>(null)
  const [shareModal, setShareModal] = useState<Dashboard | null>(null)
  const [shareRoles, setShareRoles] = useState<string[]>([])
  const [assignedDashboards, setAssignedDashboards] = useState<Set<number>>(new Set())
  const [editModal, setEditModal] = useState<Dashboard | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { toast } = useToast()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchDashboards()
    fetchTemplates()
    fetchAssignedDashboards()
  }, [])

  // Close menus on outside click
  useEffect(() => {
    if (!activeMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeMenu])

  const fetchDashboards = async () => {
    try {
      const res = await api.get('/dashboards/')
      setDashboards(res.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/dashboards/templates/')
      setTemplates(res.data)
    } catch {
      // ignore
    }
  }

  const fetchAssignedDashboards = async () => {
    try {
      const res = await api.get('/dashboards/my-assigned/')
      const ids = new Set<number>(res.data.map((d: { id: number }) => d.id))
      setAssignedDashboards(ids)
    } catch {
      // ignore
    }
  }

  const createDashboard = async () => {
    try {
      const res = await api.post('/dashboards/', {
        name: 'داشبورد جدید',
        description: '',
        allowed_roles: ['ceo', 'finance', 'sales', 'admin'],
      })
      toast('داشبورد جدید ساخته شد', 'success')
      navigate(`/dashboards/${res.data.id}`)
    } catch {
      toast('خطا در ساخت داشبورد', 'error')
    }
  }

  const createFromTemplate = async (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId)
    const name = tmpl?.name || templateId
    if (!window.confirm(`آیا از ساخت داشبورد «${name}» از قالب اطمینان دارید؟`)) return
    setCreatingFromTemplate(templateId)
    try {
      const res = await api.post('/dashboards/create-from-template/', {
        template_id: templateId,
      })
      toast('داشبورد از قالب ساخته شد', 'success')
      setShowTemplates(false)
      navigate(`/dashboards/${res.data.id}`)
    } catch {
      toast('خطا در ساخت داشبورد از قالب', 'error')
    } finally {
      setCreatingFromTemplate(null)
    }
  }

  const handleDeleteDashboard = async (d: Dashboard) => {
    if (!window.confirm(`آیا از حذف داشبورد «${d.name}» اطمینان دارید؟ این عمل غیرقابل بازگشت است.`)) return
    try {
      await api.delete(`/dashboards/${d.id}/`)
      setDashboards((prev) => prev.filter((x) => x.id !== d.id))
      toast('داشبورد حذف شد', 'success')
    } catch {
      toast('خطا در حذف داشبورد', 'error')
    }
    setActiveMenu(null)
  }

  const handleDuplicateDashboard = async (d: Dashboard) => {
    try {
      await api.post(`/dashboards/${d.id}/duplicate/`)
      toast('داشبورد کپی شد', 'success')
      fetchDashboards()
      setActiveMenu(null)
    } catch {
      toast('خطا در کپی داشبورد', 'error')
    }
  }

  const openShareModal = (d: Dashboard) => {
    setShareRoles(d.allowed_roles || [])
    setShareModal(d)
    setActiveMenu(null)
  }

  const handleShareSave = async () => {
    if (!shareModal) return
    try {
      await api.put(`/dashboards/${shareModal.id}/share/`, {
        allowed_roles: shareRoles,
      })
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === shareModal.id ? { ...d, allowed_roles: shareRoles } : d
        )
      )
      setShareModal(null)
      toast('دسترسی‌ها به‌روز شد', 'success')
    } catch {
      toast('خطا در به‌روزرسانی دسترسی‌ها', 'error')
    }
  }

  const toggleShareRole = (role: string) => {
    setShareRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const openEditModal = (d: Dashboard) => {
    setEditForm({ name: d.name, description: d.description || '' })
    setEditModal(d)
    setActiveMenu(null)
  }

  const handleEditSave = async () => {
    if (!editModal || !editForm.name.trim()) return
    try {
      await api.put(`/dashboards/${editModal.id}/`, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
      })
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === editModal.id ? { ...d, name: editForm.name.trim(), description: editForm.description.trim() } : d
        )
      )
      setEditModal(null)
      toast('داشبورد به‌روز شد', 'success')
    } catch {
      toast('خطا در به‌روزرسانی داشبورد', 'error')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleLabels: Record<string, string> = {
    ceo: 'مدیرعامل',
    finance: 'مالی',
    sales: 'فروش',
    admin: 'مدیر سیستم',
  }

  return (
    <div className="min-h-screen bg-white dark:bg-nx-navy" dir="rtl">
      {/* Header */}
      <header className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-nx-blue rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-nx-navy dark:text-slate-100">نکسیوو</h1>
              <p className="text-xs text-slate-600 dark:text-slate-200">پلتفرم داشبورد هوشمند</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <ThemeToggle />

            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
              <span className="font-medium">{user?.username}</span>
              <span className="px-2 py-0.5 bg-nx-blue/10 dark:bg-nx-blue/40 text-nx-blue dark:text-nx-blue rounded-lg text-xs font-medium">
                {roleLabels[user?.role || ''] || user?.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-nx-mist hover:text-nx-danger-500 transition"
              title="خروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-white dark:text-slate-100">داشبوردها</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted text-nx-navy dark:text-nx-mist rounded-xl hover:bg-white dark:hover:bg-nx-navy transition text-sm font-medium"
            >
              <LayoutTemplate className="w-4 h-4" />
              استفاده از قالب
            </button>
            <button
              onClick={createDashboard}
              className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              داشبورد جدید
            </button>
          </div>
        </div>

        {/* Template Picker */}
        {showTemplates && (
          <div className="mb-8 bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-6">
            <h3 className="text-lg font-bold text-nx-navy dark:text-slate-100 mb-4">قالب‌های آماده</h3>
            <p className="text-sm text-slate-600 dark:text-slate-200 mb-6">یک قالب انتخاب کنید تا داشبورد شما با نمودارهای پیش‌فرض ساخته شود. سپس می‌توانید داده‌ها و تنظیمات را تغییر دهید.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tmpl) => {
                const Icon = TEMPLATE_ICONS[tmpl.id] || BarChart3
                const colorClass = TEMPLATE_COLORS[tmpl.id] || 'bg-nx-mist'
                const isCreating = creatingFromTemplate === tmpl.id
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => createFromTemplate(tmpl.id)}
                    disabled={isCreating}
                    className="text-right p-4 border border-nx-border dark:border-nx-muted rounded-xl hover:border-nx-blue dark:hover:border-nx-blue hover:shadow-md transition group disabled:opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-nx-navy dark:text-slate-100 group-hover:text-nx-blue transition text-sm">
                          {isCreating ? 'در حال ساخت...' : tmpl.name}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-200 mt-1">{tmpl.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-nx-mist">
                          <span>{tmpl.page_count} صفحه</span>
                          <span>{tmpl.widget_count} نمودار</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-nx-mist">در حال بارگذاری...</div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-20">
            <BarChart3 className="w-16 h-16 text-slate-600 dark:text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white dark:text-slate-100 mb-2">هنوز داشبوردی ندارید</h3>
            <p className="text-slate-600 dark:text-slate-200 mb-6">اولین داشبورد خود را بسازید یا از یک قالب شروع کنید</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowTemplates(true)}
                className="px-6 py-3 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted text-nx-navy dark:text-nx-mist rounded-xl hover:bg-white dark:hover:bg-nx-navy transition font-medium"
              >
                <LayoutTemplate className="w-4 h-4 inline ml-2" />
                استفاده از قالب
              </button>
              <button
                onClick={createDashboard}
                className="px-6 py-3 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition font-medium"
              >
                ساخت داشبورد
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards.map((d) => (
              <div
                key={d.id}
                className="group bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-6 hover:shadow-lg hover:border-nx-blue dark:hover:border-nx-blue transition relative"
              >
                <Link to={`/dashboards/${d.id}`} className="block">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-nx-navy dark:text-slate-100 group-hover:text-nx-blue transition">
                      {d.name}
                    </h3>
                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-200 group-hover:text-nx-blue transition" />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-200 mb-4 line-clamp-2">
                    {d.description || 'بدون توضیح'}
                  </p>
                </Link>

                {/* Action buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-nx-mist">
                    {assignedDashboards.has(d.id) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-nx-teal/10 dark:bg-nx-teal/30 text-nx-teal dark:text-nx-teal rounded text-[10px] font-medium">
                        <UserCheck className="w-2.5 h-2.5" />
                        تخصیص
                      </span>
                    )}
                    <span className="text-slate-600 dark:text-slate-200">{d.pages && d.pages.length > 0 ? `${d.pages.length} صفحه` : `${d.widgets?.length || 0} نمودار`}</span>
                    <span className="mx-1 text-slate-600 dark:text-slate-200">·</span>
                    <span className="text-slate-600 dark:text-slate-200">{d.owner_name}</span>
                  </div>

                  {/* Three-dot menu */}
                  <div className="relative" ref={activeMenu === d.id ? menuRef : undefined}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenu(activeMenu === d.id ? null : d.id)
                      }}
                      className="p-1.5 text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist hover:bg-nx-mist/10 dark:hover:bg-nx-navy rounded-lg transition opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenu === d.id && (
                      <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted rounded-xl shadow-lg py-1 z-50 min-w-[160px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(d)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-nx-navy dark:text-nx-mist hover:bg-white dark:hover:bg-nx-navy"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          ویرایش نام و توضیحات
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDuplicateDashboard(d)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-nx-navy dark:text-nx-mist hover:bg-white dark:hover:bg-nx-navy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          کپی داشبورد
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openShareModal(d)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-nx-navy dark:text-nx-mist hover:bg-white dark:hover:bg-nx-navy"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          اشتراک‌گذاری
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteDashboard(d)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-nx-danger-600 hover:bg-nx-danger-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف داشبورد
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Dashboard Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditModal(null)} />
          <div className="relative bg-white dark:bg-nx-navy rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nx-border dark:border-nx-navy-border">
              <h3 className="font-bold text-nx-navy dark:text-slate-100">ویرایش داشبورد</h3>
              <button onClick={() => setEditModal(null)} className="p-1 text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">نام داشبورد</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none"
                  dir="rtl"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">توضیحات</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none resize-none"
                  dir="rtl"
                  placeholder="توضیحات داشبورد..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-nx-border dark:border-nx-navy-border flex items-center justify-end gap-3">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy rounded-xl transition"
              >
                انصراف
              </button>
              <button
                onClick={handleEditSave}
                disabled={!editForm.name.trim()}
                className="px-6 py-2 bg-nx-blue text-white text-sm rounded-xl hover:bg-nx-blue transition font-medium disabled:opacity-50"
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShareModal(null)} />
          <div className="relative bg-white dark:bg-nx-navy rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nx-border dark:border-nx-navy-border">
              <h3 className="font-bold text-nx-navy dark:text-slate-100">اشتراک‌گذاری: {shareModal.name}</h3>
              <button onClick={() => setShareModal(null)} className="p-1 text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-200 mb-4">نقش‌هایی که به این داشبورد دسترسی دارند:</p>
              <div className="space-y-2">
                {ALL_ROLES.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-center gap-3 p-3 rounded-xl border border-nx-border dark:border-nx-muted hover:bg-white dark:hover:bg-nx-navy-elevated cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={shareRoles.includes(r.value)}
                      onChange={() => toggleShareRole(r.value)}
                      className="w-4 h-4 text-nx-blue rounded border-nx-mist focus:ring-nx-blue"
                    />
                    <span className="text-sm font-medium text-nx-navy dark:text-nx-mist">{r.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-nx-mist mt-3">بدون انتخاب = همه نقش‌ها مجازند</p>
            </div>
            <div className="px-6 py-4 border-t border-nx-border dark:border-nx-navy-border flex items-center justify-end gap-3">
              <button
                onClick={() => setShareModal(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy rounded-xl transition"
              >
                انصراف
              </button>
              <button
                onClick={handleShareSave}
                className="px-6 py-2 bg-nx-blue text-white text-sm rounded-xl hover:bg-nx-blue transition font-medium"
              >
                ذخیره دسترسی‌ها
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
