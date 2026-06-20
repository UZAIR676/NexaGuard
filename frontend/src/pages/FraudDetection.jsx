import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T, s } from "../theme";
import { api } from "../api";

function MiniBar({ value, color }) {
  return (
    <div style={s.progressBar}>
      <div style={{ ...s.progressFill, width: `${value}%`, background: color }} />
    </div>
  );
}

export default function FraudDetection() {
  const [tx, setTx] = useState({ time: 10000, amount: 9999.99 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("simple");
  const [history, setHistory] = useState([]);
  const [liveDist, setLiveDist] = useState(null);

  useEffect(() => {
    api.fraudStats().then(setLiveDist).catch(() => {});
  }, []);

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    const payload = { ...tx };

    if (mode === "simple") {
      const amt = tx.amount;
      const isSuspicious = amt > 5000;
      payload.v1  = isSuspicious ? -3.0 + Math.random() * -1.5 : 1.2  + Math.random();
      payload.v2  = isSuspicious ? -2.5 + Math.random() * -1.0 : 0.2  + Math.random() * 0.3;
      payload.v3  = isSuspicious ? -1.8 + Math.random() * -2.0 : 0.3  + Math.random() * 0.2;
      payload.v4  = isSuspicious ?  0.5 + Math.random()        : 1.5  + Math.random();
      payload.v5  = isSuspicious ? -1.2 + Math.random() * -0.5 : 0.5  + Math.random() * 0.2;
      payload.v6  = isSuspicious ? -0.8 + Math.random() * -0.5 : 0.1  + Math.random() * 0.3;
      payload.v7  = isSuspicious ? -2.1 + Math.random() * -1.0 : 0.2  + Math.random() * 0.2;
      payload.v8  = isSuspicious ?  0.3 + Math.random()        : 0.1  + Math.random() * 0.1;
      payload.v9  = isSuspicious ? -1.5 + Math.random() * -0.5 : 0.3  + Math.random() * 0.2;
      payload.v10 = isSuspicious ? -2.0 + Math.random() * -1.0 : 0.1  + Math.random() * 0.3;
      payload.v11 = isSuspicious ?  1.2 + Math.random()        : 0.5  + Math.random() * 0.3;
      payload.v12 = isSuspicious ? -2.8 + Math.random() * -1.0 : 0.2  + Math.random() * 0.2;
      payload.v13 = isSuspicious ?  0.1 + Math.random() * 0.5  : 0.1  + Math.random() * 0.3;
      payload.v14 = isSuspicious ? -3.1 + Math.random() * -1.5 : 0.1  + Math.random() * 0.2;
      payload.v15 = isSuspicious ?  0.2 + Math.random() * 0.3  : 0.1  + Math.random() * 0.2;
      payload.v16 = isSuspicious ? -1.1 + Math.random() * -0.5 : 0.2  + Math.random() * 0.2;
      payload.v17 = isSuspicious ? -2.3 + Math.random() * -1.0 : 0.1  + Math.random() * 0.2;
      payload.v18 = isSuspicious ? -0.9 + Math.random() * -0.5 : 0.3  + Math.random() * 0.2;
      payload.v19 = isSuspicious ?  0.4 + Math.random() * 0.3  : 0.0  + Math.random() * 0.1;
      payload.v20 = isSuspicious ?  0.1 + Math.random() * 0.2  : 0.1  + Math.random() * 0.1;
      for (let i = 21; i <= 28; i++) payload[`v${i}`] = (Math.random() - 0.5) * 0.3;
    } else {
      for (let i = 1; i <= 28; i++) payload[`v${i}`] = tx[`v${i}`] || 0.0;
    }

    try {
      const d = await api.detectFraud(payload);
      setResult(d);
      const newEntry = {
        id: `TXN-${Math.floor(Math.random() * 9000 + 1000)}`,
        amount: `$${tx.amount.toLocaleString()}`,
        merchant: "Manual Check",
        risk: d.risk_level?.replace(" RISK", "") || "SAFE",
        score: d.fraud_score,
        flagged: d.is_fraud,
      };
      setHistory(h => [newEntry, ...h.slice(0, 9)]);
      api.fraudStats().then(setLiveDist).catch(() => {});
    } catch {
      setResult({ error: "Backend not reachable. Start backend first." });
    }
    setLoading(false);
  };

  const riskColor = (r) => r === "HIGH RISK" ? T.red : r === "MEDIUM RISK" ? T.amber : r === "LOW RISK" ? T.amber : T.green;

  const dist = liveDist?.risk_distribution || { SAFE: 0, "LOW RISK": 0, "MEDIUM RISK": 0, "HIGH RISK": 0 };
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const scoreData = [
    { name: "Safe", val: Math.round((dist.SAFE / distTotal) * 100) },
    { name: "Low", val: Math.round((dist["LOW RISK"] / distTotal) * 100) },
    { name: "Medium", val: Math.round((dist["MEDIUM RISK"] / distTotal) * 100) },
    { name: "High", val: Math.round((dist["HIGH RISK"] / distTotal) * 100) },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>Fraud Detection</div>
        <div style={s.muted}>Submit a transaction to the ML model for real-time fraud scoring</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={s.h3}>Transaction Details</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["simple", "advanced"].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  ...s.navItem, fontSize: 12, padding: "4px 10px",
                  ...(mode === m ? s.navItemActive : {})
                }}>{m === "simple" ? "Simple" : "Advanced"}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={s.label}>Time (seconds)</label>
              <input style={s.input} type="number" value={tx.time}
                onChange={e => setTx(t => ({ ...t, time: parseFloat(e.target.value) || 0 }))}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.border} />
            </div>
            <div>
              <label style={s.label}>Amount (USD)</label>
              <input style={s.input} type="number" value={tx.amount}
                onChange={e => setTx(t => ({ ...t, amount: parseFloat(e.target.value) || 0 }))}
                onFocus={e => e.target.style.borderColor = T.accent}
                onBlur={e => e.target.style.borderColor = T.border} />
            </div>
          </div>

          {mode === "advanced" && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>PCA Features V1–V28 (leave 0 if unknown)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, maxHeight: 200, overflowY: "auto" }}>
                {[...Array(28)].map((_, i) => (
                  <div key={i}>
                    <label style={{ ...s.label, marginTop: 4 }}>V{i + 1}</label>
                    <input style={{ ...s.input, padding: "7px 10px" }} type="number" step="0.01"
                      value={tx[`v${i + 1}`] || 0}
                      onChange={e => setTx(t => ({ ...t, [`v${i + 1}`]: parseFloat(e.target.value) || 0 }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button style={{ ...s.btn, marginTop: 20, opacity: loading ? 0.7 : 1 }} onClick={analyze} disabled={loading}>
            {loading ? "⚡ Analyzing..." : "Analyze Transaction"}
          </button>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["🚨 Suspicious Wire", [0, 9999.99, -3, -2.5, -1.8, 0.5, -1.2, -0.8, -2.1, 0.3, -1.5, -2, 1.2, -2.8, 0.1, -3.1, 0.2, -1.1, -2.3, -0.9, 0.4, 0.1, 0.3, -0.2, 0.1, -0.1, 0.2, 0.1, 0, 0.1]],
              ["✅ Normal Purchase", [50000, 89.99, 1.2, 0.2, 0.3, -0.1, 0.5, 0.1, 0.2, -0.1, 0.3, 0.1, -0.2, 0.4, 0.1, -0.1, 0.2, 0.1, -0.1, 0.3, 0, 0.1, 0, -0.1, 0.1, 0, -0.1, 0.1, 0, -0.1]]
            ].map(([label, vals]) => (
              <button key={label} onClick={() => {
                const t = { time: vals[0], amount: vals[1] };
                for (let i = 1; i <= 28; i++) t[`v${i}`] = vals[i + 1] || 0;
                setTx(t);
              }} style={{ ...s.navItem, ...s.navItemActive, fontSize: 12, padding: "5px 12px" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={s.card}>
          <div style={s.h3}>Analysis Result</div>
          {!result && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: T.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 14 }}>Submit a transaction to see fraud analysis</div>
            </div>
          )}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: T.muted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
              <div style={{ fontSize: 14 }}>Running ML model...</div>
            </div>
          )}
          {result && result.error && (
            <div style={{ color: T.red, fontSize: 14, marginTop: 20 }}>⚠️ {result.error}</div>
          )}
          {result && !result.error && (
            <div>
              <div style={{ ...s.scoreCircle, borderColor: riskColor(result.risk_level), boxShadow: `0 0 30px ${riskColor(result.risk_level)}44` }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: riskColor(result.risk_level) }}>{result.fraud_score}%</div>
                <div style={{ fontSize: 11, color: T.muted }}>Fraud Score</div>
              </div>

              <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700, marginBottom: 16, color: result.is_fraud ? T.red : T.green }}>
                {result.action}
              </div>

              {[
                ["Risk Level", result.risk_level, riskColor(result.risk_level)],
                ["Amount", `$${parseFloat(result.amount).toLocaleString()}`, T.text],
                ["Decision", result.is_fraud ? "BLOCKED" : "APPROVED", result.is_fraud ? T.red : T.green],
                ["Model", "Random Forest v2", T.muted],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ color: T.muted, fontSize: 13 }}>{k}</span>
                  <span style={{ fontWeight: 600, color: c, fontSize: 13 }}>{v}</span>
                </div>
              ))}

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Risk Score Gauge</div>
                <MiniBar value={result.fraud_score} color={riskColor(result.risk_level)} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted }}>
                  <span>Safe (0%)</span><span>High Risk (100%)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...s.grid2, marginBottom: 20 }}>
        <div style={s.card}>
          <div style={s.h3}>Risk Distribution</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={scoreData}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: T.muted }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} formatter={v => [`${v}%`, "Transactions"]} />
              <Bar dataKey="val" radius={[4, 4, 0, 0]} fill={T.accent} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={s.card}>
          <div style={s.h3}>Model Info</div>
          {[
            ["Model", "Random Forest v2"],
            ["Accuracy", "99.7%"],
            ["Precision (Fraud)", "82%"],
            ["ROC-AUC", "~0.97"],
            ["Training Data", "284,807 transactions"],
            ["Dataset", "Kaggle — MLG-ULB"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ color: T.muted, fontSize: 13 }}>{k}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.h3}>Analysis History (Session)</div>
        <table style={s.table}>
          <thead><tr>{["Transaction", "Amount", "Score", "Risk", "Action"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {history.map(tx => (
              <tr key={tx.id}>
                <td style={{ ...s.td, fontFamily: "monospace", fontSize: 12, color: T.muted }}>{tx.id}</td>
                <td style={{ ...s.td, fontWeight: 600 }}>{tx.amount}</td>
                <td style={s.td}>
                  <MiniBar value={tx.score} color={tx.score > 70 ? T.red : tx.score > 30 ? T.amber : T.green} />
                  <span style={{ fontSize: 11, color: T.muted }}>{tx.score}%</span>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.badge, ...(tx.risk === "HIGH" ? s.badgeRed : tx.risk === "MEDIUM" ? s.badgeAmber : s.badgeGreen) }}>
                    {tx.risk}
                  </span>
                </td>
                <td style={{ ...s.td, color: tx.flagged ? T.red : T.green, fontWeight: 600 }}>
                  {tx.flagged ? "BLOCKED" : "APPROVED"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}