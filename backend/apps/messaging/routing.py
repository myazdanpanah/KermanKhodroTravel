from django.urls import re_path
from apps.messaging.consumers.conversation_consumer import ConversationConsumer

websocket_urlpatterns = [
    re_path(r"^ws/messaging/?$", ConversationConsumer.as_asgi()),
]
