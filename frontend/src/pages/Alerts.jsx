import { useState, useEffect } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

const CATEGORY_ICON = {
  login:         "🔐",
  transaction:   "💳",
  user_activity: "👤",
  system:        "📊",
  account:       "⚙️",
};

const TYPE_COLORS = {
  high:    { bg: "rgba(239,68,68,0.12)",   color: "#ef4444", label: "HIGH"    },
  medium:  { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b", label: "MEDIUM"  },
  info:    { bg: "rgba(79,142,247,0.12)",  color: "#4f8ef7", label: "INFO"    },
  success: { bg: "rgba(34,197,94,0.12)",   color: "#22c55e", label: "SUCCESS" },
};

// Category labels for filter tabs
const ADMIN_CATEGORIES = ["all", "login", "transaction", "user_activity", "system"];
const USER_CATEGORIES  = ["login"]; // user sirf login activity dekhe

export function Alerts({ user }) {
  const isAdmin = user?.role === "admin" || user?.role === "analyst";
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState(isAdmin ? "all" : "login");
  const token = localStorage.getItem("ng_token") || "";

  useEffect(() => { fetchAlerts(); }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/alerts?token=${token}&limit=60`);
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    }
    setLoading(false);
  };

  const filtered = alerts.filter(a =>
    filter === "all" ? true : a.category === filter
  );

  const counts = {
    high:    alerts.filter(a => a.type === "high").length,
    medium:  alerts.filter(a => a.type === "medium").length,
    success: alerts.filter(a => a.type === "success").length,
    info:    alerts.filter(a => a.type === "info").length,
  };

  const categories = isAdmin ? ADMIN_CATEGORIES : USER_CATEGORIES;

  const formatTime = (dt) => {
    if (!dt) return "";
    const d    = new Date(dt.replace(" ", "T") + "Z");
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)   return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={s.h2}>
            {isAdmin ? "🔔 System Alerts" : "🔔 My Alerts"}
          </div>
          <div style={s.muted}>
            {isAdmin
              ? "All users' activity — login, transactions, role changes"
              : "Your account activity — logins and transactions"}
          </div>
        </div>
        <button onClick={fetchAlerts} style={{ ...s.navItem, fontSize: 12, padding: "6px 14px" }}>
          ↻ Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div style={s.grid3}>
        {[
          ["🚨 High Risk",  counts.high,    T.red],
          ["⚠️ Medium",     counts.medium,  T.amber],
          ["✅ Success",    counts.success, T.green],
          ["ℹ️ Info",       counts.info,    T.accent],
        ].map(([l, v, c]) => (
          <div key={l} style={s.statCard}>
            <div style={s.statLabel}>{l}</div>
            <div style={{ ...s.statVal, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Category filter tabs */}
      <div style={{ display: "flex", gap: 8, marginTop: 20, marginBottom: 16, flexWrap: "wrap" }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{
              ...s.navItem,
              ...(filter === cat ? s.navItemActive : {}),
              fontSize: 12, textTransform: "capitalize",
            }}>
            {CATEGORY_ICON[cat] || ""} {cat === "all" ? "All" : cat.replace("_", " ")}
            {cat !== "all" && (
              <span style={{ marginLeft: 4, opacity: 0.7 }}>
                ({alerts.filter(a => a.category === cat).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <div style={s.card}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: T.muted }}>Loading alerts...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: T.muted }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔔</div>
            <div>No alerts yet</div>
          </div>
        ) : (
          filtered.map((a, i) => {
            const tc = TYPE_COLORS[a.type] || TYPE_COLORS.info;
            return (
              <div key={a.id} style={{
                display: "flex", gap: 14, padding: "14px 0",
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                alignItems: "flex-start",
              }}>
                {/* Icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                  background: tc.bg, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 18,
                }}>
                  {CATEGORY_ICON[a.category] || "🔔"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>{a.message}</div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: T.muted }}>
                      {formatTime(a.created_at)}
                    </span>
                    {/* Show email for admin view */}
                    {isAdmin && a.user_email && (
                      <span style={{ fontSize: 11, color: T.accent }}>
                        {a.user_email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Badge */}
                <span style={{
                  ...s.badge,
                  background: tc.bg, color: tc.color,
                  flexShrink: 0, fontSize: 10,
                }}>
                  {tc.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function Settings({ user }) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>Settings</div>
        <div style={s.muted}>Account, API configuration, and preferences</div>
      </div>
      <div style={{ ...s.grid2, alignItems: "start" }}>
        <div style={s.card}>
          <div style={s.h3}>Account</div>
          <label style={s.label}>Display Name</label>
          <input style={s.input} defaultValue={user?.name}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />
          <label style={s.label}>Email</label>
          <input style={{ ...s.input, opacity: 0.5 }} defaultValue={user?.email} disabled />
          <label style={s.label}>Role</label>
          <input style={{ ...s.input, opacity: 0.5 }} value={user?.role || "user"} disabled />
          <button style={{ ...s.btn, marginTop: 20 }}>Save Changes</button>
        </div>

        <div style={s.card}>
          <div style={s.h3}>Backend Connection</div>
          <label style={s.label}>API URL</label>
          <input style={s.input} defaultValue="http://localhost:8000"
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
            Point this to your FastAPI backend. Default: http://localhost:8000
          </div>
          <button style={{ ...s.btn, marginTop: 20 }}>Save Settings</button>

          <div style={{ marginTop: 20, padding: 14, background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Backend Status</div>
            {[
              ["/api/market/indices", "Indices"],
              ["/api/market/sectors", "Sectors"],
              ["/api/fraud/test",     "Fraud Detection"],
            ].map(([url, label]) => (
              <div key={url} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", color: T.muted }}>
                <span>{label}</span>
                <span style={{ color: T.accent, fontFamily: "monospace" }}>localhost:8000{url}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...s.card, marginTop: 0 }}>
        <div style={s.h3}>About NexaGuard</div>
        <div style={{ color: T.muted, fontSize: 14, lineHeight: 2 }}>
          NexaGuard is an AI-powered financial fraud detection and market intelligence platform.<br />
          <strong style={{ color: T.text }}>Backend:</strong> FastAPI + Random Forest ML model<br />
          <strong style={{ color: T.text }}>Market Data:</strong> Yahoo Finance API — Live USA market<br />
          <strong style={{ color: T.text }}>Frontend:</strong> React + Recharts<br />
          <strong style={{ color: T.text }}>Version:</strong> 2.0.0
        </div>
      </div>
    </div>
  );
}

export default Alerts;