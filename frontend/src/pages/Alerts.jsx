import { useState, useEffect, useRef } from "react";
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
  high:    { bg: "rgba(239,68,68,0.13)",   border: "rgba(239,68,68,0.30)",   color: "#ef4444", label: "HIGH",    glow: "0 0 12px rgba(239,68,68,0.18)"   },
  medium:  { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.28)",  color: "#f59e0b", label: "MEDIUM",  glow: "0 0 12px rgba(245,158,11,0.15)"  },
  info:    { bg: "rgba(79,142,247,0.10)",  border: "rgba(79,142,247,0.25)",  color: "#4f8ef7", label: "INFO",    glow: "none"                             },
  success: { bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.25)",   color: "#22c55e", label: "SUCCESS", glow: "none"                             },
};

const ADMIN_CATEGORIES = ["all", "login", "transaction", "user_activity", "system"];
const USER_CATEGORIES  = ["login", "transaction"];

/* ─── Helpers ─────────────────────────────────────────────────── */
function timeAgo(dt) {
  if (!dt) return "";
  const d    = new Date(dt.replace(" ", "T") + "Z");
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ─── Inline styles ────────────────────────────────────────────── */
const css = {
  page: {
    fontFamily: "'Inter', sans-serif",
  },
  headerRow: {
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 20,
  },
  statCard: (color) => ({
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${color}33`,
    borderRadius: 12,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  }),
  statVal: (color) => ({
    fontSize: 28,
    fontWeight: 700,
    color,
    letterSpacing: "-1px",
  }),
  statLabel: {
    fontSize: 11,
    color: "#6b7a99",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  searchBar: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "10px 14px 10px 38px",
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  searchWrap: {
    position: "relative",
    marginBottom: 14,
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 15,
    opacity: 0.4,
    pointerEvents: "none",
  },
  tabRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  tab: (active) => ({
    padding: "6px 14px",
    borderRadius: 8,
    border: active ? "1px solid rgba(79,142,247,0.5)" : "1px solid rgba(255,255,255,0.07)",
    background: active ? "rgba(79,142,247,0.15)" : "rgba(255,255,255,0.03)",
    color: active ? "#4f8ef7" : "#6b7a99",
    fontSize: 12,
    cursor: "pointer",
    textTransform: "capitalize",
    transition: "all 0.15s",
  }),
  listWrap: {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    overflow: "hidden",
  },
  alertRow: (tc, read) => ({
    display: "flex",
    gap: 14,
    padding: "15px 18px",
    alignItems: "flex-start",
    background: read ? "transparent" : tc.bg,
    borderLeft: read ? "3px solid transparent" : `3px solid ${tc.color}`,
    transition: "background 0.2s",
    opacity: read ? 0.55 : 1,
  }),
  iconBox: (tc) => ({
    width: 36,
    height: 36,
    borderRadius: 8,
    background: tc.bg,
    border: `1px solid ${tc.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    flexShrink: 0,
  }),
  badge: (tc) => ({
    padding: "3px 8px",
    borderRadius: 6,
    background: tc.bg,
    color: tc.color,
    border: `1px solid ${tc.border}`,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.5px",
    flexShrink: 0,
  }),
  dismissBtn: {
    background: "none",
    border: "none",
    color: "#6b7a99",
    cursor: "pointer",
    fontSize: 16,
    padding: "0 4px",
    lineHeight: 1,
    flexShrink: 0,
    opacity: 0.6,
  },
  autoRefreshBtn: (on) => ({
    padding: "6px 14px",
    borderRadius: 8,
    border: on ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.08)",
    background: on ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.03)",
    color: on ? "#22c55e" : "#6b7a99",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  }),
  pulse: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#22c55e",
    animation: "pulse 1.5s infinite",
  },
};

/* ─── Alerts Component ─────────────────────────────────────────── */
export function Alerts({ user }) {
  const isAdmin = user?.role === "admin" || user?.role === "analyst";
  const [alerts, setAlerts]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState(isAdmin ? "all" : "login");
  const [search, setSearch]       = useState("");
  const [read, setRead]           = useState(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef(null);
  const token = localStorage.getItem("ng_token") || "";

  const fetchAlerts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/alerts?token=${token}&limit=80`);
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchAlerts(true), 8000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  const markRead = (id) => setRead(prev => new Set([...prev, id]));
  const markAllRead = () => setRead(new Set(alerts.map(a => a.id)));

  const filtered = alerts.filter(a => {
    const catOk = filter === "all" || a.category === filter;
    const q = search.toLowerCase();
    const searchOk = !q || a.message?.toLowerCase().includes(q) || a.user_email?.toLowerCase().includes(q);
    return catOk && searchOk;
  });

  const unread = alerts.filter(a => !read.has(a.id)).length;

  const counts = {
    high:    alerts.filter(a => a.type === "high").length,
    medium:  alerts.filter(a => a.type === "medium").length,
    success: alerts.filter(a => a.type === "success").length,
    info:    alerts.filter(a => a.type === "info").length,
  };

  const categories = isAdmin ? ADMIN_CATEGORIES : USER_CATEGORIES;

  return (
    <div style={css.page}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes highPulse { 0%,100%{box-shadow:0 0 0 rgba(239,68,68,0)} 50%{box-shadow:0 0 10px rgba(239,68,68,0.3)} }
      `}</style>

      {/* Header */}
      <div style={css.headerRow}>
        <div>
          <div style={{ ...s.h2, display: "flex", alignItems: "center", gap: 10 }}>
            🔔 {isAdmin ? "System Alerts" : "My Alerts"}
            {unread > 0 && (
              <span style={{
                background: "#ef4444", color: "#fff",
                borderRadius: 20, fontSize: 11, fontWeight: 700,
                padding: "2px 8px", letterSpacing: "0.3px"
              }}>{unread} new</span>
            )}
          </div>
          <div style={s.muted}>
            {isAdmin ? "All user activity — logins, transactions, system events" : "Your account activity"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Auto-refresh toggle */}
          <button onClick={() => setAutoRefresh(v => !v)} style={css.autoRefreshBtn(autoRefresh)}>
            {autoRefresh && <span style={css.pulse} />}
            {autoRefresh ? "Live" : "Auto-refresh"}
          </button>
          {unread > 0 && (
            <button onClick={markAllRead} style={{ ...css.tab(false), padding: "6px 14px" }}>
              ✓ Mark all read
            </button>
          )}
          <button onClick={() => fetchAlerts()} style={{ ...css.tab(false), padding: "6px 14px" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={css.statsGrid}>
        {[
          ["🚨 High Risk", counts.high,    "#ef4444"],
          ["⚠️ Medium",    counts.medium,  "#f59e0b"],
          ["✅ Success",   counts.success, "#22c55e"],
          ["ℹ️ Info",      counts.info,    "#4f8ef7"],
        ].map(([l, v, c]) => (
          <div key={l} style={css.statCard(c)}>
            <div style={css.statLabel}>{l}</div>
            <div style={css.statVal(c)}>{v}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={css.searchWrap}>
        <span style={css.searchIcon}>🔍</span>
        <input
          style={css.searchBar}
          placeholder="Search alerts by message or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor = "rgba(79,142,247,0.4)"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "#6b7a99", cursor: "pointer", fontSize: 16
          }}>×</button>
        )}
      </div>

      {/* Category tabs */}
      <div style={css.tabRow}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={css.tab(filter === cat)}>
            {CATEGORY_ICON[cat] || ""} {cat === "all" ? "All" : cat.replace("_", " ")}
            {cat !== "all" && (
              <span style={{ marginLeft: 4, opacity: 0.6 }}>
                ({alerts.filter(a => a.category === cat).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div style={css.listWrap}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#6b7a99" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
            Loading alerts…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#6b7a99" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔕</div>
            <div style={{ fontSize: 14 }}>{search ? "No alerts match your search" : "No alerts yet"}</div>
          </div>
        ) : (
          filtered.map((a, i) => {
            const tc      = TYPE_COLORS[a.type] || TYPE_COLORS.info;
            const isRead  = read.has(a.id);
            const isHigh  = a.type === "high";
            return (
              <div
                key={a.id}
                style={{
                  ...css.alertRow(tc, isRead),
                  borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  animation: isHigh && !isRead ? "highPulse 2.5s infinite" : "none",
                }}
              >
                {/* Icon */}
                <div style={css.iconBox(tc)}>
                  {CATEGORY_ICON[a.category] || "🔔"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: isRead ? "#6b7a99" : "#e2e8f0" }}>
                    {a.message}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#6b7a99" }}>{timeAgo(a.created_at)}</span>
                    {isAdmin && a.user_email && (
                      <span style={{
                        fontSize: 11, color: "#4f8ef7",
                        background: "rgba(79,142,247,0.1)",
                        padding: "1px 7px", borderRadius: 5,
                      }}>
                        {a.user_email}
                      </span>
                    )}
                    {a.category && (
                      <span style={{
                        fontSize: 10, color: "#6b7a99",
                        background: "rgba(255,255,255,0.05)",
                        padding: "1px 6px", borderRadius: 4, textTransform: "capitalize"
                      }}>
                        {a.category.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Badge + Dismiss */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span style={css.badge(tc)}>{tc.label}</span>
                  {!isRead && (
                    <button
                      onClick={() => markRead(a.id)}
                      style={css.dismissBtn}
                      title="Mark as read"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ textAlign: "right", fontSize: 11, color: "#6b7a99", marginTop: 10 }}>
          Showing {filtered.length} of {alerts.length} alerts
        </div>
      )}
    </div>
  );
}

/* ─── Settings Component ───────────────────────────────────────── */
export function Settings({ user }) {
  const [apiUrl, setApiUrl]         = useState("http://localhost:8000");
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [pingResults, setPingResults] = useState({});
  const [pinging, setPinging]       = useState(false);
  const [saved, setSaved]           = useState(false);

  const ENDPOINTS = [
    ["/api/market/indices",  "📈 Market Indices"],
    ["/api/market/sectors",  "🏭 Sectors"],
    ["/api/fraud/test",      "🤖 Fraud Detection"],
    ["/api/alerts",          "🔔 Alerts"],
  ];

  const pingAll = async () => {
    setPinging(true);
    const results = {};
    await Promise.all(
      ENDPOINTS.map(async ([url]) => {
        const t0 = Date.now();
        try {
          const res = await fetch(`${apiUrl}${url}?token=${localStorage.getItem("ng_token")}&limit=1`, { signal: AbortSignal.timeout(3000) });
          results[url] = { ok: res.ok, ms: Date.now() - t0 };
        } catch {
          results[url] = { ok: false, ms: null };
        }
      })
    );
    setPingResults(results);
    setPinging(false);
  };

  const saveSettings = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 9,
    padding: "10px 14px",
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 14,
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    fontSize: 11,
    color: "#6b7a99",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    marginBottom: 6,
    display: "block",
  };

  const cardStyle = {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 24,
    marginBottom: 16,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>⚙️ Settings</div>
        <div style={s.muted}>Account preferences and backend configuration</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>

        {/* Account Card */}
        <div style={cardStyle}>
          <div style={{ ...s.h3, marginBottom: 18 }}>👤 Account</div>

          <label style={labelStyle}>Display Name</label>
          <input
            style={inputStyle}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            onFocus={e => e.target.style.borderColor = "rgba(79,142,247,0.5)"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
          />

          <label style={labelStyle}>Email</label>
          <input style={{ ...inputStyle, opacity: 0.45, cursor: "not-allowed" }} value={user?.email || ""} disabled />

          <label style={labelStyle}>Role</label>
          <div style={{
            padding: "8px 14px", borderRadius: 9, marginBottom: 14,
            background: user?.role === "admin" ? "rgba(239,68,68,0.1)" : "rgba(79,142,247,0.1)",
            border: `1px solid ${user?.role === "admin" ? "rgba(239,68,68,0.25)" : "rgba(79,142,247,0.25)"}`,
            color: user?.role === "admin" ? "#ef4444" : "#4f8ef7",
            fontSize: 13, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {user?.role === "admin" ? "🛡️" : user?.role === "analyst" ? "📊" : "👤"}
            {(user?.role || "user").charAt(0).toUpperCase() + (user?.role || "user").slice(1)}
          </div>

          <button
            onClick={saveSettings}
            style={{
              width: "100%", padding: "11px", borderRadius: 9,
              background: saved ? "rgba(34,197,94,0.2)" : "rgba(79,142,247,0.2)",
              border: `1px solid ${saved ? "rgba(34,197,94,0.4)" : "rgba(79,142,247,0.4)"}`,
              color: saved ? "#22c55e" : "#4f8ef7",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>

        {/* Backend Card */}
        <div style={cardStyle}>
          <div style={{ ...s.h3, marginBottom: 18 }}>🔌 Backend Connection</div>

          <label style={labelStyle}>API URL</label>
          <input
            style={inputStyle}
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            placeholder="http://localhost:8000"
            onFocus={e => e.target.style.borderColor = "rgba(79,142,247,0.5)"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
          />

          <button
            onClick={pingAll}
            disabled={pinging}
            style={{
              width: "100%", padding: "10px", borderRadius: 9,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0", fontSize: 13, cursor: pinging ? "wait" : "pointer",
              marginBottom: 16, opacity: pinging ? 0.7 : 1,
            }}
          >
            {pinging ? "⏳ Pinging..." : "🏓 Ping All Endpoints"}
          </button>

          {/* Endpoint list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ENDPOINTS.map(([url, label]) => {
              const r = pingResults[url];
              return (
                <div key={url} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    r == null ? "rgba(255,255,255,0.06)"
                    : r.ok    ? "rgba(34,197,94,0.25)"
                              : "rgba(239,68,68,0.25)"
                  }`,
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#e2e8f0" }}>{label}</div>
                    <div style={{ fontSize: 10, color: "#6b7a99", fontFamily: "monospace", marginTop: 2 }}>
                      {apiUrl}{url}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {r == null ? (
                      <span style={{ color: "#6b7a99" }}>—</span>
                    ) : r.ok ? (
                      <span style={{ color: "#22c55e" }}>✓ {r.ms}ms</span>
                    ) : (
                      <span style={{ color: "#ef4444" }}>✗ down</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* About Card */}
      <div style={{ ...cardStyle, marginBottom: 0 }}>
        <div style={{ ...s.h3, marginBottom: 16 }}>🛡️ About NexaGuard</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            ["Backend",   "FastAPI + Random Forest ML",  "⚡"],
            ["Market",    "Yahoo Finance — Live USA",     "📈"],
            ["Frontend",  "React + Recharts",             "⚛️"],
            ["Version",   "2.0.0",                        "🔖"],
          ].map(([k, v, icon]) => (
            <div key={k} style={{
              padding: "14px 16px", borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 10, color: "#6b7a99", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Alerts;