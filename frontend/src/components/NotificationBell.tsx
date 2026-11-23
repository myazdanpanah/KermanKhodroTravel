import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Bell, Check, CheckCheck, X, Trash2, ExternalLink } from 'lucide-react'
import api from '../api/client'
import { useToast } from './Toast'
import { playOfficeChime } from '../utils/sound'
import { resolveNotificationRoute } from '../utils/notificationNavigation'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  target_type: string
  target_id: string
  is_read: boolean
  created_at: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const prevUnreadRef = useRef<number | null>(null)

  useEffect(() => {
    fetchNotifications()
    // Poll every 30s
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/dashboards/notifications/')
      const list = res.data.notifications || []
      const newCount = res.data.unread_count || 0

      // Play soft chime if new unread notification arrived while user is online
      if (prevUnreadRef.current !== null && newCount > prevUnreadRef.current) {
        playOfficeChime()
      }
      prevUnreadRef.current = newCount

      setNotifications(list)
      setUnreadCount(newCount)
    } catch {
      // ignore
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/dashboards/notifications/${id}/read/`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1)
        prevUnreadRef.current = next
        return next
      })
    } catch {
      toast('خطا در علامت‌گذاری', 'error')
    }
  }

  // Marking read is a side effect of opening; navigation must happen even if
  // the request fails, and target route is resolved via unified resolver.
  const openNotification = (notification: Notification) => {
    if (!notification.is_read) void markAsRead(notification.id)
    setOpen(false)
    const route = resolveNotificationRoute(notification)
    if (route) {
      navigate({
        pathname: route.pathname,
        search: route.search ? `?${route.search}` : undefined,
      })
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.post('/dashboards/notifications/read-all/')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
      prevUnreadRef.current = 0
      toast('همه اعلان‌ها خوانده شد', 'success')
    } catch {
      toast('خطا در علامت‌گذاری', 'error')
    }
  }

  const clearReadNotifications = async () => {
    try {
      const res = await api.post('/dashboards/notifications/clear-read/')
      setNotifications((prev) => prev.filter((n) => !n.is_read))
      toast(res.data?.detail || 'اعلان‌های خوانده‌شده پاک‌سازی شدند', 'success')
    } catch {
      toast('خطا در پاک‌سازی اعلان‌ها', 'error')
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'assignment_new': return '📋'
      case 'assignment_updated': return '✏️'
      case 'assignment_removed': return '🗑️'
      default: return '🔔'
    }
  }

  const timeAgo = (dateStr: string) => {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return 'همین الان'
    if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`
    return `${Math.floor(diff / 86400)} روز پیش`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open)
          if (!open) {
            setLoading(true)
            fetchNotifications().finally(() => setLoading(false))
          }
        }}
        className="relative p-2 text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist hover:bg-nx-mist/10 dark:hover:bg-nx-navy rounded-xl transition"
        title="اعلان‌ها"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-nx-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-96 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-navy-border rounded-2xl shadow-2xl z-50 overflow-hidden" dir="rtl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-nx-border dark:border-nx-navy-border">
            <h3 className="font-bold text-sm text-nx-navy dark:text-slate-100">اعلان‌ها</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-nx-blue dark:text-blue-400 hover:underline font-medium"
                  title="علامت‌گذاری همه به‌عنوان خوانده‌شده"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  همه خوانده شد
                </button>
              )}
              {notifications.some((n) => n.is_read) && (
                <button
                  onClick={clearReadNotifications}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-500 dark:text-nx-mist dark:hover:text-rose-400 font-medium transition"
                  title="پاک‌سازی پیام‌های خوانده‌شده"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  پاک‌سازی
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-nx-mist hover:text-slate-700 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-nx-mist text-sm">در حال بارگذاری...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 text-nx-mist/20 dark:text-nx-mist mx-auto mb-2" />
                <p className="text-sm text-nx-mist">اعلانی وجود ندارد</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-nx-mist/70 dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy-elevated transition cursor-pointer ${
                    !n.is_read ? 'bg-nx-blue/10 dark:bg-nx-blue/20' : ''
                  }`}
                  onClick={() => openNotification(n)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{getTypeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-nx-navy dark:text-slate-100 truncate">{n.title}</p>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-nx-blue rounded-full flex-shrink-0" />
                        )}
                      </div>                        <p className="text-xs text-slate-600 dark:text-slate-200 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-nx-mist mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(n.id)
                        }}
                        className="p-1 text-nx-mist hover:text-nx-blue hover:bg-nx-blue/10 dark:hover:bg-nx-blue/30 rounded transition flex-shrink-0"
                        title="خوانده شد"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-nx-border dark:border-nx-navy-border bg-slate-50/70 dark:bg-nx-navy-elevated/40 text-center">
            <Link
              to="/erp/notifications"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-nx-blue dark:text-blue-400 hover:underline py-1 px-3"
            >
              <span>مشاهده و بایگانی همه اعلانات</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
