import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/client'
import { useToast } from '../components/Toast'
import {
  UserPlus, Users, Trash, Shield, History, ChevronDown, ChevronUp, Plus, Tag, Database, X, Pencil, Trash2
} from 'lucide-react'
import { ALL_ROLES, ROLE_MAP } from '../utils/roles'

interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'finance' | 'sales' | 'ceo' | 'admin'
  department: string
  company: number | null
  company_name: string | null
  division: number | null
  division_name: string | null
  team: number | null
  team_name: string | null
  reports_to: number | null
  reports_to_name: string | null
  permission_flags?: Record<string, boolean>
}

// The twelve billing permissions of the KKT spec (§6.1), grouped for the editor.
const PERMISSION_ITEMS: { key: string; label: string }[] = [
  { key: 'can_view', label: 'مشاهدهٔ اطلاعات' },
  { key: 'can_submit', label: 'ثبت درخواست صدور' },
  { key: 'can_issue', label: 'صدور صورت‌حساب' },
  { key: 'can_approve', label: 'تأیید و رد درخواست' },
  { key: 'can_pay', label: 'ثبت پرداخت' },
  { key: 'can_delete_payment', label: 'حذف پرداخت' },
  { key: 'can_delete_history', label: 'حذف تاریخچه' },
  { key: 'can_manage_companies', label: 'مدیریت شرکت‌ها' },
  { key: 'can_manage_users', label: 'مدیریت کاربران' },
  { key: 'can_manage_settings', label: 'مدیریت تنظیمات' },
  { key: 'can_export', label: 'خروجی گرفتن' },
  { key: 'can_edit_template', label: 'ویرایش قالب نامه' },
]

const EMPTY_PERMISSIONS: Record<string, boolean> = Object.fromEntries(
  PERMISSION_ITEMS.map((item) => [item.key, false])
)

interface AuditLog {
  id: number
  action: string
  action_display: string
  user: string | null
  target_type: string
  target_id: string
  target_name: string
  old_value: Record<string, unknown>
  new_value: Record<string, unknown>
  details: Record<string, unknown>
  created_at: string
}

interface OrgCompany { id: number; name: string }
interface OrgDivision { id: number; name: string; company: number }
interface OrgTeam { id: number; name: string; division: number }

const ACTION_LABELS: Record<string, string> = {
  dashboard_share: 'اشتراک‌گذاری داشبورد',
  dashboard_create: 'ساخت داشبورد',
  dashboard_delete: 'حذف داشبورد',
  page_access_update: 'بروزرسانی دسترسی صفحه',
  filter_access_update: 'بروزرسانی دسترسی فیلتر',
  user_role_change: 'تغییر نقش کاربر',
}

const ACTION_COLORS: Record<string, string> = {
  dashboard_share: 'bg-nx-blue/10 text-nx-blue',
  dashboard_create: 'bg-nx-teal/10 text-nx-teal',
  dashboard_delete: 'bg-nx-danger-100 text-nx-danger-700',
  page_access_update: 'bg-nx-warning-100 text-nx-warning-700',
  filter_access_update: 'bg-nx-blue/10 text-nx-blue',
  user_role_change: 'bg-nx-blue/10 text-nx-blue',
}

const ROLE_OPTIONS = ALL_ROLES

export default function AdminSettingsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [clearing, setClearing] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'roles'>('users')
  const [customRoles, setCustomRoles] = useState<Array<{ id: number; value: string; label: string; color: string }>>([])
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<{ id?: number; value: string; label: string; color: string }>({ value: '', label: '', color: 'bg-nx-mist/10 text-nx-navy' })
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [companies, setCompanies] = useState<OrgCompany[]>([])
  const [divisions, setDivisions] = useState<OrgDivision[]>([])
  const [teams, setTeams] = useState<OrgTeam[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [openRoleDropdown, setOpenRoleDropdown] = useState(false)
  const roleDropdownRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'sales' as string,
    department: '',
    password: '',
    company: null as number | null,
    division: null as number | null,
    team: null as number | null,
    reports_to: null as number | null,
    permissions: { ...EMPTY_PERMISSIONS } as Record<string, boolean>,
  })

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'ceo')) {
      navigate('/dashboards')
      return
    }
    fetchUsers()
    fetchAuditLogs()
    fetchOrgData()
    fetchCustomRoles()
  }, [user, navigate])

  // Close role dropdown on outside click
  useEffect(() => {
    if (!openRoleDropdown) return
    const handler = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setOpenRoleDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openRoleDropdown])

  const fetchOrgData = async () => {
    try {
      const [compRes, divRes, teamRes, userRes] = await Promise.all([
        api.get('/auth/companies/'),
        api.get('/auth/divisions/'),
        api.get('/auth/teams/'),
        api.get('/auth/users/'),
      ])
      setCompanies(compRes.data)
      setDivisions(divRes.data)
      setTeams(teamRes.data)
      setAllUsers(userRes.data)
    } catch { /* ignore */ }
  }

  const fetchCustomRoles = async () => {
    try {
      const res = await api.get('/auth/roles/')
      setCustomRoles(res.data)
    } catch { /* ignore */ }
  }

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/dashboards/audit-log/')
      setAuditLogs(res.data)
    } catch { /* ignore */ }
    finally { setAuditLoading(false) }
  }

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users/')
      setUsers(res.data)
    } catch {
      toast('خطا در دریافت لیست کاربران', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredDivisions = divisions.filter((d) => !form.company || d.company === form.company)
  const filteredTeams = teams.filter((t) => !form.division || t.division === form.division)

  const openCreateModal = () => {
    setEditingUser(null)
    setForm({ username: '', email: '', first_name: '', last_name: '', role: 'sales', department: '', password: '', company: null, division: null, team: null, reports_to: null, permissions: { ...EMPTY_PERMISSIONS } })
    setShowModal(true)
  }

  const openEditModal = (u: User) => {
    setEditingUser(u)
    setForm({
      username: u.username,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
      department: u.department,
      password: '',
      company: u.company,
      division: u.division,
      team: u.team,
      reports_to: u.reports_to,
      permissions: { ...EMPTY_PERMISSIONS, ...(u.permission_flags || {}) },
    })
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.username || !form.email) {
      toast('نام کاربری و ایمیل الزامی است', 'error')
      return
    }

    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {
          username: form.username,
          email: form.email,
          first_name: form.first_name,
          last_name: form.last_name,
          role: form.role,
          department: form.department,
          company: form.company,
          division: form.division,
          team: form.team,
          reports_to: form.reports_to,
        }
        // Optional password reset — only sent when the admin typed one
        if (form.password) {
          if (form.password.length < 8) {
            toast('رمز عبور باید حداقل ۸ کاراکتر باشد', 'error')
            return
          }
          payload.password = form.password
        }
        await api.put(`/auth/users/${editingUser.id}/`, payload)
        toast(form.password ? 'کاربر و رمز عبور به‌روزرسانی شد' : 'کاربر به‌روزرسانی شد', 'success')
      } else {
        if (!form.password || form.password.length < 8) {
          toast('رمز عبور باید حداقل ۸ کاراکتر باشد', 'error')
          return
        }
        await api.post('/auth/users/', {
          username: form.username,
          email: form.email,
          first_name: form.first_name,
          last_name: form.last_name,
          role: form.role,
          department: form.department,
          password: form.password,
          company: form.company,
          division: form.division,
          team: form.team,
          reports_to: form.reports_to,
          permissions: form.permissions,
        })
        toast('کاربر جدید ساخته شد', 'success')
      }
      setShowModal(false)
      fetchUsers()
      fetchOrgData()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast(axiosErr.response?.data?.error || 'خطا در ذخیره', 'error')
    }
  }

  const handleDelete = async (u: User) => {
    if (u.id === user?.id) {
      toast('امکان حذف خود وجود ندارد', 'error')
      return
    }
    if (!window.confirm(`آیا از حذف کاربر «${u.username}» اطمینان دارید؟`)) return

    try {
      await api.delete(`/auth/users/${u.id}/`)
      toast('کاربر حذف شد', 'success')
      fetchUsers()
    } catch {
      toast('خطا در حذف کاربر', 'error')
    }
  }

  const handleRoleSubmit = async () => {
    if (!editingRole.value || !editingRole.label) {
      toast('شناسه و نام نقش الزامی است', 'error')
      return
    }
    try {
      if (editingRole.id) {
        await api.put(`/auth/roles/${editingRole.id}/`, {
          value: editingRole.value,
          label: editingRole.label,
          color: editingRole.color,
        })
        toast('نقش به‌روزرسانی شد', 'success')
      } else {
        await api.post('/auth/roles/', {
          value: editingRole.value,
          label: editingRole.label,
          color: editingRole.color,
        })
        toast('نقش جدید ساخته شد', 'success')
      }
      setShowRoleModal(false)
      setEditingRole({ value: '', label: '', color: 'bg-nx-mist/10 text-nx-navy' })
      fetchCustomRoles()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast(axiosErr.response?.data?.error || 'خطا در ذخیره نقش', 'error')
    }
  }

  const handleDeleteRole = async (roleId: number) => {
    if (!window.confirm('آیا از حذف این نقش اطمینان دارید؟')) return
    try {
      await api.delete(`/auth/roles/${roleId}/`)
      toast('نقش حذف شد', 'success')
      fetchCustomRoles()
    } catch {
      toast('خطا در حذف نقش', 'error')
    }
  }

  const COLOR_OPTIONS = [
    'bg-nx-mist/10 text-nx-navy',
    'bg-nx-blue/10 text-nx-blue',
    'bg-nx-blue/10 text-nx-blue',
    'bg-nx-teal/10 text-nx-teal',
    'bg-nx-warning-100 text-nx-warning-700',
    'bg-nx-danger-100 text-nx-danger-700',
    'bg-nx-blue/10 text-nx-blue',
    'bg-nx-blue/10 text-nx-blue',
    'bg-nx-teal/10 text-nx-teal',
    'bg-nx-blue/10 text-nx-blue',
  ]

  const handleClearAll = async () => {
    if (!window.confirm('⚠️ آیا از حذف تمام داشبوردها و داده‌ها اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) return
    if (!window.confirm('⚠️ این آخرین هشدار است! تمام داده‌ها حذف خواهند شد. تایید کنید:')) return
    setClearing(true)
    try {
      await api.delete('/dashboards/clear-all/', { data: { confirm: true } })
      toast('تمام داشبوردها و نمودارها حذف شدند', 'success')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast(axiosErr.response?.data?.error || 'خطا در حذف داده‌ها', 'error')
    } finally {
      setClearing(false)
    }
  }

  if (user?.role !== 'admin' && user?.role !== 'ceo') {
    return null
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">مدیریت کاربران</h1>
            <p className="text-sm text-nx-mist mt-1">ایجاد، ویرایش و حذف نقش‌ها و دسترسی‌ها</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            کاربر جدید
          </button>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {ROLE_OPTIONS.map((r) => {
            const count = users.filter((u) => u.role === r.value).length
            return (
              <div key={r.value} className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.color}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-nx-navy dark:text-slate-100">{count}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-200">{r.label}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Danger Zone */}
        {user?.isStaff && (
          <div className="mb-8 bg-white dark:bg-nx-navy rounded-2xl border-2 border-nx-danger-200 dark:border-nx-danger-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-nx-danger-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-nx-danger-700 dark:text-nx-danger-400">منطقه خطر</h2>
                <p className="text-xs text-nx-danger-400">حذف تمام داشبوردها، صفحات و نمودارها</p>
              </div>
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="flex items-center gap-2 px-4 py-2 bg-nx-danger-600 text-white rounded-xl hover:bg-nx-danger-700 transition text-sm font-medium disabled:opacity-50"
              >
                <Trash className="w-4 h-4" />
                {clearing ? 'در حال حذف...' : 'حذف همه داده‌ها'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6">
          <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === 'users' ? 'bg-nx-blue/10 dark:bg-nx-blue/40 text-nx-blue dark:text-nx-blue' : 'text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy'}`}>
            <Users className="w-4 h-4" /> کاربران
          </button>
          <button onClick={() => setActiveTab('audit')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === 'audit' ? 'bg-nx-blue/10 dark:bg-nx-blue/40 text-nx-blue dark:text-nx-blue' : 'text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy'}`}>
            <History className="w-4 h-4" /> تاریخچه تغییرات
          </button>
          <button onClick={() => setActiveTab('roles')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === 'roles' ? 'bg-nx-blue/10 dark:bg-nx-blue/40 text-nx-blue dark:text-nx-blue' : 'text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy'}`}>
            <Tag className="w-4 h-4" /> مدیریت نقش‌ها
          </button>
          <Link to="/admin/superset" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy">
            <Database className="w-4 h-4" /> وضعیت Superset
          </Link>
        </div>

        {/* Users Table */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
            <div className="px-6 py-4 border-b border-nx-border dark:border-nx-navy-border">
              <h2 className="font-bold text-nx-navy dark:text-slate-100">لیست کاربران ({users.length})</h2>
            </div>
            {loading ? (
              <div className="p-12 text-center text-nx-mist">در حال بارگذاری...</div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-nx-mist mx-auto mb-3" />
                <p className="text-nx-mist">هنوز کاربری وجود ندارد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-right text-xs text-slate-600 dark:text-slate-200 border-b border-nx-border dark:border-nx-navy-border">
                      <th className="px-6 py-3 font-medium">کاربر</th>
                      <th className="px-6 py-3 font-medium">ایمیل</th>
                      <th className="px-6 py-3 font-medium">نقش</th>
                      <th className="px-6 py-3 font-medium">ساختار سازمانی</th>
                      <th className="px-6 py-3 font-medium">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nx-mist/70">
                    {users.map((u) => {
                      const roleInfo = ROLE_MAP[u.role] || ROLE_OPTIONS[3]
                      return (
                        <tr key={u.id} className="hover:bg-white dark:hover:bg-nx-navy-elevated transition">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-nx-navy dark:text-slate-100">
                                {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                              </p>
                              <p className="text-xs text-nx-mist">@{u.username}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-200">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {u.company_name && <span className="px-1.5 py-0.5 bg-nx-blue/10 text-nx-blue rounded text-[10px]">{u.company_name}</span>}
                              {u.division_name && <span className="px-1.5 py-0.5 bg-nx-blue/10 text-nx-blue rounded text-[10px]">{u.division_name}</span>}
                              {u.team_name && <span className="px-1.5 py-0.5 bg-nx-teal/10 text-nx-teal rounded text-[10px]">{u.team_name}</span>}
                              {u.reports_to_name && <span className="px-1.5 py-0.5 bg-nx-warning-50 text-nx-warning-600 rounded text-[10px]">↑ {u.reports_to_name}</span>}
                              {!u.company_name && !u.division_name && !u.team_name && <span className="text-xs text-nx-mist">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditModal(u)} className="p-1.5 text-nx-mist hover:text-nx-blue hover:bg-nx-blue/10 rounded-lg transition" title="ویرایش"><Pencil className="w-4 h-4" /></button>
                              {u.id !== user?.id && (
                                <button onClick={() => handleDelete(u)} className="p-1.5 text-nx-mist hover:text-nx-danger-500 hover:bg-nx-danger-50 rounded-lg transition" title="حذف"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Audit Log */}
        {activeTab === 'audit' && (
          <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
            <div className="px-6 py-4 border-b border-nx-border dark:border-nx-navy-border">
              <h2 className="font-bold text-nx-navy dark:text-slate-100">تاریخچه تغییرات دسترسی ({auditLogs.length})</h2>
            </div>
            {auditLoading ? (
              <div className="p-12 text-center text-nx-mist">در حال بارگذاری...</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center">
                <History className="w-12 h-12 text-nx-mist mx-auto mb-3" />
                <p className="text-nx-mist">هنوز تغییری ثبت نشده</p>
              </div>
            ) : (
              <div className="divide-y divide-nx-mist/70">
                {auditLogs.map((log) => (
                  <div key={log.id} className="px-6 py-4 hover:bg-white dark:hover:bg-nx-navy-elevated transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-nx-mist/10 text-nx-navy'}`}>
                          {ACTION_LABELS[log.action] || log.action_display}
                        </span>
                        <div>
                          <p className="text-sm text-nx-navy dark:text-slate-100">
                            <span className="font-medium">{log.target_type}</span>
                            {' '}«{log.target_name || log.target_id}»
                          </p>
                          <p className="text-xs text-nx-mist">
                            توسط {log.user || 'سیستم'} · {new Date(log.created_at).toLocaleString('fa-IR')}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="p-1 text-nx-mist hover:text-nx-mist transition">
                        {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                    {expandedLog === log.id && (
                      <div className="mt-3 pl-6 border-r-2 border-nx-blue/10 pr-3 space-y-2">
                        {Object.keys(log.old_value).length > 0 && (
                          <div>
                            <span className="text-[10px] text-nx-mist uppercase tracking-wide">قبل:</span>
                            <pre className="text-xs text-nx-danger-600 dark:text-nx-danger-400 bg-nx-danger-50 dark:bg-nx-danger-900/20 rounded-lg p-2 mt-1 overflow-x-auto">{JSON.stringify(log.old_value, null, 2)}</pre>
                          </div>
                        )}
                        {Object.keys(log.new_value).length > 0 && (
                          <div>
                            <span className="text-[10px] text-nx-mist uppercase tracking-wide">بعد:</span>
                            <pre className="text-xs text-nx-teal dark:text-nx-teal bg-nx-teal/10 dark:bg-nx-teal/20 rounded-lg p-2 mt-1 overflow-x-auto">{JSON.stringify(log.new_value, null, 2)}</pre>
                          </div>
                        )}
                        {Object.keys(log.details).length > 0 && (
                          <div>
                            <span className="text-[10px] text-nx-mist uppercase tracking-wide">جزئیات:</span>
                            <pre className="text-xs text-slate-600 dark:text-slate-200 bg-white dark:bg-nx-navy-elevated rounded-lg p-2 mt-1 overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Roles Management */}
        {activeTab === 'roles' && (
          <div className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
            <div className="px-6 py-4 border-b border-nx-border dark:border-nx-navy-border flex items-center justify-between">
              <h2 className="font-bold text-nx-navy dark:text-slate-100">مدیریت نقش‌ها</h2>
              <button
                onClick={() => { setEditingRole({ value: '', label: '', color: 'bg-nx-mist/10 text-nx-navy' }); setShowRoleModal(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-nx-blue text-white rounded-lg text-xs font-medium hover:bg-nx-blue transition"
              >
                <Plus className="w-3.5 h-3.5" /> نقش جدید
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Built-in roles */}
              <div>
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-200 uppercase tracking-wide mb-3">نقش‌های پیش‌فرض</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {ALL_ROLES.map((r) => (
                    <div key={r.value} className="flex items-center gap-3 p-3 bg-white dark:bg-nx-navy-elevated rounded-xl border border-nx-border dark:border-nx-muted">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.color}`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-nx-navy dark:text-slate-100">{r.label}</p>
                        <p className="text-[10px] text-nx-mist">{r.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Custom roles */}
              <div>
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-200 uppercase tracking-wide mb-3">نقش‌های سفارشی</h3>
                {customRoles.length === 0 ? (
                  <div className="text-center py-8">
                    <Tag className="w-10 h-10 text-nx-mist mx-auto mb-2" />
                    <p className="text-sm text-nx-mist">هنوز نقش سفارشی ایجاد نشده</p>
                    <button
                      onClick={() => { setEditingRole({ value: '', label: '', color: 'bg-nx-mist/10 text-nx-navy' }); setShowRoleModal(true) }}
                      className="mt-2 text-xs text-nx-blue hover:text-nx-blue font-medium"
                    >+ ایجاد نقش جدید</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {customRoles.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-white dark:bg-nx-navy-elevated rounded-xl border border-nx-border dark:border-nx-muted group">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.color}`}>
                          <Tag className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-nx-navy dark:text-slate-100">{r.label}</p>
                          <p className="text-[10px] text-nx-mist">{r.value}</p>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => { setEditingRole(r); setShowRoleModal(true) }}
                            className="p-1 text-nx-mist hover:text-nx-blue rounded transition"
                          ><Pencil className="w-3 h-3" /></button>
                          <button
                            onClick={() => handleDeleteRole(r.id)}
                            className="p-1 text-nx-mist hover:text-nx-danger-500 rounded transition"
                          ><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Role Create/Edit Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRoleModal(false)} />
          <div className="relative bg-white dark:bg-nx-navy rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nx-border dark:border-nx-navy-border">
              <h3 className="font-bold text-nx-navy dark:text-slate-100">{editingRole.id ? 'ویرایش نقش' : 'نقش جدید'}</h3>
              <button onClick={() => setShowRoleModal(false)} className="p-1 text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">شناسه نقش (انگلیسی) *</label>
                <input
                  type="text"
                  value={editingRole.value}
                  onChange={(e) => setEditingRole({ ...editingRole, value: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                  placeholder="مثلاً: marketing, hr, it"
                  disabled={!!editingRole.id}
                />
                <p className="text-[10px] text-nx-mist mt-1">فقط حروف انگلیسی، عدد و خط زیر</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">نام نمایشی (فارسی) *</label>
                <input
                  type="text"
                  value={editingRole.label}
                  onChange={(e) => setEditingRole({ ...editingRole, label: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue outline-none"
                  placeholder="مثلاً: بازاریابی، منابع انسانی"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">رنگ</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditingRole({ ...editingRole, color: c })}
                      className={`w-8 h-8 rounded-lg ${c} flex items-center justify-center transition ring-2 ${editingRole.color === c ? 'ring-nx-blue ring-offset-2' : 'ring-transparent'}`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-nx-blue/10 dark:bg-nx-blue/20 rounded-xl">
                <p className="text-xs text-nx-blue dark:text-nx-blue font-medium">پیش‌نمایش:</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium mt-1 ${editingRole.color}`}>
                  <Tag className="w-3.5 h-3.5" />
                  {editingRole.label || 'نام نقش'}
                </span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-nx-border dark:border-nx-navy-border flex items-center justify-end gap-3">
              <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy rounded-xl transition">انصراف</button>
              <button onClick={handleRoleSubmit} className="px-6 py-2 bg-nx-blue text-white text-sm rounded-xl hover:bg-nx-blue transition font-medium">
                {editingRole.id ? 'ذخیره تغییرات' : 'ساخت نقش'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-nx-navy rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nx-border dark:border-nx-navy-border sticky top-0 bg-white dark:bg-nx-navy z-10">
              <h3 className="font-bold text-nx-navy dark:text-slate-100">{editingUser ? 'ویرایش کاربر' : 'کاربر جدید'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">نام</label>
                  <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">نام خانوادگی</label>
                  <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none" />
                </div>
              </div>

              <div>                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">نام کاربری *</label>
                  <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none" disabled={!!editingUser} />
              </div>

              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">ایمیل *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">نقش *</label>
                {/* Graphical dropdown for role selection */}
                {(() => {
                  const allRoleOptions = [
                    ...ROLE_OPTIONS,
                    ...customRoles.map((cr) => ({ value: cr.value, label: cr.label, color: cr.color })),
                  ]
                  const selectedRole = allRoleOptions.find((r) => r.value === form.role)
                  return (
                    <div className="relative" ref={roleDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setOpenRoleDropdown(!openRoleDropdown)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm hover:border-nx-blue transition focus:ring-2 focus:ring-nx-blue outline-none"
                      >
                        <div className="flex items-center gap-2">
                          {selectedRole ? (
                            <>
                              <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${selectedRole.color}`}>{selectedRole.label}</span>
                              <span className="text-[10px] text-nx-mist">({selectedRole.value})</span>
                            </>
                          ) : (
                            <span className="text-nx-mist">انتخاب نقش...</span>
                          )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-nx-mist transition-transform ${openRoleDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {openRoleDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted rounded-xl shadow-xl z-50 p-3 max-h-60 overflow-y-auto">
                          {/* Built-in roles section */}
                          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-200 uppercase tracking-wider mb-2">نقش‌های پیش‌فرض</p>
                          <div className="grid grid-cols-2 gap-1.5 mb-3">
                            {ROLE_OPTIONS.map((r) => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => { setForm({ ...form, role: r.value }); setOpenRoleDropdown(false) }}
                                className={`flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition ${
                                  form.role === r.value
                                    ? 'bg-nx-blue/10 dark:bg-nx-blue/30 ring-2 ring-nx-blue text-nx-blue dark:text-nx-blue'
                                    : 'hover:bg-white dark:hover:bg-nx-navy text-slate-600 dark:text-slate-200'
                                }`}
                              >
                                <span className={`w-6 h-6 rounded-md flex items-center justify-center ${r.color}`}>
                                  <Shield className="w-3 h-3" />
                                </span>
                                <span>{r.label}</span>
                              </button>
                            ))}
                          </div>
                          {/* Custom roles section */}
                          {customRoles.length > 0 && (
                            <>
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-200 uppercase tracking-wider mb-2">نقش‌های سفارشی</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {customRoles.map((cr) => (
                                  <button
                                    key={cr.value}
                                    type="button"
                                    onClick={() => { setForm({ ...form, role: cr.value }); setOpenRoleDropdown(false) }}
                                    className={`flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition ${
                                      form.role === cr.value
                                        ? 'bg-nx-blue/10 dark:bg-nx-blue/30 ring-2 ring-nx-blue text-nx-blue dark:text-nx-blue'
                                        : 'hover:bg-white dark:hover:bg-nx-navy text-slate-600 dark:text-slate-200'
                                    }`}
                                  >
                                    <span className={`w-6 h-6 rounded-md flex items-center justify-center ${cr.color}`}>
                                      <Tag className="w-3 h-3" />
                                    </span>
                                    <span>{cr.label}</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">بخش</label>
                <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none" placeholder="مثلاً: فروش، مالی، ..." />
              </div>

              {/* Org Hierarchy */}
              <div className="p-4 bg-white dark:bg-nx-navy-elevated rounded-xl space-y-3">
                <p className="text-xs font-bold text-nx-navy dark:text-nx-mist">🏢 ساختار سازمانی</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-200 mb-1">شرکت</label>
                    <select value={form.company || ''} onChange={(e) => setForm({ ...form, company: Number(e.target.value) || null, division: null, team: null })} className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue outline-none">
                      <option value="">بدون شرکت</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-200 mb-1">واحد</label>
                    <select value={form.division || ''} onChange={(e) => setForm({ ...form, division: Number(e.target.value) || null, team: null })} className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue outline-none" disabled={!form.company}>
                      <option value="">بدون واحد</option>
                      {filteredDivisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-200 mb-1">تیم</label>
                    <select value={form.team || ''} onChange={(e) => setForm({ ...form, team: Number(e.target.value) || null })} className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue outline-none" disabled={!form.division}>
                      <option value="">بدون تیم</option>
                      {filteredTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-200 mb-1">گزارش‌دهی به</label>
                    <select value={form.reports_to || ''} onChange={(e) => setForm({ ...form, reports_to: Number(e.target.value) || null })} className="w-full px-3 py-2 rounded-lg border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue outline-none">
                      <option value="">بدون مدیر</option>
                      {allUsers.filter((u) => u.id !== editingUser?.id).map((u) => (
                        <option key={u.id} value={u.id}>{u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-nx-border dark:border-nx-navy-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-nx-navy dark:text-nx-mist">دسترسی‌های این کاربر</p>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, permissions: Object.fromEntries(PERMISSION_ITEMS.map((i) => [i.key, true])) })}
                      className="text-nx-blue hover:underline"
                    >
                      انتخاب همه
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, permissions: { ...EMPTY_PERMISSIONS } })}
                      className="text-nx-mist hover:underline"
                    >
                      پاک کردن
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PERMISSION_ITEMS.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-xs text-nx-navy dark:text-nx-mist cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(form.permissions?.[item.key])}
                        onChange={(e) =>
                          setForm({ ...form, permissions: { ...form.permissions, [item.key]: e.target.checked } })
                        }
                        className="w-4 h-4 rounded border-nx-muted text-nx-blue focus:ring-nx-blue"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-nx-mist">
                  نقش‌های مدیرعامل و ادمین همیشه به همهٔ بخش‌ها دسترسی دارند؛ این چک‌باکس‌ها برای بقیهٔ کاربران اعمال می‌شود.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-nx-navy dark:text-nx-mist mb-1">
                  {editingUser ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور *'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-nx-mist dark:border-nx-muted dark:bg-nx-navy dark:text-slate-100 text-sm focus:ring-2 focus:ring-nx-blue focus:border-transparent outline-none"
                  placeholder={editingUser ? 'برای تغییر رمز، مقدار جدید را وارد کنید' : 'حداقل ۸ کاراکتر'}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-nx-border dark:border-nx-navy-border flex items-center justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy rounded-xl transition">انصراف</button>
              <button onClick={handleSubmit} className="px-6 py-2 bg-nx-blue text-white text-sm rounded-xl hover:bg-nx-blue transition font-medium">
                {editingUser ? 'ذخیره تغییرات' : 'ساخت کاربر'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
