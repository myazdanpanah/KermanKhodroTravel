import React, { useState, useEffect } from 'react'
import {
  X,
  Search,
  FileText,
  Receipt,
  CreditCard,
  Building2,
  Calendar,
  Hash,
  ArrowRight,
  Check,
} from 'lucide-react'
import { messagingApi, EntityItem } from '../../../api/messaging'
import { toPersianDigits } from '../presenceUtils'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelect: (entity: EntityItem) => void
}

type TabType = 'correspondence' | 'invoice' | 'payment'

export const EntityAttachmentModal: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const [activeTab, setActiveTab] = useState<TabType>('correspondence')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<EntityItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<EntityItem | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let isCancelled = false
    setLoading(true)

    const timer = setTimeout(() => {
      messagingApi
        .searchEntities(activeTab, searchQuery)
        .then((data) => {
          if (!isCancelled) {
            setItems(data)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setItems([])
            setLoading(false)
          }
        })
    }, 250)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, activeTab, searchQuery])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (selectedItem) {
      onSelect(selectedItem)
      onClose()
    }
  }

  const formatRials = (val?: number) => {
    if (val === undefined || val === null) return ''
    return toPersianDigits(Number(val).toLocaleString('fa-IR')) + ' ریال'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="flex h-[620px] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-nx-surface border border-slate-200 dark:border-nx-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-nx-border bg-slate-50/70 dark:bg-nx-surface-raised">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                پیوست سند و اطلاعات یکپارچه سازمانی
              </h3>
              <p className="text-xs text-slate-500 dark:text-nx-mist">
                نامه اداری، صورت‌حساب مالی یا تراکنش پرداختی را جهت ارسال در گفتگو انتخاب کنید
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 dark:hover:bg-nx-surface dark:text-nx-mist"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 px-6 dark:border-nx-border bg-white dark:bg-nx-surface">
          <button
            onClick={() => {
              setActiveTab('correspondence')
              setSelectedId(null)
              setSelectedItem(null)
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'correspondence'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-nx-mist dark:hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>نامه‌های اداری صادره</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('invoice')
              setSelectedId(null)
              setSelectedItem(null)
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'invoice'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-nx-mist dark:hover:text-white'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>صورت‌حساب‌های مالی</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('payment')
              setSelectedId(null)
              setSelectedItem(null)
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'payment'
                ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-nx-mist dark:hover:text-white'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>پرداخت‌های مالی</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-nx-border/50">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'correspondence'
                  ? 'جستجو بر اساس شماره نامه، موضوع یا فرستنده...'
                  : activeTab === 'invoice'
                  ? 'جستجو بر اساس شماره صورت‌حساب، نام شرکت یا نوع خدمت...'
                  : 'جستجو بر اساس شماره پیگیری، نام شرکت یا شرح پرداخت...'
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-10 pl-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white dark:border-nx-border dark:bg-nx-surface-raised dark:text-white dark:focus:border-blue-400"
            />
          </div>
        </div>

        {/* List of items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400 dark:text-nx-mist">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="text-xs">در حال بارگذاری اسناد...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400 dark:text-nx-mist">
              <Building2 className="h-10 w-10 stroke-[1.5] text-slate-300 dark:text-nx-border" />
              <p className="text-sm">سندی با این مشخصات یافت نشد.</p>
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selectedId === item.entity_id
              return (
                <div
                  key={item.entity_id}
                  onClick={() => {
                    setSelectedId(item.entity_id)
                    setSelectedItem(item)
                  }}
                  className={`flex cursor-pointer items-start justify-between rounded-xl border p-3.5 transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-nx-border dark:bg-nx-surface dark:hover:bg-nx-surface-raised'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                        item.entity_type === 'correspondence'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : item.entity_type === 'invoice'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                      }`}
                    >
                      {item.entity_type === 'correspondence' && <FileText className="h-4 w-4" />}
                      {item.entity_type === 'invoice' && <Receipt className="h-4 w-4" />}
                      {item.entity_type === 'payment' && <CreditCard className="h-4 w-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                            item.entity_type === 'correspondence'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                              : item.entity_type === 'invoice'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white line-clamp-1">
                          {item.title}
                        </h4>
                      </div>

                      <p className="mt-1 text-xs text-slate-500 dark:text-nx-mist">
                        {item.subtitle}
                      </p>

                      {item.period_range && (
                        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-nx-mist">
                          بازه: {toPersianDigits(item.period_range)}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 dark:text-nx-mist">
                        {item.code && (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Hash className="h-3 w-3 text-slate-400" />
                            {toPersianDigits(item.code)}
                          </span>
                        )}
                        {item.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {toPersianDigits(item.date)}
                          </span>
                        )}
                        {item.amount !== undefined && (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatRials(item.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                          : 'border-slate-300 dark:border-nx-border text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-nx-border bg-slate-50/70 dark:bg-nx-surface-raised">
          <div className="text-xs text-slate-500 dark:text-nx-mist">
            {selectedItem ? (
              <span className="font-medium text-slate-700 dark:text-slate-200">
                سند انتخاب‌شده: <span className="font-bold">{selectedItem.title}</span>
              </span>
            ) : (
              <span>یک سند را برای پیوست کردن انتخاب کنید</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-nx-border dark:text-nx-mist dark:hover:bg-nx-surface"
            >
              انصراف
            </button>
            <button
              disabled={!selectedItem}
              onClick={handleConfirm}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>افزودن به گفتگو</span>
              <ArrowRight className="h-4 w-4 rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
