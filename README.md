# SmartDump

[![PyPI version](https://badge.fury.io/py/smartdump.svg)](https://badge.fury.io/py/smartdump)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

Real-time variable dump viewer for FastAPI — inspired by [Laradumps](https://laradumps.dev).

Call `sd(variable)` anywhere in your FastAPI app and see it appear instantly in the browser.

---

## Installation

```bash
pip install smartdump
```

---

## Quick start

### 1. Start the debug server

```bash
smartdump start
```

Open **http://localhost:8765** in your browser.

### 2. Use `sd()` in your FastAPI app

```python
from smartdump import sd

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    user = db.get_user(user_id)
    sd(user, label="user from DB")   # dumps to the UI, non-blocking
    return user
```

Every dump appears instantly in the browser with the file, line number, and function name.

---

## `sd()` reference

```python
sd(data, label=None, level="info")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data`    | any  | —       | Any Python value to inspect |
| `label`   | str  | `None`  | Human-readable name shown in the UI |
| `level`   | str  | `"info"`| One of `info`, `debug`, `warning`, `error` |

**Returns** `data` unchanged — safe to use inline:

```python
return sd(result, "final result")
```

### Configuration

```python
from client import configure

configure(
    server_url="http://localhost:8765",  # default
    timeout=1.0,                         # seconds — kept short
    enabled=True,                        # set False in production
)
```

---

## UI features

- Real-time WebSocket feed
- Collapsible JSON tree viewer (auto-collapses at depth 3)
- Level badges: `info` / `debug` / `warning` / `error`
- Filter by level and free-text search (label, file, value)
- Sort newest / oldest
- Copy-to-clipboard button
- File + line number + function name for every dump
- Dark mode by default

---

## How it works

```
FastAPI app          SmartDump server            Browser
    │                        │                      │
    │  sd(data)              │                      │
    │─── POST /dump ────────>│                      │
    │   (daemon thread)      │── WS broadcast ─────>│
    │                        │                      │ (live update)
    │  (request continues)   │                      │
```

1. `sd()` captures the caller's file/line/function via `inspect`.
2. It serialises the value and fires a POST request on a **daemon thread** — completely non-blocking.
3. The server stores the dump in a `deque(maxlen=200)` and broadcasts it to all connected WebSocket clients.
4. The browser receives the payload and renders it as a collapsible JSON tree.

If the server is not running, `sd()` silently does nothing — it never crashes your app.

---

## Disabling in production

```python
import os
from client import configure

configure(enabled=os.getenv("DEBUG", "false").lower() == "true")
```

---

## Project structure

```
smartdump/
├── client/          # Python client library — the sd() function
├── server/          # FastAPI dump server (port 8765)
├── static/          # Web UI (vanilla JS, no build step)
├── example/         # Demo FastAPI app
└── run.py           # Server launcher (also registered as `smartdump` CLI)
```

---

## Contributing

Contributions are welcome! This is an open source project.

1. Fork the repository: [https://github.com/achelton/smartdump](https://github.com/achelton/smartdump)
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and commit: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

### Development setup

```bash
git clone https://github.com/achelton/smartdump.git
cd smartdump
pip install -e ".[dev]"
pytest
```

---

## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

## Links

- **PyPI**: [https://pypi.org/project/smartdump/](https://pypi.org/project/smartdump/)
- **GitHub**: [https://github.com/achelton/smartdump](https://github.com/achelton/smartdump)
- **Issues**: [https://github.com/achelton/smartdump/issues](https://github.com/achelton/smartdump/issues)

---

Made with ❤️ by [achelton](https://github.com/achelton)
