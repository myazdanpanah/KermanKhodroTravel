/**
 * User settings: identity, avatar and password in one calm page.
 *
 * Avatar upload posts multipart through the shared client, which leaves the
 * boundary to the browser; the returned avatar_url is stored in the auth store
 * so every header and menu reflects it immediately.
 */
import { useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import api from '../api/client';
import { ImagePlus, KeyRound, Save, Sun, Moon, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '../lib/apiError';
import { useThemeStore } from '../store/themeStore';

const CARD = 'rounded-xl border border-nx-border bg-white p-5 shadow-sm dark:border-nx-navy-border dark:bg-nx-navy';
const INPUT = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-nx-blue dark:border-nx-navy-border dark:bg-nx-navy dark:text-white';
const LABEL = 'block text-[11px] font-medium text-slate-700 dark:text-nx-mist';

export default function UserSettingsPage() {
  const { user, updateUser } = useAuthStore();
  const { toast } = useToast();
  const dark = useThemeStore((state) => state.dark);
  const toggleTheme = useThemeStore((state) => state.toggle);

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'کاربر';

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await api.put('/auth/profile/update/', { first_name: firstName, last_name: lastName, email });
      updateUser(res.data);
      toast('اطلاعات کاربری ذخیره شد', 'success');
    } catch (error) {
      toast(apiErrorMessage(error, 'ذخیرهٔ اطلاعات انجام نشد'), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await api.put('/auth/profile/update/', form);
      updateUser(res.data);
      toast('تصویر نمایه به‌روزرسانی شد', 'success');
    } catch (error) {
      toast(apiErrorMessage(error, 'بارگذاری تصویر انجام نشد'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      toast('رمز جدید باید حداقل ۸ کاراکتر باشد', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('تکرار رمز جدید مطابقت ندارد', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await api.put('/auth/profile/update/', { current_password: currentPassword, password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('رمز عبور تغییر کرد', 'success');
    } catch (error) {
      toast(apiErrorMessage(error, 'تغییر رمز عبور انجام نشد'), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-nx-navy dark:text-white">تنظیمات کاربری</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-nx-mist">
          مشخصات، تصویر نمایه و رمز عبور خود را از این‌جا مدیریت کنید.
        </p>
      </div>

      <section className={CARD}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={displayName} className="h-20 w-20 rounded-full object-cover ring-2 ring-nx-teal/30" />
            ) : (
              <span className="grid h-20 w-20 place-items-center rounded-full bg-nx-blue text-2xl font-bold text-white">
                {(displayName.trim().slice(0, 1) || 'U').toUpperCase()}
              </span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -left-1 grid h-8 w-8 place-items-center rounded-full bg-nx-teal text-white shadow disabled:opacity-60"
              title="تغییر تصویر نمایه"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void uploadAvatar(file);
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-nx-navy dark:text-white">{displayName}</p>
            <p className="text-xs text-slate-500 dark:text-nx-mist" dir="ltr">{user?.email || '—'}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-nx-mist">
              {user?.company_name || '—'} · نقش: {user?.role || '—'}
              {uploading ? ' · در حال بارگذاری تصویر…' : ''}
            </p>
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="mb-3 text-sm font-semibold text-nx-navy dark:text-white">اطلاعات پایه</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>نام
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={INPUT} />
          </label>
          <label className={LABEL}>نام خانوادگی
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} className={INPUT} />
          </label>
          <label className={`${LABEL} sm:col-span-2`}>ایمیل
            <input type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} className={INPUT} />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={saveProfile} disabled={savingProfile}
            className="flex items-center gap-1.5 rounded-lg bg-nx-blue px-4 py-2 text-sm text-white disabled:opacity-60">
            <Save className="h-4 w-4" /> {savingProfile ? 'در حال ذخیره…' : 'ذخیرهٔ اطلاعات'}
          </button>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-nx-navy dark:text-white">
          <KeyRound className="h-4 w-4 text-nx-blue" /> تغییر رمز عبور
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={LABEL}>رمز فعلی
            <input type="password" value={currentPassword} autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)} className={INPUT} />
          </label>
          <label className={LABEL}>رمز جدید
            <input type="password" value={newPassword} autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)} className={INPUT} />
          </label>
          <label className={LABEL}>تکرار رمز جدید
            <input type="password" value={confirmPassword} autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)} className={INPUT} />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={savePassword} disabled={savingPassword}
            className="rounded-lg bg-nx-teal px-4 py-2 text-sm text-white disabled:opacity-60">
            {savingPassword ? 'در حال تغییر…' : 'تغییر رمز'}
          </button>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="mb-2 text-sm font-semibold text-nx-navy dark:text-white">نمایش</h2>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-nx-mist">
            حالت تیره برای نور کم؛ انتخاب شما ذخیره می‌شود.
          </p>
          <button onClick={toggleTheme}
            className="flex items-center gap-2 rounded-lg border border-nx-border px-3 py-2 text-xs text-nx-navy dark:border-nx-navy-border dark:text-white">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {dark ? 'حالت روشن' : 'حالت تاریک'}
          </button>
        </div>
      </section>

      <p className="flex items-center gap-1.5 pb-2 text-[10px] text-slate-400 dark:text-nx-mist">
        <Trash2 className="h-3 w-3" /> حذف نمایه فعلاً از طریق پشتیبانی انجام می‌شود.
      </p>
    </div>
  );
}
