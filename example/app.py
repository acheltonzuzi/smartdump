"""
Example FastAPI application showing SmartDebugger usage.

Run the debugger server first:
    python run.py

Then run this app:
    uvicorn example.app:app --port 8000 --reload

Then open http://localhost:8765 in your browser and hit these routes:
    GET  http://localhost:8000/
    GET  http://localhost:8000/users/42
    GET  http://localhost:8000/error
    POST http://localhost:8000/items  body: {"name": "widget", "price": 9.99}
"""

from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from smartdump import sd

app = FastAPI()


# ── Example 1: simple dict dump ─────────────────────────────────────────────

@app.get("/")
async def root():
    config = {
        "app": "SmartDebugger Demo",
        "version": "1.0.0",
        "debug": True,
        "features": ["websocket", "json-viewer", "dark-mode"],
        "started_at": datetime.now().isoformat(),
    }
    sd(config, label="app config")
    return {"message": "Hello! Check the SmartDebugger UI."}


# ── Example 2: nested object dump ───────────────────────────────────────────

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    user = {
        "id": user_id,
        "name": "Jane Doe",
        "email": "jane@example.com",
        "roles": ["admin", "editor"],
        "address": {
            "city": "San Francisco",
            "country": "US",
            "zip": "94102",
        },
        "created_at": "2024-01-15T09:00:00Z",
    }
    sd(user, label=f"user:{user_id}")
    sd("Achelton Pambo",label='Author')
    return user


# ── Example 3: exception dump ────────────────────────────────────────────────

@app.get("/error")
async def trigger_error():
    try:
        result = 1 / 0
    except ZeroDivisionError as exc:
        sd(exc, label="caught exception", level="error")
        raise HTTPException(status_code=500, detail="Division by zero (check the debugger!)")


# ── Example 4: Pydantic model dump ──────────────────────────────────────────

class Item(BaseModel):
    name: str
    price: float
    in_stock: bool = True


@app.post("/items")
async def create_item(item: Item):
    sd(item, label="incoming item", level="debug")

    processed = {
        "id": 101,
        "name": item.name.upper(),
        "price_with_tax": round(item.price * 1.1, 2),
        "in_stock": item.in_stock,
    }
    sd(processed, label="processed item")
    return processed


# ── Example 5: list dump + chaining ─────────────────────────────────────────

@app.get("/products")
async def list_products():
    products = [
        {"id": i, "name": f"Product {i}", "price": i * 9.99}
        for i in range(1, 6)
    ]
    # sd() returns the value unchanged — great for inline use
    return sd(products, label="product list")
