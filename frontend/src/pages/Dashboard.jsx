import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { T, s } from "../theme";
import { api } from "../api";

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  radius: { sm: 8, md: 12, lg: 16 },
  shadow: "0 1px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.3)",
  glow: (color) => `0 0 0 1px ${color}22, 0 4px 16px ${color}18`,
  transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return "";
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const diffMs = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const fmt = (p) =>
  p >= 1000 ? `$${(p / 1000).toFixed(1)}K` : `$${p?.toFixed(2) ?? "0.00"}`;
const fmtMoney = (n) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n?.toFixed(0) ?? 0}`;

// ─── Alert meta ───────────────────────────────────────────────────────────────
const ALERT_META = {
  high:    { icon: "🚨", color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.28)" },
  medium:  { icon: "⚠️", color: "#fbbf24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.28)"  },
  info:    { icon: "ℹ️", color: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.24)"  },
  success: { icon: "✅", color: "#4ade80", bg: "rgba(74,222,128,0.10)",  border: "rgba(74,222,128,0.24)"  },
};
const CAT_ICON = {
  login: "🔐", transaction: "💳", user_activity: "👤",
  system: "📊", account: "⚙️",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Pill({ children, color = T.muted, bg = "rgba(255,255,255,0.06)", border = "rgba(255,255,255,0.10)" }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
      padding: "2px 8px", borderRadius: 20,
      color, background: bg, border: `1px solid ${border}`,
      textTransform: "uppercase",
    }}>
      {children}
    </span>
  );
}

function LiveDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: "#4ade80",
        boxShadow: "0 0 0 2px #4ade8033",
        animation: "pulse 2s infinite",
      }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>LIVE</span>
    </span>
  );
}

function StatCard({ label, value, change, up, loading, icon, accent }) {
  const col = accent || (up === undefined ? T.accent : up ? "#4ade80" : "#f87171");
  return (
    <div style={{
      background: T.card || "#1a1f2e",
      border: `1px solid ${T.border || "#2a3042"}`,
      borderRadius: D.radius.md,
      padding: "16px 18px",
      boxShadow: D.shadow,
      transition: D.transition,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: col, borderRadius: "12px 12px 0 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>
          {label}
        </div>
        {icon && <span style={{ fontSize: 18, opacity: 0.6 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: loading ? T.muted : col, letterSpacing: "-0.5px" }}>
        {loading ? "—" : value}
      </div>
      {change && !loading && (
        <div style={{ fontSize: 11, marginTop: 5, color: up ? "#4ade80" : "#f87171", fontWeight: 600 }}>
          {up ? "▲" : "▼"} {change}
        </div>
      )}
    </div>
  );
}

function MiniBar({ value, max = 100, color }) {
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${Math.min((value / max) * 100, 100)}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
    </div>
  );
}

function SectionHeader({ title, action, badge }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.2px" }}>{title}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {badge}
        {action}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: T.muted }}>
      <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 12 }}>{text}</div>
    </div>
  );
}

// ─── NEW: Sparkline mini chart ────────────────────────────────────────────────
function SparkLine({ data, color = T.accent }) {
  if (!data?.length) return null;
  const vals = data.map(d => d.val);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── NEW: Fraud Score Ring ────────────────────────────────────────────────────
function ScoreRing({ value, size = 38 }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r;
  const color = value > 70 ? "#f87171" : value > 30 ? "#fbbf24" : "#4ade80";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - value / 100)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 9, fontWeight: 700, fill: color, transform: "rotate(90deg)", transformOrigin: "center", transformBox: "fill-box" }}>
        {Math.round(value)}
      </text>
    </svg>
  );
}

// ─── NEW: Summary strip for regular users ────────────────────────────────────
function AccountSummary({ user, txns }) {
  const total = txns.reduce((s, t) => s + Number(t.amount), 0);
  const blocked = txns.filter(t => t.status === "blocked").length;
  const recent = txns[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { l: "Balance", v: `$${(user?.balance ?? 0).toLocaleString()}`, c: T.accent },
          { l: "Transactions", v: txns.length, c: "#4ade80" },
          { l: "Total Volume", v: fmtMoney(total), c: "#fbbf24" },
          { l: "Blocked", v: blocked, c: blocked > 0 ? "#f87171" : T.muted },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      {recent && (
        <div style={{ background: "rgba(96,165,250,0.06)", borderRadius: 10, padding: "10px 14px", border: "1px solid rgba(96,165,250,0.2)", fontSize: 12 }}>
          <span style={{ color: T.muted }}>Last activity: </span>
          <span style={{ color: "#e2e8f0", fontWeight: 600, textTransform: "capitalize" }}>{recent.type}</span>
          <span style={{ color: T.muted }}> · </span>
          <span style={{ color: "#4ade80", fontWeight: 700 }}>${Number(recent.amount).toLocaleString()}</span>
          <span style={{ color: T.muted }}> · {timeAgo(recent.created_at)}</span>
        </div>
      )}
      <div style={{ fontSize: 11, color: T.muted, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${T.border}` }}>
        🛡️ Fraud monitoring is active on your account. Suspicious transactions are reviewed automatically.
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ user }) {
  const isStaff = user?.role === "admin" || user?.role === "analyst";
  const token = localStorage.getItem("ng_token");

  const [indices, setIndices]             = useState([]);
  const [movers, setMovers]               = useState({ top_gainers: [], top_losers: [] });
  const [loading, setLoading]             = useState(true);
  const [chartData, setChartData]         = useState([]);
  const [stats, setStats]                 = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState("^GSPC");
  const [selectedPeriod, setSelectedPeriod] = useState("1mo");
  const [recent, setRecent]               = useState([]);
  const [liveAlerts, setLiveAlerts]       = useState([]);
  const [myTxns, setMyTxns]               = useState([]);
  const [lastRefresh, setLastRefresh]     = useState(null);

  // ── NEW: alert filter ──
  const [alertFilter, setAlertFilter] = useState("all");
  // ── NEW: mover tab ──
  const [moverTab, setMoverTab] = useState("gainers");
  // ── NEW: search filter for txns (staff) ──
  const [txSearch, setTxSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isStaff) {
        const [idx, mv, hist, st, allTx, alertsRes] = await Promise.all([
          api.indices(),
          api.movers(),
          api.history(selectedSymbol, selectedPeriod),
          fetch(`http://localhost:8000/api/auth/banking-stats?token=${token}`).then(r => r.json()),
          fetch(`http://localhost:8000/api/auth/transactions?token=${token}`).then(r => r.json()),
          fetch(`http://localhost:8000/api/alerts?token=${token}&limit=20`).then(r => r.json()),
        ]);
        setIndices(idx); setMovers(mv); setStats(st);
        const txList = Array.isArray(allTx) ? allTx : [];
        setRecent(txList.slice(0, 8));
        setLiveAlerts(Array.isArray(alertsRes) ? alertsRes.slice(0, 10) : []);
        if (hist?.data?.length)
          setChartData(hist.data.map((d, i) => ({ i, val: d.close, date: d.date })));
      } else {
        const [idx, mv, hist, tx, alertsRes] = await Promise.all([
          api.indices(), api.movers(),
          api.history(selectedSymbol, selectedPeriod),
          fetch(`http://localhost:8000/api/auth/transactions?token=${token}`).then(r => r.json()),
          fetch(`http://localhost:8000/api/alerts?token=${token}&limit=20`).then(r => r.json()),
        ]);
        setIndices(idx); setMovers(mv);
        setMyTxns(Array.isArray(tx) ? tx : []);
        setLiveAlerts(Array.isArray(alertsRes) ? alertsRes.slice(0, 10) : []);
        if (hist?.data?.length)
          setChartData(hist.data.map((d, i) => ({ i, val: d.close, date: d.date })));
      }
      setLastRefresh(new Date());
    } catch (e) {
      console.log("Backend not available:", e);
    }
    setLoading(false);
  }, [selectedSymbol, selectedPeriod, isStaff, token]);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 15000);
    return () => clearInterval(iv);
  }, [loadData]);

  // Derived
  const dist      = stats?.risk_distribution || { SAFE: 0, "LOW RISK": 0, "MEDIUM RISK": 0, "HIGH RISK": 0 };
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const distPct   = (n) => Math.round((n / distTotal) * 100);

  const filteredAlerts = alertFilter === "all"
    ? liveAlerts
    : liveAlerts.filter(a => a.type === alertFilter);

  const filteredRecent = txSearch
    ? recent.filter(tx =>
        tx.user?.toLowerCase().includes(txSearch.toLowerCase()) ||
        tx.type?.toLowerCase().includes(txSearch.toLowerCase()) ||
        String(tx.id).includes(txSearch))
    : recent;

  const highCount = liveAlerts.filter(a => a.type === "high").length;

  // Chart trend
  const chartTrend = chartData.length >= 2
    ? chartData[chartData.length - 1].val - chartData[0].val
    : 0;

  // ── Styles ──
  const card = {
    background: T.card || "#1a1f2e",
    border: `1px solid ${T.border || "#2a3042"}`,
    borderRadius: D.radius.lg,
    padding: "18px 20px",
    boxShadow: D.shadow,
  };

  const tabBtn = (active) => ({
    fontSize: 12, fontWeight: active ? 700 : 500,
    padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: "none",
    background: active ? "rgba(96,165,250,0.15)" : "transparent",
    color: active ? "#60a5fa" : T.muted,
    transition: D.transition,
  });

  const grid2 = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 16,
    marginBottom: 16,
  };

  const grid4 = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 16,
  };

  const symbolLabels = {
    "^GSPC": "S&P 500", "^IXIC": "NASDAQ", "^DJI": "DOW", "^RUT": "RUSSELL",
  };
  const periodLabels = { "1wk": "1W", "1mo": "1M", "3mo": "3M", "1y": "1Y" };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.5px", marginBottom: 4 }}>
            {isStaff ? "Command Center" : "My Dashboard"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LiveDot />
            {lastRefresh && (
              <span style={{ fontSize: 11, color: T.muted }}>
                Updated {timeAgo(lastRefresh.toISOString())}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {highCount > 0 && (
            <div style={{
              background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#f87171", fontWeight: 700,
              animation: "pulse 2s infinite",
            }}>
              🚨 {highCount} HIGH ALERT{highCount > 1 ? "S" : ""}
            </div>
          )}
          <button onClick={loadData} disabled={loading} style={{
            padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.border}`,
            background: loading ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
            color: loading ? T.muted : "#e2e8f0", cursor: loading ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 600, transition: D.transition,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>↻</span>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Market Indices ── */}
      <div style={grid4}>
        {(loading ? ["S&P 500","NASDAQ","DOW JONES","RUSSELL 2000"] : indices.slice(0, 4)).map((item, i) => {
          const idx = typeof item === "string" ? null : item;
          return (
            <StatCard key={i}
              label={idx?.name ?? item}
              value={idx ? fmt(idx.price) : ""}
              change={idx ? `${idx.change_pct > 0 ? "+" : ""}${idx.change_pct}% today` : undefined}
              up={idx ? idx.change_pct > 0 : undefined}
              loading={!idx}
              icon={["📈","💹","📊","📉"][i]}
            />
          );
        })}
      </div>

      {/* ── Chart + Stats/Account ── */}
      <div style={grid2}>

        {/* Chart */}
        <div style={card}>
          <SectionHeader
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {symbolLabels[selectedSymbol]} Chart
                {chartTrend !== 0 && (
                  <span style={{ fontSize: 12, color: chartTrend > 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                    {chartTrend > 0 ? "▲" : "▼"} {Math.abs(chartTrend).toFixed(2)}
                  </span>
                )}
              </span>
            }
            action={<LiveDot />}
          />

          {/* Controls */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {Object.entries(symbolLabels).map(([sym, label]) => (
              <button key={sym} onClick={() => setSelectedSymbol(sym)} style={tabBtn(selectedSymbol === sym)}>
                {label}
              </button>
            ))}
            <div style={{ width: 1, height: 16, background: T.border, margin: "0 4px" }} />
            {Object.entries(periodLabels).map(([val, label]) => (
              <button key={val} onClick={() => setSelectedPeriod(val)} style={tabBtn(selectedPeriod === val)}>
                {label}
              </button>
            ))}
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={chartTrend >= 0 ? "#60a5fa" : "#f87171"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartTrend >= 0 ? "#60a5fa" : "#f87171"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="i" hide />
                <YAxis domain={["auto","auto"]} hide />
                <Tooltip
                  contentStyle={{ background: "#1e2535", border: "1px solid #2a3042", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
                  formatter={(v) => [`$${v.toLocaleString()}`, symbolLabels[selectedSymbol]]}
                  labelFormatter={(i) => chartData[i]?.date || ""}
                />
                <Area type="monotone" dataKey="val"
                  stroke={chartTrend >= 0 ? "#60a5fa" : "#f87171"}
                  fill="url(#chartGrad)" strokeWidth={2} dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon="📉" text={loading ? "Loading chart data…" : "No chart data — connect backend"} />
          )}
        </div>

        {/* Fraud Stats / Account */}
        {isStaff ? (
          <div style={card}>
            <SectionHeader title="🛡️ Fraud Detection" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { l: "Scanned",  v: (stats?.total_scanned  ?? 0).toLocaleString(), c: "#60a5fa", icon: "🔍" },
                { l: "Detected", v: (stats?.fraud_detected ?? 0).toLocaleString(), c: "#f87171", icon: "⛔" },
                { l: "Fraud Rate", v: `${stats?.fraud_rate ?? 0}%`,                c: "#fbbf24", icon: "📊" },
                { l: "Blocked",  v: fmtMoney(stats?.blocked_amount ?? 0),          c: "#4ade80", icon: "🔒" },
              ].map(({ l, v, c, icon }) => (
                <div key={l} style={{
                  background: "rgba(255,255,255,0.03)", borderRadius: 10,
                  padding: "12px 14px", border: `1px solid rgba(255,255,255,0.07)`,
                  display: "flex", flexDirection: "column", gap: 4,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{l}</span>
                    <span style={{ fontSize: 14 }}>{icon}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Risk Breakdown
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { l: "Safe",        n: dist.SAFE,           c: "#4ade80" },
                { l: "Low Risk",    n: dist["LOW RISK"],    c: "#a3e635" },
                { l: "Medium Risk", n: dist["MEDIUM RISK"], c: "#fbbf24" },
                { l: "High Risk",   n: dist["HIGH RISK"],   c: "#f87171" },
              ].map(({ l, n, c }) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: T.muted, width: 80, flexShrink: 0 }}>{l}</span>
                  <div style={{ flex: 1 }}><MiniBar value={distPct(n)} color={c} /></div>
                  <span style={{ fontSize: 11, color: c, fontWeight: 700, width: 32, textAlign: "right" }}>{distPct(n)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={card}>
            <SectionHeader title="💳 Your Account" />
            <AccountSummary user={user} txns={myTxns} />
          </div>
        )}
      </div>

      {/* ── Top Movers (combined tab) ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setMoverTab("gainers")} style={tabBtn(moverTab === "gainers")}>
              📈 Top Gainers
            </button>
            <button onClick={() => setMoverTab("losers")} style={tabBtn(moverTab === "losers")}>
              📉 Top Losers
            </button>
          </div>
          <LiveDot />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {((moverTab === "gainers" ? movers.top_gainers : movers.top_losers) || []).slice(0, 6).map(g => {
            const isGainer = moverTab === "gainers";
            const color = isGainer ? "#4ade80" : "#f87171";
            return (
              <div key={g.symbol} style={{
                background: `${color}0a`, border: `1px solid ${color}25`,
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", marginBottom: 4 }}>{g.symbol}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>${g.price}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>
                    {isGainer ? "+" : ""}{g.change_pct}%
                  </span>
                </div>
              </div>
            );
          })}
          {(!movers.top_gainers?.length && !loading) && (
            <div style={{ gridColumn: "1/-1" }}>
              <EmptyState icon="📡" text="Connect backend for live market data" />
            </div>
          )}
        </div>
      </div>

      {/* ── Transactions + Alerts ── */}
      <div style={grid2}>

        {/* Transactions */}
        <div style={card}>
          <SectionHeader
            title={isStaff ? "Recent Transactions" : "Your Transactions"}
            action={
              isStaff && (
                <input
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  placeholder="Search…"
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 7,
                    border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.04)",
                    color: "#e2e8f0", outline: "none", width: 110,
                  }}
                />
              )
            }
          />

          {isStaff ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["ID","User","Type","Amount","Status","Risk"].map(h => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecent.map((tx, i) => (
                    <tr key={tx.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      <td style={{ padding: "9px 10px", fontFamily: "monospace", fontSize: 11, color: T.muted }}>#{tx.id}</td>
                      <td style={{ padding: "9px 10px", color: "#e2e8f0" }}>{tx.user}</td>
                      <td style={{ padding: "9px 10px", textTransform: "capitalize", color: "#e2e8f0" }}>{tx.type}</td>
                      <td style={{ padding: "9px 10px", fontWeight: 700, color: "#e2e8f0" }}>${Number(tx.amount).toLocaleString()}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <Pill
                          color={tx.status === "blocked" ? "#f87171" : tx.status === "completed" ? "#4ade80" : "#fbbf24"}
                          bg={tx.status === "blocked" ? "rgba(248,113,113,0.1)" : tx.status === "completed" ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)"}
                          border={tx.status === "blocked" ? "rgba(248,113,113,0.3)" : tx.status === "completed" ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)"}
                        >
                          {tx.status}
                        </Pill>
                      </td>
                      <td style={{ padding: "9px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ScoreRing value={Number(tx.fraud_score)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRecent.length === 0 && !loading && (
                    <tr><td colSpan={6}><EmptyState icon="💳" text="No transactions yet — head to Banking" /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myTxns.slice(0, 6).map(tx => (
                <div key={tx.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.07)`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>
                      {tx.type === "transfer" ? "↗️" : tx.type === "deposit" ? "⬇️" : "↩️"}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", textTransform: "capitalize" }}>{tx.type}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{timeAgo(tx.created_at)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>${Number(tx.amount).toLocaleString()}</div>
                    <Pill
                      color={tx.status === "blocked" ? "#f87171" : tx.status === "completed" ? "#4ade80" : "#fbbf24"}
                      bg="transparent" border="transparent"
                    >{tx.status}</Pill>
                  </div>
                </div>
              ))}
              {myTxns.length === 0 && !loading && (
                <EmptyState icon="💳" text="No transactions yet — head to Banking to send or deposit money" />
              )}
            </div>
          )}
        </div>

        {/* Alerts */}
        <div style={card}>
          <SectionHeader
            title={isStaff ? "🔔 Live Alerts" : "🔔 Your Alerts"}
            badge={highCount > 0 && (
              <Pill color="#f87171" bg="rgba(248,113,113,0.12)" border="rgba(248,113,113,0.3)">
                {highCount} HIGH
              </Pill>
            )}
          />

          {/* Alert filter tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            {["all","high","medium","info","success"].map(f => (
              <button key={f} onClick={() => setAlertFilter(f)} style={{
                ...tabBtn(alertFilter === f),
                padding: "3px 10px", fontSize: 11,
              }}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== "all" && (
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>
                    ({liveAlerts.filter(a => a.type === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {filteredAlerts.length === 0 && !loading ? (
            <EmptyState icon="🔕" text={alertFilter === "all" ? "No alerts yet" : `No ${alertFilter} alerts`} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {filteredAlerts.map((a, i) => {
                const meta = ALERT_META[a.type] || ALERT_META.info;
                const catIcon = CAT_ICON[a.category] || "🔔";
                return (
                  <div key={a.id ?? i} style={{
                    display: "flex", gap: 10, padding: "11px 10px",
                    borderRadius: 10,
                    background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    borderLeft: `3px solid ${meta.color}`,
                    marginLeft: -3, paddingLeft: 12,
                    transition: D.transition,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: meta.bg, border: `1px solid ${meta.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14,
                    }}>
                      {catIcon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 4 }}>
                        {a.message}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: T.muted }}>{timeAgo(a.created_at)}</span>
                        {isStaff && a.user_email && (
                          <Pill color="#60a5fa" bg="rgba(96,165,250,0.08)" border="rgba(96,165,250,0.2)">
                            {a.user_email}
                          </Pill>
                        )}
                        {a.category && (
                          <Pill color={T.muted} bg="rgba(255,255,255,0.04)" border="rgba(255,255,255,0.08)">
                            {a.category.replace("_", " ")}
                          </Pill>
                        )}
                      </div>
                    </div>

                    <Pill color={meta.color} bg={meta.bg} border={meta.border}>
                      {(a.type || "info").toUpperCase()}
                    </Pill>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}