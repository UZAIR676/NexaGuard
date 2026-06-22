import { useState } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

export default function Profile({ user, onLogout, onUpdate }) {
  const [form, setForm]     = useState({ name: user.name || "" });
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [msg, setMsg]       = useState("");
  const [err, setErr]       = useState("");
  const [pwMsg, setPwMsg]   = useState("");
  const [pwErr, setPwErr]   = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab]       = useState("profile");

  const token = localStorage.getItem("ng_token");

  const save = async () => {
    setMsg(""); setErr("");
    if (!form.name.trim()) { setErr("Name khali nahi ho sakta"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/auth/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: form.name }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Update failed"); return; }
      onUpdate({ ...user, name: form.name });
      setMsg("✅ Profile updated!");
    } catch { setErr("Server se connect nahi ho raha"); }
    setLoading(false);
  };

  const changePassword = async () => {
    setPwMsg(""); setPwErr("");
    if (!pwForm.current)              { setPwErr("Current password required"); return; }
    if (!pwForm.newPw)                { setPwErr("New password required"); return; }
    if (pwForm.newPw.length < 6)      { setPwErr("Min 6 characters chahiye"); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwErr("Passwords match nahi kar rahe"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/auth/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: user.name, current_password: pwForm.current, new_password: pwForm.newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwErr(data.detail || "Failed"); return; }
      setPwMsg("✅ Password changed!");
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch { setPwErr("Server se connect nahi ho raha"); }
    setLoading(false);
  };

  const avatarColors = ["#4F8EF7","#22C55E","#F59E0B","#EF4444","#8B5CF6"];
  const avatarColor  = avatarColors[user.name?.charCodeAt(0) % avatarColors.length] || T.accent;
  const roleColor    = user.role === "admin" ? T.red : user.role === "analyst" ? T.amber : T.accent;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={s.h2}>Profile</div>
        <div style={s.muted}>Manage your account</div>
      </div>

      {/* Avatar Banner */}
      <div style={{ ...s.card, marginBottom: 20, display: "flex", alignItems: "center", gap: 24, padding: 28 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%", background: avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 700, color: "#fff",
          boxShadow: `0 0 24px ${avatarColor}55`, flexShrink: 0
        }}>
          {user.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{user.name}</div>
          <div style={{ color: T.muted, fontSize: 14 }}>{user.email}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <span style={{ ...s.badge, ...s.badgeGreen }}>● Active</span>
            <span style={{ ...s.badge, color: roleColor, background: `${roleColor}22` }}>
              {user.role?.toUpperCase()}
            </span>
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 12, color: T.muted }}>Balance</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.green }}>
            ${parseFloat(user.balance || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["profile","👤 Profile"], ["password","🔑 Password"], ["danger","⚠️ Account"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...s.navItem, ...(tab === t ? s.navItemActive : {}) }}>
            {l}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === "profile" && (
        <div style={s.card}>
          <div style={s.h3}>Account Details</div>
          <label style={s.label}>Full Name</label>
          <input style={s.input} value={form.name} onChange={e => setForm({ name: e.target.value })}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <label style={s.label}>Email</label>
          <input style={{ ...s.input, opacity: 0.5 }} value={user.email} disabled />

          <label style={s.label}>Role</label>
          <input style={{ ...s.input, opacity: 0.5 }} value={user.role?.toUpperCase()} disabled />

          {msg && <div style={{ color: T.green, fontSize: 13, marginTop: 12 }}>{msg}</div>}
          {err && <div style={{ color: T.red,   fontSize: 13, marginTop: 12 }}>⚠️ {err}</div>}

          <button style={{ ...s.btn, marginTop: 20, opacity: loading ? 0.7 : 1 }} onClick={save} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Password Tab */}
      {tab === "password" && (
        <div style={s.card}>
          <div style={s.h3}>Change Password</div>
          <label style={s.label}>Current Password</label>
          <input style={s.input} type="password" placeholder="••••••••"
            value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <label style={s.label}>New Password</label>
          <input style={s.input} type="password" placeholder="••••••••"
            value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <label style={s.label}>Confirm New Password</label>
          <input style={s.input} type="password" placeholder="••••••••"
            value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          {pwMsg && <div style={{ color: T.green, fontSize: 13, marginTop: 12 }}>{pwMsg}</div>}
          {pwErr && <div style={{ color: T.red,   fontSize: 13, marginTop: 12 }}>⚠️ {pwErr}</div>}

          <button style={{ ...s.btn, marginTop: 20, opacity: loading ? 0.7 : 1 }} onClick={changePassword} disabled={loading}>
            {loading ? "Changing..." : "Change Password"}
          </button>
        </div>
      )}

      {/* Danger Zone */}
      {tab === "danger" && (
        <div style={{ ...s.card, borderColor: "rgba(239,68,68,0.3)" }}>
          <div style={{ ...s.h3, color: T.red }}>Account Actions</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>
            Sign out from your current session.
          </div>
          <button onClick={onLogout} style={{
            ...s.btn, background: "rgba(239,68,68,0.15)", color: T.red,
            border: `1px solid rgba(239,68,68,0.3)`, width: "auto", padding: "10px 24px"
          }}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}