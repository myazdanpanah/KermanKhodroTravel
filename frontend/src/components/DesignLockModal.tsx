import React, { useState } from 'react'
import { Lock, Unlock, KeyRound, Eye, EyeOff, ShieldAlert, CheckCircle2, X } from 'lucide-react'
import { useDashboardStore } from '../store/dashboardStore'
import { useToast } from './Toast'
import api from '../api/client'

interface DesignLockModalProps {
  isOpen: boolean
  onClose: () => void
  dashboardId: number
}

export default function DesignLockModal({ isOpen, onClose, dashboardId }: DesignLockModalProps) {
  const { toast } = useToast()
  const {
    isDesignLocked,
    sessionUnlocked,
    setDesignLockState,
    setSessionUnlocked,
  } = useDashboardStore()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'unlock' | 'change' | 'set'>('unlock')

  if (!isOpen) return null

  // Handler: Temporary unlock in session (Verify password)
  const handleSessionUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      toast('لطفاً رمز قفل طراحی را وارد کنید', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await api.post(`/dashboards/${dashboardId}/design-lock/`, {
        action: 'verify',
        password: password.trim(),
      })
      if (res.data.valid) {
        setSessionUnlocked(true, password.trim())
        toast('قفل طراحی برای این نشست با موفقیت باز شد', 'success')
        setPassword('')
        onClose()
      } else {
        toast(res.data.error || 'رمز قفل طراحی نادرست است', 'error')
      }
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'رمز قفل طراحی نادرست است'
      toast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handler: Global unlock
  const handleGlobalUnlock = async () => {
    if (!password.trim()) {
      toast('لطفاً رمز قفل طراحی را وارد کنید', 'error')
      return
    }
    setLoading(true)
    try {
      await api.post(`/dashboards/${dashboardId}/design-lock/`, {
        action: 'unlock',
        password: password.trim(),
      })
      setDesignLockState(false, true)
      setSessionUnlocked(true, password.trim())
      toast('قفل طراحی برای تمام کاربران باز شد', 'success')
      setPassword('')
      onClose()
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'خطا در باز کردن قفل'
      toast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handler: Re-lock immediately
  const handleReLock = async () => {
    setLoading(true)
    try {
      await api.post(`/dashboards/${dashboardId}/design-lock/`, {
        action: 'lock',
      })
      setDesignLockState(true, true)
      setSessionUnlocked(false, '')
      toast('چینش داشبورد مجدداً قفل شد', 'success')
      onClose()
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'خطا در قفل کردن داشبورد'
      toast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handler: Set or change password and lock
  const handleSetLock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      toast('لطفاً رمز قفل طراحی را وارد کنید', 'error')
      return
    }
    if (password !== confirmPassword) {
      toast('رمز عبور و تکرار آن یکسان نیستند', 'error')
      return
    }
    setLoading(true)
    try {
      await api.post(`/dashboards/${dashboardId}/design-lock/`, {
        action: 'set_lock',
        password: password.trim(),
        current_password: currentPassword.trim(),
      })
      setDesignLockState(true, true)
      // Also unlock for creator session
      setSessionUnlocked(true, password.trim())
      toast('رمز قفل با موفقیت تنظیم شد و چینش قفل گردید', 'success')
      setPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
      onClose()
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'خطا در تنظیم رمز'
      toast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handler: Remove password and lock completely
  const handleRemoveLock = async () => {
    if (!window.confirm('آیا مطمئن هستید که می‌خواهید قفل طراحی و رمز آن را به طور کامل حذف کنید؟')) {
      return
    }
    setLoading(true)
    try {
      await api.post(`/dashboards/${dashboardId}/design-lock/`, {
        action: 'remove_lock',
        password: password.trim(),
      })
      setDesignLockState(false, false)
      setSessionUnlocked(false, '')
      toast('قفل طراحی و رمز آن با موفقیت حذف شدند', 'success')
      setPassword('')
      onClose()
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'خطا در حذف قفل طراحی'
      toast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white dark:bg-nx-navy rounded-2xl shadow-2xl border border-nx-border dark:border-nx-navy-border w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nx-border dark:border-nx-navy-border bg-slate-50/70 dark:bg-nx-navy-light/40">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${
              isDesignLocked && !sessionUnlocked
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
            }`}>
              {isDesignLocked && !sessionUnlocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-nx-navy dark:text-slate-100 text-base">
                {isDesignLocked && !sessionUnlocked ? 'قفل طراحی داشبورد' : 'مدیریت قفل طراحی'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isDesignLocked && !sessionUnlocked
                  ? 'چینش داشبورد محافظت شده است'
                  : sessionUnlocked
                  ? 'قفل طراحی در این نشست باز است'
                  : 'محافظت از چینش با رمز اختصاصی'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-nx-navy-light transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Case 1: Locked & session not unlocked */}
          {isDesignLocked && !sessionUnlocked && (
            <form onSubmit={handleSessionUnlock} className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  چینش، ابعاد و نمودارهای این داشبورد توسط مدیر سیستم قفل شده است. برای ایجاد هرگونه تغییر یا جابه‌جایی، رمز اختصاصی قفل را وارد نمایید.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  رمز قفل طراحی:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="رمز قفل را وارد کنید..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-nx-navy-light border border-slate-300 dark:border-slate-700 rounded-xl text-nx-navy dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-nx-blue"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-nx-blue hover:bg-nx-blue/90 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  {loading ? 'در حال بررسی...' : 'بازگشایی و ویرایش'}
                </button>
                <button
                  type="button"
                  onClick={handleGlobalUnlock}
                  disabled={loading}
                  className="py-2.5 px-3 bg-slate-100 dark:bg-nx-navy-light hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition"
                  title="بازگشایی دائم قفل برای همه"
                >
                  قفل‌گشایی دائم
                </button>
              </div>
            </form>
          )}

          {/* Case 2: Currently unlocked in this session */}
          {sessionUnlocked && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  قفل طراحی برای این نشست باز است. شما می‌توانید نمودارها را اضافه، حذف، ویرایش یا جابه‌جا کنید.
                </p>
              </div>

              {activeTab === 'unlock' ? (
                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={handleReLock}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    قفل کردن مجدد چینش هم‌اکنون
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('change')}
                      className="flex-1 py-2 px-3 bg-slate-100 dark:bg-nx-navy-light hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition"
                    >
                      تغییر رمز قفل
                    </button>
                    <button
                      onClick={handleRemoveLock}
                      className="py-2 px-3 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs font-medium transition"
                    >
                      حذف کامل قفل
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSetLock} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      رمز عبور فعلی:
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="رمز فعلی..."
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-nx-navy-light border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      رمز عبور جدید:
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="رمز جدید..."
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-nx-navy-light border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      تکرار رمز عبور جدید:
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="تکرار رمز جدید..."
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-nx-navy-light border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2 px-4 bg-nx-blue text-white rounded-xl text-xs font-semibold"
                    >
                      ذخیره رمز جدید
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('unlock')}
                      className="py-2 px-3 bg-slate-100 dark:bg-nx-navy-light text-slate-700 dark:text-slate-200 rounded-xl text-xs"
                    >
                      انصراف
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Case 3: Not locked & no session unlock */}
          {!isDesignLocked && !sessionUnlocked && (
            <form onSubmit={handleSetLock} className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-xl flex items-start gap-2.5">
                <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  با تنظیم رمز قفل طراحی، هیچ‌کس (حتی مدیرعامل) نمی‌تواند چیدمان یا نمودارهای داشبورد را تغییر دهد، مگر اینکه رمز اختصاصی شما را وارد کند.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  رمز عبور قفل طراحی:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="رمز دلخواه را وارد کنید..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-nx-navy-light border border-slate-300 dark:border-slate-700 rounded-xl text-nx-navy dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-nx-blue"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  تکرار رمز عبور:
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="تکرار رمز..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-nx-navy-light border border-slate-300 dark:border-slate-700 rounded-xl text-nx-navy dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-nx-blue"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-nx-blue hover:bg-nx-blue/90 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {loading ? 'در حال ثبت...' : 'تنظیم رمز و قفل کردن چینش'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
