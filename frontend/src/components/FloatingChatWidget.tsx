import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  X,
  Maximize2,
  Send,
  Search,
  ChevronRight,
  Hash,
  Users,
  Sparkles,
  Receipt,
  CreditCard,
  FileText,
  Eye,
} from 'lucide-react'
import { useMessagingStore } from '../store/messagingStore'
import { useAuthStore } from '../store/authStore'
import { ConversationItem, MessageItem } from '../api/messaging'
import { formatLastSeen } from '../pages/messaging/presenceUtils'
import InvoiceDetailModal from './InvoiceDetailModal'
import PaymentDetailModal from './PaymentDetailModal'

const toPersianDigits = (n: number | string) =>
  String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

const formatRials = (val: number | string) => {
  const num = Number(val) || 0
  return toPersianDigits(num.toLocaleString('fa-IR')) + ' ریال'
}

interface FloatingChatWidgetProps {
  positionClass?: string // e.g. 'bottom-7 left-24' for ERP, 'bottom-7 left-8' for Dashboards
}

export default function FloatingChatWidget({
  positionClass = 'bottom-7 left-24',
}: FloatingChatWidgetProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    fetchConversations,
    selectConversation,
    sendMessage,
    initWebSocket,
    presenceMap,
    lastSeenMap,
  } = useMessagingStore()

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [search, setSearch] = useState('')
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [previewInvoice, setPreviewInvoice] = useState<{ id: string | number; initial?: any } | null>(null)
  const [previewPayment, setPreviewPayment] = useState<{ id: string | number; initial?: any } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleAttachmentClick = (metadata: any) => {
    if (!metadata) return
    const entityType = String(metadata.entity_type || metadata.type || '').toLowerCase()
    const title = String(metadata.title || '').toLowerCase()
    const badge = String(metadata.badge || '').toLowerCase()

    if (
      entityType === 'invoice' ||
      title.includes('صورت‌حساب') ||
      badge.includes('صورت‌حساب') ||
      title.includes('فاکتور')
    ) {
      setPreviewInvoice({
        id: metadata.entity_id || metadata.code || metadata.letter_number,
        initial: metadata,
      })
    } else if (
      entityType === 'payment' ||
      title.includes('پرداخت') ||
      badge.includes('پرداخت')
    ) {
      setPreviewPayment({
        id: metadata.entity_id || metadata.code || metadata.tracking_number,
        initial: metadata,
      })
    } else if (
      entityType === 'correspondence' ||
      title.includes('نامه') ||
      badge.includes('نامه')
    ) {
      if (metadata.entity_id) {
        navigate(`/erp/office/correspondence/${metadata.entity_id}`)
        setOpen(false)
      }
    }
  }

  const isOrbitEnabled =
    user?.is_superuser ||
    user?.role === 'admin' ||
    Boolean(user?.accessible_modules?.some((m) => m === 'orbit' || m === 'messaging'))

  // Initialize conversations and websocket connection (only if orbit is enabled)
  useEffect(() => {
    if (!isOrbitEnabled) return
    fetchConversations()
    initWebSocket()
  }, [isOrbitEnabled])

  // Auto-scroll on new messages in chat view
  useEffect(() => {
    if (view === 'chat' && open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, view, open, activeConversationId])

  // Total unread count
  const totalUnread = conversations.reduce(
    (acc, c) => acc + (c.unread_count || 0),
    0
  )

  const handleOpenConversation = async (conv: ConversationItem) => {
    await selectConversation(conv.id)
    setView('chat')
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || sending) return
    setSending(true)
    setInputText('')
    try {
      await sendMessage(trimmed)
    } finally {
      setSending(false)
    }
  }

  const handleOpenFullOrbit = () => {
    setOpen(false)
    if (activeConversationId) {
      navigate(`/orbit/${activeConversationId}`)
    } else {
      navigate('/orbit')
    }
  }

  const getConversationTitle = (c: ConversationItem | null | undefined) => {
    if (!c) return 'گفتگو'
    if (c.kind === 'DIRECT') {
      if (c.other_user?.full_name) return c.other_user.full_name
      if (c.title && c.title.includes(' & ')) {
        const parts = c.title.split(' & ')
        const myName = (user ? user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : '').trim()
        if (parts.length === 2 && myName) {
          return parts[0].trim() === myName ? parts[1].trim() : parts[0].trim()
        }
        if (parts.length === 2) {
          return parts[1].trim()
        }
      }
    }
    return c.title || c.other_user?.full_name || 'گفتگو'
  }

  const filteredConversations = conversations.filter((c) => {
    if (!search.trim()) return true
    const term = search.trim().toLowerCase()
    const convTitle = getConversationTitle(c)
    return convTitle.toLowerCase().includes(term)
  })

  const currentMessages: MessageItem[] =
    activeConversationId && messages[activeConversationId]
      ? messages[activeConversationId]
      : []

  const isDirect = activeConversation?.kind === 'DIRECT'
  const activeTitle = getConversationTitle(activeConversation)

  const isOnline =
    isDirect &&
    activeConversation?.other_user &&
    presenceMap[activeConversation.other_user.id] === 'online'

  if (!isOrbitEnabled) return null

  return (
    <>
      {/* Click outside to close */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:bg-transparent"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Pop-up Chat Drawer */}
      {open && (
        <div
          className={`fixed bottom-24 ${
            positionClass.includes('left-24') ? 'left-8 lg:left-24' : 'left-8'
          } z-50 flex h-[540px] max-h-[82vh] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-4 dark:border-nx-navy-border dark:bg-nx-navy`}
          style={{ transformOrigin: 'left bottom' }}
        >
          {/* Top Bar */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 dark:border-nx-navy-border dark:from-nx-navy-elevated dark:to-nx-navy">
            <div className="flex items-center gap-2">
              {view === 'chat' && (
                <button
                  onClick={() => setView('list')}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-nx-mist dark:hover:bg-nx-navy-border dark:hover:text-white"
                  title="بازگشت به فهرست گفتگوها"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-blue/15 text-nx-blue">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {view === 'chat' ? activeTitle : 'پیام‌رسان نکسیو (Orbit)'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-nx-mist">
                  {view === 'chat'
                    ? isDirect && activeConversation?.other_user
                      ? formatLastSeen(
                          lastSeenMap[activeConversation.other_user.id] || activeConversation.other_user.last_seen_at,
                          isOnline
                        )
                      : `${activeConversation?.members_count || 1} عضو`
                    : totalUnread > 0
                    ? `${toPersianDigits(totalUnread)} پیام خوانده نشده`
                    : 'همکاری و پیام‌های سازمانی'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleOpenFullOrbit}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-nx-blue dark:text-nx-mist dark:hover:bg-nx-navy dark:hover:text-nx-blue"
                title="باز کردن محیط کامل Orbit"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-nx-mist dark:hover:bg-nx-navy dark:hover:text-white"
                title="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {view === 'list' ? (
            <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/50 dark:bg-nx-navy/50">
              {/* Search Bar */}
              <div className="border-b border-slate-200 p-2.5 dark:border-nx-navy-border">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 dark:border-nx-navy-border dark:bg-nx-navy-elevated">
                  <Search className="h-3.5 w-3.5 text-slate-400 dark:text-nx-mist" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="جستجو در گفتگوها و کانال‌ها…"
                    className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-nx-mist/60"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-nx-navy-border/60">
                {filteredConversations.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center p-6 text-center text-xs text-slate-400 dark:text-nx-mist">
                    <MessageSquare className="mb-2 h-8 w-8 opacity-40" />
                    <span>گفتگویی یافت نشد.</span>
                  </div>
                ) : (
                  filteredConversations.map((c) => {
                    const title = getConversationTitle(c)
                    const userOnline =
                      c.kind === 'DIRECT' &&
                      c.other_user &&
                      presenceMap[c.other_user.id] === 'online'

                    return (
                      <div
                        key={c.id}
                        onClick={() => void handleOpenConversation(c)}
                        className="flex cursor-pointer items-center gap-3 p-3 transition hover:bg-slate-100/70 dark:hover:bg-nx-navy-elevated/70"
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {c.kind === 'DIRECT' ? (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {c.other_user?.full_name?.charAt(0) || 'ک'}
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nx-blue/15 text-nx-blue">
                              {c.kind === 'PROJECT' ? (
                                <Users className="h-5 w-5" />
                              ) : (
                                <Hash className="h-5 w-5" />
                              )}
                            </div>
                          )}
                          {userOnline && (
                            <span className="absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-nx-navy" />
                          )}
                        </div>

                        {/* Text Details */}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                              {title}
                            </span>
                            {c.unread_count > 0 && (
                              <span className="rounded-full bg-nx-blue px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {toPersianDigits(c.unread_count)}
                              </span>
                            )}
                          </div>
                          {c.kind === 'DIRECT' && c.other_user && (
                            <span className="text-[10px] text-slate-400">
                              {formatLastSeen(
                                lastSeenMap[c.other_user.id] || c.other_user.last_seen_at,
                                userOnline
                              )}
                            </span>
                          )}
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-nx-mist">
                            {c.last_message_preview || 'پیامی وجود ندارد'}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Bottom Quick Launch Link */}
              <div className="border-t border-slate-200 bg-white p-2.5 text-center dark:border-nx-navy-border dark:bg-nx-navy-elevated">
                <button
                  onClick={handleOpenFullOrbit}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-nx-blue hover:underline"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>ورود به محیط کامل پیام‌رسان (Orbit) ↗</span>
                </button>
              </div>
            </div>
          ) : (
            /* Chat View */
            <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/50 dark:bg-nx-navy/30">
              {/* Message Timeline */}
              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {currentMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-400 dark:text-nx-mist">
                    <span>شروع گفتگو در این کانال یا پیام مستقیم</span>
                  </div>
                ) : (
                  currentMessages.map((msg) => {
                    const isOwn =
                      msg.sender?.username ===
                      useMessagingStore.getState().activeConversation?.other_user
                        ?.username
                        ? false
                        : true // fallback simple display
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isOwn ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 px-1 text-[10px] text-slate-400 dark:text-nx-mist">
                          <span>{msg.sender?.full_name || 'کاربر'}</span>
                        </div>
                        <div
                          className={`mt-1 max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                            isOwn
                              ? 'rounded-bl-none bg-nx-blue text-white'
                              : 'rounded-br-none border border-slate-200 bg-white text-slate-800 dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-white'
                          }`}
                        >
                          {msg.metadata?.title && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAttachmentClick(msg.metadata)
                              }}
                              className="mb-2 rounded-xl border border-white/20 dark:border-white/10 bg-black/15 dark:bg-white/10 p-2 text-[11px] cursor-pointer hover:bg-black/25 dark:hover:bg-white/20 transition-all select-none shadow-xs group/att"
                              title="جهت مشاهده جزئیات کلیک کنید"
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                  {msg.metadata.entity_type === 'invoice' ||
                                  msg.metadata.title?.includes('صورت‌حساب') ||
                                  msg.metadata.badge?.includes('صورت‌حساب') ? (
                                    <Receipt className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                                  ) : msg.metadata.entity_type === 'payment' ||
                                    msg.metadata.title?.includes('پرداخت') ||
                                    msg.metadata.badge?.includes('پرداخت') ? (
                                    <CreditCard className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                                  )}
                                  <span className="line-clamp-1">
                                    {msg.metadata.badge || 'پیوست'}: {msg.metadata.title}
                                  </span>
                                </div>
                                <Eye className="h-3 w-3 opacity-70 group-hover/att:opacity-100 shrink-0" />
                              </div>

                              {msg.metadata.code && (
                                <div className="text-[10px] opacity-85 font-medium" dir="ltr">
                                  کد/شماره: {toPersianDigits(msg.metadata.code)}
                                </div>
                              )}

                              <div className="mt-1.5 flex items-center justify-between pt-1 border-t border-white/15 text-[10px] font-semibold">
                                <span className="text-emerald-200">
                                  {msg.metadata.amount ? formatRials(msg.metadata.amount) : 'مشاهده جزئیات'}
                                </span>
                                <span className="underline opacity-90 group-hover/att:opacity-100 flex items-center gap-0.5">
                                  کارت و ریز اقلام ↗
                                </span>
                              </div>
                            </div>
                          )}
                          {msg.content && (
                            <p className="whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <form
                onSubmit={handleSend}
                className="border-t border-slate-200 bg-white p-2.5 dark:border-nx-navy-border dark:bg-nx-navy"
              >
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus-within:border-nx-blue dark:border-nx-navy-border dark:bg-nx-navy-elevated">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="پیام خود را بنویسید…"
                    className="flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-nx-mist"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-nx-blue text-white transition hover:bg-nx-blue/90 disabled:opacity-40"
                    title="ارسال"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Floating Launcher Button */}
      <div
        className={`fixed ${positionClass} z-40 hidden flex-col items-end lg:flex pointer-events-none`}
      >
        <button
          onClick={() => setOpen((prev) => !prev)}
          aria-label="پیام‌رسان سازمانی (Orbit)"
          title="پیام‌رسان سازمانی نکسیو (Orbit)"
          className="pointer-events-auto relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-tr from-nx-blue to-indigo-600 text-white shadow-xl ring-4 ring-white transition-transform duration-300 hover:scale-105 active:scale-95 dark:ring-nx-navy"
        >
          <MessageSquare className="h-6 w-6" />

          {/* Unread badge */}
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white animate-pulse dark:ring-nx-navy">
              {toPersianDigits(totalUnread)}
            </span>
          )}
        </button>
      </div>

      {previewInvoice && (
        <InvoiceDetailModal
          invoiceIdOrCode={previewInvoice.id}
          initialData={previewInvoice.initial}
          onClose={() => setPreviewInvoice(null)}
        />
      )}

      {previewPayment && (
        <PaymentDetailModal
          paymentIdOrCode={previewPayment.id}
          initialData={previewPayment.initial}
          onClose={() => setPreviewPayment(null)}
        />
      )}
    </>
  )
}
