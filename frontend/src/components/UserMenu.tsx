import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ChevronDown, LogOut, Settings2 } from 'lucide-react'

/**
 * Top-bar account menu.
 *
 * Editing profile, avatar and password lives on the dedicated user settings
 * page; the menu itself only offers that page and signing out.
 */
export default function UserMenu({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'کاربر'

  const show = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const hide = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 160)
  }

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button
        onClick={show}
        className="flex items-center gap-2 border-l border-nx-border pl-3 dark:border-nx-navy-border"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt={displayName} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nx-blue text-xs font-bold text-white">
            {(displayName.trim().slice(0, 1) || 'U').toUpperCase()}
          </span>
        )}
        <span className="hidden text-right sm:block">
          <span className="block text-xs font-medium leading-tight text-nx-navy dark:text-white">{displayName}</span>
          <span className="block text-[10px] text-slate-500 dark:text-nx-mist">{user?.company_name || 'ERP'}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform dark:text-nx-mist ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-nx-border bg-white py-1 shadow-xl dark:border-nx-navy-border dark:bg-nx-navy-elevated">
          <div className="border-b border-nx-border px-4 py-2 dark:border-nx-navy-border">
            <p className="truncate text-xs font-medium text-nx-navy dark:text-white">{displayName}</p>
            <p className="truncate text-[10px] text-slate-500 dark:text-nx-mist" dir="ltr">{user?.email || '—'}</p>
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/erp/profile') }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-nx-navy transition hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5"
          >
            <Settings2 className="h-4 w-4" /> تنظیمات کاربری
          </button>
          <button
            onClick={() => { setOpen(false); onLogout() }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-500 transition hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4" /> خروج از سامانه
          </button>
        </div>
      )}
    </div>
  )
}
