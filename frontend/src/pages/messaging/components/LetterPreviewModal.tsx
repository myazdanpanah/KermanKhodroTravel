import React from 'react'
import { X, FileText, Download, Paperclip, Calendar, Hash, Eye, Shield } from 'lucide-react'
import { toPersianDigits } from '../presenceUtils'

interface LetterAttachment {
  id: number
  name: string
  content_type: string
  size_bytes: number
  download_url: string
}

export interface LetterData {
  id: number | string
  subject: string
  registration_number: string
  letter_date: string
  body: string
  sender_name?: string
  sender_organization?: string
  priority?: string
  confidentiality?: string
  status?: string
  attachments?: LetterAttachment[]
}

interface Props {
  isOpen: boolean
  letter: LetterData | null
  onClose: () => void
  onPreviewAttachment?: (att: LetterAttachment) => void
}

export const LetterPreviewModal: React.FC<Props> = ({
  isOpen,
  letter,
  onClose,
  onPreviewAttachment,
}) => {
  if (!isOpen || !letter) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-nx-surface border border-slate-200 dark:border-nx-border overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 dark:border-nx-border bg-slate-50 dark:bg-nx-surface-raised">
          <div className="flex items-center gap-2 text-slate-700 dark:text-white font-bold text-sm">
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>مشاهده رسمی نامه اداری اتوماسیون</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-nx-surface dark:text-nx-mist transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formal Letter Paper Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60 dark:bg-nx-bg">
          <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow-sm border border-slate-200/80 dark:bg-nx-surface dark:border-nx-border">
            {/* Header / Letterhead */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-5 dark:border-nx-border">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  شرکت سفرهای کرمان خودرو
                </h2>
                <span className="text-xs text-slate-500 dark:text-nx-mist">
                  سامانه یکپارچه اتوماسیون مکاتبات اداری
                </span>
              </div>

              {/* Stamp / Registration Box */}
              <div className="rounded-lg border border-slate-300/80 bg-slate-50/80 p-3 text-xs dark:border-nx-border dark:bg-nx-surface-raised min-w-[210px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-nx-mist flex items-center gap-1">
                    <Hash className="h-3 w-3" /> شماره ثبت:
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    {toPersianDigits(letter.registration_number)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-nx-mist flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> تاریخ صدور:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-white">
                    {toPersianDigits(letter.letter_date || '—')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-nx-mist flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> پیوست:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-white">
                    {letter.attachments && letter.attachments.length > 0
                      ? `${toPersianDigits(letter.attachments.length)} مورد`
                      : 'دارد'}
                  </span>
                </div>
                {letter.confidentiality && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-nx-border/50">
                    <span className="text-slate-500 dark:text-nx-mist flex items-center gap-1">
                      <Shield className="h-3 w-3" /> محرمانگی:
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 text-[11px]">
                      {letter.confidentiality}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Subject Line */}
            <div className="mt-6 rounded-lg bg-blue-50/60 p-3.5 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">موضوع نامه:</span>
              <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-white">
                {letter.subject}
              </p>
            </div>

            {/* Letter Body */}
            <div className="mt-6 min-h-[140px] text-justify text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans">
              {letter.body || 'متن نامه در دسترس نیست.'}
            </div>

            {/* Signature Area */}
            <div className="mt-8 flex justify-end pt-4 border-t border-slate-100 dark:border-nx-border/40">
              <div className="text-center min-w-[160px]">
                <p className="text-xs font-semibold text-slate-600 dark:text-nx-mist">با احترام</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  {letter.sender_name || 'امور اداری و مکاتبات'}
                </p>
                {letter.sender_organization && (
                  <p className="text-xs text-slate-400 dark:text-nx-mist">
                    {letter.sender_organization}
                  </p>
                )}
              </div>
            </div>

            {/* Letter Attachments Section */}
            {letter.attachments && letter.attachments.length > 0 && (
              <div className="mt-8 border-t border-slate-200 pt-4 dark:border-nx-border">
                <h4 className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
                  <Paperclip className="h-3.5 w-3.5 text-blue-500" />
                  <span>پیوست‌های رسمی نامه ({toPersianDigits(letter.attachments.length)})</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {letter.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 bg-slate-50/70 hover:bg-slate-100 dark:border-nx-border dark:bg-nx-surface-raised transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-slate-800 dark:text-white truncate">
                          {att.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {onPreviewAttachment && (
                          <button
                            onClick={() => onPreviewAttachment(att)}
                            title="مشاهده پیش‌نمایش"
                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-nx-surface"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <a
                          href={att.download_url}
                          download
                          title="دانلود فایل"
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-nx-surface"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 dark:border-nx-border bg-slate-50 dark:bg-nx-surface-raised">
          <span className="text-xs text-slate-500 dark:text-nx-mist">
            اتوماسیون اداری نکسِیو • پیوست یکپارچه سازمانی
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300 dark:bg-nx-surface dark:text-white dark:hover:bg-nx-border transition"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  )
}
