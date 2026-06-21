import smtplib, random, string, os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# ── Config from .env ───────────────────────────────────────────────────────
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_PASS = os.getenv("GMAIL_PASS")

def send_email(to: str, subject: str, html: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"NexaGuard <{GMAIL_USER}>"
    msg["To"]      = to
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
            s.login(GMAIL_USER, GMAIL_PASS)
            s.sendmail(GMAIL_USER, to, msg.as_string())
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

def generate_otp():
    return "".join(random.choices(string.digits, k=6))

# ── Email Templates ────────────────────────────────────────────────────────
def otp_email(name: str, otp: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0A0D14;color:#E8EDF5;padding:40px;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
            <div style="font-size:36px;">🛡️</div>
            <h2 style="color:#4F8EF7;margin:8px 0;">NexaGuard</h2>
        </div>
        <h3 style="margin-bottom:8px;">Hello {name}!</h3>
        <p style="color:#6B7A99;">Your verification code is:</p>
        <div style="text-align:center;margin:32px 0;">
            <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#4F8EF7;background:#161C2D;padding:20px;border-radius:12px;border:1px solid #1E2740;">
                {otp}
            </div>
        </div>
        <p style="color:#6B7A99;font-size:13px;">This code expires in <strong style="color:#E8EDF5;">10 minutes</strong>.</p>
        <p style="color:#6B7A99;font-size:13px;">If you did not request this, ignore this email.</p>
        <hr style="border:1px solid #1E2740;margin:24px 0;">
        <p style="color:#6B7A99;font-size:12px;text-align:center;">NexaGuard — AI-Powered Fraud Intelligence</p>
    </div>
    """

def transaction_email(name: str, txn_type: str, amount: float, status: str, balance: float) -> str:
    icon  = "↑" if txn_type in ["send","withdraw"] else "↓"
    color = "#EF4444" if txn_type in ["send","withdraw"] else "#22C55E"
    status_color = "#22C55E" if status == "completed" else "#EF4444"
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0A0D14;color:#E8EDF5;padding:40px;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
            <div style="font-size:36px;">🛡️</div>
            <h2 style="color:#4F8EF7;margin:8px 0;">NexaGuard</h2>
        </div>
        <h3>Transaction Alert</h3>
        <p style="color:#6B7A99;">Hello {name}, here's your transaction summary:</p>
        <div style="background:#161C2D;border:1px solid #1E2740;border-radius:12px;padding:24px;margin:24px 0;">
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span style="color:#6B7A99;">Type</span>
                <span style="font-weight:700;text-transform:capitalize;">{icon} {txn_type}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span style="color:#6B7A99;">Amount</span>
                <span style="font-weight:700;font-size:20px;color:{color};">${amount:,.2f}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
                <span style="color:#6B7A99;">Status</span>
                <span style="font-weight:700;color:{status_color};">{status.upper()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span style="color:#6B7A99;">New Balance</span>
                <span style="font-weight:700;">${balance:,.2f}</span>
            </div>
        </div>
        <p style="color:#6B7A99;font-size:13px;">If you did not make this transaction, contact support immediately.</p>
        <hr style="border:1px solid #1E2740;margin:24px 0;">
        <p style="color:#6B7A99;font-size:12px;text-align:center;">NexaGuard — AI-Powered Fraud Intelligence</p>
    </div>
    """

def welcome_email(name: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0A0D14;color:#E8EDF5;padding:40px;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
            <div style="font-size:48px;">🛡️</div>
            <h2 style="color:#4F8EF7;margin:8px 0;">Welcome to NexaGuard!</h2>
        </div>
        <h3>Hello {name}! 👋</h3>
        <p style="color:#6B7A99;">Your account has been successfully verified. You now have access to:</p>
        <div style="background:#161C2D;border:1px solid #1E2740;border-radius:12px;padding:24px;margin:24px 0;">
            <p style="margin:8px 0;">✅ AI-Powered Fraud Detection</p>
            <p style="margin:8px 0;">📈 Live USA Market Data</p>
            <p style="margin:8px 0;">🏦 Banking & Transactions</p>
            <p style="margin:8px 0;">🔔 Real-time Alerts</p>
        </div>
        <hr style="border:1px solid #1E2740;margin:24px 0;">
        <p style="color:#6B7A99;font-size:12px;text-align:center;">NexaGuard — AI-Powered Fraud Intelligence</p>
    </div>
    """