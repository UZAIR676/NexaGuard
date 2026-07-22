import { useState } from "react";
import { T, s } from "../theme";

export default function ForgotPassword({ goLogin }) {
  const [step, setStep] = useState("request"); // 'request' | 'reset' | 'done'
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    setErr(""); setMsg("");
    if (!email) { setErr("Please enter your email."); return; }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Something went wrong."); return; }
      setMsg(data.message || "If an account exists for this email, a reset code has been sent.");
      setStep("reset");
    } catch {
      setErr("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setErr("");
    if (!otp || otp.length !== 6) { setErr("Enter the 6-digit code from your email."); return; }
    if (newPassword.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (newPassword !== confirm) { setErr("Passwords don't match."); return; }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Could not reset password."); return; }
      setStep("done");
    } catch {
      setErr("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.authWrap}>
      <div style={s.authLeft}>
        <div style={s.logo}>
          <div style={s.logoIcon}>🛡️</div>
          <span style={s.logoText}>NexaGuard</span>
        </div>

        {step === "request" && (
          <>
            <div style={s.authTitle}>Forgot Password</div>
            <div style={s.authSub}>Enter your email and we'll send you a reset code.</div>

            <label style={s.label}>Email</label>
            <input style={s.input} type="email" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && requestCode()}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>⚠️ {err}</div>}

            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={requestCode} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Code →"}
            </button>
            <span style={s.link} onClick={goLogin}>← Back to login</span>
          </>
        )}

        {step === "reset" && (
          <>
            <div style={s.authTitle}>Reset Password</div>
            <div style={s.authSub}>Enter the code we sent and choose a new password.</div>

            {msg && (
              <div style={{
                background: "rgba(79,142,247,0.1)", border: `1px solid rgba(79,142,247,0.2)`,
                borderRadius: 8, padding: "12px 16px", marginBottom: 8, fontSize: 13, color: T.accent
              }}>
                📧 {msg}
              </div>
            )}

            <label style={s.label}>Reset Code</label>
            <input
              style={{ ...s.input, fontSize: 24, fontWeight: 700, textAlign: "center", letterSpacing: 10 }}
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={s.label}>New Password</label>
            <input style={s.input} type="password" placeholder="••••••••"
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={s.label}>Confirm New Password</label>
            <input style={s.input} type="password" placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === "Enter" && resetPassword()}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>⚠️ {err}</div>}

            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={resetPassword} disabled={loading}>
              {loading ? "Resetting..." : "✅ Reset Password"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <span style={s.link} onClick={() => { setStep("request"); setErr(""); setOtp(""); }}>
                ← Use a different email
              </span>
              <span style={s.link} onClick={requestCode}>
                Resend code
              </span>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <div style={s.authTitle}>✅ Password Reset</div>
            <div style={s.authSub}>
              Your password has been changed. For your security, you've been logged out of any active session — please sign in again.
            </div>
            <button style={s.btn} onClick={goLogin}>Go to Login →</button>
          </>
        )}
      </div>

      <div style={s.authRight}>
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.07 }}
          viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          {[...Array(12)].map((_, i) => <line key={i} x1={50*i} y1="0" x2={50*i} y2="700" stroke={T.accent} strokeWidth="1"/>)}
          {[...Array(15)].map((_, i) => <line key={i} x1="0" y1={50*i} x2="600" y2={50*i} stroke={T.accent} strokeWidth="1"/>)}
        </svg>
        <div style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🔑</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, color: T.text }}>
            Account Recovery
          </div>
          <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 360 }}>
            We'll email you a one-time code to verify it's really you before letting you set a new password.
          </div>
        </div>
      </div>
    </div>
  );
}