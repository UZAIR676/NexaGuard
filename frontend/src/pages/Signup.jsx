import { useState } from "react";
import { T, s } from "../theme";

export default function Signup({ onAuth, goLogin }) {
  const [form, setForm]     = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setErr("");
    if (!form.name || !form.email || !form.password) { setErr("Please fill in all fields."); return; }
    if (form.password !== form.confirm) { setErr("Passwords don't match."); return; }
    if (form.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Signup failed"); return; }
      localStorage.setItem("ng_token", data.token);
      onAuth(data.user);
    } catch {
      setErr("Cannot connect to server. Make sure backend is running.");
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
        <div style={s.authTitle}>Create account</div>
        <div style={s.authSub}>Start monitoring financial activity with AI.</div>

        <label style={s.label}>Full Name</label>
        <input style={s.input} placeholder="John Smith" value={form.name} onChange={upd("name")}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border} />

        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="you@company.com" value={form.email} onChange={upd("email")}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border} />

        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="••••••••" value={form.password} onChange={upd("password")}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border} />

        <label style={s.label}>Confirm Password</label>
        <input style={s.input} type="password" placeholder="••••••••" value={form.confirm} onChange={upd("confirm")}
          onKeyDown={e => e.key === "Enter" && submit()}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border} />

        {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>{err}</div>}

        <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </button>
        <span style={s.link} onClick={goLogin}>
          Already have an account? Sign in →
        </span>
      </div>

      <div style={s.authRight}>
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.07 }}
          viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          {[...Array(12)].map((_, i) => <line key={i} x1={50 * i} y1="0" x2={50 * i} y2="700" stroke={T.accent} strokeWidth="1" />)}
          {[...Array(15)].map((_, i) => <line key={i} x1="0" y1={50 * i} x2="600" y2={50 * i} stroke={T.accent} strokeWidth="1" />)}
        </svg>
        <div style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🚀</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, color: T.text }}>
            Join NexaGuard
          </div>
          <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 360 }}>
            Get instant access to AI fraud detection and real-time USA market intelligence.
          </div>
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16, maxWidth: 300, margin: "40px auto 0" }}>
            {["✅ Real-time fraud detection", "✅ Live USA market data", "✅ AI-powered insights", "✅ Free to use"].map(f => (
              <div key={f} style={{ fontSize: 14, color: T.text, textAlign: "left" }}>{f}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}