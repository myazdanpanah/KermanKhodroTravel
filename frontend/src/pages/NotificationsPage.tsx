import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  Inbox,
} from 'lucide-react'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { toPersianDigits } from '../utils/kpiFormat'

interface NotificationItem {
  id: number
  type: string
  title: string
  message: string
  target_type: string
  target_id: string
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await api.get('/dashboards/notifications/')
      setNotifications(res.data.notifications || [])
    } catch {
      toast('خطا در دریافت فهرست اعلانات', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/dashboards/notifications/${id}/read/`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
    } catch {
      toast('خطا در علامت‌گذاری اعلان', 'error')
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.post('/dashboards/notifications/read-all/')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      toast('همه اعلانات به‌عنوان خوانده‌شده علامت‌گذاری شدند', 'success')
    } catch {
      toast('خطا در علامت‌گذاری اعلانات', 'error')
    }
  }

  const clearRead = async () => {
    try {
      const res = await api.post('/dashboards/notifications/clear-read/')
      setNotifications((prev) => prev.filter((n) => !n.is_read))
      toast(res.data?.detail || 'پیام‌های خوانده‌شده پاک‌سازی شدند', 'success')
    } catch {
      toast('خطا در پاک‌سازی اعلانات', 'error')
    }
  }

  const deleteNotification = async (id: number) => {
    try {
      await api.delete(`/dashboards/notifications/${id}/delete/`)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      toast('اعلان با موفقیت حذف شد', 'success')
    } catch {
      toast('خطا در حذف اعلان', 'error')
    }
  }

  const openTarget = (n: NotificationItem) => {
    if (!n.is_read) void markAsRead(n.id)
    if (n.target_type === 'billing_request' && n.target_id) {
      navigate({
        pathname: '/erp/billing/issue',
        search: new URLSearchParams({ request: n.target_id }).toString(),
      })
    }
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications])
  const readCount = useMemo(() => notifications.filter((n) => n.is_read).length, [notifications])

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === 'unread' && n.is_read) return false
      if (activeTab === 'read' && !n.is_read) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const titleMatch = (n.title || '').toLowerCase().includes(q)
        const msgMatch = (n.message || '').toLowerCase().includes(q)
        if (!titleMatch && !msgMatch) return false
      }
      return true
    })
  }, [notifications, activeTab, searchQuery])

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'assignment_new':
        return { label: 'تخصیص جدید', color: 'bg-blue-50 text-nx-blue dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' }
      case 'assignment_updated':
        return { label: 'ویرایش دسترسی', color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' }
      case 'assignment_removed':
        return { label: 'حذف دسترسی', color: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' }
      case 'billing_request':
        return { label: 'درخواست صورت‌حساب', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' }
      default:
        return { label: 'اطلاعیه سیستم', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' }
    }
  }

  const timeAgo = (dateStr: string) => {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return 'همین الان'
    if (diff < 3600) return `${toPersianDigits(Math.floor(diff / 60))} دقیقه پیش`
    if (diff < 86400) return `${toPersianDigits(Math.floor(diff / 3600))} ساعت پیش`
    return `${toPersianDigits(Math.floor(diff / 86400))} روز پیش`
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-nx-blue/10 text-nx-blue dark:bg-nx-blue/20 dark:text-blue-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">اعلانات و پیام‌ها</h1>
            <p className="text-xs text-slate-500 dark:text-nx-mist">
              ثبت وقایع، انتساب داشبوردها و اعلانات درون‌سازمانی (
              {unreadCount > 0 ? (
                <span className="font-bold text-rose-500">{toPersianDigits(unreadCount)} پیام جدید</span>
              ) : (
                'همه پیام‌ها خوانده شده است'
              )}
              )
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-nx-navy border border-slate-200 dark:border-nx-navy-border text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-nx-navy-elevated transition shadow-xs"
            >
              <CheckCheck className="w-4 h-4 text-emerald-500" />
              <span>همه خوانده شد</span>
            </button>
          )}

          {readCount > 0 && (
            <button
              onClick={clearRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-nx-navy border border-slate-200 dark:border-nx-navy-border text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition shadow-xs"
              title="پاک‌سازی همه پیام‌های خوانده‌شده"
            >
              <Trash2 className="w-4 h-4" />
              <span>پاک‌سازی خوانده‌شده‌ها</span>
            </button>
          )}

          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="p-2 rounded-xl bg-white dark:bg-nx-navy border border-slate-200 dark:border-nx-navy-border text-slate-600 dark:text-nx-mist hover:text-nx-blue transition shadow-xs disabled:opacity-50"
            title="بروزرسانی"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-nx-navy rounded-2xl border border-slate-200 dark:border-nx-navy-border p-3 shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-nx-navy-elevated p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'all'
                ? 'bg-white dark:bg-nx-navy text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-nx-mist hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            همه ({toPersianDigits(notifications.length)})
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'unread'
                ? 'bg-white dark:bg-nx-navy text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-nx-mist hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>خوانده‌نشده</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                {toPersianDigits(unreadCount)}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('read')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'read'
                ? 'bg-white dark:bg-nx-navy text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-nx-mist hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            خوانده‌شده ({toPersianDigits(readCount)})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در اعلانات..."
            className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-nx-navy-border bg-slate-50 dark:bg-nx-navy-elevated text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-nx-blue"
          />
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500 dark:text-nx-mist flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-nx-blue" />
          <span>در حال بارگذاری اعلانات…</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-nx-navy rounded-2xl border border-slate-200 dark:border-nx-navy-border shadow-xs">
          <Inbox className="w-12 h-12 text-slate-300 dark:text-nx-mist/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">اعلانی یافت نشد</p>
          <p className="text-xs text-slate-400 dark:text-nx-mist/60 mt-1">
            {searchQuery ? 'هیچ پیامی با عبارت جستجو شده تطابق ندارد.' : 'صندوق اعلانات شما خالی است.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n) => {
            const badge = getTypeBadge(n.type)
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (n.target_id) openTarget(n)
                  else if (!n.is_read) markAsRead(n.id)
                }}
                className={`group relative rounded-2xl border p-4.5 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !n.is_read
                    ? 'bg-blue-50/40 dark:bg-nx-navy-elevated/70 border-blue-200/80 dark:border-blue-500/30 shadow-xs'
                    : 'bg-white dark:bg-nx-navy border-slate-200 dark:border-nx-navy-border hover:border-slate-300 dark:hover:border-nx-navy-border/80'
                }`}
              >
                {/* Content */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 transition ${
                      !n.is_read ? 'bg-nx-blue ring-4 ring-nx-blue/20' : 'bg-transparent'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {n.title}
                      </h3>
                      <span className="text-[11px] text-slate-400 dark:text-nx-mist">
                        • {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                      {n.message}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {n.target_id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openTarget(n)
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-nx-blue/10 hover:bg-nx-blue/20 text-nx-blue dark:bg-nx-blue/20 dark:hover:bg-nx-blue/30 dark:text-blue-300 transition"
                      title="مشاهده جزئیات مربوطه"
                    >
                      <span>مشاهده</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        markAsRead(n.id)
                      }}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-nx-mist dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10 transition"
                      title="علامت‌گذاری به‌عنوان خوانده‌شده"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(n.id)
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition"
                    title="حذف اعلان"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
