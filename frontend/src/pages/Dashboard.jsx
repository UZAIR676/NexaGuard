import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { T, s } from "../theme";
import { api } from "../api";

function StatCard({ label, value, change, up, loading }) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statVal, fontSize: 24 }}>
        {loading ? <span style={{ color: T.muted, fontSize: 16 }}>Loading...</span> : value}
      </div>
      {change && <div style={{ ...s.statChange, color: up ? T.green : T.red }}>{change}</div>}
    </div>
  );
}

function MiniBar({ value, max = 100, color }) {
  return (
    <div style={s.progressBar}>
      <div style={{ ...s.progressFill, width: `${(value / max) * 100}%`, background: color }} />
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return "";
  // SQLite stores naive UTC strings like "2026-06-22 14:00:00" (no timezone marker).
  // Without forcing UTC, browsers parse this as local time and the math goes wrong.
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const diffMs = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Dashboard({ user }) {
  const isStaff = user?.role === "admin" || user?.role === "analyst";
  const token = localStorage.getItem("ng_token");
  const [indices, setIndices] = useState([]);
  const [movers, setMovers] = useState({ top_gainers: [], top_losers: [] });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [myTxns, setMyTxns] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isStaff) {
        const [idx, mv, hist, st, rc, al] = await Promise.all([
          api.indices(),
          api.movers(),
          api.history("^GSPC", "1mo"),
          api.fraudStats(),
          api.fraudRecent(5, token),
          api.fraudAlerts(4, token),
        ]);
        setIndices(idx);
        setMovers(mv);
        setStats(st);
        setRecent(rc);
        setAlerts(al);
        if (hist?.data?.length) {
          setChartData(hist.data.map((d, i) => ({ i, val: d.close, date: d.date })));
        }
      } else {
        const [idx, mv, hist, tx] = await Promise.all([
          api.indices(),
          api.movers(),
          api.history("^GSPC", "1mo"),
          fetch(`http://localhost:8000/api/auth/transactions?token=${token}`).then(r => r.json()),
        ]);
        setIndices(idx);
        setMovers(mv);
        setMyTxns(Array.isArray(tx) ? tx : []);
        if (hist?.data?.length) {
          setChartData(hist.data.map((d, i) => ({ i, val: d.close, date: d.date })));
        }
      }
    } catch (e) {
      console.log("Backend not available:", e);
    }
    setLoading(false);
  };

  const fmt = (p) => (p >= 1000 ? `$${(p / 1000).toFixed(1)}K` : `$${p?.toFixed(2)}`);
  const fmtMoney = (n) => (n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n?.toFixed(0) ?? 0}`);

  const dist = stats?.risk_distribution || { SAFE: 0, "LOW RISK": 0, "MEDIUM RISK": 0, "HIGH RISK": 0 };
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const distPct = (n) => Math.round((n / distTotal) * 100);

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={s.h2}>Overview</div>
          <div style={s.muted}>Live fraud & market intelligence — real-time data</div>
        </div>
        <button onClick={loadData} style={{ ...s.navItem, ...s.navItemActive, fontSize: 13 }}>
          ↻ Refresh
        </button>
      </div>

      {/* Market indices */}
      <div style={s.grid4}>
        {loading ? (
          ["S&P 500", "NASDAQ", "DOW JONES", "RUSSELL 2000"].map(n => (
            <StatCard key={n} label={n} value="" loading={true} />
          ))
        ) : indices.slice(0, 4).map(idx => (
          <StatCard key={idx.name}
            label={idx.name}
            value={fmt(idx.price)}
            change={`${idx.change_pct > 0 ? "+" : ""}${idx.change_pct}% today`}
            up={idx.change_pct > 0}
          />
        ))}
      </div>

      {/* S&P Chart + Fraud Stats */}
      <div style={s.grid2}>
        {/* S&P 500 Chart — real history from backend */}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={s.h3}>S&P 500 — 1 Month</div>
            <span style={{ ...s.badge, ...s.badgeGreen }}>LIVE</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={T.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="i" hide />
                <YAxis domain={["auto", "auto"]} hide />
                <Tooltip
                  contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`$${v.toLocaleString()}`, "S&P 500"]}
                  labelFormatter={(i) => chartData[i]?.date || ""}
                />
                <Area type="monotone" dataKey="val" stroke={T.accent} fill="url(#spGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ ...s.muted, textAlign: "center", padding: "60px 0" }}>
              {loading ? "Loading chart..." : "No history data — connect backend"}
            </div>
          )}
        </div>

        {/* Fraud Stats — real counts from transactions table, staff only (system-wide data) */}
        {isStaff ? (
        <div style={s.card}>
          <div style={s.h3}>Fraud Detection Stats</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              ["Total Scanned", (stats?.total_scanned ?? 0).toLocaleString(), T.accent],
              ["Fraud Detected", (stats?.fraud_detected ?? 0).toLocaleString(), T.red],
              ["Fraud Rate", `${stats?.fraud_rate ?? 0}%`, T.amber],
              ["Blocked Amount", fmtMoney(stats?.blocked_amount ?? 0), T.green],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: T.surface, borderRadius: 8, padding: "12px 14px", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
            Risk Distribution {stats?.total_scanned === 0 && "(no transactions logged yet)"}
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={[
              { name: "Safe", val: distPct(dist.SAFE), fill: T.green },
              { name: "Low", val: distPct(dist["LOW RISK"]), fill: T.amber },
              { name: "Medium", val: distPct(dist["MEDIUM RISK"]), fill: T.amber },
              { name: "High", val: distPct(dist["HIGH RISK"]), fill: T.red },
            ]}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v}%`, "Transactions"]} />
              <Bar dataKey="val" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        ) : (
        <div style={s.card}>
          <div style={s.h3}>Your Account</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: T.surface, borderRadius: 8, padding: "12px 14px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, textTransform: "uppercase" }}>Balance</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.accent }}>${(user?.balance ?? 0).toLocaleString()}</div>
            </div>
            <div style={{ background: T.surface, borderRadius: 8, padding: "12px 14px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, textTransform: "uppercase" }}>Your Transactions</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.green }}>{myTxns.length}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>
            Fraud monitoring stats are only visible to admins and analysts.
          </div>
        </div>
        )}
      </div>

      {/* Top Gainers / Losers */}
      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.h3}>📈 Top Gainers</div>
          <table style={s.table}>
            <thead><tr>{["Symbol", "Price", "Change"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(movers.top_gainers || []).slice(0, 5).map(g => (
                <tr key={g.symbol}>
                  <td style={{ ...s.td, fontWeight: 600, color: T.accent }}>{g.symbol}</td>
                  <td style={s.td}>${g.price}</td>
                  <td style={{ ...s.td, color: T.green, fontWeight: 600 }}>+{g.change_pct}%</td>
                </tr>
              ))}
              {(movers.top_gainers || []).length === 0 && !loading && (
                <tr><td colSpan={3} style={{ ...s.td, color: T.muted, textAlign: "center" }}>Connect backend for live data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={s.card}>
          <div style={s.h3}>📉 Top Losers</div>
          <table style={s.table}>
            <thead><tr>{["Symbol", "Price", "Change"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(movers.top_losers || []).slice(0, 5).map(g => (
                <tr key={g.symbol}>
                  <td style={{ ...s.td, fontWeight: 600, color: T.accent }}>{g.symbol}</td>
                  <td style={s.td}>${g.price}</td>
                  <td style={{ ...s.td, color: T.red, fontWeight: 600 }}>{g.change_pct}%</td>
                </tr>
              ))}
              {(movers.top_losers || []).length === 0 && !loading && (
                <tr><td colSpan={3} style={{ ...s.td, color: T.muted, textAlign: "center" }}>Connect backend for live data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions + Alerts */}
      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.h3}>{isStaff ? "Recent Transactions (All Users)" : "Your Recent Transactions"}</div>
          {isStaff ? (
          <table style={s.table}>
            <thead><tr>{["ID", "Amount", "Merchant", "Risk", "Score"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {recent.map(tx => (
                <tr key={tx.id}>
                  <td style={s.td}><span style={{ fontFamily: "monospace", fontSize: 12, color: T.muted }}>{tx.id}</span></td>
                  <td style={{ ...s.td, fontWeight: 600 }}>${tx.amount.toLocaleString()}</td>
                  <td style={s.td}>{tx.merchant}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...(tx.risk === "HIGH RISK" ? s.badgeRed : tx.risk === "MEDIUM RISK" ? s.badgeAmber : s.badgeGreen) }}>
                      {tx.risk}
                    </span>
                  </td>
                  <td style={s.td}>
                    <MiniBar value={tx.score} color={tx.score > 70 ? T.red : tx.score > 30 ? T.amber : T.green} />
                    <span style={{ fontSize: 11, color: T.muted }}>{tx.score}%</span>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ ...s.td, color: T.muted, textAlign: "center" }}>
                  No transactions logged yet — run a fraud check to populate this
                </td></tr>
              )}
            </tbody>
          </table>
          ) : (
          <table style={s.table}>
            <thead><tr>{["Type", "Amount", "Status", "Date"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {myTxns.slice(0, 6).map(tx => (
                <tr key={tx.id}>
                  <td style={{ ...s.td, textTransform: "capitalize" }}>{tx.type}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>${Number(tx.amount).toLocaleString()}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...(tx.status === "blocked" ? s.badgeRed : tx.status === "completed" ? s.badgeGreen : s.badgeAmber) }}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontSize: 12, color: T.muted }}>{timeAgo(tx.created_at)}</td>
                </tr>
              ))}
              {myTxns.length === 0 && !loading && (
                <tr><td colSpan={4} style={{ ...s.td, color: T.muted, textAlign: "center" }}>
                  No transactions yet — head to Banking to send or deposit money
                </td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>

        <div style={s.card}>
          <div style={s.h3}>{isStaff ? "Live Alerts (All Users)" : "Your Alerts"}</div>
          {isStaff ? (
          <>
            {alerts.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < alerts.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "flex-start" }}>
                <div style={{ fontSize: 18, marginTop: 1 }}>
                  {a.type === "high" ? "🚨" : "⚠️"}
                </div>
                <div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{a.msg}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))}
            {alerts.length === 0 && !loading && (
              <div style={{ ...s.muted, textAlign: "center", padding: "24px 0" }}>
                No alerts yet — medium/high risk transactions will show here
              </div>
            )}
          </>
          ) : (
          <>
            {myTxns.filter(tx => tx.status === "blocked" || tx.fraud_score >= 40).slice(0, 6).map((tx, i) => (
              <div key={tx.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}`, alignItems: "flex-start" }}>
                <div style={{ fontSize: 18, marginTop: 1 }}>
                  {tx.status === "blocked" ? "🚨" : "⚠️"}
                </div>
                <div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {tx.status === "blocked" ? "Blocked" : "Flagged"} {tx.type} of ${Number(tx.amount).toLocaleString()} — fraud score {tx.fraud_score}%
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{timeAgo(tx.created_at)}</div>
                </div>
              </div>
            ))}
            {myTxns.filter(tx => tx.status === "blocked" || tx.fraud_score >= 40).length === 0 && !loading && (
              <div style={{ ...s.muted, textAlign: "center", padding: "24px 0" }}>
                No alerts on your account — all your transactions look safe
              </div>
            )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}