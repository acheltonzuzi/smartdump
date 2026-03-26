"""
WebSocket connection manager.
Keeps track of every connected browser tab and broadcasts payloads to all.
"""

import asyncio
import json
from typing import Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def broadcast(self, payload: dict) -> None:
        """Send *payload* to every connected client, removing dead connections."""
        if not self._clients:
            return

        message = json.dumps(payload)
        dead: list[WebSocket] = []

        for client in list(self._clients):
            try:
                await client.send_text(message)
            except Exception:
                dead.append(client)

        for ws in dead:
            self._clients.discard(ws)

    @property
    def client_count(self) -> int:
        return len(self._clients)
