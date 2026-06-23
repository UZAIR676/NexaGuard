"""
NexaGuard — Alerts System
Logs: login events, failed logins, transactions, role changes, CSV scans
Admin sees all, user sees only their own alerts.
"""
from fastapi import APIRouter, HTTPException
import sqlite3, os, json
from datetime import datetime
from routes.auth import get_user_by_token, get_db, DB

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# ── Init alerts table ──────────────────────────────────────────────────────
def init_alerts_table():
    con = sqlite3.connect(DB)
    con.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER,
            user_email TEXT,
            type       TEXT NOT NULL,
            category   TEXT NOT NULL,
            message    TEXT NOT NULL,
            meta       TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    con.commit()
    con.close()

init_alerts_table()

# ── Helper: create alert (called from other routes) ────────────────────────
def create_alert(user_id: int, user_email: str, type: str, category: str, message: str, meta: dict = {}):
    """
    type     : "high" | "medium" | "info" | "success"
    category : "login" | "transaction" | "user_activity" | "system" | "account"
    """
    try:
        con = sqlite3.connect(DB)
        con.execute("""
            INSERT INTO alerts (user_id, user_email, type, category, message, meta)
            VALUES (?,?,?,?,?,?)
        """, (user_id, user_email, type, category, message, json.dumps(meta)))
        con.commit()
        con.close()
    except Exception as e:
        print(f"[Alert] Failed to create alert: {e}")

# ── GET /api/alerts ────────────────────────────────────────────────────────
@router.get("")
def get_alerts(token: str, limit: int = 50):
    user = get_user_by_token(token)
    con  = get_db()

    if user["role"] in ["admin", "analyst"]:
        # Admin/analyst sees ALL alerts
        rows = con.execute("""
            SELECT id, user_id, user_email, type, category, message, meta, created_at
            FROM alerts ORDER BY created_at DESC LIMIT ?
        """, (limit,)).fetchall()
    else:
        # Regular user sees only their own alerts
        rows = con.execute("""
            SELECT id, user_id, user_email, type, category, message, meta, created_at
            FROM alerts WHERE user_id=?
            ORDER BY created_at DESC LIMIT ?
        """, (user["id"], limit)).fetchall()

    con.close()
    return [_row_to_dict(r) for r in rows]

# ── GET /api/alerts/unread-count ───────────────────────────────────────────
@router.get("/unread-count")
def unread_count(token: str):
    user = get_user_by_token(token)
    con  = get_db()
    if user["role"] in ["admin", "analyst"]:
        count = con.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
    else:
        count = con.execute("SELECT COUNT(*) FROM alerts WHERE user_id=?", (user["id"],)).fetchone()[0]
    con.close()
    return {"count": count}

def _row_to_dict(r):
    return {
        "id":         r[0],
        "user_id":    r[1],
        "user_email": r[2],
        "type":       r[3],
        "category":   r[4],
        "message":    r[5],
        "meta":       json.loads(r[6]) if r[6] else {},
        "created_at": r[7],
    }