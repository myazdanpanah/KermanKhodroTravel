import React, { useState, useRef, useEffect } from 'react'
import {
  Download,
  Smile,
  Edit2,
  Trash2,
  CheckCheck,
  Clock,
  AlertCircle,
  File,
  Eye,
  FileText,
  Receipt,
  CreditCard,
  Calendar,
  Hash,
} from 'lucide-react'
import { MessageItem, AttachmentItem } from '../../../api/messaging'
import { messagingApi } from '../../../api/messaging'
import api from '../../../api/client'
import { useMessagingStore } from '../../../store/messagingStore'
import { useAuthStore } from '../../../store/authStore'
import DocumentPreviewModal from '../../../components/document-preview/DocumentPreviewModal'
import type { PreviewSource } from '../../../components/document-preview/types'
import { LetterPreviewModal, LetterData } from './LetterPreviewModal'
import InvoiceDetailModal from '../../../components/InvoiceDetailModal'
import PaymentDetailModal from '../../../components/PaymentDetailModal'
import {
  toPersianDigits,
  formatMessageTime,
  getMessageDateDivider,
  formatFullJalaliDateTime,
} from '../presenceUtils'

interface Props {
  messages: MessageItem[]
}

const QUICK_EMOJIS = ['👍', '❤️', '👏', '😂', '🎉', '🚀', '✅']

export default function MessageTimeline({ messages }: Props) {
  const { user: currentUser } = useAuthStore()
  const { editMessage, deleteMessage, addReaction, removeReaction } = useMessagingStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [activeEmojiMsgId, setActiveEmojiMsgId] = useState<string | null>(null)

  // Document preview states
  const [previewSource, setPreviewSource] = useState<PreviewSource | null>(null)
  const [letterPreview, setLetterPreview] = useState<LetterData | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<{ id: string | number; initial?: any } | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<{ id: string | number; initial?: any } | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatRials = (val?: number) => {
    if (val === undefined || val === null) return ''
    return toPersianDigits(Number(val).toLocaleString('fa-IR')) + ' ریال'
  }

  const handleStartEdit = (msg: MessageItem) => {
    setEditingId(msg.id)
    setEditContent(msg.content)
  }

  const handleSaveEdit = async (msgId: string) => {
    if (!editContent.trim()) return
    await editMessage(msgId, editContent.trim())
    setEditingId(null)
  }

  const handleReactionClick = (msg: MessageItem, emoji: string) => {
    const existing = msg.reactions?.find((r) => r.emoji === emoji && r.user_id === currentUser?.id)
    if (existing) {
      removeReaction(msg.id, existing.id)
    } else {
      addReaction(msg.id, emoji)
    }
    setActiveEmojiMsgId(null)
  }

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('آیا از حذف این پیام اطمینان دارید؟')) return
    try {
      await deleteMessage(msgId)
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'خطا در حذف پیام.')
    }
  }

  const handleDownloadFile = async (att: AttachmentItem) => {
    try {
      const res = await api.get(att.download_url, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(
        new Blob([res.data], { type: att.mime_type || 'application/octet-stream' })
      )
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = att.original_filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      alert('خطا در دانلود فایل.')
    }
  }

  const openAttachmentPreview = (att: AttachmentItem) => {
    setPreviewSource({
      file: {
        name: att.original_filename,
        mimeType: att.mime_type,
        sizeBytes: att.file_size,
      },
      getBlob: () =>
        api
          .get(att.download_url, { responseType: 'blob' })
          .then((r) => r.data),
    })
  }

  const openInvoicePreview = (invId: string, invoiceCode: string) => {
    setPreviewSource({
      file: {
        name: `صورت‌حساب_${invoiceCode || invId}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 0,
      },
      getBlob: () =>
        api
          .get(`/billing/invoices/${invId}/download-pdf/`, { responseType: 'blob' })
          .then((r) => r.data),
    })
  }

  const openLetterPreview = async (letterId: string) => {
    try {
      const data = await messagingApi.getEntityPreview('correspondence', letterId)
      setLetterPreview(data)
    } catch {
      alert('خطا در دریافت اطلاعات نامه اداری.')
    }
  }

  const handleLetterAttachmentPreview = (att: { name: string; content_type: string; size_bytes: number; download_url: string }) => {
    setLetterPreview(null)
    setPreviewSource({
      file: {
        name: att.name,
        mimeType: att.content_type,
        sizeBytes: att.size_bytes,
      },
      getBlob: () =>
        api
          .get(att.download_url, { responseType: 'blob' })
          .then((r) => r.data),
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
          <p className="text-sm font-medium">هنوز پیامی در این گفتگو ارسال نشده است.</p>
          <p className="text-xs text-slate-400 mt-1">اولین نفری باشید که گفتگو را شروع می‌کند!</p>
        </div>
      ) : (
        (() => {
          let lastDateDivider = ''
          return messages.map((msg) => {
            const isMe = msg.sender?.id === currentUser?.id
            const isDeleted = !!msg.deleted_at
            const isSystem = msg.message_type === 'SYSTEM'
            const isAnnouncement = msg.message_type === 'ANNOUNCEMENT'
            const isEntityLink = msg.message_type === 'ENTITY_LINK' || !!msg.metadata?.entity_type
            const entity = msg.metadata
            const isEditing = editingId === msg.id

            const currentDateDivider = getMessageDateDivider(msg.created_at)
            const showDateDivider = currentDateDivider && currentDateDivider !== lastDateDivider
            if (showDateDivider) {
              lastDateDivider = currentDateDivider
            }

            return (
              <React.Fragment key={msg.id}>
                {/* Jalali Date Divider Separator */}
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4 select-none">
                    <div className="h-px flex-1 bg-slate-200/80 dark:bg-nx-navy-border/80" />
                    <span className="mx-3 rounded-full bg-slate-100/90 px-3.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200/80 shadow-xs dark:bg-nx-navy-elevated dark:border-nx-navy-border dark:text-nx-mist">
                      {currentDateDivider}
                    </span>
                    <div className="h-px flex-1 bg-slate-200/80 dark:bg-nx-navy-border/80" />
                  </div>
                )}

                {isSystem ? (
                  <div className="flex justify-center my-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500 dark:bg-nx-navy-elevated dark:text-nx-mist border border-slate-200/60 dark:border-nx-navy-border shadow-xs">
                      {msg.content}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`group flex items-end gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar (for others) with Corporate Gradient */}
                    {!isMe && (
                      <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-nx-blue to-nx-teal text-xs font-bold text-white flex items-center justify-center shadow-sm">
                        {msg.sender?.first_name?.[0] || msg.sender?.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}

                    {/* Message Bubble Container */}
                    <div className={`relative max-w-[85%] md:max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* Author Name */}
                      {!isMe && (
                        <span className="mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                          {msg.sender?.full_name || msg.sender?.username}
                        </span>
                      )}

                      {/* Bubble */}
                      <div
                        className={`relative rounded-2xl px-4 py-2.5 shadow-xs text-sm transition-all ${
                          isAnnouncement
                            ? 'border-2 border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                            : isDeleted
                            ? 'italic bg-slate-100 text-slate-400 dark:bg-nx-navy-elevated/60 dark:text-slate-500 border border-slate-200/60 dark:border-nx-navy-border'
                            : isMe
                            ? 'bg-nx-blue text-white rounded-br-none shadow-sm'
                            : 'bg-white text-slate-800 rounded-bl-none border border-slate-200/80 dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-slate-100 shadow-xs'
                        }`}
                      >
                        {/* Announcement Badge */}
                        {isAnnouncement && (
                          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            <span>📢 اطلاعیه رسمی</span>
                          </div>
                        )}

                        {/* Cross-System Entity Link Card */}
                        {isEntityLink && entity && (
                          <div
                            className={`mb-2.5 rounded-xl border p-3 shadow-xs transition ${
                              isMe
                                ? 'border-white/20 bg-white/15 text-white shadow-sm'
                                : 'border-slate-200/90 bg-slate-50/90 text-slate-800 dark:border-nx-navy-border dark:bg-nx-navy dark:text-white'
                            }`}
                          >
                            {/* Top Entity Bar */}
                            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2 mb-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
                                    entity.entity_type === 'correspondence'
                                      ? isMe
                                        ? 'bg-white/20 text-white'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                                      : entity.entity_type === 'invoice'
                                      ? isMe
                                        ? 'bg-emerald-400/30 text-white'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                                      : isMe
                                      ? 'bg-sky-400/30 text-white'
                                      : 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300'
                                  }`}
                                >
                                  {entity.entity_type === 'correspondence' && <FileText className="h-3.5 w-3.5" />}
                                  {entity.entity_type === 'invoice' && <Receipt className="h-3.5 w-3.5" />}
                                  {entity.entity_type === 'payment' && <CreditCard className="h-3.5 w-3.5" />}
                                </span>
                                <span className="font-bold text-xs">{entity.badge || 'سند یکپارچه'}</span>
                              </div>
                              {entity.status && (
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  isMe ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10'
                                }`}>
                                  {entity.status}
                                </span>
                              )}
                            </div>

                            {/* Main Title & Details */}
                            <div>
                              <h4 className="font-bold text-sm leading-snug line-clamp-1">{entity.title}</h4>
                              {entity.subtitle && (
                                <p className={`mt-0.5 text-xs ${isMe ? 'text-white/80' : 'text-slate-500 dark:text-nx-mist'}`}>
                                  {entity.subtitle}
                                </p>
                              )}
                              {entity.period_range && (
                                <p className={`mt-0.5 text-[11px] ${isMe ? 'text-white/80' : 'text-slate-400 dark:text-nx-mist'}`}>
                                  بازه زمانی: {toPersianDigits(entity.period_range)}
                                </p>
                              )}
                            </div>

                            {/* Meta Pills */}
                            <div className={`mt-2 flex flex-wrap items-center gap-3 text-xs ${isMe ? 'text-white/85' : 'text-slate-600 dark:text-nx-mist'}`}>
                              {entity.code && (
                                <span className="flex items-center gap-1 font-medium text-[11px]">
                                  <Hash className="h-3 w-3 opacity-70" />
                                  {toPersianDigits(entity.code)}
                                </span>
                              )}
                              {entity.date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 opacity-70" />
                                  {toPersianDigits(entity.date)}
                                </span>
                              )}
                              {entity.amount !== undefined && (
                                <span className={`font-bold ${isMe ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {formatRials(entity.amount)}
                                </span>
                              )}
                            </div>

                            {/* Action Buttons: Preview & Download */}
                            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                              {entity.entity_type === 'correspondence' && (
                                <button
                                  type="button"
                                  onClick={() => openLetterPreview(entity.entity_id)}
                                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs transition ${
                                    isMe
                                      ? 'bg-white text-nx-blue hover:bg-slate-100 shadow-xs'
                                      : 'bg-nx-blue text-white hover:bg-nx-blue/90 shadow-xs'
                                  }`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>مشاهده متن نامه</span>
                                </button>
                              )}

                              {entity.entity_type === 'invoice' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInvoice({ id: entity.entity_id || entity.code, initial: entity })}
                                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold shadow-xs transition ${
                                      isMe
                                        ? 'bg-white text-emerald-800 hover:bg-slate-100'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    }`}
                                  >
                                    <Receipt className="h-3.5 w-3.5" />
                                    <span>کارت و ریز اقلام</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openInvoicePreview(entity.entity_id, entity.code)}
                                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs transition ${
                                      isMe
                                        ? 'bg-white/20 text-white hover:bg-white/30'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-nx-navy-elevated dark:text-white'
                                    }`}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>پیش‌نمایش PDF</span>
                                  </button>
                                  <a
                                    href={`/api/v1/billing/invoices/${entity.entity_id}/download-pdf/`}
                                    download
                                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                                      isMe
                                        ? 'bg-black/20 text-white hover:bg-black/30'
                                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-nx-navy-elevated dark:text-white'
                                    }`}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    <span>دانلود</span>
                                  </a>
                                </>
                              )}

                              {entity.entity_type === 'payment' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPayment({ id: entity.entity_id || entity.code || entity.tracking_number, initial: entity })}
                                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold shadow-xs transition ${
                                      isMe
                                        ? 'bg-white text-sky-800 hover:bg-slate-100'
                                        : 'bg-sky-600 text-white hover:bg-sky-700'
                                    }`}
                                  >
                                    <CreditCard className="h-3.5 w-3.5" />
                                    <span>کارت پرداخت</span>
                                  </button>
                                  <span className="text-[11px] font-mono opacity-90">
                                    رهگیری: {toPersianDigits(entity.tracking_number || entity.code)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Content / Edit Form */}
                        {isEditing ? (
                          <div className="space-y-2 min-w-[200px]">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:outline-none dark:border-nx-navy-border dark:bg-nx-navy dark:text-slate-100"
                              rows={2}
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-200 dark:hover:bg-nx-navy"
                              >
                                انصراف
                              </button>
                              <button
                                onClick={() => handleSaveEdit(msg.id)}
                                className="rounded bg-nx-blue px-2.5 py-0.5 text-[10px] font-bold text-white hover:bg-nx-blue/90"
                              >
                                ذخیره
                              </button>
                            </div>
                          </div>
                        ) : (
                          msg.content && (
                            <div className="whitespace-pre-wrap break-words leading-relaxed">
                              {msg.content}
                            </div>
                          )
                        )}

                        {/* Attachments with In-App Preview */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1.5 pt-2 border-t border-white/20 dark:border-nx-navy-border">
                            {msg.attachments.map((att) => (
                              <div
                                key={att.id}
                                className={`flex items-center justify-between gap-3 rounded-xl p-2 text-xs transition-colors ${
                                  isMe
                                    ? 'bg-black/15 text-white'
                                    : 'bg-slate-50 text-slate-700 dark:bg-nx-navy/60 dark:text-slate-200 border border-slate-200/60 dark:border-nx-navy-border'
                                }`}
                              >
                                <div
                                  onClick={() => openAttachmentPreview(att)}
                                  className="flex cursor-pointer items-center gap-2 truncate hover:underline"
                                  title="کلیک برای مشاهده پیش‌نمایش"
                                >
                                  <File className={`h-4 w-4 shrink-0 ${isMe ? 'text-white/80' : 'text-nx-blue dark:text-nx-teal'}`} />
                                  <span className="truncate font-medium">{att.original_filename}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 text-[10px] opacity-80">
                                  <span>{formatFileSize(att.file_size)}</span>
                                  <button
                                    type="button"
                                    onClick={() => openAttachmentPreview(att)}
                                    className="rounded p-1 hover:bg-white/20 dark:hover:bg-nx-navy-elevated"
                                    title="مشاهده پیش‌نمایش داخل برنامه"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(att)}
                                    className="rounded p-1 hover:bg-white/20 dark:hover:bg-nx-navy-elevated"
                                    title="دانلود مستقیم"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Metadata & Status (Jalali time with tooltip) */}
                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                            isMe ? 'text-blue-100 dark:text-blue-200' : 'text-slate-400 dark:text-nx-mist'
                          }`}
                        >
                          {msg.edited_at && <span>(ویرایش شده)</span>}
                          <span
                            title={formatFullJalaliDateTime(msg.created_at)}
                            className="cursor-help"
                          >
                            {formatMessageTime(msg.created_at)}
                          </span>
                          {isMe && (
                            msg.isOptimistic ? (
                              <Clock className="h-3 w-3 animate-pulse" />
                            ) : msg.isFailed ? (
                              <AlertCircle className="h-3 w-3 text-red-400" />
                            ) : (
                              <CheckCheck className="h-3 w-3" />
                            )
                          )}
                        </div>
                      </div>

                      {/* Reactions Row */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 px-1">
                          {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((emoji) => {
                            const count = msg.reactions.filter((r) => r.emoji === emoji).length
                            const hasMyReaction = msg.reactions.some(
                              (r) => r.emoji === emoji && r.user_id === currentUser?.id
                            )
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleReactionClick(msg, emoji)}
                                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border transition-colors ${
                                  hasMyReaction
                                    ? 'border-nx-blue/50 bg-nx-blue/10 text-nx-blue dark:border-nx-teal/50 dark:bg-nx-teal/20 dark:text-nx-teal'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-slate-300'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{toPersianDigits(count)}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Hover Action Bar */}
                      {!isDeleted && (
                        <div
                          className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-nx-navy-border dark:bg-nx-navy-elevated ${
                            isMe ? 'left-0' : 'right-0'
                          }`}
                        >
                          <button
                            onClick={() =>
                              setActiveEmojiMsgId(activeEmojiMsgId === msg.id ? null : msg.id)
                            }
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-nx-navy"
                            title="افزودن واکنش"
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                          {isMe && (
                            <button
                              onClick={() => handleStartEdit(msg)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-nx-navy"
                              title="ویرایش پیام"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {(isMe || currentUser?.role === 'admin' || currentUser?.role === 'ceo') && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/60"
                              title="حذف پیام"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Quick Emoji Bar Popup */}
                      {activeEmojiMsgId === msg.id && (
                        <div className="absolute z-20 -top-8 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg dark:border-nx-navy-border dark:bg-nx-navy-elevated">
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReactionClick(msg, emoji)}
                              className="rounded p-1 text-base hover:scale-125 transition-transform"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            )
          })
        })()
      )}
      <div ref={bottomRef} />

      {/* In-App Document Preview Modal */}
      {previewSource && (
        <DocumentPreviewModal
          source={previewSource}
          onClose={() => setPreviewSource(null)}
        />
      )}

      {/* Office Automation Letter Modal */}
      {letterPreview && (
        <LetterPreviewModal
          isOpen={!!letterPreview}
          letter={letterPreview}
          onClose={() => setLetterPreview(null)}
          onPreviewAttachment={handleLetterAttachmentPreview}
        />
      )}

      {/* Invoice Detail Card Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoiceIdOrCode={selectedInvoice.id}
          initialData={selectedInvoice.initial}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {/* Payment Detail Card Modal */}
      {selectedPayment && (
        <PaymentDetailModal
          paymentIdOrCode={selectedPayment.id}
          initialData={selectedPayment.initial}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  )
}
