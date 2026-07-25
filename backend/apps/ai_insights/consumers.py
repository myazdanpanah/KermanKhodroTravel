"""
WebSocket Consumer for Real-time Anomaly Alerts (Phase 20)

Receives anomaly alerts pushed from the server when new anomalies are detected.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer


class AnomalyAlertConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer that pushes anomaly alerts to connected clients."""

    async def connect(self):
        self.company_id = self.scope['url_route']['kwargs'].get('company_id')

        # Authenticate: reject anonymous or company-mismatched connections
        user = self.scope.get('user')
        if not user or not getattr(user, 'company_id', None):
            await self.close(code=4001)
            return
        if str(user.company_id) != str(self.company_id):
            await self.close(code=4003)
            return

        self.group_name = f'anomaly_alerts_company_{self.company_id}'

        # Join the company-specific group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name,
        )

    async def receive(self, text_data):
        """Handle incoming messages from client (e.g. ping/pong)."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
        if data.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    async def anomaly_alert(self, event):
        """Handle anomaly_alert events pushed from the group."""
        await self.send(text_data=json.dumps({
            'type': 'anomaly_alert',
            'alert_id': event.get('alert_id'),
            'title': event.get('title'),
            'message': event.get('message'),
            'severity': event.get('severity'),
            'module': event.get('module'),
            'timestamp': event.get('timestamp'),
        }))
