import { useState } from "react";
import { T, s } from "../theme";

export default function Login({ onAuth, goSignup }) {
  const [form, setForm]     = useState({ email: "", password: "" });
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setErr("");
    if (!form.email || !form.password) { setErr("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Login failed"); return; }
      localStorage.setItem("ng_token", data.token);
      onAuth(data.user);
    } catch {
      setErr("Cannot connect to server. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const guest = () => onAuth({ name: "Guest", email: "guest@nexaguard.ai" });

  return (
    <div style={s.authWrap}>
      <div style={s.authLeft}>
        <div style={s.logo}>
          <div style={s.logoIcon}>🛡️</div>
          <span style={s.logoText}>NexaGuard</span>
        </div>
        <div style={s.authTitle}>Welcome back</div>
        <div style={s.authSub}>Sign in to your fraud intelligence dashboard.</div>

        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="you@company.com"
          value={form.email} onChange={upd("email")}
          onKeyDown={e => e.key === "Enter" && submit()}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border} />

        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="••••••••"
          value={form.password} onChange={upd("password")}
          onKeyDown={e => e.key === "Enter" && submit()}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border} />

        {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>{err}</div>}

        <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
        <button style={{ ...s.btn, ...s.btnSec }} onClick={guest}>
          Demo — Continue as Guest
        </button>
        <span style={s.link} onClick={goSignup}>
          Don't have an account? Sign up →
        </span>
      </div>

      <div style={s.authRight}>
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.07 }}
          viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          {[...Array(12)].map((_, i) => <line key={i} x1={50 * i} y1="0" x2={50 * i} y2="700" stroke={T.accent} strokeWidth="1" />)}
          {[...Array(15)].map((_, i) => <line key={i} x1="0" y1={50 * i} x2="600" y2={50 * i} stroke={T.accent} strokeWidth="1" />)}
        </svg>
        <div style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🛡️</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, color: T.text }}>
            AI-Powered Fraud Intelligence
          </div>
          <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 360 }}>
            Real-time transaction monitoring, ML-based fraud scoring, and live USA market data — all in one place.
          </div>
          <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 48 }}>
            {[["99.7%", "Detection Rate"], ["<50ms", "Response Time"], ["24/7", "Monitoring"]].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.accent }}>{v}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}