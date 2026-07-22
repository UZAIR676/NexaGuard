from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
import hashlib, os, secrets
from datetime import datetime, timedelta
from schemas import SignupIn, LoginIn, UpdateIn
from schemas_bank import TransactionIn, RoleUpdateIn
from fastapi import APIRouter, HTTPException, Request
from email_service import send_email, generate_otp, otp_email, transaction_email, welcome_email
from routes.banking_fraud import predict_banking_fraud
from pydantic import BaseModel
import geoip2.database
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from fastapi import Request

load_dotenv()

GEOIP_DB = os.path.join(os.path.dirname(__file__), "..", "geoip", "GeoLite2-City.mmdb")

# ── Daily Limits ───────────────────────────────────────────────────────────
DAILY_LIMIT_SEND_WITHDRAW = 5000
DAILY_LIMIT_DEPOSIT       = 10000

def get_ip_location(ip: str):
    try:
        with geoip2.database.Reader(GEOIP_DB) as reader:
            res = reader.city(ip)
            return {
                "country": res.country.iso_code,
                "city": res.city.name,
                "lat": float(res.location.latitude or 0),
                "lon": float(res.location.longitude or 0),
            }
    except Exception:
        return None

import math

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

router = APIRouter(prefix="/api/auth", tags=["auth"])

BACKEND_BASE_URL = os.environ.get("NEXAGUARD_BACKEND_URL", "http://localhost:8000")
CONFIRM_TOKEN_EXPIRY_MINUTES = 30

# ── DB (Supabase / PostgreSQL) ─────────────────────────────────────────────
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

def init_db():
    con = get_db()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          SERIAL PRIMARY KEY,
            name        TEXT    NOT NULL,
            email       TEXT    UNIQUE NOT NULL,
            password    TEXT    NOT NULL,
            token       TEXT,
            role        TEXT    DEFAULT 'user',
            balance     NUMERIC DEFAULT 0.00,
            verified    INTEGER DEFAULT 0,
            held        INTEGER DEFAULT 0,
            held_reason TEXT,
            created_at  TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id              SERIAL PRIMARY KEY,
            user_id         INTEGER NOT NULL REFERENCES users(id),
            type            TEXT    NOT NULL,
            amount          NUMERIC NOT NULL,
            to_email        TEXT,
            description     TEXT,
            status          TEXT    DEFAULT 'completed',
            fraud_score     NUMERIC DEFAULT 0,
            risk_level      TEXT    DEFAULT 'SAFE',
            is_fraud        BOOLEAN DEFAULT FALSE,
            ip              TEXT,
            confirm_token   TEXT,
            confirm_expires TIMESTAMP,
            created_at      TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS otp_codes (
            id         SERIAL PRIMARY KEY,
            email      TEXT      NOT NULL,
            otp        TEXT      NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used       INTEGER   DEFAULT 0,
            purpose    TEXT      DEFAULT 'signup'
        )
    """)
    # Safety net in case the table already existed without this column
    cur.execute("ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'signup'")
    con.commit()
    cur.close()
    con.close()

init_db()

def hash_pw(pw):  return hashlib.sha256(pw.encode()).hexdigest()

def get_user_by_token(token):
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT id,name,email,role,balance,held FROM users WHERE token=%s", (token,))
    row = cur.fetchone()
    cur.close(); con.close()
    if not row: raise HTTPException(401, "Invalid token")
    return {"id": row["id"], "name": row["name"], "email": row["email"],
            "role": row["role"], "balance": float(row["balance"]), "held": bool(row["held"])}

def confirm_transaction_email(name, txn_type, amount, confirm_link, expires_minutes):
    return f"""
    <div style="font-family:Arial,sans-serif;background:#0f1420;padding:32px;color:#e5e7eb;">
      <div style="max-width:480px;margin:0 auto;background:#161c2d;border-radius:14px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
        <h2 style="color:#f59e0b;margin-top:0;">⏳ Confirm Your Transaction</h2>
        <p>Hi {name},</p>
        <p>Your <strong>{txn_type}</strong> of <strong>${amount:,.2f}</strong> was flagged by NexaGuard's fraud detection
        for extra verification. If this was you, click below to confirm and complete it.</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="{confirm_link}" style="background:#4f8ef7;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;display:inline-block;">
            ✅ Confirm Transaction
          </a>
        </p>
        <p style="font-size:13px;color:#9ca3af;">This link expires in {expires_minutes} minutes. If you didn't request this transaction, ignore this email — nothing happens until you click confirm.</p>
      </div>
    </div>
    """

def deposit_pending_email(name, amount):
    return f"""
    <div style="font-family:Arial,sans-serif;background:#0f1420;padding:32px;color:#e5e7eb;">
      <div style="max-width:480px;margin:0 auto;background:#161c2d;border-radius:14px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
        <h2 style="color:#60a5fa;margin-top:0;">🕐 Deposit Awaiting Approval</h2>
        <p>Hi {name},</p>
        <p>Your deposit of <strong>${amount:,.2f}</strong> has been submitted and is now waiting for
        admin approval before it's added to your balance. This is a demo-safety step — you'll get
        another email once it's reviewed.</p>
      </div>
    </div>
    """

# ── OTP Schemas ────────────────────────────────────────────────────────────
class OTPVerifyIn(BaseModel):
    email: str
    otp: str

class ResendOTPIn(BaseModel):
    email: str

# ── Auth ───────────────────────────────────────────────────────────────────
@router.post("/signup")
def signup(body: SignupIn):
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("SELECT id, verified FROM users WHERE email=%s", (body.email.lower().strip(),))
        existing = cur.fetchone()
        if existing:
            if existing["verified"] == 0:
                raise HTTPException(400, "Email registered but not verified. Check your email for OTP.")
            raise HTTPException(400, "Email already registered")

        token = secrets.token_hex(32)
        STARTING_BALANCE = 0.00
        cur.execute(
            "INSERT INTO users (name, email, password, token, role, balance, verified) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (body.name.strip(), body.email.lower().strip(), hash_pw(body.password), token, "user", STARTING_BALANCE, 0)
        )
        con.commit()

        otp = generate_otp()
        expires = datetime.now() + timedelta(minutes=10)
        cur.execute("INSERT INTO otp_codes (email, otp, expires_at, purpose) VALUES (%s,%s,%s,%s)",
                    (body.email.lower().strip(), otp, expires, "signup"))
        con.commit()
        send_email(body.email, "NexaGuard — Verify Your Email", otp_email(body.name, otp))
        return {"message": "OTP sent to your email", "email": body.email.lower().strip()}
    finally:
        cur.close(); con.close()

@router.post("/verify-otp")
def verify_otp(body: OTPVerifyIn):
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("""
            SELECT id, otp, expires_at, used FROM otp_codes
            WHERE email=%s AND purpose='signup' ORDER BY id DESC LIMIT 1
        """, (body.email.lower(),))
        row = cur.fetchone()

        if not row:
            raise HTTPException(400, "No OTP found. Please signup again.")
        if row["used"] == 1:
            raise HTTPException(400, "OTP already used.")
        if datetime.now() > row["expires_at"].replace(tzinfo=None):
            raise HTTPException(400, "OTP expired. Request a new one.")
        if row["otp"] != body.otp:
            raise HTTPException(400, "Invalid OTP.")

        cur.execute("UPDATE otp_codes SET used=1 WHERE id=%s", (row["id"],))
        cur.execute("UPDATE users SET verified=1 WHERE email=%s", (body.email.lower(),))
        con.commit()

        cur.execute("SELECT id,name,email,token,role,balance FROM users WHERE email=%s", (body.email.lower(),))
        user = cur.fetchone()
        send_email(body.email, "Welcome to NexaGuard! 🛡️", welcome_email(user["name"]))
        return {"token": user["token"], "user": {"id": user["id"], "name": user["name"],
                "email": user["email"], "role": user["role"], "balance": float(user["balance"])}}
    finally:
        cur.close(); con.close()

@router.post("/resend-otp")
def resend_otp(body: ResendOTPIn):
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("SELECT name, verified FROM users WHERE email=%s", (body.email.lower(),))
        user = cur.fetchone()
        if not user:
            raise HTTPException(404, "Email not found")
        if user["verified"] == 1:
            raise HTTPException(400, "Email already verified")

        otp = generate_otp()
        expires = datetime.now() + timedelta(minutes=10)
        cur.execute("INSERT INTO otp_codes (email, otp, expires_at, purpose) VALUES (%s,%s,%s,%s)",
                    (body.email.lower(), otp, expires, "signup"))
        con.commit()
        send_email(body.email, "NexaGuard — New OTP", otp_email(user["name"], otp))
        return {"message": "New OTP sent"}
    finally:
        cur.close(); con.close()

# ── Forgot / Reset Password ─────────────────────────────────────────────────
class ForgotPasswordIn(BaseModel):
    email: str

class ResetPasswordIn(BaseModel):
    email: str
    otp: str
    new_password: str

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordIn):
    con = get_db()
    cur = con.cursor()
    try:
        email = body.email.lower().strip()
        cur.execute("SELECT id, name FROM users WHERE email=%s", (email,))
        user = cur.fetchone()

        # Always return the same generic message — don't reveal whether the
        # email exists, so attackers can't use this endpoint to enumerate accounts.
        generic_msg = {"message": "If an account exists for this email, a reset code has been sent."}

        if not user:
            return generic_msg

        otp = generate_otp()
        expires = datetime.now() + timedelta(minutes=10)
        cur.execute("INSERT INTO otp_codes (email, otp, expires_at, purpose) VALUES (%s,%s,%s,%s)",
                    (email, otp, expires, "reset"))
        con.commit()
        send_email(email, "NexaGuard — Password Reset Code", otp_email(user["name"], otp))
        return generic_msg
    finally:
        cur.close(); con.close()

@router.post("/reset-password")
def reset_password(body: ResetPasswordIn):
    con = get_db()
    cur = con.cursor()
    try:
        email = body.email.lower().strip()

        if len(body.new_password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")

        cur.execute("""
            SELECT id, otp, expires_at, used FROM otp_codes
            WHERE email=%s AND purpose='reset' ORDER BY id DESC LIMIT 1
        """, (email,))
        row = cur.fetchone()

        if not row:
            raise HTTPException(400, "No reset code found. Please request a new one.")
        if row["used"] == 1:
            raise HTTPException(400, "This reset code has already been used.")
        if datetime.now() > row["expires_at"].replace(tzinfo=None):
            raise HTTPException(400, "Reset code expired. Request a new one.")
        if row["otp"] != body.otp:
            raise HTTPException(400, "Invalid reset code.")

        cur.execute("UPDATE otp_codes SET used=1 WHERE id=%s", (row["id"],))
        # Invalidate any active session token so old logins can't keep using the
        # account after a password reset.
        cur.execute("UPDATE users SET password=%s, token=NULL WHERE email=%s",
                    (hash_pw(body.new_password), email))
        con.commit()
        return {"success": True, "message": "Password reset successfully. Please log in."}
    finally:
        cur.close(); con.close()

@router.post("/login")
def login(body: LoginIn, request: Request):
    
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("SELECT id,name,email,password,role,balance,verified FROM users WHERE email=%s",
                    (body.email.lower().strip(),))
        row = cur.fetchone()
        if not row or row["password"] != hash_pw(body.password):
            raise HTTPException(401, "Invalid email or password")
        if row["verified"] == 0:
            raise HTTPException(403, "Email not verified. Check your inbox for OTP.")

        token = secrets.token_hex(32)
        client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(",")[0].strip()
        user_agent = request.headers.get("User-Agent", "Unknown device")

        cur.execute(
            "UPDATE users SET token=%s, last_login_ip=%s, last_login_device=%s, last_login_at=NOW() WHERE id=%s",
            (token, client_ip, user_agent, row["id"])
        )
        con.commit()
        from routes.alerts import create_alert
        login_time = datetime.now().strftime("%d %b %Y, %I:%M %p")
        create_alert(row["id"], row["email"], "info", "login",
                    f"Someone logged into your account on {login_time}",
                    {"email": row["email"], "time": login_time})
        return {"token": token, "user": {"id": row["id"], "name": row["name"],
                "email": row["email"], "role": row["role"], "balance": float(row["balance"])}}
    finally:
        cur.close(); con.close()
@router.get("/me")
def me(token: str):
    return get_user_by_token(token)

@router.post("/update")
def update_profile(body: UpdateIn):
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE token=%s", (body.token,))
        row = cur.fetchone()
        if not row: raise HTTPException(401, "Invalid token")
        cur.execute("UPDATE users SET name=%s WHERE id=%s", (body.name.strip(), row["id"]))
        con.commit()
        return {"success": True, "name": body.name.strip()}
    finally:
        cur.close(); con.close()

# ── Admin ──────────────────────────────────────────────────────────────────
@router.get("/admin/users")
def get_all_users(token: str):
    user = get_user_by_token(token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Access denied")
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT id,name,email,role,balance,verified,created_at,held FROM users")
    rows = cur.fetchall()
    cur.close(); con.close()
    return [{"id": r["id"], "name": r["name"], "email": r["email"], "role": r["role"],
             "balance": float(r["balance"]), "verified": r["verified"],
             "created_at": str(r["created_at"]), "held": bool(r["held"])} for r in rows]

@router.post("/admin/role")
def update_role(body: RoleUpdateIn):
    user = get_user_by_token(body.token)
    if user["role"] != "admin":
        raise HTTPException(403, "Only admin can change roles")
    if body.role not in ["user", "analyst", "admin"]:
        raise HTTPException(400, "Invalid role")
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT id, email, role FROM users WHERE id=%s", (body.user_id,))
    target = cur.fetchone()
    cur.execute("UPDATE users SET role=%s WHERE id=%s", (body.role, body.user_id))
    con.commit()
    cur.close(); con.close()
    from routes.alerts import create_alert
    if target:
        create_alert(target["id"], target["email"], "medium", "user_activity",
                    f"Your role was changed: {target['role']} → {body.role}",
                    {"changed_by": user["email"], "old_role": target["role"], "new_role": body.role})
    return {"success": True}

# ── Transactions ───────────────────────────────────────────────────────────
def _build_risk_features(cur, user, body):
    is_new_recipient = 0
    if body.type == "send" and body.to_email:
        cur.execute("SELECT COUNT(*) as cnt FROM transactions WHERE user_id=%s AND to_email=%s",
                    (user["id"], body.to_email.lower()))
        is_new_recipient = 1 if cur.fetchone()["cnt"] == 0 else 0

    cur.execute("SELECT COUNT(*) as cnt FROM transactions WHERE user_id=%s AND created_at >= NOW() - INTERVAL '1 day'",
                (user["id"],))
    tx_count_last_24h = cur.fetchone()["cnt"]

    cur.execute("SELECT created_at FROM users WHERE id=%s", (user["id"],))
    row = cur.fetchone()
    account_age_days = 9999
    if row and row["created_at"]:
        try:
            account_age_days = (datetime.utcnow() - row["created_at"].replace(tzinfo=None)).total_seconds() / 86400
        except:
            account_age_days = 9999

    return {
        "amount": body.amount,
        "balance": user["balance"],
        "is_new_recipient": is_new_recipient,
        "tx_count_last_24h": tx_count_last_24h,
        "account_age_days": account_age_days,
        "is_outgoing": 1 if body.type in ["send", "withdraw"] else 0,
    }

@router.post("/transaction")
def make_transaction(body: TransactionIn, request: Request):
    user = get_user_by_token(body.token)
    con = get_db()
    cur = con.cursor()
    try:
        from routes.alerts import create_alert

        # ── Account hold check ─────────────────────────────────────────────
        if user["held"]:
            raise HTTPException(403, "Your account is on hold pending review. Contact support or wait for admin clearance.")

        # ── Recipient validation ───────────────────────────────────────────
        if body.type == "send" and body.to_email:
            cur.execute("SELECT id FROM users WHERE email=%s", (body.to_email.lower().strip(),))
            if not cur.fetchone():
                raise HTTPException(400, "Recipient not found — this email is not a registered NexaGuard account")
            if body.to_email.lower().strip() == user["email"].lower():
                raise HTTPException(400, "You cannot send money to yourself")

        # ── Velocity check ─────────────────────────────────────────────────
        client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(",")[0].strip()

        cur.execute(
            "SELECT amount, fraud_score FROM transactions WHERE user_id=%s AND created_at >= NOW() - INTERVAL '2 minutes'",
            (user["id"],)
        )
        recent_rows = cur.fetchall()
        recent_count = len(recent_rows)

        cur.execute(
            "SELECT COUNT(*) as cnt FROM transactions WHERE ip=%s AND created_at >= NOW() - INTERVAL '2 minutes'",
            (client_ip,)
        )
        ip_count = cur.fetchone()["cnt"]

        avg_recent_fraud = (
            sum(float(r["fraud_score"] or 0) for r in recent_rows) / recent_count
            if recent_count > 0 else 0
        )
        total_recent_amount = sum(float(r["amount"]) for r in recent_rows)

        tx_limit = 3 if avg_recent_fraud > 50 else (5 if total_recent_amount > 50000 else 10)

        if recent_count >= tx_limit or ip_count >= 15:
            cur.execute("UPDATE users SET held=1 WHERE id=%s", (user["id"],))
            con.commit()
            send_email(user["email"], "🚨 NexaGuard — Account On Hold",
                transaction_email(user["name"], body.type, body.amount, "blocked", user["balance"]))
            create_alert(user["id"], user["email"], "high", "transaction",
                        f"Account held — velocity limit hit (count={recent_count}, ip_count={ip_count}, avg_fraud={avg_recent_fraud:.1f}%)",
                        {"recent_count": recent_count, "ip_count": ip_count, "avg_fraud": avg_recent_fraud})
            raise HTTPException(403, "Suspicious activity detected. Account placed on hold.")

        # ── Location / impossible travel check ─────────────────────────────
        new_location = get_ip_location(client_ip)
        if new_location:
            cur.execute(
                "SELECT ip, created_at FROM transactions WHERE user_id=%s AND ip IS NOT NULL ORDER BY created_at DESC LIMIT 1",
                (user["id"],)
            )
            last_tx_row = cur.fetchone()
            if last_tx_row and last_tx_row["ip"]:
                last_location = get_ip_location(last_tx_row["ip"])
                if last_location and (last_location["lat"] != 0 and new_location["lat"] != 0):
                    distance_km = haversine_km(
                        last_location["lat"], last_location["lon"],
                        new_location["lat"], new_location["lon"]
                    )
                    try:
                        last_time = last_tx_row["created_at"].replace(tzinfo=None)
                        hours_passed = max((datetime.utcnow() - last_time).total_seconds() / 3600, 0.001)
                    except:
                        hours_passed = 1
                    max_possible_km = hours_passed * 900
                    if distance_km > max_possible_km and distance_km > 500:
                        cur.execute("UPDATE users SET held=1 WHERE id=%s", (user["id"],))
                        con.commit()
                        send_email(user["email"], "🚨 NexaGuard — Impossible Travel Detected",
                            transaction_email(user["name"], body.type, body.amount, "blocked", user["balance"]))
                        create_alert(user["id"], user["email"], "high", "transaction",
                            f"Impossible travel: {last_location['city']} → {new_location['city']} ({distance_km:.0f} km in {hours_passed*60:.1f} mins)",
                            {"from_city": last_location["city"], "to_city": new_location["city"],
                             "distance_km": round(distance_km), "hours_passed": round(hours_passed, 4),
                             "max_possible_km": round(max_possible_km)})
                        raise HTTPException(403,
                            f"Impossible travel detected: {last_location['city'] or last_location['country']} → "
                            f"{new_location['city'] or new_location['country']} "
                            f"({distance_km:.0f} km in {hours_passed*60:.1f} mins). Account placed on hold.")

        # ── ML Fraud Score ──────────────────────────────────────────────────
        ml_result   = predict_banking_fraud(_build_risk_features(cur, user, body))
        fraud_score = ml_result["fraud_score"]
        risk_level  = ml_result["risk_level"]
        is_fraud    = ml_result["is_fraud"]

        # ── Daily limit check ───────────────────────────────────────────────
        if body.type in ["send", "withdraw"]:
            cur.execute(
                """SELECT COALESCE(SUM(amount),0) as total FROM transactions
                   WHERE user_id=%s AND type IN ('send','withdraw')
                   AND status != 'blocked' AND created_at >= CURRENT_DATE""",
                (user["id"],)
            )
            daily_out = float(cur.fetchone()["total"])
            if daily_out + body.amount > DAILY_LIMIT_SEND_WITHDRAW:
                remaining = max(0, DAILY_LIMIT_SEND_WITHDRAW - daily_out)
                raise HTTPException(400,
                    f"Daily send/withdraw limit of ${DAILY_LIMIT_SEND_WITHDRAW:,} reached. "
                    f"Remaining today: ${remaining:,.2f}")

        elif body.type == "deposit":
            cur.execute(
                """SELECT COALESCE(SUM(amount),0) as total FROM transactions
                   WHERE user_id=%s AND type='deposit'
                   AND status != 'blocked' AND created_at >= CURRENT_DATE""",
                (user["id"],)
            )
            daily_dep = float(cur.fetchone()["total"])
            if daily_dep + body.amount > DAILY_LIMIT_DEPOSIT:
                remaining = max(0, DAILY_LIMIT_DEPOSIT - daily_dep)
                raise HTTPException(400,
                    f"Daily deposit limit of ${DAILY_LIMIT_DEPOSIT:,} reached. "
                    f"Remaining today: ${remaining:,.2f}")

        # ── DEMO SAFETY: all deposits require admin approval ─────────────────
        # This is a demo app with no real payment gateway behind "Deposit", so
        # instead of auto-crediting balance, every deposit is queued as
        # 'pending' and only an admin/analyst can approve it via
        # POST /api/auth/admin/review (action="approve"). The existing review
        # endpoint already knows how to credit balance for type="deposit".
        if body.type == "deposit":
            cur.execute(
                "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score,risk_level,is_fraud,ip) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (user["id"], body.type, body.amount, body.to_email, body.description,
                 "pending", fraud_score, risk_level, is_fraud, client_ip)
            )
            txn_id = cur.fetchone()["id"]
            con.commit()
            send_email(user["email"], "🕐 NexaGuard — Deposit Awaiting Approval",
                deposit_pending_email(user["name"], body.amount))
            create_alert(user["id"], user["email"], "info", "transaction",
                        f"Deposit of ${body.amount:,.2f} submitted — awaiting admin approval",
                        {"amount": body.amount, "transaction_id": txn_id, "fraud_score": fraud_score})
            return {"success": True, "status": "pending",
                    "reason": "Deposit submitted for admin approval (demo safety step)",
                    "fraud_score": fraud_score}

        # ── Tier 1: High risk → block UNLESS face verified ──────────────────
        if fraud_score > 70 and not body.face_verified:
            cur.execute(
                "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score,risk_level,is_fraud,ip) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (user["id"], body.type, body.amount, body.to_email, body.description, "blocked", fraud_score, risk_level, is_fraud, client_ip)
            )
            con.commit()
            send_email(user["email"], "🚨 NexaGuard — Transaction Blocked",
                transaction_email(user["name"], body.type, body.amount, "blocked", user["balance"]))
            create_alert(user["id"], user["email"], "high", "transaction",
                        f"Transaction blocked — ${body.amount:,.2f} {body.type} (fraud score: {fraud_score}%)",
                        {"amount": body.amount, "type": body.type, "fraud_score": fraud_score})
            return {"success": False, "status": "blocked", "reason": "High fraud risk detected", "fraud_score": fraud_score}

        # ── Tier 2: Medium risk → email confirm (only if face NOT verified) ──
        if fraud_score >= 40 and not body.face_verified:
            cur.execute(
                "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score,risk_level,is_fraud,ip) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (user["id"], body.type, body.amount, body.to_email, body.description, "pending", fraud_score, risk_level, is_fraud, client_ip)
            )
            txn_id = cur.fetchone()["id"]
            ctoken = secrets.token_urlsafe(32)
            ctoken_expires = datetime.now() + timedelta(minutes=CONFIRM_TOKEN_EXPIRY_MINUTES)
            cur.execute(
                "UPDATE transactions SET confirm_token=%s, confirm_expires=%s WHERE id=%s",
                (ctoken, ctoken_expires, txn_id)
            )
            con.commit()
            confirm_link = f"{BACKEND_BASE_URL}/api/auth/confirm-transaction?ctoken={ctoken}"
            send_email(user["email"], "⏳ NexaGuard — Confirm Your Transaction",
                confirm_transaction_email(user["name"], body.type, body.amount, confirm_link, CONFIRM_TOKEN_EXPIRY_MINUTES))
            create_alert(user["id"], user["email"], "medium", "transaction",
                        f"Transaction flagged for review — ${body.amount:,.2f} {body.type} (fraud score: {fraud_score}%). Confirmation email sent.",
                        {"amount": body.amount, "type": body.type, "fraud_score": fraud_score})
            return {"success": True, "status": "pending", "reason": "Check your email to confirm this transaction", "fraud_score": fraud_score}

        # ── Tier 3: Auto-approve (low risk OR face verified override) ────────
        if body.type in ["send", "withdraw"]:
            if user["balance"] < body.amount:
                raise HTTPException(400, "Insufficient balance")
            cur.execute("UPDATE users SET balance=balance-%s WHERE id=%s", (body.amount, user["id"]))
            if body.type == "send" and body.to_email:
                cur.execute("UPDATE users SET balance=balance+%s WHERE email=%s", (body.amount, body.to_email.lower()))
        elif body.type in ["receive", "deposit"]:
            cur.execute("UPDATE users SET balance=balance+%s WHERE id=%s", (body.amount, user["id"]))

        cur.execute(
            "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score,risk_level,is_fraud,ip) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (user["id"], body.type, body.amount, body.to_email, body.description, "completed", fraud_score, risk_level, is_fraud, client_ip)
        )
        con.commit()
        cur.execute("SELECT balance FROM users WHERE id=%s", (user["id"],))
        new_balance = float(cur.fetchone()["balance"])

        send_email(user["email"], "✅ NexaGuard — Transaction Confirmed",
            transaction_email(user["name"], body.type, body.amount, "completed", new_balance))
        create_alert(user["id"], user["email"], "success", "transaction",
                    f"Transaction completed — ${body.amount:,.2f} {body.type}"
                    + (" (face-verified override)" if body.face_verified else ""),
                    {"amount": body.amount, "type": body.type, "new_balance": round(new_balance, 2),
                     "face_verified": body.face_verified})

        if body.type == "send" and body.to_email:
            cur.execute("SELECT id, name, email, balance FROM users WHERE email=%s", (body.to_email.lower(),))
            recipient = cur.fetchone()
            if recipient:
                send_email(recipient["email"], "✅ NexaGuard — Money Received",
                    transaction_email(recipient["name"], "receive", body.amount, "completed", float(recipient["balance"])))
                create_alert(recipient["id"], recipient["email"], "success", "transaction",
                            f"You received ${body.amount:,.2f} from {user['name']}",
                            {"amount": body.amount, "from": user["email"]})

        return {"success": True, "status": "completed", "new_balance": round(new_balance, 2), "fraud_score": fraud_score}
    finally:
        cur.close(); con.close()


@router.get("/confirm-transaction", response_class=HTMLResponse)
def confirm_transaction(ctoken: str):
    con = get_db()
    cur = con.cursor()
    try:
        from routes.alerts import create_alert

        cur.execute(
            """SELECT t.id,t.user_id,t.type,t.amount,t.to_email,t.status,t.confirm_expires,
               u.email,u.name,u.balance
               FROM transactions t JOIN users u ON t.user_id=u.id WHERE t.confirm_token=%s""",
            (ctoken,)
        )
        row = cur.fetchone()

        def page(title, message, color="#f59e0b"):
            return f"""
            <html><body style="font-family:Arial,sans-serif;background:#0f1420;color:#e5e7eb;
                text-align:center;padding:80px 20px;">
              <div style="max-width:420px;margin:0 auto;background:#161c2d;border-radius:14px;
                  padding:36px;border:1px solid rgba(255,255,255,0.08);">
                <h2 style="color:{color};margin-top:0;">{title}</h2>
                <p style="color:#9ca3af;">{message}</p>
              </div>
            </body></html>
            """

        if not row:
            return HTMLResponse(page("Invalid Link", "This confirmation link is invalid or was already used.", "#ef4444"), status_code=400)

        if row["status"] != "pending":
            return HTMLResponse(page("Already Processed", f"This transaction is already {row['status']}.", "#9ca3af"))

        if row["confirm_expires"] and datetime.now() > row["confirm_expires"].replace(tzinfo=None):
            cur.execute("UPDATE transactions SET status='blocked', confirm_token=NULL WHERE id=%s", (row["id"],))
            con.commit()
            create_alert(row["user_id"], row["email"], "high", "transaction",
                        f"Confirmation link expired — ${float(row['amount']):,.2f} {row['type']} was cancelled",
                        {"amount": float(row["amount"]), "type": row["type"]})
            return HTMLResponse(page("Link Expired",
                "This confirmation link has expired. The transaction was cancelled — please retry from the app.",
                "#ef4444"), status_code=400)

        amount  = float(row["amount"])
        balance = float(row["balance"])

        if row["type"] in ["send", "withdraw"]:
            if balance < amount:
                return HTMLResponse(page("Insufficient Balance",
                    "You no longer have enough balance to complete this transaction.", "#ef4444"), status_code=400)
            cur.execute("UPDATE users SET balance=balance-%s WHERE id=%s", (amount, row["user_id"]))
            if row["type"] == "send" and row["to_email"]:
                cur.execute("UPDATE users SET balance=balance+%s WHERE email=%s", (amount, row["to_email"].lower()))
        elif row["type"] in ["receive", "deposit"]:
            cur.execute("UPDATE users SET balance=balance+%s WHERE id=%s", (amount, row["user_id"]))

        cur.execute("UPDATE transactions SET status='completed', confirm_token=NULL WHERE id=%s", (row["id"],))
        con.commit()
        cur.execute("SELECT balance FROM users WHERE id=%s", (row["user_id"],))
        new_balance = float(cur.fetchone()["balance"])

        send_email(row["email"], "✅ NexaGuard — Transaction Confirmed",
            transaction_email(row["name"], row["type"], amount, "completed", new_balance))
        create_alert(row["user_id"], row["email"], "success", "transaction",
                    f"You confirmed your transaction — ${amount:,.2f} {row['type']}",
                    {"amount": amount, "type": row["type"], "new_balance": round(new_balance, 2)})

        if row["type"] == "send" and row["to_email"]:
            cur.execute("SELECT id, name, email, balance FROM users WHERE email=%s", (row["to_email"].lower(),))
            recipient = cur.fetchone()
            if recipient:
                send_email(recipient["email"], "✅ NexaGuard — Money Received",
                    transaction_email(recipient["name"], "receive", amount, "completed", float(recipient["balance"])))
                create_alert(recipient["id"], recipient["email"], "success", "transaction",
                            f"You received ${amount:,.2f} from {row['name']}",
                            {"amount": amount, "from": row["email"]})

        return HTMLResponse(page("✅ Transaction Confirmed",
            f"Your {row['type']} of ${amount:,.2f} has been completed. New balance: ${new_balance:,.2f}.", "#22c55e"))
    finally:
        cur.close(); con.close()


class ReviewIn(BaseModel):
    token: str
    transaction_id: int
    action: str  # "approve" | "reject"

@router.post("/admin/review")
def review_transaction(body: ReviewIn):
    user = get_user_by_token(body.token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Only admin or analyst can review transactions")
    con = get_db()
    cur = con.cursor()
    try:
        from routes.alerts import create_alert
        cur.execute(
            """SELECT t.user_id,t.type,t.amount,t.to_email,t.status,u.email,u.name,u.balance
               FROM transactions t JOIN users u ON t.user_id=u.id WHERE t.id=%s""",
            (body.transaction_id,)
        )
        row = cur.fetchone()
        if not row: raise HTTPException(404, "Transaction not found")
        if row["status"] != "pending":
            raise HTTPException(400, f"Transaction is already {row['status']}, not pending")

        amount = float(row["amount"])

        if body.action == "approve":
            if row["type"] in ["send", "withdraw"]:
                if float(row["balance"]) < amount:
                    raise HTTPException(400, "User no longer has sufficient balance")
                cur.execute("UPDATE users SET balance=balance-%s WHERE id=%s", (amount, row["user_id"]))
                if row["type"] == "send" and row["to_email"]:
                    cur.execute("UPDATE users SET balance=balance+%s WHERE email=%s", (amount, row["to_email"].lower()))
            elif row["type"] in ["receive", "deposit"]:
                cur.execute("UPDATE users SET balance=balance+%s WHERE id=%s", (amount, row["user_id"]))

            cur.execute("UPDATE transactions SET status='completed', confirm_token=NULL WHERE id=%s", (body.transaction_id,))
            con.commit()
            cur.execute("SELECT balance FROM users WHERE id=%s", (row["user_id"],))
            new_balance = float(cur.fetchone()["balance"])
            send_email(row["email"], "✅ NexaGuard — Transaction Approved",
                transaction_email(row["name"], row["type"], amount, "completed", new_balance))
            create_alert(row["user_id"], row["email"], "success", "transaction",
                        f"Your held transaction was approved — ${amount:,.2f} {row['type']}",
                        {"amount": amount, "type": row["type"], "reviewed_by": user["email"]})
            if row["type"] == "send" and row["to_email"]:
                cur.execute("SELECT id, name, email, balance FROM users WHERE email=%s", (row["to_email"].lower(),))
                recipient = cur.fetchone()
                if recipient:
                    send_email(recipient["email"], "✅ NexaGuard — Money Received",
                        transaction_email(recipient["name"], "receive", amount, "completed", float(recipient["balance"])))
                    create_alert(recipient["id"], recipient["email"], "success", "transaction",
                                f"You received ${amount:,.2f} from {row['name']}",
                                {"amount": amount, "from": row["email"]})
            return {"success": True, "status": "completed"}

        elif body.action == "reject":
            cur.execute("UPDATE transactions SET status='blocked', confirm_token=NULL WHERE id=%s", (body.transaction_id,))
            con.commit()
            send_email(row["email"], "🚨 NexaGuard — Transaction Rejected",
                transaction_email(row["name"], row["type"], amount, "blocked", float(row["balance"])))
            create_alert(row["user_id"], row["email"], "high", "transaction",
                        f"Your held transaction was rejected — ${amount:,.2f} {row['type']}",
                        {"amount": amount, "type": row["type"], "reviewed_by": user["email"]})
            return {"success": True, "status": "blocked"}

        raise HTTPException(400, "action must be 'approve' or 'reject'")
    finally:
        cur.close(); con.close()


@router.get("/admin/banking-stats")
def banking_stats_admin(token: str):
    user = get_user_by_token(token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Access denied")
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("SELECT COUNT(*) as cnt FROM transactions")
        total = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*) as cnt FROM transactions WHERE status IN ('blocked','pending')")
        flagged = cur.fetchone()["cnt"]
        cur.execute("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE status='blocked'")
        blocked_amount = float(cur.fetchone()["total"])
        fraud_rate = round((flagged / total) * 100, 2) if total > 0 else 0.0
        cur.execute("SELECT fraud_score FROM transactions")
        dist = {"SAFE": 0, "LOW RISK": 0, "MEDIUM RISK": 0, "HIGH RISK": 0}
        for r in cur.fetchall():
            score = float(r["fraud_score"] or 0)
            if score > 70: dist["HIGH RISK"] += 1
            elif score > 30: dist["MEDIUM RISK"] += 1
            elif score > 10: dist["LOW RISK"] += 1
            else: dist["SAFE"] += 1
        return {"total_scanned": total, "fraud_detected": flagged, "fraud_rate": fraud_rate,
                "blocked_amount": blocked_amount, "risk_distribution": dist}
    finally:
        cur.close(); con.close()


@router.get("/banking-stats")
def banking_stats(token: str):
    user = get_user_by_token(token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Access denied")
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("SELECT COUNT(*) as cnt FROM transactions")
        total = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*) as cnt FROM transactions WHERE status IN ('blocked','pending')")
        flagged = cur.fetchone()["cnt"]
        cur.execute("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE status='blocked'")
        blocked_amount = float(cur.fetchone()["total"])
        fraud_rate = round((flagged / total) * 100, 1) if total else 0
        cur.execute("SELECT fraud_score FROM transactions")
        dist = {"SAFE": 0, "LOW RISK": 0, "MEDIUM RISK": 0, "HIGH RISK": 0}
        for r in cur.fetchall():
            score = float(r["fraud_score"] or 0)
            if score > 70: dist["HIGH RISK"] += 1
            elif score > 30: dist["MEDIUM RISK"] += 1
            elif score > 10: dist["LOW RISK"] += 1
            else: dist["SAFE"] += 1
        return {"total_scanned": total, "fraud_detected": flagged, "fraud_rate": fraud_rate,
                "blocked_amount": round(blocked_amount, 2), "risk_distribution": dist}
    finally:
        cur.close(); con.close()


@router.get("/transactions")
def get_transactions(token: str):
    user = get_user_by_token(token)
    con = get_db()
    cur = con.cursor()
    try:
        if user["role"] in ["admin", "analyst"]:
            cur.execute("""
                SELECT t.id,u.name,u.email,t.type,t.amount,t.to_email,t.description,t.status,t.fraud_score,t.created_at
                FROM transactions t JOIN users u ON t.user_id=u.id
                ORDER BY t.created_at DESC LIMIT 100
            """)
            rows = cur.fetchall()
            return [{"id": r["id"], "user": r["name"], "email": r["email"], "type": r["type"],
                     "amount": float(r["amount"]), "to_email": r["to_email"], "description": r["description"],
                     "status": r["status"], "fraud_score": float(r["fraud_score"] or 0),
                     "created_at": str(r["created_at"])} for r in rows]
        else:
            cur.execute("""
                SELECT id,type,amount,to_email,description,status,fraud_score,created_at
                FROM transactions WHERE user_id=%s ORDER BY created_at DESC LIMIT 50
            """, (user["id"],))
            rows = cur.fetchall()
            return [{"id": r["id"], "type": r["type"], "amount": float(r["amount"]),
                     "to_email": r["to_email"], "description": r["description"], "status": r["status"],
                     "fraud_score": float(r["fraud_score"] or 0), "created_at": str(r["created_at"])} for r in rows]
    finally:
        cur.close(); con.close()


class DeleteUserIn(BaseModel):
    token: str
    user_id: int

@router.post("/admin/unhold")
def unhold_user(body: DeleteUserIn):
    admin = get_user_by_token(body.token)
    if admin["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Only admin or analyst can release a hold")
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("UPDATE users SET held=0 WHERE id=%s", (body.user_id,))
        con.commit()
        return {"success": True}
    finally:
        cur.close(); con.close()

@router.post("/admin/delete-user")
def delete_user(body: DeleteUserIn):
    admin = get_user_by_token(body.token)
    if admin["role"] != "admin":
        raise HTTPException(403, "Only admin can delete users")
    if admin["id"] == body.user_id:
        raise HTTPException(400, "Admin apna account delete nahi kar sakta")
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("SELECT id, role FROM users WHERE id=%s", (body.user_id,))
        row = cur.fetchone()
        if not row: raise HTTPException(404, "User not found")
        if row["role"] == "admin": raise HTTPException(400, "Admin user delete nahi ho sakta")
        cur.execute("DELETE FROM transactions WHERE user_id=%s", (body.user_id,))
        cur.execute("DELETE FROM users WHERE id=%s", (body.user_id,))
        con.commit()
        return {"success": True, "message": "User deleted successfully"}
    finally:
        cur.close(); con.close()


class UpdateProfileIn(BaseModel):
    token: str
    name: str
    current_password: str = ""
    new_password: str = ""

@router.post("/update-profile")
def update_profile_full(body: UpdateProfileIn):
    user = get_user_by_token(body.token)
    con = get_db()
    cur = con.cursor()
    try:
        if not body.name.strip():
            raise HTTPException(400, "Name cannot be empty")
        if body.new_password:
            if len(body.new_password) < 6:
                raise HTTPException(400, "Password must be at least 6 characters")
            cur.execute("SELECT password FROM users WHERE id=%s", (user["id"],))
            if cur.fetchone()["password"] != hash_pw(body.current_password):
                raise HTTPException(400, "Current password is incorrect")
            cur.execute("UPDATE users SET name=%s, password=%s WHERE id=%s",
                    (body.name.strip(), hash_pw(body.new_password), user["id"]))
        else:
            cur.execute("UPDATE users SET name=%s WHERE id=%s", (body.name.strip(), user["id"]))
        con.commit()
        cur.execute("SELECT id,name,email,role,balance FROM users WHERE id=%s", (user["id"],))
        updated = cur.fetchone()
        return {"success": True, "user": {"id": updated["id"], "name": updated["name"],
                "email": updated["email"], "role": updated["role"], "balance": float(updated["balance"])}}
    finally:
        cur.close(); con.close()