import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from apps.messaging.models import ConversationMembership
from apps.messaging.services.presence_service import (
    update_user_presence,
    set_user_typing,
)

logger = logging.getLogger(__name__)


class ConversationConsumer(AsyncWebsocketConsumer):
    """Realtime WebSocket consumer for conversations, presence, and typing indicators."""

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated or not getattr(user, "company_id", None):
            await self.close(code=4003)
            return

        self.user = user
        self.company_id = user.company_id
        self.user_group = f"messaging_user_{user.id}"
        self.company_group = f"messaging_company_{self.company_id}"
        self.subscribed_conversations = set()

        await self.accept()

        if self.channel_layer:
            # Join individual user group and company group
            await self.channel_layer.group_add(self.user_group, self.channel_name)
            await self.channel_layer.group_add(self.company_group, self.channel_name)

        # Mark user online
        try:
            await database_sync_to_async(update_user_presence)(self.company_id, user.id, "online")
        except Exception:
            pass

        # Broadcast presence
        now_iso = timezone.now().isoformat()
        if self.channel_layer:
            await self.channel_layer.group_send(
                self.company_group,
                {
                    "type": "messaging_event",
                    "event": {
                        "type": "presence.updated",
                        "occurred_at": now_iso,
                        "payload": {
                            "user_id": user.id,
                            "status": "online",
                            "last_seen_at": now_iso,
                        },
                    },
                },
            )

    async def disconnect(self, close_code):
        if hasattr(self, "user") and self.user.is_authenticated:
            # Leave user and company groups
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
            await self.channel_layer.group_discard(self.company_group, self.channel_name)

            # Leave all subscribed conversation groups
            for conv_id in self.subscribed_conversations:
                group_name = f"messaging_conv_{conv_id}"
                await self.channel_layer.group_discard(group_name, self.channel_name)

            # Mark user offline
            await database_sync_to_async(update_user_presence)(self.company_id, self.user.id, "offline")

            now_iso = timezone.now().isoformat()
            await self.channel_layer.group_send(
                self.company_group,
                {
                    "type": "messaging_event",
                    "event": {
                        "type": "presence.updated",
                        "occurred_at": now_iso,
                        "payload": {
                            "user_id": self.user.id,
                            "status": "offline",
                            "last_seen_at": now_iso,
                        },
                    },
                },
            )

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            data = json.loads(text_data)
        except Exception:
            return

        event_type = data.get("type")

        if event_type == "conversation.subscribe":
            conv_id = data.get("conversation_id")
            if conv_id and await self._can_access_conversation(conv_id):
                group_name = f"messaging_conv_{conv_id}"
                await self.channel_layer.group_add(group_name, self.channel_name)
                self.subscribed_conversations.add(str(conv_id))

        elif event_type == "conversation.unsubscribe":
            conv_id = data.get("conversation_id")
            if conv_id and str(conv_id) in self.subscribed_conversations:
                group_name = f"messaging_conv_{conv_id}"
                await self.channel_layer.group_discard(group_name, self.channel_name)
                self.subscribed_conversations.discard(str(conv_id))

        elif event_type == "typing.start":
            conv_id = data.get("conversation_id")
            if conv_id and str(conv_id) in self.subscribed_conversations:
                await database_sync_to_async(set_user_typing)(self.company_id, str(conv_id), self.user.id, True)
                group_name = f"messaging_conv_{conv_id}"
                await self.channel_layer.group_send(
                    group_name,
                    {
                        "type": "messaging_event",
                        "event": {
                            "type": "typing.started",
                            "occurred_at": timezone.now().isoformat(),
                            "payload": {
                                "conversation_id": str(conv_id),
                                "user_id": self.user.id,
                                "username": self.user.username,
                            },
                        },
                    },
                )

        elif event_type == "typing.stop":
            conv_id = data.get("conversation_id")
            if conv_id and str(conv_id) in self.subscribed_conversations:
                await database_sync_to_async(set_user_typing)(self.company_id, str(conv_id), self.user.id, False)
                group_name = f"messaging_conv_{conv_id}"
                await self.channel_layer.group_send(
                    group_name,
                    {
                        "type": "messaging_event",
                        "event": {
                            "type": "typing.stopped",
                            "occurred_at": timezone.now().isoformat(),
                            "payload": {
                                "conversation_id": str(conv_id),
                                "user_id": self.user.id,
                            },
                        },
                    },
                )

        elif event_type == "presence.heartbeat":
            await database_sync_to_async(update_user_presence)(self.company_id, self.user.id, "online")

    async def messaging_event(self, event):
        """Receive broadcast event from channel layer and forward to client."""
        await self.send(text_data=json.dumps(event["event"]))

    @database_sync_to_async
    def _can_access_conversation(self, conv_id):
        return ConversationMembership.objects.filter(
            conversation_id=conv_id,
            company_id=self.company_id,
            user=self.user,
            state="ACTIVE",
        ).exists()
