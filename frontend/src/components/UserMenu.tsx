import { useRef, useState } from 'react'
import api from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useToast } from './Toast'
import { ChevronDown, KeyRound, LogOut, Mail, UserRound, ImagePlus, X } from 'lucide-react'

/**
 * Top-bar account menu.
 *
 * The sidebar no longer carries a user block: identity, profile editing,
 * avatar, e-mail, password and logout all live here, revealed on hover.
 */

type ModalKind = 'profile' | 'avatar' | 'email' | 'password' | null

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-nx-navy-border bg-nx-navy text-white text-sm outline-none focus:ring-2 focus:ring-nx-blue'
const LABEL = 'block text-[11px] text-nx-mist mb-1'

const AVATAR_COLORS = ['#3678F6', '#24C6B2', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9']

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
}

export default function UserMenu({ onLogout }: { onLogout: () => void }) {
  const { user, updateUser } = useAuthStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)
  const [saving, setSaving] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'کاربر'

  const show = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const hide = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 160)
  }

  const openModal = (kind: ModalKind) => {
    setModal(kind)
    setOpen(false)
    if (kind === 'profile') {
      setFirstName(user?.first_name || '')
      setLastName(user?.last_name || '')
    }
    if (kind === 'email') setEmail(user?.email || '')
    if (kind === 'password') {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const closeModal = () => setModal(null)

  const save = async (payload: Record<string, unknown> | FormData) => {
    setSaving(true)
    try {
      const res = await api.put('/auth/profile/update/', payload, {
        headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
      })
      updateUser(res.data)
      toast('تغییرات ذخیره شد', 'success')
      setModal(null)
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data
      const first = data && Object.values(data)[0]
      toast((Array.isArray(first) ? first[0] : (first as string)) || 'خطا در ذخیره تغییرات', 'error')
    } finally {
      setSaving(false)
    }
  }

  const uploadAvatar = (file: File) => {
    const fd = new FormData()
    fd.append('avatar', file)
    void save(fd)
  }

  const pickPreset = (color: string) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gradient = ctx.createLinearGradient(0, 0, 128, 128)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, '#101D35')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 54px Vazirmatn, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials(displayName), 64, 68)
    canvas.toBlob((blob) => {
      if (!blob) return
      uploadAvatar(new File([blob], 'avatar.png', { type: 'image/png' }))
    }, 'image/png')
  }

  const submitPassword = () => {
    if (newPassword.length < 8) {
      toast('رمز جدید باید حداقل ۸ کاراکتر باشد', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      toast('تکرار رمز جدید مطابقت ندارد', 'error')
      return
    }
    void save({ current_password: currentPassword, password: newPassword })
  }

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button
        onClick={show}
        className="flex items-center gap-2 pl-3 border-l border-nx-navy-border"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-nx-blue flex items-center justify-center text-white text-xs font-bold">
            {initials(displayName)}
          </span>
        )}
        <span className="hidden sm:block text-right">
          <span className="block text-xs font-medium text-white leading-tight">{displayName}</span>
          <span className="block text-[10px] text-nx-mist">{user?.company_name || 'ERP'}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-nx-mist transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-60 rounded-xl border border-nx-navy-border bg-nx-navy-elevated shadow-nx-elevated py-1 z-50">
          <div className="px-4 py-2 border-b border-nx-navy-border">
            <p className="text-xs font-medium text-white truncate">{displayName}</p>
            <p className="text-[10px] text-nx-mist truncate" dir="ltr">{user?.email || '—'}</p>
          </div>
          <MenuItem icon={UserRound} label="ویرایش پروفایل" onClick={() => openModal('profile')} />
          <MenuItem icon={ImagePlus} label="انتخاب نمایه" onClick={() => openModal('avatar')} />
          <MenuItem icon={Mail} label="تغییر ایمیل" onClick={() => openModal('email')} />
          <MenuItem icon={KeyRound} label="تغییر رمز عبور" onClick={() => openModal('password')} />
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition"
          >
            <LogOut className="w-4 h-4" />
            خروج از حساب
          </button>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-2xl border border-nx-navy-border bg-nx-navy-elevated p-5"
            onClick={(event) => event.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">
                {modal === 'profile' && 'ویرایش پروفایل'}
                {modal === 'avatar' && 'انتخاب نمایه'}
                {modal === 'email' && 'تغییر ایمیل'}
                {modal === 'password' && 'تغییر رمز عبور'}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-nx-mist hover:bg-nx-navy">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modal === 'profile' && (
              <div className="space-y-3">
                <div>
                  <label className={LABEL}>نام</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>نام خانوادگی</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT} />
                </div>
                <div className="flex justify-end">
                  <button
                    disabled={saving}
                    onClick={() => void save({ first_name: firstName, last_name: lastName })}
                    className="px-5 py-2 rounded-lg bg-nx-blue text-white text-sm disabled:opacity-60"
                  >
                    ذخیره
                  </button>
                </div>
              </div>
            )}

            {modal === 'avatar' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="avatar" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <span className="w-20 h-20 rounded-full bg-nx-blue flex items-center justify-center text-white text-xl font-bold">
                      {initials(displayName)}
                    </span>
                  )}
                </div>
                <div>
                  <p className={LABEL}>نمایه‌های آماده</p>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => pickPreset(color)}
                        disabled={saving}
                        className="w-9 h-9 rounded-full border-2 border-white/20"
                        style={{ backgroundColor: color }}
                        title="انتخاب این نمایه"
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                  className="w-full px-4 py-2 rounded-lg border border-nx-navy-border text-nx-mist text-sm hover:border-nx-blue"
                >
                  بارگذاری تصویر از سیستم
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadAvatar(file)
                    e.target.value = ''
                  }}
                />
              </div>
            )}

            {modal === 'email' && (
              <div className="space-y-3">
                <div>
                  <label className={LABEL}>ایمیل</label>
                  <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
                </div>
                <div className="flex justify-end">
                  <button
                    disabled={saving}
                    onClick={() => void save({ email })}
                    className="px-5 py-2 rounded-lg bg-nx-blue text-white text-sm disabled:opacity-60"
                  >
                    ذخیره
                  </button>
                </div>
              </div>
            )}

            {modal === 'password' && (
              <div className="space-y-3">
                <div>
                  <label className={LABEL}>رمز عبور فعلی</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={INPUT} autoComplete="current-password" />
                </div>
                <div>
                  <label className={LABEL}>رمز عبور جدید</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={INPUT} autoComplete="new-password" />
                </div>
                <div>
                  <label className={LABEL}>تکرار رمز جدید</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={INPUT} autoComplete="new-password" />
                </div>
                <div className="flex justify-end">
                  <button
                    disabled={saving}
                    onClick={submitPassword}
                    className="px-5 py-2 rounded-lg bg-nx-blue text-white text-sm disabled:opacity-60"
                  >
                    تغییر رمز
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-nx-mist hover:text-white hover:bg-white/5 transition"
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}
