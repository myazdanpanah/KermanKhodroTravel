import { useState } from 'react'
import {
  Search,
  Plus,
  Pin,
  BellOff,
  Users,
  Building,
} from 'lucide-react'
import { useMessagingStore } from '../../../store/messagingStore'
import { useAuthStore } from '../../../store/authStore'
import { formatLastSeen, formatConversationTime } from '../presenceUtils'

interface Props {
  onOpenNewModal: () => void
}

export default function ConversationSidebar({ onOpenNewModal }: Props) {
  const { user } = useAuthStore()
  const {
    conversations,
    activeConversationId,
    selectConversation,
    searchQuery,
    setSearchQuery,
    presenceMap,
    lastSeenMap,
  } = useMessagingStore()

  const [filterTab, setFilterTab] = useState<'all' | 'direct' | 'group' | 'pinned'>('all')

  const filteredConversations = conversations.filter((c) => {
    // Search match
    const titleMatch = (c.title || c.other_user?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    if (searchQuery && !titleMatch) return false

    // Tab filter
    if (filterTab === 'direct') return c.kind === 'DIRECT'
    if (filterTab === 'group') return c.kind !== 'DIRECT'
    if (filterTab === 'pinned') return c.is_pinned
    return true
  })

  return (
    <div className="flex h-full w-full flex-col border-e border-slate-200 bg-white dark:border-nx-navy-border dark:bg-nx-navy md:w-80 lg:w-96">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-nx-navy-border">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          پیام‌رسان
        </h2>
        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-1.5 rounded-xl bg-nx-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-nx-blue/90 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>گفتگوی جدید</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="جستجوی گفتگوها و پیام‌ها..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-3 ps-9 text-xs text-slate-800 placeholder-slate-400 focus:border-nx-blue focus:bg-white focus:outline-none dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-slate-100 dark:focus:border-nx-teal"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-100 px-3 text-xs font-medium text-slate-500 dark:border-nx-navy-border dark:text-slate-400">
        <button
          onClick={() => setFilterTab('all')}
          className={`border-b-2 py-2 px-2.5 transition-colors ${
            filterTab === 'all'
              ? 'border-nx-blue text-nx-blue font-bold dark:border-nx-teal dark:text-nx-teal'
              : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          همه
        </button>
        <button
          onClick={() => setFilterTab('direct')}
          className={`border-b-2 py-2 px-2.5 transition-colors ${
            filterTab === 'direct'
              ? 'border-nx-blue text-nx-blue font-bold dark:border-nx-teal dark:text-nx-teal'
              : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          مستقیم
        </button>
        <button
          onClick={() => setFilterTab('group')}
          className={`border-b-2 py-2 px-2.5 transition-colors ${
            filterTab === 'group'
              ? 'border-nx-blue text-nx-blue font-bold dark:border-nx-teal dark:text-nx-teal'
              : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          گروه‌ها
        </button>
        <button
          onClick={() => setFilterTab('pinned')}
          className={`border-b-2 py-2 px-2.5 transition-colors ${
            filterTab === 'pinned'
              ? 'border-nx-blue text-nx-blue font-bold dark:border-nx-teal dark:text-nx-teal'
              : 'border-transparent hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          سنجاق‌شده
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-nx-navy-border/50 pb-20 md:pb-2 overscroll-contain">
        {filteredConversations.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            گفتگویی یافت نشد.
          </div>
        ) : (
          filteredConversations.map((c) => {
            const isActive = c.id === activeConversationId
            const isDirect = c.kind === 'DIRECT'
            const otherUser = c.other_user
            const isOnline = isDirect && otherUser && presenceMap[otherUser.id] === 'online'
            const rawTitle = isDirect ? otherUser?.full_name || c.title : c.title
            let title = rawTitle
            if (isDirect && rawTitle && rawTitle.includes(' & ')) {
              const parts = rawTitle.split(' & ')
              const myName = (user ? user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : '').trim()
              if (parts.length === 2 && myName) {
                title = parts[0].trim() === myName ? parts[1].trim() : parts[0].trim()
              } else if (parts.length === 2) {
                title = parts[1].trim()
              }
            }

            return (
              <div
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`flex cursor-pointer items-start gap-3 p-3 transition-colors ${
                  isActive
                    ? 'bg-nx-blue/10 dark:bg-nx-blue/20 border-r-4 border-nx-blue dark:border-nx-teal'
                    : 'hover:bg-slate-50 dark:hover:bg-nx-navy-elevated/40'
                }`}
              >
                {/* Avatar / Icon */}
                <div className="relative shrink-0">
                  {isDirect ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-nx-blue to-nx-teal text-sm font-bold text-white shadow-sm">
                      {otherUser?.first_name?.[0] || otherUser?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                  ) : c.kind === 'DEPARTMENT' ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <Building className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-nx-blue/10 text-nx-blue dark:bg-nx-blue/20 dark:text-nx-teal">
                      <Users className="h-5 w-5" />
                    </div>
                  )}

                  {isOnline && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-nx-navy" />
                  )}
                </div>

                {/* Info & Last Message */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                      {title}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400 dark:text-nx-mist">
                      {formatConversationTime(c.last_message_at)}
                    </span>
                  </div>

                  {isDirect && otherUser && (
                    <div className="mt-0.5 text-[10px]">
                      <span className={isOnline ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-nx-mist'}>
                        {formatLastSeen(lastSeenMap[otherUser.id] || otherUser.last_seen_at, isOnline)}
                      </span>
                    </div>
                  )}

                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <p className="truncate pe-2">
                      {c.last_message_preview || 'بدون پیام'}
                    </p>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.is_muted && <BellOff className="h-3 w-3 text-slate-400" />}
                      {c.is_pinned && <Pin className="h-3 w-3 text-nx-blue dark:text-nx-teal" />}
                      {c.unread_count > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-xs">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
