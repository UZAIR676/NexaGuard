import { useState, useEffect } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

export default function Banking({ user, onBalanceUpdate }) {
  const [balance, setBalance]   = useState(user.balance || 0);
  const [txns, setTxns]         = useState([]);
  const [tab, setTab]           = useState("overview");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState("");
  const [err, setErr]           = useState("");

  // Send Money form
  const [sendForm, setSendForm] = useState({ to_email: "", amount: "", description: "" });
  // Deposit/Withdraw form
  const [amount, setAmount]     = useState("");

  const token = localStorage.getItem("ng_token");

  useEffect(() => { loadTxns(); }, []);

  const loadTxns = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/auth/transactions?token=${token}`);
      const data = await res.json();
      setTxns(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  const doTransaction = async (type, amount, extra = {}) => {
    setMsg(""); setErr("");
    if (!amount || amount <= 0) { setErr("Invalid amount"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type, amount: parseFloat(amount), ...extra }),
      });
      const data = await res.json();
      if (!res.ok)        { setErr(data.detail || "Transaction failed"); return; }
      if (data.status === "blocked") { setErr(`Transaction blocked: ${data.reason}`); return; }
      if (data.status === "pending") {
        setMsg(`⏳ ${type.charAt(0).toUpperCase() + type.slice(1)} of $${parseFloat(amount).toLocaleString()} submitted — flagged for manual review, you'll get an email once it's decided.`);
        setSendForm({ to_email: "", amount: "", description: "" });
        setAmount("");
        loadTxns();
        return;
      }
      setBalance(data.new_balance);
      onBalanceUpdate && onBalanceUpdate(data.new_balance);
      setMsg(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} of $${parseFloat(amount).toLocaleString()} successful!`);
      setSendForm({ to_email: "", amount: "", description: "" });
      setAmount("");
      loadTxns();
    } catch { setErr("Cannot connect to server."); }
    setLoading(false);
  };

  const upd = (k) => (e) => setSendForm(f => ({ ...f, [k]: e.target.value }));

  const txnIcon  = (t) => t === "send" ? "↑" : t === "receive" ? "↓" : t === "deposit" ? "+" : "−";
  const txnColor = (t) => t === "send" || t === "withdraw" ? T.red : T.green;
  const statusBadge = (st) =>
    st === "completed" ? s.badgeGreen :
    st === "blocked"   ? s.badgeRed   : s.badgeAmber;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>🏦 Banking</div>
        <div style={s.muted}>Manage your balance, send & receive money</div>
      </div>

      {/* Balance Card */}
      <div style={{
        background: `linear-gradient(135deg, #1E3A6E 0%, #161C2D 100%)`,
        border: `1px solid ${T.accentDim}`,
        borderRadius: 16, padding: 32, marginBottom: 20,
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "1px" }}>Available Balance</div>
          <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-2px", color: T.text }}>
            ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>{user.email}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}>🏦</div>
          <div style={{ ...s.badge, ...s.badgeGreen, marginTop: 8 }}>● Active</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={s.grid3}>
        {[
          ["💸 Total Sent",     txns.filter(t => t.type === "send" || t.type === "withdraw").reduce((a, t) => a + t.amount, 0), T.red],
          ["💰 Total Received", txns.filter(t => t.type === "receive" || t.type === "deposit").reduce((a, t) => a + t.amount, 0), T.green],
          ["🚨 Blocked",        txns.filter(t => t.status === "blocked").length, T.amber],
        ].map(([label, val, color]) => (
          <div key={label} style={s.statCard}>
            <div style={s.statLabel}>{label}</div>
            <div style={{ ...s.statVal, color, fontSize: 22 }}>
              {typeof val === "number" && val > 100 ? `$${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : val}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["overview","📊 Overview"], ["send","↑ Send Money"], ["deposit","+ Deposit"], ["withdraw","− Withdraw"]].map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setMsg(""); setErr(""); }}
            style={{ ...s.navItem, ...(tab === t ? s.navItemActive : {}) }}>
            {label}
          </button>
        ))}
      </div>

      {msg && <div style={{ padding: "12px 16px", background: "rgba(34,197,94,0.1)", borderRadius: 8, marginBottom: 16, fontSize: 13, color: T.green, border: `1px solid rgba(34,197,94,0.2)` }}>{msg}</div>}
      {err && <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)",  borderRadius: 8, marginBottom: 16, fontSize: 13, color: T.red,   border: `1px solid rgba(239,68,68,0.2)`  }}>{err}</div>}

      {/* Overview Tab */}
      {tab === "overview" && (
        <div style={s.card}>
          <div style={{ ...s.h3, marginBottom: 16 }}>Transaction History</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: T.muted }}>Loading...</div>
          ) : txns.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: T.muted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>💳</div>
              <div>No transactions yet</div>
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>{["Type","Amount","To/From","Description","Status","Fraud Score","Date"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id}>
                    <td style={s.td}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: `${txnColor(t.type)}22`,
                        color: txnColor(t.type),
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 16
                      }}>
                        {txnIcon(t.type)}
                      </div>
                      <span style={{ marginLeft: 8, fontSize: 13, textTransform: "capitalize" }}>{t.type}</span>
                    </td>
                    <td style={{ ...s.td, fontWeight: 700, color: txnColor(t.type) }}>
                      {t.type === "send" || t.type === "withdraw" ? "-" : "+"}${parseFloat(t.amount).toLocaleString()}
                    </td>
                    <td style={{ ...s.td, fontSize: 12, color: T.muted }}>{t.to_email || "—"}</td>
                    <td style={{ ...s.td, fontSize: 12, color: T.muted }}>{t.description || "—"}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...statusBadge(t.status) }}>{t.status?.toUpperCase()}</span>
                    </td>
                    <td style={{ ...s.td, color: t.fraud_score > 70 ? T.red : t.fraud_score > 30 ? T.amber : T.green, fontWeight: 600, fontSize: 13 }}>
                      {parseFloat(t.fraud_score || 0).toFixed(1)}%
                    </td>
                    <td style={{ ...s.td, fontSize: 12, color: T.muted }}>{t.created_at?.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Send Money Tab */}
      {tab === "send" && (
        <div style={{ ...s.card, maxWidth: 480 }}>
          <div style={s.h3}>↑ Send Money</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Transfer funds to another NexaGuard user</div>

          <label style={s.label}>Recipient Email</label>
          <input style={s.input} type="email" placeholder="recipient@email.com"
            value={sendForm.to_email} onChange={upd("to_email")}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <label style={s.label}>Amount (USD)</label>
          <input style={s.input} type="number" placeholder="0.00"
            value={sendForm.amount} onChange={upd("amount")}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <label style={s.label}>Description (optional)</label>
          <input style={s.input} placeholder="e.g. Rent payment"
            value={sendForm.description} onChange={upd("description")}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <div style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>
            Available: <strong style={{ color: T.text }}>${balance.toLocaleString()}</strong>
          </div>

          <button
            style={{ ...s.btn, marginTop: 20, opacity: loading ? 0.7 : 1 }}
            onClick={() => doTransaction("send", sendForm.amount, { to_email: sendForm.to_email, description: sendForm.description })}
            disabled={loading}>
            {loading ? "Processing..." : "Send Money ↑"}
          </button>
        </div>
      )}

      {/* Deposit Tab */}
      {tab === "deposit" && (
        <div style={{ ...s.card, maxWidth: 480 }}>
          <div style={s.h3}>+ Deposit</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Add funds to your account</div>

          <label style={s.label}>Amount (USD)</label>
          <input style={s.input} type="number" placeholder="0.00"
            value={amount} onChange={e => setAmount(e.target.value)}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {[100, 500, 1000, 5000].map(a => (
              <button key={a} onClick={() => setAmount(a)}
                style={{ ...s.navItem, ...s.navItemActive, fontSize: 13 }}>
                +${a.toLocaleString()}
              </button>
            ))}
          </div>

          <button
            style={{ ...s.btn, marginTop: 20, background: T.green, opacity: loading ? 0.7 : 1 }}
            onClick={() => doTransaction("deposit", amount)}
            disabled={loading}>
            {loading ? "Processing..." : "+ Deposit Funds"}
          </button>
        </div>
      )}

      {/* Withdraw Tab */}
      {tab === "withdraw" && (
        <div style={{ ...s.card, maxWidth: 480 }}>
          <div style={s.h3}>− Withdraw</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Withdraw funds from your account</div>

          <label style={s.label}>Amount (USD)</label>
          <input style={s.input} type="number" placeholder="0.00"
            value={amount} onChange={e => setAmount(e.target.value)}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <div style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>
            Available: <strong style={{ color: T.text }}>${balance.toLocaleString()}</strong>
          </div>

          <button
            style={{ ...s.btn, marginTop: 20, background: "rgba(239,68,68,0.2)", color: T.red, border: `1px solid rgba(239,68,68,0.3)`, opacity: loading ? 0.7 : 1 }}
            onClick={() => doTransaction("withdraw", amount)}
            disabled={loading}>
            {loading ? "Processing..." : "− Withdraw Funds"}
          </button>
        </div>
      )}
    </div>
  );
}