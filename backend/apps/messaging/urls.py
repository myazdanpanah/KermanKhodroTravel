from django.urls import path
from apps.messaging.api import views

urlpatterns = [
    # User Directory for Messaging
    path("users/", views.UserDirectoryView.as_view(), name="messaging-users"),

    # Conversations
    path("conversations/", views.ConversationListView.as_view(), name="conversation-list"),
    path("conversations/direct/", views.DirectConversationCreateView.as_view(), name="conversation-direct-create"),
    path("conversations/groups/", views.GroupConversationCreateView.as_view(), name="conversation-group-create"),
    path("conversations/<uuid:pk>/", views.ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/<uuid:pk>/leave/", views.ConversationLeaveView.as_view(), name="conversation-leave"),
    path("conversations/<uuid:pk>/pin/", views.ConversationTogglePinView.as_view(), name="conversation-pin"),
    path("conversations/<uuid:pk>/archive/", views.ConversationToggleArchiveView.as_view(), name="conversation-archive"),
    path("conversations/<uuid:pk>/mute/", views.ConversationMuteView.as_view(), name="conversation-mute"),
    path("conversations/<uuid:pk>/members/", views.ConversationMembersView.as_view(), name="conversation-members"),
    path("conversations/<uuid:pk>/members/<int:user_id>/", views.ConversationMemberDetailView.as_view(), name="conversation-member-detail"),

    # Channels
    path("conversations/<uuid:pk>/channels/", views.ChannelListCreateView.as_view(), name="conversation-channels"),

    # Messages
    path("conversations/<uuid:pk>/messages/", views.MessageListCreateView.as_view(), name="conversation-messages"),
    path("messages/<uuid:pk>/", views.MessageDetailView.as_view(), name="message-detail"),
    path("messages/<uuid:pk>/thread/", views.MessageThreadView.as_view(), name="message-thread"),
    path("messages/<uuid:pk>/reactions/", views.MessageReactionView.as_view(), name="message-reactions"),
    path("messages/<uuid:pk>/reactions/<uuid:reaction_id>/", views.MessageReactionDeleteView.as_view(), name="message-reaction-delete"),
    path("messages/<uuid:pk>/read/", views.MessageReadView.as_view(), name="message-read"),

    # Attachments
    path("attachments/upload-init/", views.AttachmentUploadView.as_view(), name="attachment-upload"),
    path("attachments/<uuid:pk>/download/", views.AttachmentDownloadView.as_view(), name="attachment-download"),

    # Announcements
    path("announcements/", views.AnnouncementListCreateView.as_view(), name="announcement-list-create"),
    path("announcements/<uuid:pk>/acknowledge/", views.AnnouncementAcknowledgeView.as_view(), name="announcement-acknowledge"),

    # Cross-System Entity Search & Preview
    path("entities/search/", views.EntitySearchView.as_view(), name="entity-search"),
    path("entities/preview/<str:entity_type>/<str:entity_id>/", views.EntityPreviewView.as_view(), name="entity-preview"),

    # Search
    path("search/messages/", views.SearchMessagesView.as_view(), name="search-messages"),

    # Department Sync
    path("sync/department/<int:division_id>/", views.DepartmentSyncView.as_view(), name="sync-department"),
]
