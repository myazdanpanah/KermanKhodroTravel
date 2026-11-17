import { useEffect, useRef, useState } from 'react'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'
import { Save, Upload, FileText, Image as ImageIcon, PenTool, Stamp, Building2, CreditCard, User, FolderOpen } from 'lucide-react'

/**
 * Settings → سربرگ و اطلاعات نامه
 *
 * Everything the letter generator needs lives here: the letterhead text
 * (company identity, banks, manager), the uploaded logo/signature/stamp, and
 * the official Word template. Values are read by the generator from
 * `CompanySettings` — no hard-coded text.
 */

interface BillingSettings {
  company_name: string
  national_id: string
  economic_code: string
  registration_number: string
  address: string
  postal_code: string
  phone: string
  bank_name1: string
  account_number1: string
  shaba_number1: string
  bank_name2: string
  account_number2: string
  shaba_number2: string
  logo_path: string
  signature_path: string
  stamp_path: string
  word_template_path: string
  word_template_subsidiary_path: string
  word_template_credit_path: string
  legal_note: string
  manager_name: string
  manager_position: string
  approved_output_path: string
}

const EMPTY: BillingSettings = {
  company_name: '',
  national_id: '',
  economic_code: '',
  registration_number: '',
  address: '',
  postal_code: '',
  phone: '',
  bank_name1: '',
  account_number1: '',
  shaba_number1: '',
  bank_name2: '',
  account_number2: '',
  shaba_number2: '',
  logo_path: '',
  signature_path: '',
  stamp_path: '',
  word_template_path: '',
  word_template_subsidiary_path: '',
  word_template_credit_path: '',
  legal_note: '',
  manager_name: '',
  manager_position: '',
  approved_output_path: '',
}

const INPUT =
  'w-full px-3 py-2.5 rounded-xl border border-nx-navy-border bg-nx-navy-elevated text-white placeholder:text-nx-mist/45 text-sm focus:ring-2 focus:ring-nx-blue focus:border-nx-blue outline-none transition'
const LABEL = 'block text-xs font-medium text-nx-mist mb-1.5'

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea = false,
  disabled = false,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  textarea?: boolean
  disabled?: boolean
  hint?: string
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          disabled={disabled}
          className={`${INPUT} resize-none disabled:opacity-60`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`${INPUT} disabled:opacity-60`}
        />
      )}
      {hint && <p className="mt-1 text-[10px] text-nx-mist/70">{hint}</p>}
    </div>
  )
}

function AssetUpload({
  title,
  hint,
  icon: Icon,
  currentPath,
  accept,
  canEdit,
  onUpload,
  uploading,
  imagePreview = true,
}: {
  title: string
  hint: string
  icon: React.ElementType
  currentPath: string
  accept: string
  canEdit: boolean
  onUpload: (file: File) => void
  uploading: boolean
  imagePreview?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fileName = currentPath ? currentPath.split('/').pop() : ''
  const isImage = imagePreview && /\.(png|jpe?g|webp|gif)$/i.test(currentPath || '')

  return (
    <div className="rounded-xl border border-nx-navy-border bg-nx-navy p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-nx-blue" />
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <p className="text-[11px] text-nx-mist/80 mb-3 leading-5">{hint}</p>

      <div className="flex items-center gap-3">
        <div className="w-20 h-16 rounded-lg border border-dashed border-nx-navy-border bg-nx-navy-elevated flex items-center justify-center overflow-hidden shrink-0">
          {isImage ? (
            <img src={`/media/${currentPath}`} alt={title} className="max-w-full max-h-full object-contain" />
          ) : (
            <Icon className="w-6 h-6 text-nx-mist/50" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-nx-mist truncate" title={currentPath}>
            {fileName || 'فایلی بارگذاری نشده است'}
          </p>
          <button
            type="button"
            disabled={!canEdit || uploading}
            onClick={() => inputRef.current?.click()}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nx-blue/15 text-nx-blue text-xs font-medium hover:bg-nx-blue/25 transition disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'در حال بارگذاری…' : 'انتخاب فایل'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default function BillingLetterheadTab() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const canEdit = Boolean(user?.permissions?.manage_settings || user?.role === 'admin' || user?.role === 'ceo')

  const [form, setForm] = useState<BillingSettings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await api.get('/billing/settings/')
      setForm({ ...EMPTY, ...res.data })
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در دریافت تنظیمات سربرگ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (key: keyof BillingSettings) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.put('/billing/settings/', form)
      setForm({ ...EMPTY, ...res.data })
      toast('اطلاعات سربرگ ذخیره شد', 'success')
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در ذخیره تنظیمات', 'error')
    } finally {
      setSaving(false)
    }
  }

  const uploadAsset = async (type: 'logo' | 'signature' | 'stamp', file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      toast('حجم فایل باید کمتر از ۳ مگابایت باشد', 'error')
      return
    }
    setUploading(type)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`/billing/settings/upload-asset/?type=${type}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setForm((prev) => ({ ...prev, [`${type}_path`]: res.data.path }))
      if (type === 'logo') {
        // The letterhead logo is the system logo: splash, sidebar and favicon.
        await useBrandingStore.getState().load()
      }
      toast('فایل بارگذاری شد', 'success')
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در بارگذاری فایل', 'error')
    } finally {
      setUploading(null)
    }
  }

  const uploadWordTemplate = async (kind: 'debt' | 'subsidiary' | 'credit', file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast('فقط فایل Word با پسوند .docx پذیرفته می‌شود', 'error')
      return
    }
    setUploading(`word-${kind}`)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`/billing/settings/upload-template/?kind=${kind}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const field = kind === 'debt' ? 'word_template_path' : kind === 'subsidiary' ? 'word_template_subsidiary_path' : 'word_template_credit_path'
      setForm((prev) => ({ ...prev, [field]: res.data.path }))
      toast('قالب Word بارگذاری شد و از این پس برای این اعلامیه استفاده می‌شود', 'success')
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast(apiError || 'خطا در بارگذاری قالب Word', 'error')
    } finally {
      setUploading(null)
    }
  }

  if (loading) {
    return <div className="text-sm text-nx-mist py-10 text-center">در حال بارگذاری…</div>
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="rounded-xl border border-nx-navy-border bg-nx-navy-elevated p-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-nx-blue" />
          <h3 className="text-base font-bold text-white">سربرگ و اطلاعات نامه</h3>
        </div>
        <p className="text-xs text-nx-mist leading-6">
          این مقادیر همان چیزی است که روی نامه‌ها و صورتحساب‌های تولیدشده چاپ می‌شود؛ هر تغییری
          اینجا بدهید، از دفعهٔ بعد در فایل Word و PDF استفاده می‌شود.
          {!canEdit && ' برای ویرایش، مجوز «مدیریت تنظیمات» لازم است.'}
        </p>
      </div>

      {/* Company identity */}
      <section className="rounded-xl border border-nx-navy-border bg-nx-navy p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-nx-blue" />
          <h4 className="text-sm font-bold text-white">اطلاعات شرکت</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="نام شرکت" value={form.company_name} onChange={set('company_name')} disabled={!canEdit} placeholder="شرکت خدمات مسافرت هوایی …" />
          <Field label="تلفن" value={form.phone} onChange={set('phone')} disabled={!canEdit} placeholder="۰۳۴-۳۱۲۳۴۵۶۷" />
          <Field label="شناسه ملی" value={form.national_id} onChange={set('national_id')} disabled={!canEdit} />
          <Field label="کد اقتصادی" value={form.economic_code} onChange={set('economic_code')} disabled={!canEdit} />
          <Field label="شماره ثبت" value={form.registration_number} onChange={set('registration_number')} disabled={!canEdit} />
          <Field label="کد پستی" value={form.postal_code} onChange={set('postal_code')} disabled={!canEdit} />
          <div className="md:col-span-2">
            <Field label="آدرس" value={form.address} onChange={set('address')} disabled={!canEdit} textarea placeholder="نشانی کامل برای درج در سربرگ" />
          </div>
        </div>
      </section>

      {/* Banks */}
      <section className="rounded-xl border border-nx-navy-border bg-nx-navy p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-nx-blue" />
          <h4 className="text-sm font-bold text-white">اطلاعات بانکی</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p className="md:col-span-2 text-[11px] text-nx-mist/80">حساب اول</p>
          <Field label="نام بانک ۱" value={form.bank_name1} onChange={set('bank_name1')} disabled={!canEdit} placeholder="ملت" />
          <Field label="شماره حساب ۱" value={form.account_number1} onChange={set('account_number1')} disabled={!canEdit} />
          <div className="md:col-span-2">
            <Field label="شماره شبا ۱" value={form.shaba_number1} onChange={set('shaba_number1')} disabled={!canEdit} placeholder="IR..." />
          </div>

          <p className="md:col-span-2 text-[11px] text-nx-mist/80 mt-2">حساب دوم (اختیاری)</p>
          <Field label="نام بانک ۲" value={form.bank_name2} onChange={set('bank_name2')} disabled={!canEdit} placeholder="سامان" />
          <Field label="شماره حساب ۲" value={form.account_number2} onChange={set('account_number2')} disabled={!canEdit} />
          <div className="md:col-span-2">
            <Field label="شماره شبا ۲" value={form.shaba_number2} onChange={set('shaba_number2')} disabled={!canEdit} placeholder="IR..." />
          </div>
        </div>
      </section>

      {/* Manager */}
      <section className="rounded-xl border border-nx-navy-border bg-nx-navy p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-nx-blue" />
          <h4 className="text-sm font-bold text-white">امضاکنندهٔ نامه</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="نام مدیر" value={form.manager_name} onChange={set('manager_name')} disabled={!canEdit} />
          <Field label="سمت" value={form.manager_position} onChange={set('manager_position')} disabled={!canEdit} placeholder="مدیر امور اداری و مالی" />
          <div className="md:col-span-2">
            <Field
              label="متن پانویس قانونی"
              value={form.legal_note}
              onChange={set('legal_note')}
              disabled={!canEdit}
              textarea
              hint="در انتهای هر سه اعلامیه (بدهی، زیرمجموعه و بستانکاری) چاپ می‌شود."
            />
          </div>
        </div>
      </section>

      {/* Assets */}
      <section className="rounded-xl border border-nx-navy-border bg-nx-navy p-5">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-4 h-4 text-nx-blue" />
          <h4 className="text-sm font-bold text-white">فایل‌های سربرگ</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AssetUpload
            title="لوگو"
            hint="PNG یا JPG با پس‌زمینهٔ شفاف پیشنهاد می‌شود (حداکثر ۳ مگابایت)."
            icon={ImageIcon}
            currentPath={form.logo_path}
            accept="image/png,image/jpeg,image/webp"
            canEdit={canEdit}
            uploading={uploading === 'logo'}
            onUpload={(file) => uploadAsset('logo', file)}
          />
          <AssetUpload
            title="امضای مدیر"
            hint="تصویر امضا با پس‌زمینهٔ شفاف؛ پایین نامه درج می‌شود."
            icon={PenTool}
            currentPath={form.signature_path}
            accept="image/png,image/jpeg,image/webp"
            canEdit={canEdit}
            uploading={uploading === 'signature'}
            onUpload={(file) => uploadAsset('signature', file)}
          />
          <AssetUpload
            title="مهر شرکت"
            hint="تصویر مهر رسمی؛ کنار امضا چاپ می‌شود."
            icon={Stamp}
            currentPath={form.stamp_path}
            accept="image/png,image/jpeg,image/webp"
            canEdit={canEdit}
            uploading={uploading === 'stamp'}
            onUpload={(file) => uploadAsset('stamp', file)}
          />
          <AssetUpload
            title="قالب Word — اعلامیه بدهی (اصلی)"
            hint="فایل .docx با placeholderهای {{ letter_date }}، {{ letter_number }}، {{ payer }}، {{ period_range }}، {{ service_type }} و {{ total_debt }}."
            icon={FileText}
            currentPath={form.word_template_path}
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            canEdit={canEdit}
            uploading={uploading === 'word-debt'}
            imagePreview={false}
            onUpload={(file) => uploadWordTemplate('debt', file)}
          />
          <AssetUpload
            title="قالب Word — اعلامیه بدهی (شرکت زیرمجموعه)"
            hint="همان placeholderها به‌اضافهٔ {{ subsidiary }} برای نام شرکت زیرمجموعه."
            icon={FileText}
            currentPath={form.word_template_subsidiary_path}
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            canEdit={canEdit}
            uploading={uploading === 'word-subsidiary'}
            imagePreview={false}
            onUpload={(file) => uploadWordTemplate('subsidiary', file)}
          />
          <AssetUpload
            title="قالب Word — اعلامیه بستانکاری"
            hint="placeholderها: {{ total_credit }} به‌جای مبلغ بدهی. اگر خالی باشد، قالب داخلی سیستم استفاده می‌شود."
            icon={FileText}
            currentPath={form.word_template_credit_path}
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            canEdit={canEdit}
            uploading={uploading === 'word-credit'}
            imagePreview={false}
            onUpload={(file) => uploadWordTemplate('credit', file)}
          />
        </div>
      </section>

      {/* Output path */}
      <section className="rounded-xl border border-nx-navy-border bg-nx-navy p-5">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="w-4 h-4 text-nx-blue" />
          <h4 className="text-sm font-bold text-white">مسیر ذخیرهٔ فایل‌های تأییدشده</h4>
        </div>
        <Field
          label="مسیر (اختیاری)"
          value={form.approved_output_path}
          onChange={set('approved_output_path')}
          disabled={!canEdit}
          placeholder="پیش‌فرض: media/approved"
          hint="فایل‌ها همیشه در دیتابیس هم ذخیره می‌شوند؛ این مسیر فقط محل نسخهٔ دیسکی است."
        />
      </section>

      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-nx-blue text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'در حال ذخیره…' : 'ذخیرهٔ اطلاعات سربرگ'}
          </button>
        </div>
      )}
    </div>
  )
}
