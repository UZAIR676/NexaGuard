import { useState, useRef } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

export default function CSVScanner() {
  const [file, setFile]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState(null);
  const [err, setErr]           = useState("");
  const [filter, setFilter]     = useState("all");
  const fileRef                 = useRef();

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
      const res  = await fetch(`${BASE}/api/csv/scan`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Scan failed"); return; }
      setResults(data);
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
    filter === "all"    ? true :
    filter === "fraud"  ? r.is_fraud :
    !r.is_fraud
  ) || [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>📊 CSV Bulk Fraud Scanner</div>
        <div style={s.muted}>Upload bank statement CSV — AI scans every transaction</div>
      </div>

      {/* Upload Card */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.h3}>Upload CSV File</div>
        <div style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>
          Required columns: <strong style={{ color: T.text }}>Time, Amount</strong> — Optional: V1–V28 (PCA features)
        </div>

        <div
          onClick={() => fileRef.current.click()}
          style={{
            border: `2px dashed ${file ? T.accent : T.border}`,
            borderRadius: 12, padding: 40, textAlign: "center",
            cursor: "pointer", marginBottom: 16,
            background: file ? "rgba(79,142,247,0.05)" : "transparent",
            transition: "all 0.2s"
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>{file ? "✅" : "📁"}</div>
          <div style={{ fontSize: 14, color: file ? T.accent : T.muted }}>
            {file ? file.name : "Click to select CSV file"}
          </div>
          {file && (
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".csv" onChange={onFile} style={{ display: "none" }} />

        {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>⚠️ {err}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={scan} disabled={loading || !file}>
            {loading ? "⚡ Scanning..." : "🔍 Scan for Fraud"}
          </button>
          {results && (
            <button onClick={exportCSV} style={{ ...s.btn, background: "rgba(34,197,94,0.15)", color: T.green, border: `1px solid rgba(34,197,94,0.3)`, width: "auto", padding: "0 20px" }}>
              ⬇️ Export Results
            </button>
          )}
          {file && (
            <button onClick={() => { setFile(null); setResults(null); fileRef.current.value = ""; }}
              style={{ ...s.navItem, padding: "0 16px" }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {results && (
        <>
          <div style={s.grid3}>
            {[
              ["📊 Total Scanned", results.total, T.accent],
              ["🚨 Fraud Detected", results.fraud_count, T.red],
              ["✅ Safe", results.safe_count, T.green],
              ["📈 Fraud Rate", `${results.fraud_rate}%`, T.amber],
              ["💰 Blocked Amount", `$${results.total_blocked.toLocaleString()}`, T.red],
              ["🛡️ Saved", `$${results.total_blocked.toLocaleString()}`, T.green],
            ].map(([label, val, color]) => (
              <div key={label} style={s.statCard}>
                <div style={s.statLabel}>{label}</div>
                <div style={{ ...s.statVal, color, fontSize: 22 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Filter + Table */}
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
                    <td style={{ ...s.td, fontWeight: 600 }}>${r.amount.toLocaleString()}</td>
                    <td style={s.td}>
                      <div style={s.progressBar}>
                        <div style={{ ...s.progressFill, width: `${r.fraud_score}%`, background: riskColor(r.risk_level) }} />
                      </div>
                      <span style={{ fontSize: 11, color: T.muted }}>{r.fraud_score}%</span>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge,
                        color: riskColor(r.risk_level),
                        background: `${riskColor(r.risk_level)}22`
                      }}>
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
                Showing 100 of {filtered.length} results — Export CSV for full data
              </div>
            )}
          </div>
        </>
      )}

      {/* Sample CSV format */}
      {!results && (
        <div style={s.card}>
          <div style={s.h3}>📋 CSV Format Example</div>
          <pre style={{ fontSize: 12, color: T.muted, background: T.surface, padding: 16, borderRadius: 8, overflow: "auto" }}>
{`Time,Amount,V1,V2,V3
0,149.62,-1.35,0.07,-0.08
1,2.69,-1.10,-2.97,2.59
2,378.66,1.22,0.14,0.04
3,123.50,-0.49,0.64,0.07`}
          </pre>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
            💡 V1-V28 optional hain — sirf Time aur Amount required hain
          </div>
        </div>
      )}
    </div>
  );
}