from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import psycopg2, psycopg2.extras, os, secrets, json
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/settings", tags=["settings"])


def get_db():
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", 5432)),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        sslmode="require",
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


DEFAULT_PREFS = {
    "notif": {"fraud": True, "email": True, "weekly": False, "lowBalance": True},
    "theme": "dark",
    "accent": "#4F8EF7",
    "language": "en",
    "currency": "USD",
}


def init_settings_table():
    con = get_db()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            preferences    JSONB   NOT NULL DEFAULT '{}',
            two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at     TIMESTAMP DEFAULT NOW()
        )
    """)
    # Lets "Active sessions" show something real without a full multi-session
    # system. Populated by routes/auth.py's login() — see the patch notes.
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP")
    con.commit()
    cur.close()
    con.close()


init_settings_table()


def get_user_by_token(token):
    con = get_db()
    cur = con.cursor()
    cur.execute(
        "SELECT id, email, last_login_ip, last_login_device, last_login_at FROM users WHERE token=%s",
        (token,)
    )
    row = cur.fetchone()
    cur.close()
    con.close()
    if not row:
        raise HTTPException(401, "Invalid token")
    return row


def _merge_defaults(stored):
    merged = json.loads(json.dumps(DEFAULT_PREFS))  # deep copy
    for k, v in (stored or {}).items():
        if isinstance(v, dict) and isinstance(merged.get(k), dict):
            merged[k].update(v)
        else:
            merged[k] = v
    return merged


def _load_or_create(user_id):
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT preferences, two_fa_enabled FROM user_settings WHERE user_id=%s", (user_id,))
    row = cur.fetchone()
    if not row:
        cur.execute(
            "INSERT INTO user_settings (user_id, preferences, two_fa_enabled) "
            "VALUES (%s,%s,%s) RETURNING preferences, two_fa_enabled",
            (user_id, json.dumps(DEFAULT_PREFS), False)
        )
        row = cur.fetchone()
        con.commit()
    cur.close()
    con.close()
    return row


@router.get("")
def get_settings(token: str):
    user = get_user_by_token(token)
    row = _load_or_create(user["id"])
    return {
        "preferences": _merge_defaults(row["preferences"]),
        "two_fa_enabled": row["two_fa_enabled"],
    }


class UpdateSettingsIn(BaseModel):
    token: str
    preferences: dict


@router.post("")
def update_settings(body: UpdateSettingsIn):
    user = get_user_by_token(body.token)
    row = _load_or_create(user["id"])
    current = row["preferences"] or {}
    for k, v in body.preferences.items():
        if isinstance(v, dict) and isinstance(current.get(k), dict):
            current[k].update(v)
        else:
            current[k] = v

    con = get_db()
    cur = con.cursor()
    cur.execute(
        "UPDATE user_settings SET preferences=%s, updated_at=NOW() WHERE user_id=%s",
        (json.dumps(current), user["id"])
    )
    con.commit()
    cur.close()
    con.close()
    return {"success": True, "preferences": _merge_defaults(current)}


class TwoFAIn(BaseModel):
    token: str
    enabled: bool


@router.post("/2fa")
def set_two_fa(body: TwoFAIn):
    user = get_user_by_token(body.token)
    _load_or_create(user["id"])
    con = get_db()
    cur = con.cursor()
    cur.execute(
        "UPDATE user_settings SET two_fa_enabled=%s, updated_at=NOW() WHERE user_id=%s",
        (body.enabled, user["id"])
    )
    con.commit()
    cur.close()
    con.close()
    return {"success": True, "two_fa_enabled": body.enabled}


@router.get("/sessions")
def get_sessions(token: str):
    """
    NexaGuard's auth model stores exactly one *active* token per user (see
    routes/auth.py — login() overwrites it, and sign-out-others rotates it),
    so there's never more than one valid session at a time. What this returns
    is real: the last 5 logins from `login_history`, with the most recent one
    (the one matching the current token) flagged as the active session.
    """
    user = get_user_by_token(token)
    con = get_db()
    cur = con.cursor()
    cur.execute("""
        SELECT device, ip, city, country, created_at
        FROM login_history WHERE user_id=%s
        ORDER BY created_at DESC LIMIT 5
    """, (user["id"],))
    rows = cur.fetchall()
    cur.close()
    con.close()

    def fmt_location(r):
        parts = [p for p in [r["city"], r["country"]] if p]
        return ", ".join(parts) if parts else (r["ip"] or "Unknown location")

    if not rows:
        return {"sessions": [{"device": "This device", "location": "Current session", "current": True}]}

    return {
        "sessions": [{
            "device": r["device"] or "Unknown device",
            "location": fmt_location(r),
            "last_seen": str(r["created_at"]) if r["created_at"] else None,
            "current": i == 0,
        } for i, r in enumerate(rows)]
    }


class SignOutOthersIn(BaseModel):
    token: str


@router.post("/sign-out-others")
def sign_out_others(body: SignOutOthersIn):
    """
    Rotates the user's token. Since only one token is valid at a time, this
    naturally invalidates any other copy of it in the wild (old tab, stolen
    token, etc.) — the caller stays logged in because we hand back the new
    token for the frontend to store immediately.
    """
    user = get_user_by_token(body.token)
    new_token = secrets.token_hex(32)
    con = get_db()
    cur = con.cursor()
    cur.execute("UPDATE users SET token=%s WHERE id=%s", (new_token, user["id"]))
    con.commit()
    cur.close()
    con.close()
    return {"success": True, "token": new_token}