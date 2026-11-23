import React, { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, X, File, Loader2, Link2, FileText, Receipt, CreditCard } from 'lucide-react'
import { messagingApi, AttachmentItem, EntityItem } from '../../../api/messaging'
import { useMessagingStore } from '../../../store/messagingStore'
import { EntityAttachmentModal } from './EntityAttachmentModal'
import { toPersianDigits } from '../presenceUtils'

interface Props {
  conversationId: string
}

export default function MessageComposer({ conversationId }: Props) {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [selectedEntity, setSelectedEntity] = useState<EntityItem | null>(null)
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { sendMessage, setTyping } = useMessagingStore()
  const typingTimeoutRef = useRef<any>(null)

  // Auto-focus input on conversation change
  useEffect(() => {
    textareaRef.current?.focus()
  }, [conversationId])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)

    // Trigger typing indicator
    setTyping(true)
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false)
    }, 2500)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      const att = await messagingApi.uploadAttachment(conversationId, file)
      setAttachments((prev) => [...prev, att])
    } catch {
      alert('خطا در بارگذاری فایل. حجم مجاز حداکثر ۲۵ مگابایت است.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId))
  }

  const handleSend = async () => {
    const trimmed = content.trim()
    if (!trimmed && attachments.length === 0 && !selectedEntity) return
    if (uploading) return

    const attIds = attachments.map((a) => a.id)
    const entityToAttach = selectedEntity
    setContent('')
    setAttachments([])
    setSelectedEntity(null)
    setTyping(false)

    if (entityToAttach) {
      await sendMessage(trimmed, attIds, 'ENTITY_LINK', entityToAttach)
    } else {
      await sendMessage(trimmed, attIds, 'TEXT')
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-2.5 sm:p-3 dark:border-nx-navy-border dark:bg-nx-navy pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      {/* Uploaded Attachments Preview Bar */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:bg-nx-navy-elevated dark:text-slate-300 border border-slate-200 dark:border-nx-navy-border"
            >
              <File className="h-3.5 w-3.5 text-nx-blue dark:text-nx-teal" />
              <span className="max-w-[150px] truncate">{att.original_filename}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Linked Entity Preview Bar */}
      {selectedEntity && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 px-3 dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-nx-blue/15 text-nx-blue dark:bg-nx-blue/30 dark:text-nx-teal">
              {selectedEntity.entity_type === 'correspondence' && <FileText className="h-4 w-4" />}
              {selectedEntity.entity_type === 'invoice' && <Receipt className="h-4 w-4" />}
              {selectedEntity.entity_type === 'payment' && <CreditCard className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-nx-blue/10 px-1.5 py-0.2 text-[10px] font-bold text-nx-blue dark:bg-nx-blue/30 dark:text-nx-teal">
                  {selectedEntity.badge}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">
                  {selectedEntity.title}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-nx-mist">
                کد/شماره: {toPersianDigits(selectedEntity.code)} {selectedEntity.subtitle ? `• ${selectedEntity.subtitle}` : ''}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedEntity(null)}
            className="rounded-lg p-1 text-slate-400 hover:bg-blue-100 hover:text-red-600 dark:hover:bg-blue-900/40"
            title="حذف پیوست سند"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        {/* Attachment Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-nx-navy-elevated dark:hover:text-slate-300 transition-colors disabled:opacity-50"
          title="افزودن فایل پیوست"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-nx-blue" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </button>

        {/* Cross-System Entity Attachment Button */}
        <button
          type="button"
          onClick={() => setIsEntityModalOpen(true)}
          className={`rounded-xl p-2.5 transition-colors ${
            selectedEntity
              ? 'bg-nx-blue/15 text-nx-blue dark:bg-nx-blue/25 dark:text-nx-teal'
              : 'text-slate-400 hover:bg-slate-100 hover:text-nx-blue dark:hover:bg-nx-navy-elevated dark:hover:text-nx-teal'
          }`}
          title="پیوست نامه اداری، صورت‌حساب مالی یا پرداخت"
        >
          <Link2 className="h-5 w-5" />
        </button>

        {/* Text Area */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedEntity
                ? 'توضیحات اختیاری درباره این سند را بنویسید...'
                : 'پیام خود را بنویسید... (Enter برای ارسال، Shift+Enter برای خط جدید)'
            }
            className="max-h-32 min-h-[42px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-nx-blue focus:bg-white focus:outline-none dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-slate-100 dark:focus:border-nx-teal"
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={(!content.trim() && attachments.length === 0 && !selectedEntity) || uploading}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-nx-blue text-white shadow-sm hover:bg-nx-blue/90 disabled:opacity-40 transition-all active:scale-95 group"
          title="ارسال پیام"
        >
          <Send className="h-4.5 w-4.5 transition-transform group-hover:scale-105" />
        </button>
      </div>

      {/* Entity Attachment Picker Modal */}
      <EntityAttachmentModal
        isOpen={isEntityModalOpen}
        onClose={() => setIsEntityModalOpen(false)}
        onSelect={(entity) => setSelectedEntity(entity)}
      />
    </div>
  )
}
