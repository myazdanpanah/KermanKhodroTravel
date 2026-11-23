from django.test import TransactionTestCase, override_settings
from django.contrib.auth import get_user_model
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from apps.accounts.models import Company
from apps.messaging.consumers.conversation_consumer import ConversationConsumer
from apps.messaging.services.conversation_service import get_or_create_direct_conversation

User = get_user_model()


@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
)
class RealtimeMessagingTests(TransactionTestCase):
    def setUp(self):
        self.company = Company.objects.create(name="Realtime Company")
        self.user1 = User.objects.create_user(
            username="rt_user1",
            password="password",
            company=self.company,
        )
        self.user2 = User.objects.create_user(
            username="rt_user2",
            password="password",
            company=self.company,
        )

    async def test_websocket_connect_and_subscribe(self):
        conv, _ = await database_sync_to_async(get_or_create_direct_conversation)(
            self.company.id, self.user1, self.user2
        )

        communicator = WebsocketCommunicator(ConversationConsumer.as_asgi(), "/ws/messaging/")
        communicator.scope["user"] = self.user1

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Subscribe to conversation
        await communicator.send_json_to({
            "type": "conversation.subscribe",
            "conversation_id": str(conv.id),
        })

        # Send heartbeat
        await communicator.send_json_to({
            "type": "presence.heartbeat",
        })

        await communicator.disconnect()
