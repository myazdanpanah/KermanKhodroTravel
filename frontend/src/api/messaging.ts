import api from './client'

export interface UserSummary {
  id: number
  username: string
  first_name: string
  last_name: string
  full_name: string
  avatar_url: string
  role: string
  department: string
  presence?: 'online' | 'away' | 'offline'
  last_seen_at?: string | null
}

export interface AttachmentItem {
  id: string
  original_filename: string
  mime_type: string
  file_size: number
  status: string
  download_url: string
  created_at: string
}

export interface ReactionItem {
  id: string
  user_id: number
  username: string
  emoji: string
  created_at: string
}

export interface EntityItem {
  entity_type: 'correspondence' | 'invoice' | 'payment'
  entity_id: string
  title: string
  code: string
  date: string
  amount?: number
  badge: string
  status?: string
  subtitle: string
  period_range?: string
  preview_url?: string
  download_url?: string
  tracking_number?: string
  body_snippet?: string
  description?: string
}

export interface MessageItem {
  id: string
  conversation_id: string
  channel_id?: string | null
  sender: UserSummary | null
  message_type: 'TEXT' | 'SYSTEM' | 'ANNOUNCEMENT' | 'ENTITY_LINK'
  content: string
  content_format: 'PLAIN' | 'SAFE_MARKDOWN'
  root_message_id?: string | null
  reply_count: number
  sequence: number
  client_message_id?: string | null
  metadata?: Record<string, any>
  attachments: AttachmentItem[]
  reactions: ReactionItem[]
  edited_at?: string | null
  deleted_at?: string | null
  created_at: string
  // Optimistic tracking in UI
  isOptimistic?: boolean
  isFailed?: boolean
}

export interface ChannelItem {
  id: string
  conversation_id: string
  name: string
  slug: string
  description: string
  visibility: 'GROUP' | 'PRIVATE'
  is_default: boolean
  is_archived: boolean
  created_at: string
}

export interface MembershipItem {
  id: string
  user: UserSummary
  role: 'OWNER' | 'MODERATOR' | 'MEMBER' | 'READ_ONLY'
  state: 'ACTIVE' | 'INVITED' | 'LEFT' | 'REMOVED'
  is_pinned: boolean
  is_archived: boolean
  notifications_muted_until?: string | null
  last_read_sequence: number
  last_read_at?: string | null
  joined_at: string
}

export interface ConversationItem {
  id: string
  kind: 'DIRECT' | 'GROUP' | 'DEPARTMENT' | 'PROJECT'
  title: string | null
  description: string
  avatar: string
  membership_mode: 'AUTO' | 'MANUAL' | 'HYBRID'
  is_private: boolean
  is_archived: boolean
  last_message_at: string | null
  last_message_preview: string
  unread_count: number
  is_pinned: boolean
  is_muted: boolean
  members_count: number
  other_user?: UserSummary | null
  created_at: string
  members?: MembershipItem[]
  channels?: ChannelItem[]
  typing_user_ids?: number[]
}

export interface AnnouncementItem {
  id: string
  conversation_id: string
  scope_type: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  publish_at?: string | null
  expires_at?: string | null
  requires_acknowledgment: boolean
  is_acknowledged: boolean
  acknowledgments_count: number
  created_by: UserSummary
  message: MessageItem
  created_at: string
}

export const messagingApi = {
  // Directory
  getUsers: (q = '') =>
    api.get<UserSummary[]>('/messaging/users/', { params: { q } }).then((r) => r.data),

  // Conversations
  getConversations: () =>
    api.get<ConversationItem[]>('/messaging/conversations/').then((r) => r.data),

  getConversation: (id: string) =>
    api.get<ConversationItem>(`/messaging/conversations/${id}/`).then((r) => r.data),

  createDirectConversation: (userId: number) =>
    api.post<ConversationItem>('/messaging/conversations/direct/', { user_id: userId }).then((r) => r.data),

  createGroupConversation: (payload: {
    title: string
    description?: string
    member_ids?: number[]
    kind?: 'GROUP' | 'DEPARTMENT' | 'PROJECT'
    division_id?: number
    is_private?: boolean
  }) => api.post<ConversationItem>('/messaging/conversations/groups/', payload).then((r) => r.data),

  updateConversation: (id: string, payload: { title?: string; description?: string }) =>
    api.patch<ConversationItem>(`/messaging/conversations/${id}/`, payload).then((r) => r.data),

  leaveConversation: (id: string) =>
    api.post<{ status: string }>(`/messaging/conversations/${id}/leave/`).then((r) => r.data),

  togglePin: (id: string) =>
    api.post<{ is_pinned: boolean }>(`/messaging/conversations/${id}/pin/`).then((r) => r.data),

  toggleArchive: (id: string) =>
    api.post<{ is_archived: boolean }>(`/messaging/conversations/${id}/archive/`).then((r) => r.data),

  muteConversation: (id: string, minutes: number) =>
    api.post<{ muted_until: string | null }>(`/messaging/conversations/${id}/mute/`, { minutes }).then((r) => r.data),

  getMembers: (convId: string) =>
    api.get<MembershipItem[]>(`/messaging/conversations/${convId}/members/`).then((r) => r.data),

  addMembers: (convId: string, userIds: number[], role = 'MEMBER') =>
    api.post<{ added_count: number }>(`/messaging/conversations/${convId}/members/`, { user_ids: userIds, role }).then((r) => r.data),

  removeMember: (convId: string, userId: number) =>
    api.delete<{ status: string }>(`/messaging/conversations/${convId}/members/${userId}/`).then((r) => r.data),

  // Channels
  getChannels: (convId: string) =>
    api.get<ChannelItem[]>(`/messaging/conversations/${convId}/channels/`).then((r) => r.data),

  createChannel: (convId: string, payload: { name: string; slug?: string; description?: string; visibility?: string }) =>
    api.post<ChannelItem>(`/messaging/conversations/${convId}/channels/`, payload).then((r) => r.data),

  // Messages
  getMessages: (convId: string, params?: { limit?: number; before_seq?: number; after_seq?: number; channel_id?: string }) =>
    api.get<MessageItem[]>(`/messaging/conversations/${convId}/messages/`, { params }).then((r) => r.data),

  sendMessage: (convId: string, payload: {
    content: string
    content_format?: 'PLAIN' | 'SAFE_MARKDOWN'
    message_type?: 'TEXT' | 'SYSTEM' | 'ANNOUNCEMENT' | 'ENTITY_LINK'
    client_message_id?: string
    channel_id?: string | null
    root_message_id?: string | null
    attachment_ids?: string[]
    metadata?: Record<string, any>
  }) => api.post<MessageItem>(`/messaging/conversations/${convId}/messages/`, payload).then((r) => r.data),

  // Cross-System Entity Integration
  searchEntities: (type: 'correspondence' | 'invoice' | 'payment', q = '') =>
    api.get<EntityItem[]>('/messaging/entities/search/', { params: { type, q } }).then((r) => r.data),

  getEntityPreview: (type: string, id: string) =>
    api.get<any>(`/messaging/entities/preview/${type}/${id}/`).then((r) => r.data),

  editMessage: (messageId: string, content: string) =>
    api.patch<MessageItem>(`/messaging/messages/${messageId}/`, { content }).then((r) => r.data),

  deleteMessage: (messageId: string) =>
    api.delete<{ status: string; id: string }>(`/messaging/messages/${messageId}/`).then((r) => r.data),

  getThread: (messageId: string) =>
    api.get<{ root: MessageItem; replies: MessageItem[] }>(`/messaging/messages/${messageId}/thread/`).then((r) => r.data),

  addReaction: (messageId: string, emoji: string) =>
    api.post<ReactionItem>(`/messaging/messages/${messageId}/reactions/`, { emoji }).then((r) => r.data),

  removeReaction: (messageId: string, reactionId: string) =>
    api.delete<{ status: string }>(`/messaging/messages/${messageId}/reactions/${reactionId}/`).then((r) => r.data),

  markAsRead: (messageId: string) =>
    api.post<{ last_read_sequence: number }>(`/messaging/messages/${messageId}/read/`).then((r) => r.data),

  // Attachments
  uploadAttachment: (convId: string, file: File) => {
    const formData = new FormData()
    formData.append('conversation_id', convId)
    formData.append('file', file)
    return api.post<AttachmentItem>('/messaging/attachments/upload-init/', formData).then((r) => r.data)
  },

  // Announcements
  getAnnouncements: () =>
    api.get<AnnouncementItem[]>('/messaging/announcements/').then((r) => r.data),

  createAnnouncement: (payload: {
    conversation_id: string
    content: string
    priority?: string
    scope_type?: string
    requires_acknowledgment?: boolean
  }) => api.post<AnnouncementItem>('/messaging/announcements/', payload).then((r) => r.data),

  acknowledgeAnnouncement: (announcementId: string) =>
    api.post<{ acknowledged: boolean }>(`/messaging/announcements/${announcementId}/acknowledge/`).then((r) => r.data),

  // Search
  searchMessages: (q: string) =>
    api.get<MessageItem[]>('/messaging/search/messages/', { params: { q } }).then((r) => r.data),
}
