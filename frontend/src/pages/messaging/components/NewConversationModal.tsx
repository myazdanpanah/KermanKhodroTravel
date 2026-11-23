import React, { useState, useEffect } from 'react'
import { X, Search, UserPlus, Users, Check } from 'lucide-react'
import { messagingApi, UserSummary } from '../../../api/messaging'
import { useMessagingStore } from '../../../store/messagingStore'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function NewConversationModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<'direct' | 'group'>('direct')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)

  // Group state
  const [groupTitle, setGroupTitle] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const { selectConversation, fetchConversations } = useMessagingStore()

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    messagingApi
      .getUsers(search)
      .then((data) => {
        if (active) setUsers(data)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isOpen, search])

  if (!isOpen) return null

  const handleStartDirect = async (user: UserSummary) => {
    try {
      setSubmitting(true)
      const conv = await messagingApi.createDirectConversation(user.id)
      await fetchConversations()
      await selectConversation(conv.id)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupTitle.trim()) return

    try {
      setSubmitting(true)
      const conv = await messagingApi.createGroupConversation({
        title: groupTitle.trim(),
        description: groupDesc.trim(),
        member_ids: selectedUserIds,
        kind: 'GROUP',
      })
      await fetchConversations()
      await selectConversation(conv.id)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleUserSelect = (uid: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-nx-navy-border bg-white dark:bg-nx-navy-elevated rounded-t-2xl">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-nx-blue dark:text-nx-teal" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              گفتگوی جدید
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-nx-navy dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 dark:border-nx-navy-border bg-white dark:bg-nx-navy-elevated">
          <button
            onClick={() => setTab('direct')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
              tab === 'direct'
                ? 'border-nx-blue text-nx-blue dark:border-nx-teal dark:text-nx-teal font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-nx-mist dark:hover:text-slate-200'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            پیام خصوصی
          </button>
          <button
            onClick={() => setTab('group')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ms-6 ${
              tab === 'group'
                ? 'border-nx-blue text-nx-blue dark:border-nx-teal dark:text-nx-teal font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-nx-mist dark:hover:text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            ایجاد گروه
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-nx-navy">
          {tab === 'direct' ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی همکاران بر اساس نام، نام خانوادگی، دپارتمان..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-3 ps-9 text-sm text-slate-800 placeholder-slate-400 focus:border-nx-blue focus:bg-white focus:outline-none dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-slate-100 dark:focus:border-nx-teal"
                />
              </div>

              <div className="divide-y divide-slate-100 dark:divide-nx-navy-border/60">
                {loading ? (
                  <div className="py-8 text-center text-sm text-slate-400">در حال بارگذاری...</div>
                ) : users.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">همکاری یافت نشد.</div>
                ) : (
                  users.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleStartDirect(u)}
                      className="flex cursor-pointer items-center justify-between py-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors dark:hover:bg-nx-navy-elevated/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-nx-blue to-nx-teal text-sm font-bold text-white shadow-sm">
                            {u.first_name?.[0] || u.username[0].toUpperCase()}
                          </div>
                          {u.presence === 'online' && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-nx-navy" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                            {u.full_name}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-nx-mist">
                            {u.department || u.role || `@${u.username}`}
                          </div>
                        </div>
                      </div>
                      <button
                        disabled={submitting}
                        className="rounded-lg bg-nx-blue/10 px-3 py-1.5 text-xs font-semibold text-nx-blue hover:bg-nx-blue/20 dark:bg-nx-blue/20 dark:text-nx-teal dark:hover:bg-nx-blue/30 transition-colors"
                      >
                        شروع گفتگو
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  نام گروه *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تیم بازاریابی و فروش"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-nx-blue focus:bg-white focus:outline-none dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-slate-100 dark:focus:border-nx-teal"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  توضیحات (اختیاری)
                </label>
                <textarea
                  rows={2}
                  placeholder="هدف و حوزه کاری گروه..."
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-nx-blue focus:bg-white focus:outline-none dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-slate-100 dark:focus:border-nx-teal"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  انتخاب اعضای اولیه ({selectedUserIds.length} نفر انتخاب شده)
                </label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-nx-navy-border space-y-1">
                  {users.map((u) => {
                    const selected = selectedUserIds.includes(u.id)
                    return (
                      <div
                        key={u.id}
                        onClick={() => toggleUserSelect(u.id)}
                        className={`flex cursor-pointer items-center justify-between rounded-lg p-2 text-xs transition-colors ${
                          selected
                            ? 'bg-nx-blue/10 text-nx-blue dark:bg-nx-blue/20 dark:text-nx-teal'
                            : 'hover:bg-slate-100 text-slate-700 dark:hover:bg-nx-navy-elevated dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-nx-navy-elevated flex items-center justify-center font-bold text-[10px]">
                            {u.first_name?.[0] || u.username[0].toUpperCase()}
                          </div>
                          <span>{u.full_name}</span>
                        </div>
                        {selected && <Check className="h-4 w-4 text-nx-blue dark:text-nx-teal" />}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-nx-navy-border dark:text-slate-300 dark:hover:bg-nx-navy-elevated"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting || !groupTitle.trim()}
                  className="rounded-xl bg-nx-blue px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-nx-blue/90 disabled:opacity-50 transition-all active:scale-95"
                >
                  {submitting ? 'در حال ایجاد...' : 'ایجاد گروه'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
