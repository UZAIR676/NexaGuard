import { useState } from "react";
import { T, s } from "../theme";

export default function Profile({ user, onLogout, onUpdate }) {
  const [form, setForm] = useState({ name: user.name || "", email: user.email || "" });
  const [msg, setMsg]   = useState("");
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setMsg(""); setErr("");
    const token = localStorage.getItem("ng_token");
    if (!token) { setErr("Not logged in"); return; }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/auth/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: form.name }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Update failed"); return; }
      onUpdate({ ...user, name: form.name });
      setMsg("Profile updated successfully!");
    } catch {
      setErr("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const avatarColors = ["#4F8EF7", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"];
  const avatarColor  = avatarColors[user.name?.charCodeAt(0) % avatarColors.length] || T.accent;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={s.h2}>Profile</div>
        <div style={s.muted}>Manage your account information</div>
      </div>

      {/* Avatar + Name Banner */}
      <div style={{ ...s.card, marginBottom: 20, display: "flex", alignItems: "center", gap: 24, padding: 28 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 700, color: "#fff",
          boxShadow: `0 0 24px ${avatarColor}55`, flexShrink: 0
        }}>
          {user.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{user.name}</div>
          <div style={{ color: T.muted, fontSize: 14 }}>{user.email}</div>
          <div style={{ marginTop: 8 }}>
            <span style={{ ...s.badge, ...s.badgeGreen }}>● Active</span>
            <span style={{ ...s.badge, background: "rgba(79,142,247,0.15)", color: T.accent, marginLeft: 8 }}>Analyst</span>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.h3}>Account Details</div>

        <label style={s.label}>Full Name</label>
        <input style={s.input} value={form.name} onChange={upd("name")}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border} />

        <label style={s.label}>Email</label>
        <input style={{ ...s.input, opacity: 0.5 }} value={form.email} disabled />
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Email cannot be changed</div>

        <label style={s.label}>Role</label>
        <input style={{ ...s.input, opacity: 0.5 }} value="Analyst" disabled />

        {msg && <div style={{ color: T.green, fontSize: 13, marginTop: 12 }}>✅ {msg}</div>}
        {err && <div style={{ color: T.red,   fontSize: 13, marginTop: 12 }}>⚠️ {err}</div>}

        <button style={{ ...s.btn, marginTop: 20, opacity: loading ? 0.7 : 1 }} onClick={save} disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Stats */}
      <div style={s.grid3}>
        {[
          ["🛡️", "Fraud Checks", "Session"],
          ["📈", "Market Views", "Today"],
          ["🔔", "Alerts", "Active"],
        ].map(([icon, label, sub]) => (
          <div key={label} style={{ ...s.statCard, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <div style={{ ...s.card, marginTop: 20, borderColor: "rgba(239,68,68,0.3)" }}>
        <div style={{ ...s.h3, color: T.red }}>Account Actions</div>
        <div style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>
          Sign out from your current session.
        </div>
        <button
          onClick={onLogout}
          style={{ ...s.btn, background: "rgba(239,68,68,0.15)", color: T.red, border: `1px solid rgba(239,68,68,0.3)`, width: "auto", padding: "10px 24px" }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}