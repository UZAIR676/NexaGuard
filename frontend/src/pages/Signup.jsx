import { useState } from "react";
import { T, s } from "../theme";

export default function Signup({ onAuth, goLogin }) {
  const [step, setStep]     = useState("signup"); // 'signup' | 'otp'
  const [form, setForm]     = useState({ name: "", email: "", password: "", confirm: "" });
  const [otp, setOtp]       = useState("");
  const [err, setErr]       = useState("");
  const [msg, setMsg]       = useState("");
  const [loading, setLoading] = useState(false);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const signup = async () => {
    setErr("");
    if (!form.name || !form.email || !form.password) { setErr("Please fill in all fields."); return; }
    if (form.password !== form.confirm) { setErr("Passwords don't match."); return; }
    if (form.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Signup failed"); return; }
      setStep("otp");
      setMsg(`OTP sent to ${form.email}`);
    } catch { setErr("Cannot connect to server."); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setErr("");
    if (!otp || otp.length !== 6) { setErr("Enter 6 digit OTP"); return; }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Invalid OTP"); return; }
      localStorage.setItem("ng_token", data.token);
      onAuth(data.user);
    } catch { setErr("Cannot connect to server."); }
    finally { setLoading(false); }
  };

  const resendOtp = async () => {
    setErr(""); setMsg("");
    try {
      const res = await fetch("http://localhost:8000/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Failed"); return; }
      setMsg("New OTP sent to your email!");
    } catch { setErr("Cannot connect to server."); }
  };

  return (
    <div style={s.authWrap}>
      <div style={s.authLeft}>
        <div style={s.logo}>
          <div style={s.logoIcon}>🛡️</div>
          <span style={s.logoText}>NexaGuard</span>
        </div>

        {step === "signup" ? (
          <>
            <div style={s.authTitle}>Create account</div>
            <div style={s.authSub}>Start monitoring financial activity with AI.</div>

            <label style={s.label}>Full Name</label>
            <input style={s.input} placeholder="John Smith" value={form.name} onChange={upd("name")}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={s.label}>Email</label>
            <input style={s.input} type="email" placeholder="you@email.com" value={form.email} onChange={upd("email")}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={s.label}>Password</label>
            <input style={s.input} type="password" placeholder="••••••••" value={form.password} onChange={upd("password")}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={s.label}>Confirm Password</label>
            <input style={s.input} type="password" placeholder="••••••••" value={form.confirm} onChange={upd("confirm")}
              onKeyDown={e => e.key === "Enter" && signup()}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>⚠️ {err}</div>}

            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={signup} disabled={loading}>
              {loading ? "Sending OTP..." : "Create Account →"}
            </button>
            <span style={s.link} onClick={goLogin}>Already have an account? Sign in →</span>
          </>
        ) : (
          <>
            <div style={s.authTitle}>Verify Email</div>
            <div style={s.authSub}>Enter the 6-digit code sent to your email.</div>

            <div style={{ background: "rgba(79,142,247,0.1)", border: `1px solid rgba(79,142,247,0.2)`, borderRadius: 8, padding: "12px 16px", marginBottom: 8, fontSize: 13, color: T.accent }}>
              📧 {msg || `OTP sent to ${form.email}`}
            </div>

            <label style={s.label}>OTP Code</label>
            <input
              style={{ ...s.input, fontSize: 28, fontWeight: 700, textAlign: "center", letterSpacing: 12 }}
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && verifyOtp()}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>⚠️ {err}</div>}

            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={verifyOtp} disabled={loading}>
              {loading ? "Verifying..." : "✅ Verify & Login"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <span style={s.link} onClick={() => { setStep("signup"); setErr(""); setOtp(""); }}>
                ← Back
              </span>
              <span style={s.link} onClick={resendOtp}>
                Resend OTP
              </span>
            </div>
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
          <div style={{ fontSize: 56, marginBottom: 20 }}>
            {step === "otp" ? "📧" : "🚀"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, color: T.text }}>
            {step === "otp" ? "Check Your Email" : "Join NexaGuard"}
          </div>
          <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 360 }}>
            {step === "otp"
              ? "We sent a 6-digit verification code to your email. It expires in 10 minutes."
              : "Get instant access to AI fraud detection and real-time USA market intelligence."}
          </div>
          {step === "signup" && (
            <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16, maxWidth: 300, margin: "40px auto 0" }}>
              {["✅ Real-time fraud detection", "✅ Live USA market data", "✅ AI-powered insights", "✅ Email notifications", "✅ Free to use"].map(f => (
                <div key={f} style={{ fontSize: 14, color: T.text, textAlign: "left" }}>{f}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}