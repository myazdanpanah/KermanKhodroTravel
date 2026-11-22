import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { useBrandingStore, BRAND_DEFAULTS, DEFAULT_MARK } from '../store/brandingStore'
import {
  Puzzle, Users, Building2, FolderTree, Settings,
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, X, Check,
  ToggleLeft, ToggleRight, Zap, Save,
  Palette, Upload, RotateCcw, FileText, Inbox, MessageSquare, Type, LayoutTemplate, Maximize2
} from 'lucide-react'
import BillingLetterheadTab from './BillingLetterheadTab'
import AdminSettingsPage from './AdminSettingsPage'
import SecretariatPanel from './office/SecretariatPanel'
import { officeApi, OfficeMeta } from '../api/office'
import SmsSettingsPanel from '../components/SmsSettingsPanel'
import FontsTab from '../components/FontsTab'
import ReportDesignerTab from './billing/ReportDesignerTab'

// ─── Module Management ────────────────────────────────────────────

interface AllModule {
  id: string
  label: string
}

interface CompanyModules {
  id: number
  enabled_modules: string[]
  all_modules: AllModule[]
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  bi_dashboard: Zap,
  finance: Puzzle,
  crm: Users,
  office: Inbox,
  db_manager: Building2,
  datasets: FolderTree,
  settings: Settings,
}

const MODULE_DESCRIPTIONS: Record<string, string> = {
  bi_dashboard: 'داشبوردها و نمودارهای هوشمند',
  finance: 'صورتحساب، پرداخت‌ها و مدیریت مالی',
  crm: 'مدیریت ارتباط با مشتریان',
  office: 'اتوماسیون اداری، نامه‌ها و کارتابل',
  db_manager: 'مدیریت پایگاه داده و جداول',
  datasets: 'آپلود و مدیریت داده‌ها',
  settings: 'تنظیمات سازمان و ماژول‌ها',
}

function ModuleManagementTab() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Array<{ id: number; name: string }>>([])
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [companyModules, setCompanyModules] = useState<CompanyModules | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchCompanies()
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      fetchCompanyModules(selectedCompany)
    }
  }, [selectedCompany])

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/auth/companies/')
      setCompanies(res.data)
      if (res.data.length > 0) {
        setSelectedCompany(res.data[0].id)
      }
    } catch {
      toast('خطا در دریافت شرکت‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyModules = async (companyId: number) => {
    try {
      const res = await api.get(`/auth/companies/${companyId}/modules/`)
      setCompanyModules(res.data)
      setHasChanges(false)
    } catch {
      toast('خطا در دریافت ماژول‌ها', 'error')
    }
  }

  const toggleModule = (moduleId: string) => {
    if (!companyModules) return
    const current = companyModules.enabled_modules
    const updated = current.includes(moduleId)
      ? current.filter((m) => m !== moduleId)
      : [...current, moduleId]
    setCompanyModules({ ...companyModules, enabled_modules: updated })
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!selectedCompany || !companyModules) return
    setSaving(true)
    try {
      await api.put(`/auth/companies/${selectedCompany}/modules/`, {
        enabled_modules: companyModules.enabled_modules,
      })
      toast('ماژول‌ها ذخیره شدند', 'success')
      setHasChanges(false)
    } catch {
      toast('خطا در ذخیره', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-nx-mist">در حال بارگذاری...</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Company Selector */}
      <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-6">
        <h3 className="font-bold text-nx-navy dark:text-slate-100 mb-4">انتخاب شرکت</h3>
        {companies.length === 0 ? (
          <p className="text-nx-mist text-sm">هنوز شرکتی تعریف نشده. ابتدا در تب «ساختار سازمانی» شرکت ایجاد کنید.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCompany(c.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  selectedCompany === c.id
                    ? 'bg-nx-blue text-white'
                    : 'bg-nx-mist/10 dark:bg-nx-navy text-nx-navy dark:text-nx-mist hover:bg-nx-mist/20 dark:hover:bg-nx-muted'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Module Grid */}
      {selectedCompany && companyModules && (
        <>
          <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-nx-navy dark:text-slate-100">
                ماژول‌های فعال
              </h3>
              {hasChanges && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-xl text-sm font-medium hover:bg-nx-blue transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {companyModules.all_modules.map((mod) => {
                const Icon = MODULE_ICONS[mod.id] || Puzzle
                const description = MODULE_DESCRIPTIONS[mod.id] || ''
                const isEnabled = companyModules.enabled_modules.includes(mod.id)
                return (
                  <div
                    key={mod.id}
                    className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer ${
                      isEnabled
                        ? 'border-nx-blue bg-nx-blue/10 dark:bg-nx-blue/20'
                        : 'border-nx-border dark:border-nx-muted bg-white dark:bg-nx-navy-elevated hover:border-nx-mist dark:hover:border-nx-muted'
                    }`}
                    onClick={() => toggleModule(mod.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isEnabled ? 'bg-nx-blue/10 dark:bg-nx-blue' : 'bg-nx-mist/20 dark:bg-nx-muted'
                        }`}>
                          <Icon className={`w-5 h-5 ${isEnabled ? 'text-nx-blue dark:text-nx-blue' : 'text-slate-600 dark:text-slate-200'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isEnabled ? 'text-nx-blue dark:text-nx-blue' : 'text-nx-navy dark:text-nx-mist'}`}>
                            {mod.label}
                          </p>
                          {description && (
                            <p className="text-xs text-slate-600 dark:text-slate-200 mt-0.5">{description}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-1">
                        {isEnabled ? (
                          <ToggleRight className="w-8 h-8 text-nx-blue" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-nx-mist" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Info */}
          <div className="bg-nx-blue/10 dark:bg-nx-blue/20 rounded-2xl border border-nx-blue/10 dark:border-nx-blue p-4">
            <p className="text-sm text-nx-blue dark:text-nx-blue">
              <strong>نکته:</strong> ماژول‌های فعال‌شده برای کاربران این شرکت قابل مشاهده خواهند بود.
              کاربران فقط ماژول‌هایی را می‌بینند که هم در سطح شرکت فعال باشد و هم مطابق نقش کاربری دسترسی داشته باشند.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Organization Management (moved from OrganizationPage) ─────────

interface OrgUser {
  id: number
  username: string
  name: string
  role: string
}

interface Team {
  id: number
  name: string
  description: string
  manager: string | null
  manager_name: string | null
  member_count: number
  members: OrgUser[]
}

interface Division {
  id: number
  name: string
  description: string
  manager: string | null
  manager_name: string | null
  teams: Team[]
  employees: OrgUser[]
}

interface OrgCompany {
  id: number
  name: string
  description: string
  divisions: Division[]
  employees: OrgUser[]
}

interface UserOption {
  id: number
  username: string
  first_name: string
  last_name: string
  role: string
}

function OrganizationTab() {
  const { toast } = useToast()
  const [tree, setTree] = useState<OrgCompany[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [modalType, setModalType] = useState<'company' | 'division' | 'team' | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', description: '', manager: 0, company: 0, division: 0 })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [treeRes, usersRes] = await Promise.all([
        api.get('/auth/org-tree/'),
        api.get('/auth/users/'),
      ])
      setTree(treeRes.data)
      setUsers(usersRes.data)
    } catch {
      toast('خطا در دریافت اطلاعات', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }))

  const openCreate = (type: 'company' | 'division' | 'team', parentId?: number) => {
    setModalType(type)
    setEditingId(null)
    setForm({ name: '', description: '', manager: 0, company: type === 'division' ? parentId || 0 : 0, division: type === 'team' ? parentId || 0 : 0 })
  }

  const openEdit = (type: 'company' | 'division' | 'team', item: { id: number; name: string; description?: string; manager?: string | null }, parentId?: number) => {
    setModalType(type)
    setEditingId(item.id)
    const mgrUser = users.find((u) => u.username === item.manager)
    setForm({ name: item.name, description: item.description || '', manager: mgrUser?.id || 0, company: type === 'division' ? parentId || 0 : 0, division: type === 'team' ? parentId || 0 : 0 })
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast('نام الزامی است', 'error'); return }
    try {
      const payload: Record<string, unknown> = { name: form.name, description: form.description }
      if (form.manager) payload.manager = form.manager
      if (modalType === 'company') {
        if (editingId) await api.put(`/auth/companies/${editingId}/`, payload)
        else await api.post('/auth/companies/', payload)
      } else if (modalType === 'division') {
        payload.company = form.company
        if (editingId) await api.put(`/auth/divisions/${editingId}/`, payload)
        else await api.post('/auth/divisions/', payload)
      } else if (modalType === 'team') {
        payload.division = form.division
        if (editingId) await api.put(`/auth/teams/${editingId}/`, payload)
        else await api.post('/auth/teams/', payload)
      }
      toast(editingId ? 'به‌روزرسانی شد' : 'ایجاد شد', 'success')
      setModalType(null)
      fetchData()
    } catch { toast('خطا در ذخیره', 'error') }
  }

  const handleDelete = async (type: 'company' | 'division' | 'team', id: number, name: string) => {
    if (!window.confirm(`آیا از حذف «${name}» اطمینان دارید؟`)) return
    try {
      if (type === 'company') await api.delete(`/auth/companies/${id}/`)
      else if (type === 'division') await api.delete(`/auth/divisions/${id}/`)
      else await api.delete(`/auth/teams/${id}/`)
      toast('حذف شد', 'success')
      fetchData()
    } catch { toast('خطا در حذف', 'error') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white dark:text-slate-100">درخت سازمانی</h3>
        <button onClick={() => openCreate('company')} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition text-sm font-medium">
          <Building2 className="w-4 h-4" /> شرکت جدید
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-nx-mist">در حال بارگذاری...</div>
      ) : tree.length === 0 ? (
        <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-12 text-center">
          <Building2 className="w-12 h-12 text-nx-mist mx-auto mb-3" />
          <p className="text-nx-mist mb-4">هنوز شرکتی تعریف نشده</p>
          <button onClick={() => openCreate('company')} className="px-4 py-2 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition text-sm font-medium">ایجاد اولین شرکت</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
          <div className="divide-y divide-nx-mist/70 dark:divide-nx-navy">
            {tree.map((company) => {
              const compKey = `c${company.id}`
              const isCompOpen = expanded[compKey] !== false
              return (
                <div key={company.id}>
                  <div className="px-6 py-4 hover:bg-white dark:hover:bg-nx-navy-elevated transition flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(compKey)}>
                      {isCompOpen ? <ChevronDown className="w-4 h-4 text-nx-mist" /> : <ChevronRight className="w-4 h-4 text-nx-mist" />}
                      <div className="w-8 h-8 bg-nx-blue/10 dark:bg-nx-blue rounded-lg flex items-center justify-center"><Building2 className="w-4 h-4 text-nx-blue dark:text-nx-blue" /></div>
                      <div>
                        <p className="text-sm font-bold text-nx-navy dark:text-slate-100">{company.name}</p>
                        <p className="text-xs text-nx-mist">{company.divisions.length} واحد · {company.employees.length} کارمند مستقیم</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openCreate('division', company.id)} className="p-1.5 text-nx-mist hover:text-nx-blue hover:bg-nx-blue/10 dark:hover:bg-nx-blue/30 rounded-lg transition" title="افزودن واحد"><Plus className="w-4 h-4" /></button>
                      <button onClick={() => openEdit('company', company)} className="p-1.5 text-nx-mist hover:text-nx-blue hover:bg-nx-blue/10 dark:hover:bg-nx-blue/30 rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete('company', company.id, company.name)} className="p-1.5 text-nx-mist hover:text-nx-danger-500 hover:bg-nx-danger-50 dark:hover:bg-nx-danger-900/30 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {isCompOpen && (
                    <div className="mr-8">
                      {company.divisions.map((div) => {
                        const divKey = `d${div.id}`
                        const isDivOpen = expanded[divKey] === true
                        return (
                          <div key={div.id}>
                            <div className="px-6 py-3 hover:bg-white dark:hover:bg-nx-navy-elevated transition flex items-center justify-between border-r-2 border-nx-blue/10 dark:border-nx-blue">
                              <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(divKey)}>
                                {isDivOpen ? <ChevronDown className="w-3.5 h-3.5 text-nx-mist" /> : <ChevronRight className="w-3.5 h-3.5 text-nx-mist" />}
                                <div className="w-7 h-7 bg-nx-blue/10 dark:bg-nx-blue/30 rounded-lg flex items-center justify-center"><FolderTree className="w-3.5 h-3.5 text-nx-blue dark:text-nx-blue" /></div>
                                <div>
                                  <p className="text-sm font-medium text-nx-navy dark:text-slate-100">{div.name}</p>
                                  <p className="text-[11px] text-nx-mist">{div.manager_name ? `مدیر: ${div.manager_name}` : 'بدون مدیر'} · {div.teams.length} تیم</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => openCreate('team', div.id)} className="p-1 text-nx-mist hover:text-nx-blue rounded transition"><Plus className="w-3.5 h-3.5" /></button>
                                <button onClick={() => openEdit('division', div, company.id)} className="p-1 text-nx-mist hover:text-nx-blue rounded transition"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDelete('division', div.id, div.name)} className="p-1 text-nx-mist hover:text-nx-danger-500 rounded transition"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                            {isDivOpen && (
                              <div className="mr-8">
                                {div.teams.map((team) => (
                                  <div key={team.id} className="px-6 py-2 hover:bg-white dark:hover:bg-nx-navy-elevated transition flex items-center justify-between border-r-2 border-nx-blue/10 dark:border-nx-blue">
                                    <div className="flex items-center gap-3">
                                      <Users className="w-3.5 h-3.5 text-nx-teal" />
                                      <div>
                                        <p className="text-xs font-medium text-nx-navy dark:text-nx-mist">{team.name}</p>
                                        <p className="text-[10px] text-nx-mist">{team.manager_name ? `سرپرست: ${team.manager_name}` : 'بدون سرپرست'} · {team.member_count} عضو</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => openEdit('team', team, div.id)} className="p-0.5 text-nx-mist hover:text-nx-teal rounded transition"><Pencil className="w-3 h-3" /></button>
                                      <button onClick={() => handleDelete('team', team.id, team.name)} className="p-0.5 text-nx-mist hover:text-nx-danger-500 rounded transition"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalType(null)} />
          <div className="relative bg-white dark:bg-nx-navy rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nx-border dark:border-nx-navy-border">
              <h3 className="font-bold text-nx-navy dark:text-slate-100">{editingId ? 'ویرایش' : 'ایجاد'} {modalType === 'company' ? 'شرکت' : modalType === 'division' ? 'واحد' : 'تیم'}</h3>
              <button onClick={() => setModalType(null)} className="p-1 text-nx-mist hover:text-nx-mist"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">نام *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">توضیحات</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue outline-none resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">مدیر</label>
                <select value={form.manager || ''} onChange={(e) => setForm({ ...form, manager: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue outline-none">
                  <option value="">انتخاب مدیر...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username} (@{u.username})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-nx-border dark:border-nx-navy-border flex items-center justify-end gap-3">
              <button onClick={() => setModalType(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy rounded-xl transition">انصراف</button>
              <button onClick={handleSubmit} className="px-6 py-2 bg-nx-blue text-white text-sm rounded-xl hover:bg-nx-blue transition font-medium flex items-center gap-2">
                <Check className="w-4 h-4" /> {editingId ? 'ذخیره' : 'ایجاد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Branding (logo + color schema, system-wide) ─────────────────

function BrandingTab() {
  const { toast } = useToast()
  const branding = useBrandingStore((s) => s.branding)
  const setBranding = useBrandingStore((s) => s.setBranding)
  const [primary, setPrimary] = useState(branding.primaryColor)
  const [accent, setAccent] = useState(branding.accentColor)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(branding.logoUrl)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPrimary(branding.primaryColor)
    setAccent(branding.accentColor)
    setLogoPreview(branding.logoUrl)
  }, [branding])

  const onPickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast('حجم فایل باید کمتر از ۲ مگابایت باشد', 'error')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const save = async (clearLogo = false) => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('primary_color', primary)
      fd.append('accent_color', accent)
      if (logoFile) fd.append('logo', logoFile)
      if (clearLogo) fd.append('clear_logo', 'true')

      const res = await api.put('/auth/company/branding/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setBranding({
        name: res.data.name || branding.name,
        logoUrl: res.data.logo_url ?? null,
        primaryColor: res.data.primary_color,
        accentColor: res.data.accent_color,
      })
      setLogoFile(null)
      toast(clearLogo ? 'لوگو حذف شد' : 'برندینگ سازمان ذخیره و اعمال شد', 'success')
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در ذخیره برندینگ', 'error')
    } finally {
      setSaving(false)
    }
  }

  const resetColors = () => {
    setPrimary(BRAND_DEFAULTS.primaryColor)
    setAccent(BRAND_DEFAULTS.accentColor)
  }

  const changed =
    !logoFile &&
    primary.toUpperCase() === branding.primaryColor.toUpperCase() &&
    accent.toUpperCase() === branding.accentColor.toUpperCase()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-nx-navy-elevated border border-nx-navy-border rounded-nx-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Palette className="w-5 h-5 text-nx-blue" />
          <h2 className="text-lg font-bold text-white">هویت بصری سازمان</h2>
        </div>

        {/* Logo */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-nx-mist mb-2">لوگوی سازمان</label>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-nx-btn bg-nx-navy border border-nx-navy-border flex items-center justify-center overflow-hidden">
              <img
                src={logoPreview || DEFAULT_MARK}
                alt="لوگو"
                className="max-h-16 max-w-20 object-contain"
              />
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={onPickLogo}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-nx-btn text-sm font-medium hover:bg-nx-blue/90 transition"
              >
                <Upload className="w-4 h-4" /> انتخاب تصویر
              </button>
              {branding.logoUrl && (
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 border border-nx-navy-border text-nx-mist rounded-nx-btn text-sm hover:text-white hover:border-nx-mist transition disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> حذف لوگو
                </button>
              )}
              <p className="text-xs text-nx-mist/70">PNG / SVG / JPG تا ۲ مگابایت</p>
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-nx-mist mb-2">رنگ‌های سیستم</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-nx-btn border border-nx-navy-border bg-nx-navy">
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value.toUpperCase())}
                className="w-10 h-10 rounded-nx-btn bg-transparent cursor-pointer border border-nx-navy-border"
                aria-label="رنگ اصلی"
              />
              <div className="min-w-0">
                <p className="text-sm text-white">رنگ اصلی</p>
                <p className="text-xs text-nx-mist font-mono">{primary}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-nx-btn border border-nx-navy-border bg-nx-navy">
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value.toUpperCase())}
                className="w-10 h-10 rounded-nx-btn bg-transparent cursor-pointer border border-nx-navy-border"
                aria-label="رنگ تأکیدی"
              />
              <div className="min-w-0">
                <p className="text-sm text-white">رنگ تأکیدی</p>
                <p className="text-xs text-nx-mist font-mono">{accent}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saving || changed}
            className="flex items-center gap-2 px-6 py-2 bg-nx-blue text-white rounded-nx-btn text-sm font-medium hover:bg-nx-blue/90 transition disabled:bg-nx-mist disabled:text-nx-muted disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> {saving ? 'در حال ذخیره...' : 'ذخیره و اعمال'}
          </button>
          <button
            type="button"
            onClick={resetColors}
            className="flex items-center gap-2 px-4 py-2 border border-nx-navy-border text-nx-mist rounded-nx-btn text-sm hover:text-white transition"
          >
            <RotateCcw className="w-4 h-4" /> بازگردانی رنگ‌های پیش‌فرض
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-nx-navy-elevated border border-nx-navy-border rounded-nx-card p-6">
        <h3 className="text-sm font-bold text-white mb-4">پیش‌نمایش زنده</h3>
        <div className="space-y-4">
          <div className="w-20 h-20 rounded-nx-btn bg-nx-navy border border-nx-navy-border flex items-center justify-center overflow-hidden">
            <img src={logoPreview || DEFAULT_MARK} alt="لوگو" className="max-h-14 max-w-16 object-contain" />
          </div>
          <button className="w-full px-4 py-2 bg-nx-blue text-white rounded-nx-btn text-sm font-medium">
            دکمه اصلی
          </button>
          <button className="w-full px-4 py-2 border border-nx-teal text-nx-teal rounded-nx-btn text-sm font-medium">
            دکمه ثانویه
          </button>
          <div className="flex items-center gap-2 text-xs text-nx-mist">
            <span className="w-2 h-2 rounded-full bg-nx-teal" /> وضعیت موفق
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Secretariats & Registrars ───────────────────────────────────

function SecretariatsTab() {
  const { toast } = useToast()
  const [meta, setMeta] = useState<OfficeMeta | null>(null)

  useEffect(() => {
    officeApi.getMeta()
      .then((res) => setMeta(res.data.data))
      .catch(() => toast('خطا در دریافت کاربران شرکت', 'error'))
  }, [toast])

  if (!meta) {
    return <div className="p-12 text-center text-nx-mist">در حال بارگذاری...</div>
  }

  return <SecretariatPanel meta={meta} embedded />
}

// ─── Main Settings Page ───────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'modules' | 'users' | 'branding' | 'letterhead' | 'org' | 'secretariats' | 'sms' | 'fonts' | 'report-design'>('modules')
  const [designerFullscreen, setDesignerFullscreen] = useState(false)

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'ceo')) {
      navigate('/erp')
    }
  }, [user, navigate])

  if (user?.role !== 'admin' && user?.role !== 'ceo') return null

  const tabs = [
    { id: 'modules' as const, label: 'مدیریت ماژول‌ها', icon: Puzzle },
    { id: 'users' as const, label: 'کاربران و دسترسی‌ها', icon: Users },
    { id: 'branding' as const, label: 'برندینگ', icon: Palette },
    { id: 'letterhead' as const, label: 'سربرگ و اطلاعات نامه', icon: FileText },
    { id: 'org' as const, label: 'ساختار سازمانی', icon: Building2 },
    { id: 'secretariats' as const, label: 'دبیرخانه‌ها', icon: Inbox },
    { id: 'sms' as const, label: 'تنظیمات پیامک', icon: MessageSquare },
    { id: 'fonts' as const, label: 'فونت‌های اسناد', icon: Type },
    { id: 'report-design' as const, label: 'گزارش‌ساز', icon: LayoutTemplate },
  ]

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-nx-navy dark:text-white">تنظیمات</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-nx-mist">مدیریت ماژول‌ها، کاربران و ساختار سازمانی</p>
        </div>
        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-nx-teal/10 text-nx-teal dark:bg-nx-blue/40 dark:text-nx-blue'
                    : 'text-slate-500 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-nx-navy'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'modules' && <ModuleManagementTab />}
        {activeTab === 'users' && <AdminSettingsPage />}
        {activeTab === 'branding' && <BrandingTab />}
        {activeTab === 'letterhead' && <BillingLetterheadTab />}
        {activeTab === 'org' && <OrganizationTab />}
        {activeTab === 'secretariats' && <SecretariatsTab />}
        {activeTab === 'sms' && <SmsSettingsPanel />}
        {activeTab === 'fonts' && <FontsTab />}
        {activeTab === 'report-design' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-nx-navy-border dark:bg-nx-navy">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="w-5 h-5 text-nx-blue" />
                    <h2 className="text-base font-bold text-nx-navy dark:text-white">طراحی و ویرایشگر قالب صورت‌حساب</h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-nx-mist max-w-xl leading-5">
                    برای چیدمان دقیق و ویرایش بصری المان‌های صورت‌حساب (A4 افقی و عمودی، فونت‌ها، رنگ‌ها، جداول و بارکد)، ویرایشگر را به صورت تمام‌صفحه باز کنید.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDesignerFullscreen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-nx-blue text-white text-sm font-medium hover:bg-nx-blue/90 shadow-sm transition shrink-0"
                >
                  <Maximize2 className="w-4 h-4" />
                  ورود به تنظیمات گزارش‌ساز
                </button>
              </div>
            </div>

            {designerFullscreen && (
              <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 p-3 sm:p-5 dark:bg-[#0c1626] overflow-hidden">
                <ReportDesignerTab onClose={() => setDesignerFullscreen(false)} isFullscreen={true} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
