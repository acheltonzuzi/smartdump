"""
SmartDebugger server.

Endpoints:
  POST /dump        — receive a dump from the client library
  GET  /dumps       — return all stored dumps (newest first)
  GET  /dumps/clear — clear all stored dumps
  WS   /ws          — real-time WebSocket feed for the UI
  GET  /            — serve the web UI
  GET  /health      — health check
"""

import json
from collections import deque
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .manager import ConnectionManager

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="SmartDebugger Server", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store — keep the 200 most recent dumps
MAX_DUMPS = 200
_dumps: deque[dict] = deque(maxlen=MAX_DUMPS)

manager = ConnectionManager()

STATIC_DIR = Path(__file__).parent.parent / "static"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "clients": manager.client_count, "dumps": len(_dumps)}


@app.post("/dump")
async def receive_dump(payload: dict) -> dict:
    """Accept a dump from the client library and broadcast it to all UI tabs."""
    _dumps.appendleft(payload)
    await manager.broadcast({"event": "dump", "payload": payload})
    return {"ok": True}


@app.get("/dumps")
async def get_dumps() -> list:
    """Return all stored dumps, newest first."""
    return list(_dumps)


@app.delete("/dumps")
async def clear_dumps() -> dict:
    """Clear all stored dumps and notify connected clients."""
    _dumps.clear()
    await manager.broadcast({"event": "clear"})
    return {"ok": True}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            # Keep connection alive; client doesn't need to send anything
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.get("/")
async def serve_ui() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


# Mount static files (JS, CSS) under /static
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
