import { useState } from 'react'
import {
  X,
  Pin,
  BellOff,
  LogOut,
  Users,
  Trash2,
} from 'lucide-react'
import { ConversationItem, messagingApi } from '../../../api/messaging'
import { useMessagingStore } from '../../../store/messagingStore'
import { useAuthStore } from '../../../store/authStore'

interface Props {
  conversation: ConversationItem
  onClose: () => void
}

export default function ConversationDetailsDrawer({ conversation, onClose }: Props) {
  const { user: currentUser } = useAuthStore()
  const { togglePin, muteConversation, leaveConversation, fetchConversations, selectConversation } =
    useMessagingStore()

  const [loadingAction, setLoadingAction] = useState(false)
  const isDirect = conversation.kind === 'DIRECT'
  const isOwnerOrMod = conversation.members?.some(
    (m) => m.user.id === currentUser?.id && (m.role === 'OWNER' || m.role === 'MODERATOR')
  ) || currentUser?.role === 'admin'

  const handleTogglePin = async () => {
    setLoadingAction(true)
    try {
      await togglePin(conversation.id)
      await fetchConversations()
    } finally {
      setLoadingAction(false)
    }
  }

  const handleMute = async (minutes: number) => {
    setLoadingAction(true)
    try {
      await muteConversation(conversation.id, minutes)
      await fetchConversations()
    } finally {
      setLoadingAction(false)
    }
  }

  const handleLeave = async () => {
    if (!confirm('آیا از خروج از این گفتگو اطمینان دارید؟')) return
    setLoadingAction(true)
    try {
      await leaveConversation(conversation.id)
      await fetchConversations()
      onClose()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'خطا در خروج از گروه.')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('آیا از حذف این کاربر اطمینان دارید؟')) return
    try {
      await messagingApi.removeMember(conversation.id, userId)
      await selectConversation(conversation.id)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'خطا در حذف عضو.')
    }
  }

  return (
    <div className="flex h-full w-80 flex-col border-s border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          مشخصات گفتگو
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Info Card */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-bold text-xl mb-3 shadow-inner">
            {isDirect ? (
              conversation.other_user?.first_name?.[0] || 'U'
            ) : (
              <Users className="h-8 w-8" />
            )}
          </div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {isDirect ? conversation.other_user?.full_name || conversation.title : conversation.title}
          </h4>
          {conversation.description && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {conversation.description}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleTogglePin}
            disabled={loadingAction}
            className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition-colors ${
              conversation.is_pinned
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Pin className="h-3.5 w-3.5" />
            <span>{conversation.is_pinned ? 'حذف سنجاق' : 'سنجاق'}</span>
          </button>

          <button
            onClick={() => handleMute(conversation.is_muted ? 0 : 1440)}
            disabled={loadingAction}
            className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition-colors ${
              conversation.is_muted
                ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <BellOff className="h-3.5 w-3.5" />
            <span>{conversation.is_muted ? 'فعال‌سازی صدا' : 'بی‌صدا کردن'}</span>
          </button>
        </div>

        {/* Members Section (for Groups) */}
        {!isDirect && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                اعضای گروه ({conversation.members?.length || 0})
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {conversation.members?.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800/60"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[11px]">
                      {m.user.first_name?.[0] || m.user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {m.user.full_name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {m.role === 'OWNER'
                          ? 'مالک گروه'
                          : m.role === 'MODERATOR'
                          ? 'مدیر گروه'
                          : 'عضو'}
                      </div>
                    </div>
                  </div>

                  {isOwnerOrMod && m.role !== 'OWNER' && m.user.id !== currentUser?.id && (
                    <button
                      onClick={() => handleRemoveMember(m.user.id)}
                      className="rounded p-1 text-slate-400 hover:text-red-500"
                      title="حذف از گروه"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leave Group Button */}
        {!isDirect && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleLeave}
              disabled={loadingAction}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 p-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>خروج از گفتگو</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
