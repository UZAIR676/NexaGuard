from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
import sqlite3, hashlib, os, secrets
from datetime import datetime, timedelta
from schemas import SignupIn, LoginIn, UpdateIn
from schemas_bank import TransactionIn, RoleUpdateIn
from fastapi import APIRouter, HTTPException, Request
from email_service import send_email, generate_otp, otp_email, transaction_email, welcome_email
from routes.banking_fraud import predict_banking_fraud
from pydantic import BaseModel
import geoip2.database

GEOIP_DB = os.path.join(os.path.dirname(__file__), "..", "geoip", "GeoLite2-City.mmdb")

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
    """Do locations ke beech distance km mein."""
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

router = APIRouter(prefix="/api/auth", tags=["auth"])
DB = os.path.join(os.path.dirname(__file__), "..", "nexaguard.db")

# Base URL used to build the confirm-transaction link sent in emails.
# Change this if your backend runs on a different host/port in production.
BACKEND_BASE_URL = os.environ.get("NEXAGUARD_BACKEND_URL", "http://localhost:8000")
CONFIRM_TOKEN_EXPIRY_MINUTES = 30

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
            held       INTEGER DEFAULT 0,
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
    con.commit()

    # Migrations
    migrations = [
        "ALTER TABLE users ADD COLUMN held INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN held_reason TEXT",
        "ALTER TABLE transactions ADD COLUMN ip TEXT",
        "ALTER TABLE transactions ADD COLUMN confirm_token TEXT",      # ← naya
        "ALTER TABLE transactions ADD COLUMN confirm_expires TEXT",    # ← naya
    ]
    for sql in migrations:
        try:
            con.execute(sql)
            con.commit()
        except sqlite3.OperationalError:
            pass  # column already exists

    con.close()

init_db()

def hash_pw(pw):  return hashlib.sha256(pw.encode()).hexdigest()
def get_db():     return sqlite3.connect(DB)

def get_user_by_token(token):
    con = get_db()
    row = con.execute("SELECT id,name,email,role,balance,held FROM users WHERE token=?", (token,)).fetchone()
    con.close()
    if not row: raise HTTPException(401, "Invalid token")
    return {"id": row[0], "name": row[1], "email": row[2], "role": row[3], "balance": row[4], "held": bool(row[5])}

def confirm_transaction_email(name, txn_type, amount, confirm_link, expires_minutes):
    """Inline email template for the click-to-confirm pending transaction flow."""
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
        <p style="font-size:13px;color:#9ca3af;">This link expires in {expires_minutes} minutes. If you didn't request this transaction, ignore this email and your account will remain safe — nothing happens until you click confirm.</p>
      </div>
    </div>
    """

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
        STARTING_BALANCE = 0.00  # change this number to set what new signups start with
        con.execute(
            "INSERT INTO users (name, email, password, token, role, balance, verified) VALUES (?,?,?,?,?,?,?)",
            (body.name.strip(), body.email.lower().strip(), hash_pw(body.password), token, "user", STARTING_BALANCE, 0)
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
        # Login alert — user apne account ka login activity dekh sake
        from routes.alerts import create_alert
        from datetime import datetime
        login_time = datetime.now().strftime("%d %b %Y, %I:%M %p")
        create_alert(row[0], row[2], "info", "login",
                    f"Someone logged into your account on {login_time}",
                    {"email": row[2], "time": login_time})
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
    rows = con.execute("SELECT id,name,email,role,balance,verified,created_at,held FROM users").fetchall()
    con.close()
    return [{"id":r[0],"name":r[1],"email":r[2],"role":r[3],"balance":r[4],"verified":r[5],"created_at":r[6],"held":bool(r[7])} for r in rows]

@router.post("/admin/role")
def update_role(body: RoleUpdateIn):
    user = get_user_by_token(body.token)
    if user["role"] != "admin":
        raise HTTPException(403, "Only admin can change roles")
    if body.role not in ["user", "analyst", "admin"]:
        raise HTTPException(400, "Invalid role")
    con = get_db()
    # Get target user info for alert
    target = con.execute("SELECT id, email, role FROM users WHERE id=?", (body.user_id,)).fetchone()
    con.execute("UPDATE users SET role=? WHERE id=?", (body.role, body.user_id))
    con.commit()
    con.close()
    # Alert — admin sees it, target user also sees it
    from routes.alerts import create_alert
    if target:
        old_role = target[2]
        create_alert(target[0], target[1], "medium", "user_activity",
                    f"Your role was changed: {old_role} → {body.role}",
                    {"changed_by": user["email"], "old_role": old_role, "new_role": body.role})
    return {"success": True}

# ── Transactions ───────────────────────────────────────────────────────────
def _build_risk_features(con, user, body):
    """Real-time, server-side features for the banking fraud model — never trust the client for these."""
    is_new_recipient = 0
    if body.type == "send" and body.to_email:
        prior = con.execute(
            "SELECT COUNT(*) FROM transactions WHERE user_id=? AND to_email=?",
            (user["id"], body.to_email.lower())
        ).fetchone()[0]
        is_new_recipient = 1 if prior == 0 else 0

    tx_count_last_24h = con.execute(
        "SELECT COUNT(*) FROM transactions WHERE user_id=? AND created_at >= datetime('now','-1 day')",
        (user["id"],)
    ).fetchone()[0]

    created_at_row = con.execute("SELECT created_at FROM users WHERE id=?", (user["id"],)).fetchone()
    account_age_days = 9999
    if created_at_row and created_at_row[0]:
        try:
            created = datetime.strptime(created_at_row[0][:19], "%Y-%m-%d %H:%M:%S")
            account_age_days = (datetime.utcnow() - created).total_seconds() / 86400
        except Exception:
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
    try:
        from routes.alerts import create_alert

        # ── If account is already held, block everything until admin clears it ──
        if user["held"]:
            raise HTTPException(403, "Your account is on hold pending review. Contact support or wait for admin clearance.")

        # ── Validate recipient exists before doing anything else ──
        if body.type == "send" and body.to_email:
            recipient_check = con.execute("SELECT id FROM users WHERE email=?", (body.to_email.lower().strip(),)).fetchone()
            if not recipient_check:
                raise HTTPException(400, "Recipient not found — this email is not a registered NexaGuard account")
            if body.to_email.lower().strip() == user["email"].lower():
                raise HTTPException(400, "You cannot send money to yourself")

        # ── Smart Velocity Check (IP + Amount + ML history) ──────────────
        client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(",")[0].strip()

        recent_rows = con.execute(
            "SELECT amount, fraud_score FROM transactions WHERE user_id=? AND created_at >= datetime('now','-2 minutes')",
            (user["id"],)
        ).fetchall()
        recent_count = len(recent_rows)

        ip_count = con.execute(
            "SELECT COUNT(*) FROM transactions WHERE ip=? AND created_at >= datetime('now','-2 minutes')",
            (client_ip,)
        ).fetchone()[0]

        avg_recent_fraud = (
            sum(r[1] or 0 for r in recent_rows) / recent_count
            if recent_count > 0 else 0
        )
        total_recent_amount = sum(r[0] for r in recent_rows)

        # Dynamic limit: ML score + amount history ke basis pe
        if avg_recent_fraud > 50:
            tx_limit = 3       # already risky history → very strict
        elif total_recent_amount > 50000:
            tx_limit = 5       # badi amounts → moderate strict
        else:
            tx_limit = 10      # normal usage

        if recent_count >= tx_limit or ip_count >= 15:
            con.execute("UPDATE users SET held=1 WHERE id=?", (user["id"],))
            con.commit()
            send_email(user["email"], "🚨 NexaGuard — Account On Hold",
                transaction_email(user["name"], body.type, body.amount, "blocked", user["balance"]))
            create_alert(user["id"], user["email"], "high", "transaction",
                        f"Account held — velocity limit hit (count={recent_count}, ip_count={ip_count}, avg_fraud={avg_recent_fraud:.1f}%)",
                        {"recent_count": recent_count, "ip_count": ip_count, "avg_fraud": avg_recent_fraud})
            raise HTTPException(403, "Suspicious activity detected. Account placed on hold.")
    # ── Location Change Check ──────────────────────
        new_location = get_ip_location(client_ip)
        if new_location:
            last_tx_row = con.execute(
                "SELECT ip, created_at FROM transactions WHERE user_id=? AND ip IS NOT NULL ORDER BY created_at DESC LIMIT 1",
                (user["id"],)
            ).fetchone()

            if last_tx_row and last_tx_row[0]:
                last_location = get_ip_location(last_tx_row[0])

                if last_location and (last_location["lat"] != 0 and new_location["lat"] != 0):
                    distance_km = haversine_km(
                        last_location["lat"], last_location["lon"],
                        new_location["lat"], new_location["lon"]
                    )

                    # Time difference
                    try:
                        last_time = datetime.strptime(last_tx_row[1][:19], "%Y-%m-%d %H:%M:%S")
                        hours_passed = max((datetime.utcnow() - last_time).total_seconds() / 3600, 0.001)
                    except:
                        hours_passed = 1

                    # Max speed: 900 km/h (plane)
                    max_possible_km = hours_passed * 900

                    if distance_km > max_possible_km and distance_km > 500:
                        con.execute("UPDATE users SET held=1 WHERE id=?", (user["id"],))
                        con.commit()
                        send_email(user["email"], "🚨 NexaGuard — Impossible Travel Detected",
                            transaction_email(user["name"], body.type, body.amount, "blocked", user["balance"]))
                        create_alert(user["id"], user["email"], "high", "transaction",
                            f"Impossible travel: {last_location['city']} → {new_location['city']} ({distance_km:.0f} km in {hours_passed*60:.1f} mins)",
                            {
                                "from_city": last_location["city"],
                                "to_city": new_location["city"],
                                "distance_km": round(distance_km),
                                "hours_passed": round(hours_passed, 4),
                                "max_possible_km": round(max_possible_km),
                            })
                        raise HTTPException(403,
                            f"Impossible travel detected: {last_location['city'] or last_location['country']} → {new_location['city'] or new_location['country']} "
                            f"({distance_km:.0f} km in {hours_passed*60:.1f} mins). Account placed on hold.")
        # ── End Location Check ────────────────────────
        ml_result = predict_banking_fraud(_build_risk_features(con, user, body))
        fraud_score = ml_result["fraud_score"]

        # ── Tier 1: High risk → block outright ──
        if fraud_score > 70:
            con.execute(
                "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score,ip) VALUES (?,?,?,?,?,?,?,?)",
                (user["id"], body.type, body.amount, body.to_email, body.description, "blocked", fraud_score, client_ip)
            )
            con.commit()
            send_email(user["email"], "🚨 NexaGuard — Transaction Blocked",
                transaction_email(user["name"], body.type, body.amount, "blocked", user["balance"]))
            create_alert(user["id"], user["email"], "high", "transaction",
                        f"Transaction blocked — ${body.amount:,.2f} {body.type} (fraud score: {fraud_score}%)",
                        {"amount": body.amount, "type": body.type, "fraud_score": fraud_score})
            return {"success": False, "status": "blocked", "reason": "High fraud risk detected", "fraud_score": fraud_score}

        # ── Tier 2: Medium risk → email user a confirm link (admin review bypassed) ──
        if fraud_score >= 40:
            cursor = con.execute(
                "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score,ip) VALUES (?,?,?,?,?,?,?,?)",
                (user["id"], body.type, body.amount, body.to_email, body.description, "pending", fraud_score, client_ip)
            )
            txn_id = cursor.lastrowid

            ctoken = secrets.token_urlsafe(32)
            ctoken_expires = (datetime.now() + timedelta(minutes=CONFIRM_TOKEN_EXPIRY_MINUTES)).strftime("%Y-%m-%d %H:%M:%S")
            con.execute(
                "UPDATE transactions SET confirm_token=?, confirm_expires=? WHERE id=?",
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

        # ── Tier 3: Low risk → auto-approve ──
        if body.type in ["send", "withdraw"]:
            if user["balance"] < body.amount:
                raise HTTPException(400, "Insufficient balance")
            con.execute("UPDATE users SET balance=balance-? WHERE id=?", (body.amount, user["id"]))
            if body.type == "send" and body.to_email:
                con.execute("UPDATE users SET balance=balance+? WHERE email=?", (body.amount, body.to_email.lower()))
        elif body.type in ["receive", "deposit"]:
            con.execute("UPDATE users SET balance=balance+? WHERE id=?", (body.amount, user["id"]))

        con.execute(
            "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score,ip) VALUES (?,?,?,?,?,?,?,?)",
            (user["id"], body.type, body.amount, body.to_email, body.description, "completed", fraud_score, client_ip)
        )
        con.commit()
        new_balance = con.execute("SELECT balance FROM users WHERE id=?", (user["id"],)).fetchone()[0]

        send_email(user["email"], "✅ NexaGuard — Transaction Confirmed",
            transaction_email(user["name"], body.type, body.amount, "completed", new_balance))
        create_alert(user["id"], user["email"], "success", "transaction",
                    f"Transaction completed — ${body.amount:,.2f} {body.type}",
                    {"amount": body.amount, "type": body.type, "new_balance": round(new_balance, 2)})

        if body.type == "send" and body.to_email:
            recipient = con.execute("SELECT id, name, email, balance FROM users WHERE email=?", (body.to_email.lower(),)).fetchone()
            if recipient:
                send_email(recipient[2], "✅ NexaGuard — Money Received",
                    transaction_email(recipient[1], "receive", body.amount, "completed", recipient[3]))
                create_alert(recipient[0], recipient[2], "success", "transaction",
                            f"You received ${body.amount:,.2f} from {user['name']}",
                            {"amount": body.amount, "from": user["email"]})

        return {"success": True, "status": "completed", "new_balance": round(new_balance, 2), "fraud_score": fraud_score}
    finally:
        con.close()


@router.get("/confirm-transaction", response_class=HTMLResponse)
def confirm_transaction(ctoken: str):
    """User clicks the link from their email to confirm a medium-risk (pending) transaction.
    Admin review is bypassed entirely for this path."""
    con = get_db()
    try:
        from routes.alerts import create_alert

        row = con.execute(
            "SELECT t.id,t.user_id,t.type,t.amount,t.to_email,t.status,t.confirm_expires,"
            "u.email,u.name,u.balance "
            "FROM transactions t JOIN users u ON t.user_id=u.id WHERE t.confirm_token=?",
            (ctoken,)
        ).fetchone()

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

        tx_id, tx_user_id, tx_type, amount, to_email, status, expires, tx_email, tx_name, tx_balance = row

        if status != "pending":
            return HTMLResponse(page("Already Processed", f"This transaction is already {status}.", "#9ca3af"))

        if expires and datetime.now() > datetime.strptime(expires, "%Y-%m-%d %H:%M:%S"):
            con.execute("UPDATE transactions SET status='blocked', confirm_token=NULL WHERE id=?", (tx_id,))
            con.commit()
            create_alert(tx_user_id, tx_email, "high", "transaction",
                        f"Confirmation link expired — ${amount:,.2f} {tx_type} was cancelled",
                        {"amount": amount, "type": tx_type})
            return HTMLResponse(page("Link Expired", "This confirmation link has expired. The transaction was cancelled — please retry it from the app if needed.", "#ef4444"), status_code=400)

        if tx_type in ["send", "withdraw"]:
            if tx_balance < amount:
                return HTMLResponse(page("Insufficient Balance", "You no longer have enough balance to complete this transaction.", "#ef4444"), status_code=400)
            con.execute("UPDATE users SET balance=balance-? WHERE id=?", (amount, tx_user_id))
            if tx_type == "send" and to_email:
                con.execute("UPDATE users SET balance=balance+? WHERE email=?", (amount, to_email.lower()))
        elif tx_type in ["receive", "deposit"]:
            con.execute("UPDATE users SET balance=balance+? WHERE id=?", (amount, tx_user_id))

        con.execute("UPDATE transactions SET status='completed', confirm_token=NULL WHERE id=?", (tx_id,))
        con.commit()
        new_balance = con.execute("SELECT balance FROM users WHERE id=?", (tx_user_id,)).fetchone()[0]

        send_email(tx_email, "✅ NexaGuard — Transaction Confirmed",
            transaction_email(tx_name, tx_type, amount, "completed", new_balance))
        create_alert(tx_user_id, tx_email, "success", "transaction",
                    f"You confirmed your transaction — ${amount:,.2f} {tx_type}",
                    {"amount": amount, "type": tx_type, "new_balance": round(new_balance, 2)})

        if tx_type == "send" and to_email:
            recipient = con.execute("SELECT id, name, email, balance FROM users WHERE email=?", (to_email.lower(),)).fetchone()
            if recipient:
                send_email(recipient[2], "✅ NexaGuard — Money Received",
                    transaction_email(recipient[1], "receive", amount, "completed", recipient[3]))
                create_alert(recipient[0], recipient[2], "success", "transaction",
                            f"You received ${amount:,.2f} from {tx_name}",
                            {"amount": amount, "from": tx_email})

        return HTMLResponse(page(
            "✅ Transaction Confirmed",
            f"Your {tx_type} of ${amount:,.2f} has been completed. New balance: ${new_balance:,.2f}.",
            "#22c55e"
        ))
    finally:
        con.close()


class ReviewIn(BaseModel):
    token: str
    transaction_id: int
    action: str  # "approve" | "reject"


@router.post("/admin/review")
def review_transaction(body: ReviewIn):
    """Admin/analyst fallback override — approves or rejects a still-pending transaction
    in case the user never clicks their email confirm link."""
    user = get_user_by_token(body.token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Only admin or analyst can review transactions")

    con = get_db()
    try:
        from routes.alerts import create_alert

        row = con.execute(
            "SELECT t.user_id,t.type,t.amount,t.to_email,t.status,u.email,u.name,u.balance "
            "FROM transactions t JOIN users u ON t.user_id=u.id WHERE t.id=?",
            (body.transaction_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Transaction not found")
        tx_user_id, tx_type, amount, to_email, status, tx_email, tx_name, tx_balance = row
        if status != "pending":
            raise HTTPException(400, f"Transaction is already {status}, not pending")

        if body.action == "approve":
            if tx_type in ["send", "withdraw"]:
                if tx_balance < amount:
                    raise HTTPException(400, "User no longer has sufficient balance")
                con.execute("UPDATE users SET balance=balance-? WHERE id=?", (amount, tx_user_id))
                if tx_type == "send" and to_email:
                    con.execute("UPDATE users SET balance=balance+? WHERE email=?", (amount, to_email.lower()))
            elif tx_type in ["receive", "deposit"]:
                con.execute("UPDATE users SET balance=balance+? WHERE id=?", (amount, tx_user_id))

            con.execute("UPDATE transactions SET status='completed', confirm_token=NULL WHERE id=?", (body.transaction_id,))
            con.commit()
            new_balance = con.execute("SELECT balance FROM users WHERE id=?", (tx_user_id,)).fetchone()[0]
            send_email(tx_email, "✅ NexaGuard — Transaction Approved",
                transaction_email(tx_name, tx_type, amount, "completed", new_balance))
            create_alert(tx_user_id, tx_email, "success", "transaction",
                        f"Your held transaction was approved — ${amount:,.2f} {tx_type}",
                        {"amount": amount, "type": tx_type, "reviewed_by": user["email"]})
            if tx_type == "send" and to_email:
                recipient = con.execute("SELECT id, name, email, balance FROM users WHERE email=?", (to_email.lower(),)).fetchone()
                if recipient:
                    send_email(recipient[2], "✅ NexaGuard — Money Received",
                        transaction_email(recipient[1], "receive", amount, "completed", recipient[3]))
                    create_alert(recipient[0], recipient[2], "success", "transaction",
                                f"You received ${amount:,.2f} from {tx_name}",
                                {"amount": amount, "from": tx_email})
            return {"success": True, "status": "completed"}

        elif body.action == "reject":
            con.execute("UPDATE transactions SET status='blocked', confirm_token=NULL WHERE id=?", (body.transaction_id,))
            con.commit()
            send_email(tx_email, "🚨 NexaGuard — Transaction Rejected",
                transaction_email(tx_name, tx_type, amount, "blocked", tx_balance))
            create_alert(tx_user_id, tx_email, "high", "transaction",
                        f"Your held transaction was rejected — ${amount:,.2f} {tx_type}",
                        {"amount": amount, "type": tx_type, "reviewed_by": user["email"]})
            return {"success": True, "status": "blocked"}

        raise HTTPException(400, "action must be 'approve' or 'reject'")
    finally:
        con.close()


@router.get("/admin/banking-stats")
def banking_stats(token: str):
    """Real fraud-monitoring stats computed from actual banking transactions (not the old test-log feed)."""
    user = get_user_by_token(token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Access denied")
    con = get_db()
    try:
        total = con.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        flagged = con.execute("SELECT COUNT(*) FROM transactions WHERE status IN ('blocked','pending')").fetchone()[0]
        blocked_amount = con.execute("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='blocked'").fetchone()[0]
        fraud_rate = round((flagged / total) * 100, 2) if total > 0 else 0.0

        dist = {"SAFE": 0, "LOW RISK": 0, "MEDIUM RISK": 0, "HIGH RISK": 0}
        for score, in con.execute("SELECT fraud_score FROM transactions").fetchall():
            score = score or 0
            if score > 70: dist["HIGH RISK"] += 1
            elif score > 30: dist["MEDIUM RISK"] += 1
            elif score > 10: dist["LOW RISK"] += 1
            else: dist["SAFE"] += 1

        return {
            "total_scanned": total,
            "fraud_detected": flagged,
            "fraud_rate": fraud_rate,
            "blocked_amount": round(float(blocked_amount), 2),
            "risk_distribution": dist,
        }
    finally:
        con.close()


@router.get("/banking-stats")
def banking_stats(token: str):
    """Real fraud stats computed from actual banking transactions (not the old test-feed)."""
    user = get_user_by_token(token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Access denied")
    con = get_db()
    try:
        total = con.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        flagged = con.execute("SELECT COUNT(*) FROM transactions WHERE status IN ('blocked','pending')").fetchone()[0]
        blocked_amount = con.execute("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='blocked'").fetchone()[0]
        fraud_rate = round((flagged / total) * 100, 1) if total else 0

        dist = {"SAFE": 0, "LOW RISK": 0, "MEDIUM RISK": 0, "HIGH RISK": 0}
        rows = con.execute("SELECT fraud_score FROM transactions").fetchall()
        for (score,) in rows:
            score = score or 0
            if score > 70: dist["HIGH RISK"] += 1
            elif score > 30: dist["MEDIUM RISK"] += 1
            elif score > 10: dist["LOW RISK"] += 1
            else: dist["SAFE"] += 1

        return {
            "total_scanned": total,
            "fraud_detected": flagged,
            "fraud_rate": fraud_rate,
            "blocked_amount": round(blocked_amount, 2),
            "risk_distribution": dist,
        }
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

# ── Admin — Delete User / Account Hold ─────────────────────────────────────
class DeleteUserIn(BaseModel):
    token: str
    user_id: int


@router.post("/admin/unhold")
def unhold_user(body: DeleteUserIn):  # reuses {token, user_id} shape
    admin = get_user_by_token(body.token)
    if admin["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Only admin or analyst can release a hold")
    con = get_db()
    try:
        con.execute("UPDATE users SET held=0 WHERE id=?", (body.user_id,))
        con.commit()
        return {"success": True}
    finally:
        con.close()


@router.post("/admin/delete-user")
def delete_user(body: DeleteUserIn):
    admin = get_user_by_token(body.token)
    if admin["role"] != "admin":
        raise HTTPException(403, "Only admin can delete users")
    if admin["id"] == body.user_id:
        raise HTTPException(400, "Admin apna account delete nahi kar sakta")
    con = get_db()
    try:
        row = con.execute("SELECT id, role FROM users WHERE id=?", (body.user_id,)).fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        if row[1] == "admin":
            raise HTTPException(400, "Admin user delete nahi ho sakta")
        con.execute("DELETE FROM transactions WHERE user_id=?", (body.user_id,))
        con.execute("DELETE FROM users WHERE id=?", (body.user_id,))
        con.commit()
        return {"success": True, "message": "User deleted successfully"}
    finally:
        con.close()

# ── User — Update Profile ──────────────────────────────────────────────────
class UpdateProfileIn(BaseModel):
    token: str
    name: str
    current_password: str = ""
    new_password: str = ""

@router.post("/update-profile")
def update_profile_full(body: UpdateProfileIn):
    user = get_user_by_token(body.token)
    con  = get_db()
    try:
        if not body.name.strip():
            raise HTTPException(400, "Name cannot be empty")

        # Password change request
        if body.new_password:
            if len(body.new_password) < 6:
                raise HTTPException(400, "Password must be at least 6 characters")
            row = con.execute("SELECT password FROM users WHERE id=?", (user["id"],)).fetchone()
            if row[0] != hash_pw(body.current_password):
                raise HTTPException(400, "Current password is incorrect")
            con.execute("UPDATE users SET name=?, password=? WHERE id=?",
                    (body.name.strip(), hash_pw(body.new_password), user["id"]))
        else:
            con.execute("UPDATE users SET name=? WHERE id=?", (body.name.strip(), user["id"]))

        con.commit()
        updated = con.execute("SELECT id,name,email,role,balance FROM users WHERE id=?", (user["id"],)).fetchone()
        return {"success": True, "user": {"id": updated[0], "name": updated[1], "email": updated[2], "role": updated[3], "balance": updated[4]}}
    finally:
        con.close()