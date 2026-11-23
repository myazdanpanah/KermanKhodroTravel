import { create } from 'zustand'
import {
  ConversationItem,
  MessageItem,
  messagingApi,
} from '../api/messaging'
import { useAuthStore } from './authStore'

interface MessagingState {
  conversations: ConversationItem[]
  activeConversationId: string | null
  activeConversation: ConversationItem | null
  messages: Record<string, MessageItem[]>
  loadingConversations: boolean
  loadingMessages: boolean
  searchQuery: string
  presenceMap: Record<number, 'online' | 'away' | 'offline'>
  lastSeenMap: Record<number, string>
  typingMap: Record<string, number[]> // conversationId -> userIds
  wsConnected: boolean

  // Actions
  setSearchQuery: (q: string) => void
  fetchConversations: () => Promise<void>
  selectConversation: (convId: string | null) => Promise<void>
  fetchMessages: (convId: string) => Promise<void>
  sendMessage: (
    content: string,
    attachmentIds?: string[],
    messageType?: 'TEXT' | 'SYSTEM' | 'ANNOUNCEMENT' | 'ENTITY_LINK',
    metadata?: Record<string, any>
  ) => Promise<void>
  editMessage: (messageId: string, content: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  addReaction: (messageId: string, emoji: string) => Promise<void>
  removeReaction: (messageId: string, reactionId: string) => Promise<void>
  togglePin: (convId: string) => Promise<void>
  toggleArchive: (convId: string) => Promise<void>
  muteConversation: (convId: string, minutes: number) => Promise<void>
  leaveConversation: (convId: string) => Promise<void>
  initWebSocket: () => void
  closeWebSocket: () => void
  setTyping: (isTyping: boolean) => void
}

let socket: WebSocket | null = null
let reconnectTimer: any = null
let heartbeatTimer: any = null

export const useMessagingStore = create<MessagingState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeConversation: null,
  messages: {},
  loadingConversations: false,
  loadingMessages: false,
  searchQuery: '',
  presenceMap: {},
  lastSeenMap: {},
  typingMap: {},
  wsConnected: false,

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  fetchConversations: async () => {
    set({ loadingConversations: true })
    try {
      const data = await messagingApi.getConversations()
      const seenUpdates: Record<number, string> = {}
      data.forEach((c) => {
        if (c.other_user?.id && c.other_user.last_seen_at) {
          seenUpdates[c.other_user.id] = c.other_user.last_seen_at
        }
      })
      set((state) => ({
        conversations: data,
        loadingConversations: false,
        lastSeenMap: { ...state.lastSeenMap, ...seenUpdates },
      }))
    } catch {
      set({ loadingConversations: false })
    }
  },

  selectConversation: async (convId: string | null) => {
    if (!convId) {
      set({ activeConversationId: null, activeConversation: null, loadingMessages: false })
      return
    }
    set({ activeConversationId: convId, loadingMessages: true })
    try {
      const [conv, msgs] = await Promise.all([
        messagingApi.getConversation(convId),
        messagingApi.getMessages(convId),
      ])

      set((state) => ({
        activeConversation: conv,
        loadingMessages: false,
        messages: {
          ...state.messages,
          [convId]: msgs,
        },
        // Reset unread locally
        conversations: state.conversations.map((c) =>
          c.id === convId ? { ...c, unread_count: 0 } : c
        ),
      }))

      // Subscribe to WebSocket group if connected
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'conversation.subscribe',
            conversation_id: convId,
          })
        )
      }
    } catch {
      set({ loadingMessages: false })
    }
  },

  fetchMessages: async (convId: string) => {
    try {
      const msgs = await messagingApi.getMessages(convId)
      set((state) => ({
        messages: {
          ...state.messages,
          [convId]: msgs,
        },
      }))
    } catch {}
  },

  sendMessage: async (
    content: string,
    attachmentIds?: string[],
    messageType: 'TEXT' | 'SYSTEM' | 'ANNOUNCEMENT' | 'ENTITY_LINK' = 'TEXT',
    metadata?: Record<string, any>
  ) => {
    const { activeConversationId } = get()
    if (!activeConversationId) return

    const currentUser = useAuthStore.getState().user
    const clientMsgId = crypto.randomUUID()

    // Optimistic message
    const tempMsg: MessageItem = {
      id: clientMsgId,
      conversation_id: activeConversationId,
      sender: currentUser
        ? {
            id: currentUser.id,
            username: currentUser.username,
            first_name: currentUser.first_name,
            last_name: currentUser.last_name,
            full_name: `${currentUser.first_name} ${currentUser.last_name}`.trim() || currentUser.username,
            avatar_url: '',
            role: currentUser.role,
            department: currentUser.department,
          }
        : null,
      message_type: messageType,
      content,
      content_format: 'PLAIN',
      reply_count: 0,
      sequence: 999999,
      client_message_id: clientMsgId,
      metadata,
      attachments: [],
      reactions: [],
      created_at: new Date().toISOString(),
      isOptimistic: true,
    }

    set((state) => ({
      messages: {
        ...state.messages,
        [activeConversationId]: [...(state.messages[activeConversationId] || []), tempMsg],
      },
    }))

    try {
      const realMsg = await messagingApi.sendMessage(activeConversationId, {
        content,
        client_message_id: clientMsgId,
        attachment_ids: attachmentIds,
        message_type: messageType,
        metadata,
      })

      // Replace optimistic message
      set((state) => ({
        messages: {
          ...state.messages,
          [activeConversationId]: (state.messages[activeConversationId] || []).map((m) =>
            m.client_message_id === clientMsgId ? realMsg : m
          ),
        },
        conversations: state.conversations.map((c) =>
          c.id === activeConversationId
            ? { ...c, last_message_preview: content || metadata?.title || 'پیوست سند', last_message_at: realMsg.created_at }
            : c
        ),
      }))
    } catch {
      // Mark failed
      set((state) => ({
        messages: {
          ...state.messages,
          [activeConversationId]: (state.messages[activeConversationId] || []).map((m) =>
            m.client_message_id === clientMsgId ? { ...m, isFailed: true } : m
          ),
        },
      }))
    }
  },

  editMessage: async (messageId: string, content: string) => {
    const { activeConversationId } = get()
    if (!activeConversationId) return

    const updated = await messagingApi.editMessage(messageId, content)
    set((state) => ({
      messages: {
        ...state.messages,
        [activeConversationId]: (state.messages[activeConversationId] || []).map((m) =>
          m.id === messageId ? updated : m
        ),
      },
    }))
  },

  deleteMessage: async (messageId: string) => {
    const { activeConversationId } = get()
    if (!activeConversationId) return

    await messagingApi.deleteMessage(messageId)
    set((state) => ({
      messages: {
        ...state.messages,
        [activeConversationId]: (state.messages[activeConversationId] || []).filter(
          (m) => m.id !== messageId
        ),
      },
    }))
  },

  addReaction: async (messageId: string, emoji: string) => {
    const { activeConversationId } = get()
    if (!activeConversationId) return

    const reaction = await messagingApi.addReaction(messageId, emoji)
    set((state) => ({
      messages: {
        ...state.messages,
        [activeConversationId]: (state.messages[activeConversationId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions: [...(m.reactions || []), reaction] } : m
        ),
      },
    }))
  },

  removeReaction: async (messageId: string, reactionId: string) => {
    const { activeConversationId } = get()
    if (!activeConversationId) return

    await messagingApi.removeReaction(messageId, reactionId)
    set((state) => ({
      messages: {
        ...state.messages,
        [activeConversationId]: (state.messages[activeConversationId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions: (m.reactions || []).filter((r) => r.id !== reactionId) } : m
        ),
      },
    }))
  },

  togglePin: async (convId: string) => {
    const res = await messagingApi.togglePin(convId)
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, is_pinned: res.is_pinned } : c
      ),
      activeConversation:
        state.activeConversation?.id === convId
          ? { ...state.activeConversation, is_pinned: res.is_pinned }
          : state.activeConversation,
    }))
  },

  toggleArchive: async (convId: string) => {
    const res = await messagingApi.toggleArchive(convId)
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, is_archived: res.is_archived } : c
      ),
    }))
  },

  muteConversation: async (convId: string, minutes: number) => {
    const res = await messagingApi.muteConversation(convId, minutes)
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, is_muted: !!res.muted_until } : c
      ),
      activeConversation:
        state.activeConversation?.id === convId
          ? { ...state.activeConversation, is_muted: !!res.muted_until }
          : state.activeConversation,
    }))
  },

  leaveConversation: async (convId: string) => {
    await messagingApi.leaveConversation(convId)
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== convId),
      activeConversationId: state.activeConversationId === convId ? null : state.activeConversationId,
      activeConversation: state.activeConversation?.id === convId ? null : state.activeConversation,
    }))
  },

  setTyping: (isTyping: boolean) => {
    const { activeConversationId } = get()
    if (!activeConversationId || !socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(
      JSON.stringify({
        type: isTyping ? 'typing.start' : 'typing.stop',
        conversation_id: activeConversationId,
      })
    )
  },

  initWebSocket: () => {
    if (socket && socket.readyState === WebSocket.OPEN) return

    const token = useAuthStore.getState().token
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host || 'localhost:8000'
    const wsUrl = `${protocol}//${host}/ws/messaging/`

    socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      set({ wsConnected: true })
      const { activeConversationId } = get()
      if (activeConversationId) {
        socket?.send(
          JSON.stringify({
            type: 'conversation.subscribe',
            conversation_id: activeConversationId,
          })
        )
      }

      clearInterval(heartbeatTimer)
      heartbeatTimer = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'presence.heartbeat' }))
        }
      }, 25000)
    }

    socket.onclose = () => {
      set({ wsConnected: false })
      clearInterval(heartbeatTimer)
      clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        get().initWebSocket()
      }, 3000 + Math.random() * 2000)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const eventType = data.type
        const payload = data.payload

        if (eventType === 'message.created') {
          const convId = payload.conversation_id
          const { activeConversationId } = get()

          if (activeConversationId === convId) {
            set((state) => {
              const currentList = state.messages[convId] || []
              if (currentList.some((m) => m.id === payload.id || m.client_message_id === payload.client_message_id)) {
                return state
              }
              return {
                messages: {
                  ...state.messages,
                  [convId]: [...currentList, payload],
                },
              }
            })
            messagingApi.markAsRead(payload.id).catch(() => {})
          }

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    last_message_preview: payload.content,
                    last_message_at: payload.created_at,
                    unread_count: activeConversationId === convId ? 0 : c.unread_count + 1,
                  }
                : c
            ),
          }))
        } else if (eventType === 'message.updated') {
          const convId = payload.conversation_id
          set((state) => ({
            messages: {
              ...state.messages,
              [convId]: (state.messages[convId] || []).map((m) =>
                m.id === payload.id ? { ...m, content: payload.content, edited_at: payload.edited_at } : m
              ),
            },
          }))
        } else if (eventType === 'message.deleted') {
          const convId = payload.conversation_id
          set((state) => ({
            messages: {
              ...state.messages,
              [convId]: (state.messages[convId] || []).filter(
                (m) => m.id !== payload.id
              ),
            },
          }))
        } else if (eventType === 'typing.started') {
          const convId = payload.conversation_id
          const uid = payload.user_id
          set((state) => {
            const list = state.typingMap[convId] || []
            if (list.includes(uid)) return state
            return {
              typingMap: {
                ...state.typingMap,
                [convId]: [...list, uid],
              },
            }
          })
        } else if (eventType === 'typing.stopped') {
          const convId = payload.conversation_id
          const uid = payload.user_id
          set((state) => ({
            typingMap: {
              ...state.typingMap,
              [convId]: (state.typingMap[convId] || []).filter((id) => id !== uid),
            },
          }))
        } else if (eventType === 'presence.updated') {
          const uid = payload.user_id
          const status = payload.status
          const lastSeenAt = payload.last_seen_at
          set((state) => ({
            presenceMap: {
              ...state.presenceMap,
              [uid]: status,
            },
            lastSeenMap: lastSeenAt
              ? {
                  ...state.lastSeenMap,
                  [uid]: lastSeenAt,
                }
              : state.lastSeenMap,
          }))
        }
      } catch {}
    }
  },

  closeWebSocket: () => {
    clearInterval(heartbeatTimer)
    clearTimeout(reconnectTimer)
    if (socket) {
      socket.close()
      socket = null
    }
    set({ wsConnected: false })
  },
}))
