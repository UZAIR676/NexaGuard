from fastapi import APIRouter, HTTPException
import sqlite3, hashlib, os, secrets
from datetime import datetime, timedelta
from schemas import SignupIn, LoginIn, UpdateIn
from schemas_bank import TransactionIn, RoleUpdateIn
from email_service import send_email, generate_otp, otp_email, transaction_email, welcome_email
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])
DB = os.path.join(os.path.dirname(__file__), "..", "nexaguard.db")

# ── DB Setup ───────────────────────────────────────────────────────────────
def init_db():
    con = sqlite3.connect(DB)
    con.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            email      TEXT    UNIQUE NOT NULL,
            password   TEXT    NOT NULL,
            token      TEXT,
            role       TEXT    DEFAULT 'user',
            balance    REAL    DEFAULT 10000.00,
            verified   INTEGER DEFAULT 0,
            created_at TEXT    DEFAULT (datetime('now'))
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            type        TEXT    NOT NULL,
            amount      REAL    NOT NULL,
            to_email    TEXT,
            description TEXT,
            status      TEXT    DEFAULT 'completed',
            fraud_score REAL    DEFAULT 0,
            created_at  TEXT    DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS otp_codes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT    NOT NULL,
            otp        TEXT    NOT NULL,
            expires_at TEXT    NOT NULL,
            used       INTEGER DEFAULT 0
        )
    """)
    existing = con.execute("SELECT id FROM users WHERE email='admin@nexaguard.ai'").fetchone()
    if not existing:
        con.execute(
            "INSERT INTO users (name, email, password, role, balance, verified) VALUES (?,?,?,?,?,?)",
            ("Admin", "admin@nexaguard.ai", hashlib.sha256("admin123".encode()).hexdigest(), "admin", 999999.00, 1)
        )
    con.commit()
    con.close()

init_db()

def hash_pw(pw):  return hashlib.sha256(pw.encode()).hexdigest()
def get_db():     return sqlite3.connect(DB)

def get_user_by_token(token):
    con = get_db()
    row = con.execute("SELECT id,name,email,role,balance FROM users WHERE token=?", (token,)).fetchone()
    con.close()
    if not row: raise HTTPException(401, "Invalid token")
    return {"id": row[0], "name": row[1], "email": row[2], "role": row[3], "balance": row[4]}

# ── OTP Schema ─────────────────────────────────────────────────────────────
class OTPVerifyIn(BaseModel):
    email: str
    otp: str

class ResendOTPIn(BaseModel):
    email: str

# ── Auth ───────────────────────────────────────────────────────────────────
@router.post("/signup")
def signup(body: SignupIn):
    con = get_db()
    try:
        # Check email exists
        existing = con.execute("SELECT id, verified FROM users WHERE email=?", (body.email.lower().strip(),)).fetchone()
        if existing:
            if existing[1] == 0:
                raise HTTPException(400, "Email registered but not verified. Check your email for OTP.")
            raise HTTPException(400, "Email already registered")

        token = secrets.token_hex(32)
        con.execute(
            "INSERT INTO users (name, email, password, token, role, verified) VALUES (?,?,?,?,?,?)",
            (body.name.strip(), body.email.lower().strip(), hash_pw(body.password), token, "user", 0)
        )
        con.commit()

        # Generate & send OTP
        otp = generate_otp()
        expires = (datetime.now() + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
        con.execute("INSERT INTO otp_codes (email, otp, expires_at) VALUES (?,?,?)",
                    (body.email.lower().strip(), otp, expires))
        con.commit()
        send_email(body.email, "NexaGuard — Verify Your Email", otp_email(body.name, otp))

        return {"message": "OTP sent to your email", "email": body.email.lower().strip()}
    finally:
        con.close()

@router.post("/verify-otp")
def verify_otp(body: OTPVerifyIn):
    con = get_db()
    try:
        row = con.execute("""
            SELECT id, otp, expires_at, used FROM otp_codes
            WHERE email=? ORDER BY id DESC LIMIT 1
        """, (body.email.lower(),)).fetchone()

        if not row:
            raise HTTPException(400, "No OTP found. Please signup again.")
        if row[3] == 1:
            raise HTTPException(400, "OTP already used.")
        if datetime.now() > datetime.strptime(row[2], "%Y-%m-%d %H:%M:%S"):
            raise HTTPException(400, "OTP expired. Request a new one.")
        if row[1] != body.otp:
            raise HTTPException(400, "Invalid OTP.")

        # Mark OTP used + activate user
        con.execute("UPDATE otp_codes SET used=1 WHERE id=?", (row[0],))
        con.execute("UPDATE users SET verified=1 WHERE email=?", (body.email.lower(),))
        con.commit()

        # Return user + token
        user = con.execute("SELECT id,name,email,token,role,balance FROM users WHERE email=?", (body.email.lower(),)).fetchone()

        # Send welcome email
        send_email(body.email, "Welcome to NexaGuard! 🛡️", welcome_email(user[1]))

        return {"token": user[3], "user": {"id": user[0], "name": user[1], "email": user[2], "role": user[4], "balance": user[5]}}
    finally:
        con.close()

@router.post("/resend-otp")
def resend_otp(body: ResendOTPIn):
    con = get_db()
    try:
        user = con.execute("SELECT name, verified FROM users WHERE email=?", (body.email.lower(),)).fetchone()
        if not user:
            raise HTTPException(404, "Email not found")
        if user[1] == 1:
            raise HTTPException(400, "Email already verified")

        otp = generate_otp()
        expires = (datetime.now() + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
        con.execute("INSERT INTO otp_codes (email, otp, expires_at) VALUES (?,?,?)", (body.email.lower(), otp, expires))
        con.commit()
        send_email(body.email, "NexaGuard — New OTP", otp_email(user[0], otp))
        return {"message": "New OTP sent"}
    finally:
        con.close()

@router.post("/login")
def login(body: LoginIn):
    con = get_db()
    try:
        row = con.execute("SELECT id,name,email,password,role,balance,verified FROM users WHERE email=?", (body.email.lower().strip(),)).fetchone()
        if not row or row[3] != hash_pw(body.password):
            raise HTTPException(401, "Invalid email or password")
        if row[6] == 0:
            raise HTTPException(403, "Email not verified. Check your inbox for OTP.")
        token = secrets.token_hex(32)
        con.execute("UPDATE users SET token=? WHERE id=?", (token, row[0]))
        con.commit()
        return {"token": token, "user": {"id": row[0], "name": row[1], "email": row[2], "role": row[4], "balance": row[5]}}
    finally:
        con.close()

@router.get("/me")
def me(token: str):
    return get_user_by_token(token)

@router.post("/update")
def update_profile(body: UpdateIn):
    con = get_db()
    try:
        row = con.execute("SELECT id FROM users WHERE token=?", (body.token,)).fetchone()
        if not row: raise HTTPException(401, "Invalid token")
        con.execute("UPDATE users SET name=? WHERE id=?", (body.name.strip(), row[0]))
        con.commit()
        return {"success": True, "name": body.name.strip()}
    finally:
        con.close()

# ── Admin ──────────────────────────────────────────────────────────────────
@router.get("/admin/users")
def get_all_users(token: str):
    user = get_user_by_token(token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Access denied")
    con = get_db()
    rows = con.execute("SELECT id,name,email,role,balance,verified,created_at FROM users").fetchall()
    con.close()
    return [{"id":r[0],"name":r[1],"email":r[2],"role":r[3],"balance":r[4],"verified":r[5],"created_at":r[6]} for r in rows]

@router.post("/admin/role")
def update_role(body: RoleUpdateIn):
    user = get_user_by_token(body.token)
    if user["role"] != "admin":
        raise HTTPException(403, "Only admin can change roles")
    if body.role not in ["user", "analyst", "admin"]:
        raise HTTPException(400, "Invalid role")
    con = get_db()
    con.execute("UPDATE users SET role=? WHERE id=?", (body.role, body.user_id))
    con.commit()
    con.close()
    return {"success": True}

# ── Transactions ───────────────────────────────────────────────────────────
@router.post("/transaction")
def make_transaction(body: TransactionIn):
    user = get_user_by_token(body.token)
    con = get_db()
    try:
        if body.fraud_score > 70:
            con.execute(
                "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score) VALUES (?,?,?,?,?,?,?)",
                (user["id"], body.type, body.amount, body.to_email, body.description, "blocked", body.fraud_score)
            )
            con.commit()
            send_email(user["email"], "🚨 NexaGuard — Transaction Blocked",
                transaction_email(user["name"], body.type, body.amount, "blocked", user["balance"]))
            return {"success": False, "status": "blocked", "reason": "High fraud risk detected"}

        if body.type in ["send", "withdraw"]:
            if user["balance"] < body.amount:
                raise HTTPException(400, "Insufficient balance")
            con.execute("UPDATE users SET balance=balance-? WHERE id=?", (body.amount, user["id"]))
            if body.type == "send" and body.to_email:
                con.execute("UPDATE users SET balance=balance+? WHERE email=?", (body.amount, body.to_email.lower()))
        elif body.type in ["receive", "deposit"]:
            con.execute("UPDATE users SET balance=balance+? WHERE id=?", (body.amount, user["id"]))

        con.execute(
            "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score) VALUES (?,?,?,?,?,?,?)",
            (user["id"], body.type, body.amount, body.to_email, body.description, "completed", body.fraud_score)
        )
        con.commit()
        new_balance = con.execute("SELECT balance FROM users WHERE id=?", (user["id"],)).fetchone()[0]

        # Send transaction email
        send_email(user["email"], "✅ NexaGuard — Transaction Confirmed",
            transaction_email(user["name"], body.type, body.amount, "completed", new_balance))

        return {"success": True, "status": "completed", "new_balance": round(new_balance, 2)}
    finally:
        con.close()

@router.get("/transactions")
def get_transactions(token: str):
    user = get_user_by_token(token)
    con = get_db()
    if user["role"] in ["admin", "analyst"]:
        rows = con.execute("""
            SELECT t.id,u.name,u.email,t.type,t.amount,t.to_email,t.description,t.status,t.fraud_score,t.created_at
            FROM transactions t JOIN users u ON t.user_id=u.id
            ORDER BY t.created_at DESC LIMIT 100
        """).fetchall()
        return [{"id":r[0],"user":r[1],"email":r[2],"type":r[3],"amount":r[4],"to_email":r[5],"description":r[6],"status":r[7],"fraud_score":r[8],"created_at":r[9]} for r in rows]
    else:
        rows = con.execute("""
            SELECT id,type,amount,to_email,description,status,fraud_score,created_at
            FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 50
        """, (user["id"],)).fetchall()
        return [{"id":r[0],"type":r[1],"amount":r[2],"to_email":r[3],"description":r[4],"status":r[5],"fraud_score":r[6],"created_at":r[7]} for r in rows]