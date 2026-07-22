import { useState, useEffect, useRef } from "react";
import { T, s, applyThemeVars } from "../theme";

const BASE = "http://localhost:8000";

// ── Bubble-style toggle switch ─────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 46, height: 26, borderRadius: 999, border: "none",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        background: checked ? T.accent : T.border,
        position: "relative", transition: "background 0.2s", flexShrink: 0, padding: 0,
      }}
      aria-pressed={checked}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.2s",
      }} />
    </button>
  );
}

function Row({ icon, title, desc, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16, padding: "14px 0", borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ fontSize: 18, marginTop: 1 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          {desc && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{desc}</div>}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{right}</div>
    </div>
  );
}

const ACCENTS = ["#4F8EF7", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export default function Settings({ user }) {
  const [token, setToken] = useState(localStorage.getItem("ng_token"));
  const [prefs, setPrefs] = useState(null);       // null until loaded from backend
  const [twoFA, setTwoFA] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState(false);   // NEW: shows a small warning if a save fails
  const [loadErr, setLoadErr] = useState("");
  const [sessions, setSessions] = useState(null);
  const [signOutMsg, setSignOutMsg] = useState("");

  // NEW: refs used to queue/merge rapid notification toggle changes so they
  // don't race each other and overwrite one another's results.
  const notifPending = useRef(null);
  const notifSaving = useRef(false);

  useEffect(() => {
    loadSettings();
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    setLoadErr("");
    try {
      const r = await fetch(`${BASE}/api/settings?token=${token}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Failed to load settings");
      setPrefs(d.preferences);
      setTwoFA(d.two_fa_enabled);
      // Account is the source of truth — sync CSS vars in case this device's
      // cached theme (from a previous login) is stale.
      applyThemeVars(d.preferences.theme, d.preferences.accent);
    } catch (e) {
      setLoadErr("Settings load nahi ho saki — server check karo");
    }
    setLoading(false);
  };

  const loadSessions = async () => {
    try {
      const r = await fetch(`${BASE}/api/settings/sessions?token=${token}`);
      const d = await r.json();
      setSessions(Array.isArray(d.sessions) ? d.sessions : null);
    } catch {
      setSessions(null);
    }
  };

  // Persist a partial preferences patch to the backend (merged server-side).
  // Used by theme/accent/language/currency — unchanged from before.
  const persist = async (patch) => {
    setSaving(true);
    setSaveErr(false);
    try {
      const r = await fetch(`${BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, preferences: patch }),
      });
      const d = await r.json();
      if (r.ok) {
        setPrefs(d.preferences);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } else {
        setSaveErr(true);
      }
    } catch {
      setSaveErr(true);
    }
    setSaving(false);
  };

  // NEW: notification toggles now go through a small merge-queue instead of
  // calling persist() directly. This fixes the race condition where rapid
  // toggling of multiple switches could overwrite each other.
  const updateNotif = async (key, val) => {
    // optimistic UI update — toggle flips immediately
    setPrefs(p => ({ ...p, notif: { ...p.notif, [key]: val } }));

    notifPending.current = { ...(notifPending.current || {}), [key]: val };

    if (notifSaving.current) return; // a save is already in flight, it'll pick this up
    notifSaving.current = true;
    setSaving(true);
    setSaveErr(false);

    while (notifPending.current) {
      const toSend = notifPending.current;
      notifPending.current = null;
      try {
        const r = await fetch(`${BASE}/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, preferences: { notif: toSend } }),
        });
        const d = await r.json();
        if (r.ok) {
          setPrefs(d.preferences);
        } else {
          setSaveErr(true);
        }
      } catch {
        setSaveErr(true);
      }
    }

    notifSaving.current = false;
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const toggleTwoFA = async (val) => {
    setTwoFA(val); // optimistic
    try {
      const r = await fetch(`${BASE}/api/settings/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, enabled: val }),
      });
      const d = await r.json();
      if (r.ok) setTwoFA(d.two_fa_enabled);
      else setTwoFA(!val); // revert on failure
    } catch {
      setTwoFA(!val);
    }
  };

  const signOutOthers = async () => {
    if (!window.confirm("Sign out of other devices? This rotates your login token.")) return;
    setSignOutMsg("");
    try {
      const r = await fetch(`${BASE}/api/settings/sign-out-others`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (r.ok && d.token) {
        localStorage.setItem("ng_token", d.token);
        setToken(d.token);
        setSignOutMsg("✅ Other sessions signed out — this device stays logged in");
        loadSessions();
      } else {
        setSignOutMsg(d.detail || "Could not complete request");
      }
    } catch {
      setSignOutMsg("Server se connect nahi ho raha");
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", color: T.muted, fontSize: 14 }}>
        Loading settings...
      </div>
    );
  }

  if (loadErr) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ ...s.card, borderColor: "rgba(239,68,68,0.3)" }}>
          <div style={{ color: T.red, fontSize: 14, marginBottom: 12 }}>⚠️ {loadErr}</div>
          <button style={s.btn} onClick={() => { setLoading(true); loadSettings(); }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={s.h2}>Settings</div>
          <div style={s.muted}>App preferences and security</div>
        </div>
        {saving && <span style={{ ...s.badge, fontSize: 12 }}>Saving...</span>}
        {!saving && saved && <span style={{ ...s.badge, ...s.badgeGreen, fontSize: 12 }}>✅ Saved</span>}
        {!saving && saveErr && <span style={{ ...s.badge, background: "rgba(239,68,68,0.15)", color: T.red, fontSize: 12 }}>⚠️ Save failed</span>}
      </div>

      {/* Notifications */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.h3}>🔔 Notifications</div>
        <Row icon="🚨" title="Fraud alerts" desc="Get notified immediately on suspicious activity"
          right={<Toggle checked={prefs.notif.fraud} onChange={v => updateNotif("fraud", v)} />} />
        <Row icon="📧" title="Email alerts" desc="Send a copy of important alerts to your email"
          right={<Toggle checked={prefs.notif.email} onChange={v => updateNotif("email", v)} />} />
        <Row icon="💰" title="Low balance warning" desc="Alert when balance drops below your threshold"
          right={<Toggle checked={prefs.notif.lowBalance} onChange={v => updateNotif("lowBalance", v)} />} />
        <Row icon="📊" title="Weekly summary" desc="A digest of activity every Monday"
          right={<Toggle checked={prefs.notif.weekly} onChange={v => updateNotif("weekly", v)} />} />
      </div>

      {/* Appearance */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.h3}>🎨 Appearance</div>
        <Row icon="🌗" title="Theme" desc="Switch between dark and light mode"
          right={
            <div style={{ display: "flex", gap: 6, background: T.surface, borderRadius: 999, padding: 3, border: `1px solid ${T.border}` }}>
              {["dark", "light"].map(t => (
                <button key={t} onClick={() => { applyThemeVars(t, prefs.accent); persist({ theme: t }); }}
                  style={{
                    padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                    background: prefs.theme === t ? T.accent : "transparent",
                    color: prefs.theme === t ? "#fff" : T.muted,
                  }}>
                  {t === "dark" ? "🌙" : "☀️"} {t}
                </button>
              ))}
            </div>
          } />
        <Row icon="🎯" title="Accent color" desc="Used for buttons, highlights and badges"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              {ACCENTS.map(c => (
                <button key={c} onClick={() => { applyThemeVars(prefs.theme, c); persist({ accent: c }); }}
                  style={{
                    width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer",
                    border: prefs.accent === c ? `2px solid ${T.text || "#fff"}` : "2px solid transparent",
                    boxShadow: prefs.accent === c ? `0 0 0 2px ${c}55` : "none",
                  }} />
              ))}
            </div>
          } />
        <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>
          Changes apply instantly across the whole app and are saved to your account, so they
          carry over next time you log in on any device.
        </div>
      </div>

      {/* Security */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.h3}>🛡️ Security</div>
        <Row icon="🔒" title="Two-factor authentication" desc="Extra email code at login, on top of your password and Face ID"
          right={<Toggle checked={twoFA} onChange={toggleTwoFA} />} />
        <div style={{ fontSize: 11, color: T.muted, padding: "4px 0 10px" }}>
          When on, a 6-digit code is emailed to you as the final step at login — after your
          password and Face ID check succeed.
        </div>

        <div style={{ padding: "14px 0" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>💻 Recent sign-ins</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
            Only your latest sign-in stays active — logging in elsewhere or hitting "sign out of
            other devices" instantly invalidates the rest.
          </div>
          {(sessions || [{ device: "This device", location: "Current session", current: true }]).map((sess, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", background: T.surface, borderRadius: 8,
              border: `1px solid ${T.border}`, marginBottom: 8, fontSize: 13,
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{sess.device || "Unknown device"}</div>
                <div style={{ color: T.muted, fontSize: 12 }}>
                  {sess.location || "Unknown location"}
                  {sess.last_seen && ` · ${new Date(sess.last_seen).toLocaleString()}`}
                </div>
              </div>
              {sess.current && <span style={{ ...s.badge, ...s.badgeGreen, fontSize: 11 }}>Active</span>}
            </div>
          ))}
          <button style={{ ...s.btn, ...s.btnSec, marginTop: 4 }} onClick={signOutOthers}>
            Sign out of other devices
          </button>
          {signOutMsg && <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>{signOutMsg}</div>}
        </div>
      </div>

      {/* Language & Region */}
      <div style={s.card}>
        <div style={s.h3}>🌐 Language & Region</div>
        <label style={s.label}>Language</label>
        <select style={s.input} value={prefs.language} onChange={e => persist({ language: e.target.value })}>
          <option value="en">English</option>
          <option value="ur">اردو (Urdu)</option>
          <option value="hi">हिन्दी (Hindi)</option>
        </select>

        <label style={s.label}>Currency</label>
        <select style={s.input} value={prefs.currency} onChange={e => persist({ currency: e.target.value })}>
          <option value="USD">USD ($)</option>
          <option value="PKR">PKR (₨)</option>
          <option value="INR">INR (₹)</option>
          <option value="EUR">EUR (€)</option>
        </select>
      </div>
    </div>
  );
}