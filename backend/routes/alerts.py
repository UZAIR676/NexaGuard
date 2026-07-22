"""
NexaGuard — Alerts System
"""
from fastapi import APIRouter, HTTPException
import json
from datetime import datetime

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# ── Init alerts table ──────────────────────────────────────────────────────
def init_alerts_table():
    from routes.auth import get_db
    con = get_db()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER,
            user_email TEXT,
            type       TEXT NOT NULL,
            category   TEXT NOT NULL,
            message    TEXT NOT NULL,
            meta       TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    con.commit()
    cur.close()
    con.close()

init_alerts_table()

# ── Helper: create alert (called from other routes) ────────────────────────
def create_alert(user_id: int, user_email: str, type: str, category: str, message: str, meta: dict = {}):
    from routes.auth import get_db
    try:
        con = get_db()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO alerts (user_id, user_email, type, category, message, meta)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (user_id, user_email, type, category, message, json.dumps(meta)))
        con.commit()
        cur.close()
        con.close()
    except Exception as e:
        print(f"[Alert] Failed to create alert: {e}")

# ── GET /api/alerts ────────────────────────────────────────────────────────
@router.get("")
def get_alerts(token: str, limit: int = 50):
    from routes.auth import get_user_by_token, get_db
    user = get_user_by_token(token)
    con  = get_db()
    cur  = con.cursor()

    if user["role"] in ["admin", "analyst"]:
        cur.execute("""
            SELECT id, user_id, user_email, type, category, message, meta, created_at
            FROM alerts ORDER BY created_at DESC LIMIT %s
        """, (limit,))
    else:
        cur.execute("""
            SELECT id, user_id, user_email, type, category, message, meta, created_at
            FROM alerts WHERE user_id=%s
            ORDER BY created_at DESC LIMIT %s
        """, (user["id"], limit))

    rows = cur.fetchall()
    cur.close()
    con.close()
    return [_row_to_dict(r) for r in rows]

# ── GET /api/alerts/unread-count ───────────────────────────────────────────
@router.get("/unread-count")
def unread_count(token: str):
    from routes.auth import get_user_by_token, get_db
    user = get_user_by_token(token)
    con  = get_db()
    cur  = con.cursor()

    if user["role"] in ["admin", "analyst"]:
        cur.execute("SELECT COUNT(*) as cnt FROM alerts")
    else:
        cur.execute("SELECT COUNT(*) as cnt FROM alerts WHERE user_id=%s", (user["id"],))

    count = cur.fetchone()["cnt"]
    cur.close()
    con.close()
    return {"count": count}

def _row_to_dict(r):
    return {
        "id":         r["id"],
        "user_id":    r["user_id"],
        "user_email": r["user_email"],
        "type":       r["type"],
        "category":   r["category"],
        "message":    r["message"],
        "meta":       json.loads(r["meta"]) if r["meta"] else {},
        "created_at": str(r["created_at"]),
    }