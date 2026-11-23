import React, { useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { messagingApi } from '../../../api/messaging'
import { useMessagingStore } from '../../../store/messagingStore'

interface Props {
  conversationId: string
  isOpen: boolean
  onClose: () => void
}

export default function AnnouncementModal({ conversationId, isOpen, onClose }: Props) {
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL')
  const [requiresAck, setRequiresAck] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { fetchMessages } = useMessagingStore()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    try {
      setSubmitting(true)
      await messagingApi.createAnnouncement({
        conversation_id: conversationId,
        content: content.trim(),
        priority,
        scope_type: 'GROUP',
        requires_acknowledgment: requiresAck,
      })
      await fetchMessages(conversationId)
      onClose()
    } catch {
      alert('خطا در انتشار اطلاعیه.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-nx-navy-border bg-white dark:bg-nx-navy-elevated rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              انتشار اطلاعیه رسمی
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-nx-navy dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white dark:bg-nx-navy rounded-b-2xl">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              اولویت اطلاعیه
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPriority('NORMAL')}
                className={`rounded-xl border py-2 text-xs font-bold transition-colors ${
                  priority === 'NORMAL'
                    ? 'border-nx-blue bg-nx-blue/10 text-nx-blue dark:border-nx-teal dark:bg-nx-blue/20 dark:text-nx-teal'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-nx-navy-border dark:text-slate-300 dark:hover:bg-nx-navy-elevated'
                }`}
              >
                عادی
              </button>
              <button
                type="button"
                onClick={() => setPriority('HIGH')}
                className={`rounded-xl border py-2 text-xs font-bold transition-colors ${
                  priority === 'HIGH'
                    ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-nx-navy-border dark:text-slate-300 dark:hover:bg-nx-navy-elevated'
                }`}
              >
                مهم
              </button>
              <button
                type="button"
                onClick={() => setPriority('URGENT')}
                className={`rounded-xl border py-2 text-xs font-bold transition-colors ${
                  priority === 'URGENT'
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-nx-navy-border dark:text-slate-300 dark:hover:bg-nx-navy-elevated'
                }`}
              >
                فوری
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              متن اطلاعیه *
            </label>
            <textarea
              required
              rows={4}
              placeholder="متن بخشنامه، دستورالعمل یا اطلاعیه رسمی را وارد کنید..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="reqAck"
              checked={requiresAck}
              onChange={(e) => setRequiresAck(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="reqAck" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              نیاز به ثبت تاییدیه و امضای مطالعه توسط کاربران
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
            >
              {submitting ? 'در حال ارسال...' : 'انتشار اطلاعیه'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
