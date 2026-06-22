import { useState, useRef, useEffect } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

export default function CSVScanner() {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [err, setErr]         = useState("");
  const [filter, setFilter]   = useState("all");
  const [history, setHistory] = useState([]);
  const [tab, setTab]         = useState("scan");
  const fileRef               = useRef();
  const token                 = localStorage.getItem("ng_token") || "";

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const res  = await fetch(`${BASE}/api/csv/history?token=${token}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {}
  };

  const loadScan = async (scanId) => {
    try {
      const res  = await fetch(`${BASE}/api/csv/history/${scanId}?token=${token}`);
      const data = await res.json();
      setResults(data);
      setTab("scan");
      setFilter("all");
    } catch {}
  };

  const onFile = (e) => {
    const f = e.target.files[0];
    if (f && f.name.endsWith('.csv')) {
      setFile(f); setErr(""); setResults(null);
    } else {
      setErr("Sirf CSV files allowed hain!");
    }
  };

  const scan = async () => {
    if (!file) { setErr("Pehle CSV file select karo!"); return; }
    setLoading(true); setErr(""); setResults(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res  = await fetch(`${BASE}/api/csv/scan?token=${token}`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Scan failed"); return; }
      setResults(data);
      loadHistory();
    } catch { setErr("Backend connect nahi ho raha!"); }
    setLoading(false);
  };

  const exportCSV = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res  = await fetch(`${BASE}/api/csv/export`, { method: "POST", body: form });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "nexaguard_scan_results.csv"; a.click();
  };

  const riskColor = (r) =>
    r === "HIGH RISK"   ? T.red   :
    r === "MEDIUM RISK" ? T.amber : T.green;

  const filtered = results?.results?.filter(r =>
    filter === "all"   ? true :
    filter === "fraud" ? r.is_fraud :
    !r.is_fraud
  ) || [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>📊 CSV Bulk Fraud Scanner</div>
        <div style={s.muted}>Upload bank statement CSV — AI scans every transaction</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["scan","🔍 Scan"], ["history","📋 History"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...s.navItem, ...(tab === t ? s.navItemActive : {}) }}>
            {l} {t === "history" && history.length > 0 && `(${history.length})`}
          </button>
        ))}
      </div>

      {/* History Tab */}
      {tab === "history" && (
        <div style={s.card}>
          <div style={s.h3}>Previous Scans</div>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: T.muted }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div>Koi scan history nahi — pehle CSV scan karo!</div>
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>{["File", "Total", "Fraud", "Fraud Rate", "Blocked", "Date", "Action"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={{ ...s.td, fontSize: 12, color: T.accent }}>{h.filename}</td>
                    <td style={s.td}>{h.total.toLocaleString()}</td>
                    <td style={{ ...s.td, color: T.red, fontWeight: 600 }}>{h.fraud_count}</td>
                    <td style={{ ...s.td, color: T.amber }}>{h.fraud_rate}%</td>
                    <td style={{ ...s.td, color: T.green }}>${h.total_blocked.toLocaleString()}</td>
                    <td style={{ ...s.td, fontSize: 11, color: T.muted }}>{h.created_at?.slice(0,16)}</td>
                    <td style={s.td}>
                      <button onClick={() => loadScan(h.id)}
                        style={{ ...s.navItem, ...s.navItemActive, fontSize: 11, padding: "3px 10px" }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Scan Tab */}
      {tab === "scan" && (
        <>
          <div style={{ ...s.card, marginBottom: 20 }}>
            <div style={s.h3}>Upload CSV File</div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>
              Required: <strong style={{ color: T.text }}>Time, Amount</strong> — Optional: V1–V28
            </div>

            <div onClick={() => fileRef.current.click()} style={{
              border: `2px dashed ${file ? T.accent : T.border}`,
              borderRadius: 12, padding: 40, textAlign: "center",
              cursor: "pointer", marginBottom: 16,
              background: file ? "rgba(79,142,247,0.05)" : "transparent",
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{file ? "✅" : "📁"}</div>
              <div style={{ fontSize: 14, color: file ? T.accent : T.muted }}>
                {file ? file.name : "Click to select CSV file"}
              </div>
              {file && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{(file.size/1024).toFixed(1)} KB</div>}
            </div>

            <input ref={fileRef} type="file" accept=".csv" onChange={onFile} style={{ display: "none" }} />
            {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>⚠️ {err}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={scan} disabled={loading || !file}>
                {loading ? "⚡ Scanning..." : "🔍 Scan for Fraud"}
              </button>
              {results && file && (
                <button onClick={exportCSV} style={{ ...s.btn, background: "rgba(34,197,94,0.15)", color: T.green, border: `1px solid rgba(34,197,94,0.3)`, width: "auto", padding: "0 20px" }}>
                  ⬇️ Export CSV
                </button>
              )}
              {file && (
                <button onClick={() => { setFile(null); setResults(null); fileRef.current.value = ""; }}
                  style={{ ...s.navItem, padding: "0 16px" }}>✕ Clear</button>
              )}
            </div>
          </div>

          {results && (
            <>
              <div style={s.grid3}>
                {[
                  ["📊 Total Scanned",  results.total,                          T.accent],
                  ["🚨 Fraud Detected", results.fraud_count,                    T.red],
                  ["✅ Safe",           results.safe_count,                     T.green],
                  ["📈 Fraud Rate",     `${results.fraud_rate}%`,               T.amber],
                  ["💰 Blocked",        `$${results.total_blocked?.toLocaleString()}`, T.red],
                  ["🛡️ Saved",         `$${results.total_blocked?.toLocaleString()}`, T.green],
                ].map(([label, val, color]) => (
                  <div key={label} style={s.statCard}>
                    <div style={s.statLabel}>{label}</div>
                    <div style={{ ...s.statVal, color, fontSize: 20 }}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{ ...s.card, marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={s.h3}>Scan Results</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["all","All"], ["fraud","🚨 Fraud"], ["safe","✅ Safe"]].map(([v, l]) => (
                      <button key={v} onClick={() => setFilter(v)}
                        style={{ ...s.navItem, ...(filter === v ? s.navItemActive : {}), fontSize: 12 }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <table style={s.table}>
                  <thead>
                    <tr>{["Row","Amount","Fraud Score","Risk Level","Action"].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 100).map(r => (
                      <tr key={r.row}>
                        <td style={{ ...s.td, color: T.muted, fontSize: 12 }}>#{r.row}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>${r.amount?.toLocaleString()}</td>
                        <td style={s.td}>
                          <div style={s.progressBar}>
                            <div style={{ ...s.progressFill, width: `${r.fraud_score}%`, background: riskColor(r.risk_level) }} />
                          </div>
                          <span style={{ fontSize: 11, color: T.muted }}>{r.fraud_score}%</span>
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.badge, color: riskColor(r.risk_level), background: `${riskColor(r.risk_level)}22` }}>
                            {r.risk_level}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontWeight: 600, color: r.is_fraud ? T.red : T.green }}>
                          {r.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 100 && (
                  <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: 12 }}>
                    Showing 100 of {filtered.length} — Export CSV for full data
                  </div>
                )}
              </div>
            </>
          )}

          {!results && (
            <div style={s.card}>
              <div style={s.h3}>📋 CSV Format Example</div>
              <pre style={{ fontSize: 12, color: T.muted, background: T.surface, padding: 16, borderRadius: 8, overflow: "auto" }}>
{`Time,Amount,V1,V2,V3
0,149.62,-1.35,0.07,-0.08
1,2.69,-1.10,-2.97,2.59
2,378.66,1.22,0.14,0.04`}
              </pre>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
                💡 V1-V28 optional — sirf Time aur Amount required
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}