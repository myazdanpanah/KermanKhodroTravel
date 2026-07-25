"""
ASGI config for Nexivo project.

Supports HTTP and WebSocket protocols via Django Channels.
"""
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nexivo.settings")

# Initialize Django before importing routing
django_asgi_app = get_asgi_application()

try:
    from channels.auth import AuthMiddlewareStack
    from channels.routing import ProtocolTypeRouter, URLRouter
    from apps.ai_insights.routing import websocket_urlpatterns
    _ws_urlpatterns = websocket_urlpatterns
except ImportError:
    _ws_urlpatterns = []

if _ws_urlpatterns:
    application = ProtocolTypeRouter({
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(
            URLRouter(_ws_urlpatterns)
        ),
    })
else:
    application = django_asgi_app
