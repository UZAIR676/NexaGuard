from fastapi import APIRouter, HTTPException
import sqlite3, hashlib, os, secrets
from datetime import datetime, timedelta
from schemas import SignupIn, LoginIn, UpdateIn
from schemas_bank import TransactionIn, RoleUpdateIn
from email_service import send_email, generate_otp, otp_email, transaction_email, welcome_email
from services.banking_fraud import predict_banking_fraud
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
def make_transaction(body: TransactionIn):
    user = get_user_by_token(body.token)
    con = get_db()
    try:
        from routes.alerts import create_alert

        # ── Validate recipient exists before doing anything else (no sending money into thin air) ──
        if body.type == "send" and body.to_email:
            recipient_check = con.execute("SELECT id FROM users WHERE email=?", (body.to_email.lower().strip(),)).fetchone()
            if not recipient_check:
                raise HTTPException(400, "Recipient not found — this email is not a registered NexaGuard account")
            if body.to_email.lower().strip() == user["email"].lower():
                raise HTTPException(400, "You cannot send money to yourself")

        ml_result = predict_banking_fraud(_build_risk_features(con, user, body))
        fraud_score = ml_result["fraud_score"]

        # ── Tier 1: High risk → block outright ──
        if fraud_score > 70:
            con.execute(
                "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score) VALUES (?,?,?,?,?,?,?)",
                (user["id"], body.type, body.amount, body.to_email, body.description, "blocked", fraud_score)
            )
            con.commit()
            send_email(user["email"], "🚨 NexaGuard — Transaction Blocked",
                transaction_email(user["name"], body.type, body.amount, "blocked", user["balance"]))
            create_alert(user["id"], user["email"], "high", "transaction",
                         f"Transaction blocked — ${body.amount:,.2f} {body.type} (fraud score: {fraud_score}%)",
                         {"amount": body.amount, "type": body.type, "fraud_score": fraud_score})
            return {"success": False, "status": "blocked", "reason": "High fraud risk detected", "fraud_score": fraud_score}

        # ── Tier 2: Medium risk → hold for admin/analyst review, no balance change yet ──
        if fraud_score >= 40:
            con.execute(
                "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score) VALUES (?,?,?,?,?,?,?)",
                (user["id"], body.type, body.amount, body.to_email, body.description, "pending", fraud_score)
            )
            con.commit()
            send_email(user["email"], "⏳ NexaGuard — Transaction Under Review",
                transaction_email(user["name"], body.type, body.amount, "pending", user["balance"]))
            create_alert(user["id"], user["email"], "medium", "transaction",
                         f"Transaction flagged for review — ${body.amount:,.2f} {body.type} (fraud score: {fraud_score}%)",
                         {"amount": body.amount, "type": body.type, "fraud_score": fraud_score})
            return {"success": True, "status": "pending", "reason": "Flagged for manual review", "fraud_score": fraud_score}

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
            "INSERT INTO transactions (user_id,type,amount,to_email,description,status,fraud_score) VALUES (?,?,?,?,?,?,?)",
            (user["id"], body.type, body.amount, body.to_email, body.description, "completed", fraud_score)
        )
        con.commit()
        new_balance = con.execute("SELECT balance FROM users WHERE id=?", (user["id"],)).fetchone()[0]

        # Send transaction email
        send_email(user["email"], "✅ NexaGuard — Transaction Confirmed",
            transaction_email(user["name"], body.type, body.amount, "completed", new_balance))
        create_alert(user["id"], user["email"], "success", "transaction",
                     f"Transaction completed — ${body.amount:,.2f} {body.type}",
                     {"amount": body.amount, "type": body.type, "new_balance": round(new_balance, 2)})

        # Notify recipient too, if this was a send to another NexaGuard user
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


class ReviewIn(BaseModel):
    token: str
    transaction_id: int
    action: str  # "approve" | "reject"


@router.post("/admin/review")
def review_transaction(body: ReviewIn):
    """Admin/analyst approves or rejects a pending (medium-risk) transaction."""
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

            con.execute("UPDATE transactions SET status='completed' WHERE id=?", (body.transaction_id,))
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
            con.execute("UPDATE transactions SET status='blocked' WHERE id=?", (body.transaction_id,))
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

# ── Admin — Delete User ────────────────────────────────────────────────────
class DeleteUserIn(BaseModel):
    token: str
    user_id: int

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