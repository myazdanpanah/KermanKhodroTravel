import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  MessageSquare,
  Users,
  Building,
  Info,
  Megaphone,
  ChevronRight,
} from 'lucide-react'
import { useMessagingStore } from '../../store/messagingStore'
import { useAuthStore } from '../../store/authStore'
import { formatLastSeen } from './presenceUtils'
import ConversationSidebar from './components/ConversationSidebar'
import MessageTimeline from './components/MessageTimeline'
import MessageComposer from './components/MessageComposer'
import ConversationDetailsDrawer from './components/ConversationDetailsDrawer'
import NewConversationModal from './components/NewConversationModal'
import AnnouncementModal from './components/AnnouncementModal'

export default function MessagingPage() {
  const {
    activeConversationId,
    activeConversation,
    messages,
    fetchConversations,
    selectConversation,
    initWebSocket,
    closeWebSocket,
    typingMap,
    presenceMap,
    lastSeenMap,
  } = useMessagingStore()

  const { conversationId } = useParams<{ conversationId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false)
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true)

  // Auto-open new conversation modal when navigated via ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setNewModalOpen(true)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('new')
      setSearchParams(nextParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    fetchConversations().then(() => {
      if (conversationId) {
        selectConversation(conversationId)
      }
    })
    initWebSocket()
    return () => {
      closeWebSocket()
    }
  }, [conversationId])

  // Auto-close mobile sidebar when conversation is picked
  useEffect(() => {
    if (activeConversationId) {
      setMobileSidebarOpen(false)
    }
  }, [activeConversationId])

  const currentMessages = activeConversationId ? messages[activeConversationId] || [] : []
  const isDirect = activeConversation?.kind === 'DIRECT'
  const isOnline = isDirect && activeConversation?.other_user && presenceMap[activeConversation.other_user.id] === 'online'
  const activeTypingUserIds = activeConversationId ? typingMap[activeConversationId] || [] : []

  return (
    <div className={`relative flex h-full w-full overflow-hidden bg-slate-50 dark:bg-nx-navy ${
      activeConversation ? 'pb-0' : 'pb-16 lg:pb-0'
    }`}>
      {/* Sidebar (Responsive full-width on mobile list view) */}
      <div
        className={`${
          mobileSidebarOpen && !activeConversationId ? 'flex' : 'hidden'
        } md:flex h-full shrink-0 z-30 transition-all w-full md:w-80 lg:w-96`}
      >
        <ConversationSidebar onOpenNewModal={() => setNewModalOpen(true)} />
      </div>

      {/* Main Conversation View */}
      <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-nx-navy border-e border-slate-200 dark:border-nx-navy-border">
        {activeConversation ? (
          <>
            {/* Conversation Header — with Notch safe-area on mobile */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 sm:px-4 dark:border-nx-navy-border bg-white dark:bg-nx-navy-elevated h-[calc(3.75rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] md:h-16 md:pt-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Mobile Back / Exit Conversation Button */}
                <button
                  onClick={() => {
                    setMobileSidebarOpen(true)
                    selectConversation(null)
                  }}
                  className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-nx-navy dark:text-slate-200 md:hidden flex items-center justify-center active:scale-95"
                  aria-label="بازگشت به لیست گفتگوها"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div className="relative">
                  {isDirect ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-nx-blue to-nx-teal text-sm font-bold text-white shadow-sm">
                      {activeConversation.other_user?.first_name?.[0] || 'U'}
                    </div>
                  ) : activeConversation.kind === 'DEPARTMENT' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <Building className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-nx-blue/10 text-nx-blue dark:bg-nx-blue/20 dark:text-nx-teal">
                      <Users className="h-5 w-5" />
                    </div>
                  )}

                  {isOnline && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-nx-navy" />
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    {(() => {
                      if (!isDirect) return activeConversation.title
                      const raw = activeConversation.other_user?.full_name || activeConversation.title
                      if (raw && raw.includes(' & ')) {
                        const parts = raw.split(' & ')
                        const myName = (user ? user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : '').trim()
                        if (parts.length === 2 && myName) {
                          return parts[0].trim() === myName ? parts[1].trim() : parts[0].trim()
                        }
                        if (parts.length === 2) return parts[1].trim()
                      }
                      return raw
                    })()}
                    {activeConversation.kind !== 'DIRECT' && (
                      <span className="rounded-md bg-nx-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-nx-blue dark:bg-nx-blue/20 dark:text-nx-teal">
                        {activeConversation.kind === 'DEPARTMENT' ? 'دپارتمان' : 'گروه'}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-nx-mist">
                    {isDirect && activeConversation.other_user ? (
                      <span className={isOnline ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                        {formatLastSeen(
                          lastSeenMap[activeConversation.other_user.id] || activeConversation.other_user.last_seen_at,
                          isOnline
                        )}
                      </span>
                    ) : (
                      <span>{activeConversation.members_count} عضو</span>
                    )}
                    {activeTypingUserIds.length > 0 && (
                      <span className="text-nx-blue dark:text-nx-teal animate-pulse font-medium">
                        در حال نوشتن...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {!isDirect && (
                  <button
                    onClick={() => setAnnouncementModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300 transition-colors"
                    title="انتشار اطلاعیه رسمی"
                  >
                    <Megaphone className="h-3.5 w-3.5 text-amber-500" />
                    <span className="hidden sm:inline">اطلاعیه رسمی</span>
                  </button>
                )}

                <button
                  onClick={() => setDetailsDrawerOpen(!detailsDrawerOpen)}
                  className={`rounded-xl p-2 transition-colors ${
                    detailsDrawerOpen
                      ? 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue/20 dark:text-nx-teal'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-nx-navy dark:text-nx-mist'
                  }`}
                  title="مشخصات گفتگو"
                >
                  <Info className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Timeline */}
            <MessageTimeline messages={currentMessages} />

            {/* Composer */}
            <MessageComposer conversationId={activeConversation.id} />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-nx-blue/10 text-nx-blue dark:bg-nx-blue/20 dark:text-nx-teal mb-4 shadow-sm">
              <MessageSquare className="h-10 w-10" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              به پیام‌رسان سازمانی Nexivo Orbit خوش آمدید
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-400 dark:text-nx-mist leading-relaxed">
              یک گفتگو را از نوار کناری انتخاب کنید یا با کلیک روی «گفتگوی جدید»، گفتگوی خصوصی یا گروهی جدیدی را آغاز نمایید.
            </p>
            <button
              onClick={() => setNewModalOpen(true)}
              className="mt-4 rounded-xl bg-nx-blue px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-nx-blue/90 transition-all active:scale-95"
            >
              شروع گفتگوی جدید
            </button>
          </div>
        )}
      </div>

      {/* Details Drawer */}
      {detailsDrawerOpen && activeConversation && (
        <ConversationDetailsDrawer
          conversation={activeConversation}
          onClose={() => setDetailsDrawerOpen(false)}
        />
      )}

      {/* Modals */}
      <NewConversationModal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
      />

      {activeConversation && (
        <AnnouncementModal
          conversationId={activeConversation.id}
          isOpen={announcementModalOpen}
          onClose={() => setAnnouncementModalOpen(false)}
        />
      )}
    </div>
  )
}
