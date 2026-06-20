import { T, s } from "../theme";

const ALL_ALERTS = [
  { time: "2 min ago", msg: "High-risk transaction blocked: $12,400 wire transfer", type: "high" },
  { time: "18 min ago", msg: "Unusual pattern: 3 transactions in 60 seconds", type: "medium" },
  { time: "1 hr ago", msg: "New login from unrecognized device – IP 45.22.x.x", type: "medium" },
  { time: "3 hr ago", msg: "Fraud model retrained with 2,400 new samples", type: "info" },
  { time: "Yesterday", msg: "Daily fraud summary: 12 blocked transactions, $48,200 saved.", type: "info" },
  { time: "Yesterday", msg: "Model accuracy update: 99.7% on last 10,000 transactions.", type: "info" },
  { time: "2 days ago", msg: "Suspicious pattern detected: 5 rapid-fire small transactions.", type: "medium" },
  { time: "2 days ago", msg: "High-risk transaction blocked: $8,900 crypto transfer", type: "high" },
];

export function Alerts() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>Alerts & Notifications</div>
        <div style={s.muted}>All system alerts and fraud events</div>
      </div>

      {/* Summary */}
      <div style={s.grid3}>
        {[
          ["🚨 High Risk", ALL_ALERTS.filter(a => a.type === "high").length, T.red],
          ["⚠️ Medium Risk", ALL_ALERTS.filter(a => a.type === "medium").length, T.amber],
          ["ℹ️ Info", ALL_ALERTS.filter(a => a.type === "info").length, T.accent],
        ].map(([l, v, c]) => (
          <div key={l} style={s.statCard}>
            <div style={s.statLabel}>{l}</div>
            <div style={{ ...s.statVal, color: c }}>{v}</div>
            <div style={{ fontSize: 12, color: T.muted }}>alerts today</div>
          </div>
        ))}
      </div>

      <div style={s.card}>
        {ALL_ALERTS.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: i < ALL_ALERTS.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "flex-start" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: a.type === "high" ? "rgba(239,68,68,0.15)" : a.type === "medium" ? "rgba(245,158,11,0.15)" : "rgba(79,142,247,0.15)",
              fontSize: 18, flexShrink: 0
            }}>
              {a.type === "high" ? "🚨" : a.type === "medium" ? "⚠️" : "ℹ️"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{a.msg}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{a.time}</div>
            </div>
            <span style={{
              ...s.badge,
              ...(a.type === "high" ? s.badgeRed : a.type === "medium" ? s.badgeAmber : { background: "rgba(79,142,247,0.15)", color: T.accent })
            }}>
              {a.type.toUpperCase()}
            </span>
          </div>
        ))}
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
          <input style={s.input} defaultValue={user.name}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />
          <label style={s.label}>Email</label>
          <input style={{ ...s.input, opacity: 0.5 }} defaultValue={user.email} disabled />
          <label style={s.label}>Role</label>
          <input style={{ ...s.input, opacity: 0.5 }} value="Analyst" disabled />
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
              ["/api/fraud/test", "Fraud Detection"],
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
          <strong style={{ color: T.text }}>Backend:</strong> FastAPI + Random Forest ML model (Kaggle — MLG-ULB dataset)<br />
          <strong style={{ color: T.text }}>Market Data:</strong> Yahoo Finance API (yfinance) — Live USA market<br />
          <strong style={{ color: T.text }}>Frontend:</strong> React + Recharts<br />
          <strong style={{ color: T.text }}>Version:</strong> 2.0.0
        </div>
      </div>
    </div>
  );
}

export default Alerts;