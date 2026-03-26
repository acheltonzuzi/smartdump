"""
SmartDebugger client — sd() function.

Usage:
    from smartdump import sd

    sd(my_var)
    sd(my_var, label="user object")
    sd(my_var, label="error", level="error")

Works in both sync and async FastAPI routes. Non-blocking.
"""
import inspect
import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_config = {
    "server_url": "http://localhost:8765",
    "timeout": 1.0,   # seconds — kept short so it never blocks
    "enabled": True,
}

def configure(
    server_url: str = "http://localhost:8765",
    timeout: float = 1.0,
    enabled: bool = True,
) -> None:
    """Override default sd() configuration."""
    _config["server_url"] = server_url.rstrip("/")
    _config["timeout"] = timeout
    _config["enabled"] = enabled

# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------

def _safe_serialize(obj: Any) -> Any:
    """
    Recursively convert an arbitrary Python object into something JSON-safe.
    Falls back to repr() for unrecognised types.
    """
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj

    if isinstance(obj, dict):
        return {str(k): _safe_serialize(v) for k, v in obj.items()}

    if isinstance(obj, (list, tuple, set, frozenset)):
        return [_safe_serialize(item) for item in obj]

    if isinstance(obj, bytes):
        try:
            return obj.decode("utf-8")
        except UnicodeDecodeError:
            return obj.hex()

    if isinstance(obj, datetime):
        return obj.isoformat()

    if isinstance(obj, BaseException):
        return {
            "__exception__": type(obj).__name__,
            "message": str(obj),
            "args": [_safe_serialize(a) for a in obj.args],
        }

    # Dataclasses, Pydantic models, plain objects
    if hasattr(obj, "__dict__"):
        return {
            "__type__": type(obj).__qualname__,
            **{k: _safe_serialize(v) for k, v in obj.__dict__.items()
               if not k.startswith("_")},
        }

    # Anything else → safe string
    return repr(obj)


def _build_payload(
    data: Any,
    label: Optional[str],
    level: str,
    caller_frame,
) -> dict:
    filename = caller_frame.f_code.co_filename
    return {
        "id": str(uuid.uuid4()),
        "label": label,
        "level": level,
        "type": type(data).__name__,
        "data": _safe_serialize(data),
        "meta": {
            "file": filename,
            "line": caller_frame.f_lineno,
            "function": caller_frame.f_code.co_name,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Background sender (daemon thread → never blocks the request lifecycle)
# ---------------------------------------------------------------------------

def _send_to_server(payload: dict) -> None:
    try:
        requests.post(
            f"{_config['server_url']}/dump",
            json=payload,
            timeout=_config["timeout"],
        )
    except Exception:
        # Silently ignore — server may not be running; never crash the app
        pass


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def sd(
    data: Any,
    label: Optional[str] = None,
    level: str = "info",
) -> Any:
    """
    SmartDebugger — send *data* to the SmartDebugger viewer.

    Args:
        data:   Any Python value to inspect.
        label:  Optional human-readable label shown in the UI.
        level:  One of "info" | "debug" | "warning" | "error".

    Returns:
        *data* unchanged, so you can inline the call:
        ``return sd(result, "final result")``
    """
    if not _config["enabled"]:
        return data

    # Capture the caller's frame *before* spawning a thread
    caller_frame = inspect.currentframe().f_back
    payload = _build_payload(data, label, level, caller_frame)

    # Fire-and-forget on a daemon thread — works in sync and async contexts
    threading.Thread(target=_send_to_server, args=(payload,), daemon=True).start()

    return data
