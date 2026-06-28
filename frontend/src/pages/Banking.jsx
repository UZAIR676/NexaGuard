import { useState, useEffect, useRef } from "react";
import FaceVerificationModal from "./FaceVerificationModal";
import { T, s } from "../theme";

function timeAgo(iso) {
  if (!iso) return "";
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const diffMs = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const BASE = "http://localhost:8000";

const FACE_VERIFY_THRESHOLD = 5000;

// Daily limits (USD)
const DAILY_LIMIT_SEND_WITHDRAW = 5000;
const DAILY_LIMIT_DEPOSIT = 10000;

/* ---------------------------------------------------
   Small reusable bits
--------------------------------------------------- */

function useCountUp(value, duration = 600) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}

function estimateRisk({ amount, to_email }) {
  const amt = parseFloat(amount) || 0;
  let score = 0;
  if (amt > 10000) score += 55;
  else if (amt > 5000) score += 38;
  else if (amt > 1000) score += 18;
  else if (amt > 0) score += 6;

  if (to_email) {
    const freeDomains = ["tempmail", "guerrilla", "yopmail", "mailinator"];
    if (freeDomains.some((d) => to_email.toLowerCase().includes(d))) score += 30;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email)) score += 10;
  }
  score += Math.min(8, amt % 7);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function riskMeta(score) {
  if (score >= 70) return { label: "High Risk", color: "#ef4444" };
  if (score >= 35) return { label: "Medium Risk", color: "#f59e0b" };
  return { label: "Low Risk", color: "#22c55e" };
}

function RiskGauge({ score }) {
  const meta = riskMeta(score);
  const r = 54;
  const circumference = Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <svg width="130" height="74" viewBox="0 0 130 74">
        <path
          d="M 8 70 A 54 54 0 0 1 122 70"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 8 70 A 54 54 0 0 1 122 70"
          fill="none"
          stroke={meta.color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.4s ease" }}
        />
        <text x="65" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill={T.text}>
          {score}
        </text>
      </svg>
      <div>
        <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Live Risk Preview
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: meta.color }}>{meta.label}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
          Final score is calculated by NexaGuard AI on submit
        </div>
      </div>
    </div>
  );
}

// Daily limit progress bar
function DailyLimitBar({ used, limit, label, color }) {
  const pct = Math.min(100, (used / limit) * 100);
  const remaining = Math.max(0, limit - used);
  const barColor = pct >= 90 ? "#ef4444" : pct >= 65 ? "#f59e0b" : color || "#22c55e";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: T.text }}>
          ${remaining.toLocaleString()} remaining
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: barColor,
            borderRadius: 4,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
        ${used.toLocaleString()} of ${limit.toLocaleString()} used today
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} style={{ padding: "14px 12px" }}>
          <div
            style={{
              height: 14,
              borderRadius: 6,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.05) 63%)",
              backgroundSize: "400% 100%",
              animation: "ngShimmer 1.4s ease infinite",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

function MiniSparkline({ values, color }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 32, marginTop: 8 }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(6, (v / max) * 100)}%`,
            background: color,
            opacity: 0.35 + (i / values.length) * 0.5,
            borderRadius: 3,
            transition: "height 0.4s ease",
          }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------
   Main component
--------------------------------------------------- */

export default function Banking({ user, onBalanceUpdate }) {
  const [balance, setBalance] = useState(user.balance || 0);
  const [txns, setTxns] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [err, setErr] = useState("");
  const [accountHeld, setAccountHeld] = useState(user.held || false);
  const [sendForm, setSendForm] = useState({ to_email: "", amount: "", description: "" });
  const [amount, setAmount] = useState("");

  // Daily usage tracking (loaded from backend or computed from txns)
  const [dailyUsed, setDailyUsed] = useState({ sendWithdraw: 0, deposit: 0 });

  // Face verification gate
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceReason, setFaceReason] = useState("");
  // faceVerified = true means user JUST passed face check this session → bypass fraud block
  const [faceVerified, setFaceVerified] = useState(false);
  const pendingTxnRef = useRef(null);

  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const token = localStorage.getItem("ng_token");
  const animatedBalance = useCountUp(balance);

  const TABS = [
    ["overview", "📊 Overview"],
    ["send", "↑ Send Money"],
    ["deposit", "+ Deposit"],
    ["withdraw", "− Withdraw"],
  ];

  useEffect(() => {
    loadTxns();
    loadFaceStatus();
  }, []);

  useEffect(() => {
    const el = tabRefs.current[tab];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab, loading]);

  // Recompute daily usage whenever txns change
  useEffect(() => {
    const today = new Date().toDateString();
    let sw = 0, dep = 0;
    txns.forEach((t) => {
      const tDate = new Date(
        t.created_at.includes("T") ? t.created_at : t.created_at.replace(" ", "T") + "Z"
      ).toDateString();
      if (tDate !== today) return;
      if (t.status === "blocked") return;
      if (t.type === "send" || t.type === "withdraw") sw += t.amount || 0;
      if (t.type === "deposit") dep += t.amount || 0;
    });
    setDailyUsed({ sendWithdraw: sw, deposit: dep });
  }, [txns]);

  const loadFaceStatus = async () => {
    try {
      const r = await fetch(`${BASE}/api/face/status?token=${token}`);
      const d = await r.json();
      setFaceRegistered(!!d.registered);
    } catch {}
  };

  const loadTxns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/transactions?token=${token}`);
      const data = await res.json();
      setTxns(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  // Check daily limit before submitting
  const checkDailyLimit = (type, amt) => {
    const num = parseFloat(amt) || 0;
    if (type === "deposit") {
      if (dailyUsed.deposit + num > DAILY_LIMIT_DEPOSIT) {
        return `Daily deposit limit of $${DAILY_LIMIT_DEPOSIT.toLocaleString()} reached. Remaining: $${Math.max(0, DAILY_LIMIT_DEPOSIT - dailyUsed.deposit).toLocaleString()}`;
      }
    } else if (type === "send" || type === "withdraw") {
      if (dailyUsed.sendWithdraw + num > DAILY_LIMIT_SEND_WITHDRAW) {
        return `Daily send/withdraw limit of $${DAILY_LIMIT_SEND_WITHDRAW.toLocaleString()} reached. Remaining: $${Math.max(0, DAILY_LIMIT_SEND_WITHDRAW - dailyUsed.sendWithdraw).toLocaleString()}`;
      }
    }
    return null;
  };

  // Actually fires the transaction request to the backend.
  // faceVerifiedOverride = true means face was verified, so skip fraud block on frontend
  const doTransaction = async (type, amount, extra = {}, faceVerifiedOverride = false) => {
    setMsg("");
    setErr("");
    if (!amount || amount <= 0) {
      setErr("Invalid amount");
      return;
    }

    // Daily limit check
    const limitErr = checkDailyLimit(type, amount);
    if (limitErr) {
      setErr(limitErr);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          type,
          amount: parseFloat(amount),
          face_verified: faceVerifiedOverride, // tell backend face was verified
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg403 = data.detail || "Transaction failed";
        if (res.status === 403 && msg403.toLowerCase().includes("hold")) {
          setAccountHeld(true);
        }
        setErr(msg403);
        return;
      }
      if (data.status === "blocked") {
        // If face was verified, override block and warn user instead
        if (faceVerifiedOverride) {
          setMsgType("success");
          setBalance(data.new_balance ?? balance);
          onBalanceUpdate && onBalanceUpdate(data.new_balance ?? balance);
          setMsg(
            `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} of $${parseFloat(amount).toLocaleString()} completed (face-verified — fraud flag overridden).`
          );
          setSendForm({ to_email: "", amount: "", description: "" });
          setAmount("");
          loadTxns();
          return;
        }
        setErr(`Transaction blocked: ${data.reason}`);
        return;
      }
      if (data.status === "pending") {
        setMsgType("pending");
        setMsg(
          `${type.charAt(0).toUpperCase() + type.slice(1)} of $${parseFloat(amount).toLocaleString()} needs confirmation — we've emailed you a confirm link. Click it to complete the transaction.`
        );
        setSendForm({ to_email: "", amount: "", description: "" });
        setAmount("");
        loadTxns();
        return;
      }
      setMsgType("success");
      setBalance(data.new_balance);
      onBalanceUpdate && onBalanceUpdate(data.new_balance);
      setMsg(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} of $${parseFloat(amount).toLocaleString()} successful!`);
      setSendForm({ to_email: "", amount: "", description: "" });
      setAmount("");
      loadTxns();
    } catch {
      setErr("Cannot connect to server.");
    }
    setLoading(false);
  };

  // Gate: decide if face verification is needed first
  const requestTransaction = (type, amt, extra = {}) => {
    setMsg("");
    setErr("");
    const numericAmt = parseFloat(amt) || 0;

    // Daily limit check early
    const limitErr = checkDailyLimit(type, amt);
    if (limitErr) {
      setErr(limitErr);
      return;
    }

    const needsFace =
      faceRegistered &&
      (type === "send" || type === "withdraw") &&
      numericAmt >= FACE_VERIFY_THRESHOLD;

    if (needsFace) {
      pendingTxnRef.current = { type, amount: amt, extra };
      setFaceReason(
        `${type === "send" ? "Sending" : "Withdrawing"} $${numericAmt.toLocaleString()} — above your $${FACE_VERIFY_THRESHOLD.toLocaleString()} face-verification limit`
      );
      setShowFaceModal(true);
      return;
    }

    doTransaction(type, amt, extra, false);
  };

  const handleFaceSuccess = () => {
    setShowFaceModal(false);
    setFaceVerified(true);
    const pending = pendingTxnRef.current;
    pendingTxnRef.current = null;
    if (pending) {
      // Pass faceVerifiedOverride = true so fraud block is bypassed
      doTransaction(pending.type, pending.amount, pending.extra, true);
    }
  };

  const handleFaceFail = () => {
    setShowFaceModal(false);
    setFaceVerified(false);
    pendingTxnRef.current = null;
    setErr("Face verification failed or was cancelled — transaction was not submitted.");
  };

  const upd = (k) => (e) => setSendForm((f) => ({ ...f, [k]: e.target.value }));

  const txnIcon = (t) => (t === "send" ? "↑" : t === "receive" ? "↓" : t === "deposit" ? "+" : "−");
  const txnColor = (t) => (t === "send" || t === "withdraw" ? T.red : T.green);
  const statusBadge = (st) => (st === "completed" ? s.badgeGreen : st === "blocked" ? s.badgeRed : s.badgeAmber);

  const totalSent = txns.filter((t) => t.type === "send" || t.type === "withdraw").reduce((a, t) => a + t.amount, 0);
  const totalReceived = txns.filter((t) => t.type === "receive" || t.type === "deposit").reduce((a, t) => a + t.amount, 0);
  const blockedCount = txns.filter((t) => t.status === "blocked").length;
  const blockedSaved = txns.filter((t) => t.status === "blocked").reduce((a, t) => a + t.amount, 0);
  const pendingCount = txns.filter((t) => t.status === "pending").length;

  const recentAmounts = txns.slice(0, 8).reverse().map((t) => t.amount || 0);

  const risk = estimateRisk(sendForm);
  const riskInfo = riskMeta(risk);

  const swRemaining = Math.max(0, DAILY_LIMIT_SEND_WITHDRAW - dailyUsed.sendWithdraw);
  const depRemaining = Math.max(0, DAILY_LIMIT_DEPOSIT - dailyUsed.deposit);

  return (
    <div>
      <style>{`
        @keyframes ngShimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
        @keyframes ngFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ngPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .ng-glass {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .ng-fade { animation: ngFadeIn 0.35s ease; }
        .ng-pulse { animation: ngPulse 1.6s ease infinite; }
        .ng-tab-btn {
          position: relative;
          z-index: 1;
          background: transparent !important;
          border: none !important;
          transition: color 0.25s ease;
        }

        /* ── Responsive ─────────────────────────────── */
        .ng-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }
        .ng-balance-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .ng-balance-amount { font-size: 48px; }
        .ng-send-row {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .ng-tabs {
          display: flex;
          gap: 4px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .ng-tabs::-webkit-scrollbar { display: none; }
        .ng-txn-table { overflow-x: auto; }

        @media (max-width: 700px) {
          .ng-stats-grid { grid-template-columns: 1fr 1fr; }
          .ng-balance-amount { font-size: 34px !important; letter-spacing: -1px !important; }
          .ng-balance-icon { display: none; }
          .ng-send-row { flex-direction: column; }
          .ng-tab-btn { font-size: 13px !important; padding: 8px 10px !important; }
        }

        @media (max-width: 480px) {
          .ng-stats-grid { grid-template-columns: 1fr; }
          .ng-balance-card { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      {/* Face Verification Modal */}
      {showFaceModal && (
        <FaceVerificationModal
          reason={faceReason}
          onSuccess={handleFaceSuccess}
          onFail={handleFaceFail}
        />
      )}

      {/* Account Held Banner */}
      {accountHeld && (
        <div
          className="ng-glass ng-fade"
          style={{
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 28 }}>🔒</div>
          <div>
            <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 15 }}>Account On Hold</div>
            <div style={{ color: "#ef4444", fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              Suspicious activity detected. All transactions are blocked until admin clears your account.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>🏦 Banking</div>
        <div style={s.muted}>Manage your balance, send & receive money</div>
      </div>

      {/* Balance Card */}
      <div
        className="ng-glass"
        style={{
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(135deg, rgba(30,58,110,0.85) 0%, rgba(22,28,45,0.95) 100%)`,
          borderRadius: 20,
          padding: 32,
          marginBottom: 20,
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(96,165,250,0.18), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div className="ng-balance-card" style={{ position: "relative" }}>
          <div>
            <div
              style={{
                fontSize: 13,
                color: T.muted,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Available Balance
            </div>
            <div className="ng-balance-amount" style={{ fontWeight: 700, letterSpacing: "-2px", color: T.text }}>
              ${animatedBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>{user.email}</div>
          </div>
          <div className="ng-balance-icon" style={{ textAlign: "right" }}>
            <div style={{ fontSize: 48, opacity: 0.3 }}>🏦</div>
            <div style={{ ...s.badge, ...s.badgeGreen, marginTop: 8 }}>● Active</div>
          </div>
        </div>

        {/* Daily Limits inside balance card */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          <DailyLimitBar
            used={dailyUsed.sendWithdraw}
            limit={DAILY_LIMIT_SEND_WITHDRAW}
            label="Daily Send / Withdraw"
            color="#60a5fa"
          />
          <DailyLimitBar
            used={dailyUsed.deposit}
            limit={DAILY_LIMIT_DEPOSIT}
            label="Daily Deposit"
            color="#22c55e"
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="ng-stats-grid">
        {[
          ["💸 Total Sent", totalSent, T.red, recentAmounts],
          ["💰 Total Received", totalReceived, T.green, recentAmounts],
          ["🛡️ Blocked & Saved", blockedSaved, T.amber, recentAmounts],
        ].map(([label, val, color, spark]) => (
          <div key={label} className="ng-glass" style={{ ...s.statCard, borderRadius: 14 }}>
            <div style={s.statLabel}>{label}</div>
            <div style={{ ...s.statVal, color, fontSize: 22 }}>
              ${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <MiniSparkline values={spark.length ? spark : [1, 1, 1]} color={color} />
          </div>
        ))}
      </div>

      {/* Blocked / pending count chips */}
      {(blockedCount > 0 || pendingCount > 0) && (
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.muted, margin: "4px 0 18px", flexWrap: "wrap" }}>
          {blockedCount > 0 && (
            <span>
              NexaGuard AI has blocked <strong style={{ color: T.amber }}>{blockedCount}</strong> suspicious transaction
              {blockedCount > 1 ? "s" : ""} so far.
            </span>
          )}
          {pendingCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="ng-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: T.amber, display: "inline-block" }} />
              <strong style={{ color: T.amber }}>{pendingCount}</strong> transaction{pendingCount > 1 ? "s" : ""} waiting on your email confirmation.
            </span>
          )}
        </div>
      )}

      {/* Face ID hint */}
      {!faceRegistered && (
        <div
          style={{
            fontSize: 12,
            color: T.muted,
            margin: "0 0 18px",
            padding: "10px 14px",
            background: T.surface,
            borderRadius: 10,
            border: `1px solid ${T.border}`,
          }}
        >
          🔐 Tip: Register Face ID in Settings to add an extra verification step for transactions over $
          {FACE_VERIFY_THRESHOLD.toLocaleString()}.
        </div>
      )}

      {/* Tabs with sliding indicator */}
      <div style={{ position: "relative", marginBottom: 16, borderBottom: `1px solid ${T.border}` }}>
        <div className="ng-tabs">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              ref={(el) => (tabRefs.current[t] = el)}
              className="ng-tab-btn"
              onClick={() => {
                setTab(t);
                setMsg("");
                setErr("");
              }}
              style={{
                ...s.navItem,
                background: "transparent",
                color: tab === t ? T.text : T.muted,
                fontWeight: tab === t ? 700 : 500,
                padding: "10px 14px",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: -1,
            height: 2,
            borderRadius: 2,
            background: T.accent,
            left: indicator.left,
            width: indicator.width,
            transition: "left 0.25s ease, width 0.25s ease",
          }}
        />
      </div>

      {/* Suspicious location banner */}
      {err && err.toLowerCase().includes("impossible travel") && (
        <div
          className="ng-glass ng-fade"
          style={{
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 24 }}>🌍</div>
          <div>
            <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 14 }}>Suspicious Location Detected</div>
            <div style={{ color: "#ef4444", fontSize: 13, opacity: 0.85, marginTop: 4 }}>{err}</div>
          </div>
        </div>
      )}

      {/* Pending confirmation banner */}
      {msg && msgType === "pending" && (
        <div
          className="ng-glass ng-fade"
          style={{
            background: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 26 }} className="ng-pulse">📧</div>
          <div>
            <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 14 }}>Check Your Email to Confirm</div>
            <div style={{ color: "#f59e0b", fontSize: 13, opacity: 0.85, marginTop: 4 }}>{msg}</div>
          </div>
        </div>
      )}

      {msg && msgType === "success" && (
        <div
          className="ng-fade"
          style={{
            padding: "12px 16px",
            background: "rgba(34,197,94,0.1)",
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            color: T.green,
            border: `1px solid rgba(34,197,94,0.2)`,
          }}
        >
          {msg}
        </div>
      )}
      {err && !err.toLowerCase().includes("impossible travel") && (
        <div
          className="ng-fade"
          style={{
            padding: "12px 16px",
            background: "rgba(239,68,68,0.1)",
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            color: T.red,
            border: `1px solid rgba(239,68,68,0.2)`,
          }}
        >
          {err}
        </div>
      )}

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="ng-glass ng-fade" style={{ ...s.card, borderRadius: 16 }}>
          <div style={{ ...s.h3, marginBottom: 16 }}>Transaction History</div>
          {loading ? (
            <div className="ng-txn-table">
              <table style={s.table}>
                <thead>
                  <tr>
                    {["Type", "Amount", "To/From", "Description", "Status", "Fraud Score", "Date"].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                </tbody>
              </table>
            </div>
          ) : txns.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: T.muted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>💳</div>
              <div>No transactions yet</div>
            </div>
          ) : (
            <div className="ng-txn-table">
              <table style={s.table}>
                <thead>
                  <tr>
                    {["Type", "Amount", "To/From", "Description", "Status", "Fraud Score", "Date"].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t.id} className="ng-fade">
                      <td style={s.td}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: `${txnColor(t.type)}22`,
                            color: txnColor(t.type),
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 16,
                          }}
                        >
                          {txnIcon(t.type)}
                        </div>
                        <span style={{ marginLeft: 8, fontSize: 13, textTransform: "capitalize" }}>{t.type}</span>
                      </td>
                      <td style={{ ...s.td, fontWeight: 700, color: txnColor(t.type) }}>
                        {t.type === "send" || t.type === "withdraw" ? "-" : "+"}$
                        {parseFloat(t.amount).toLocaleString()}
                      </td>
                      <td style={{ ...s.td, fontSize: 12, color: T.muted }}>{t.to_email || "—"}</td>
                      <td style={{ ...s.td, fontSize: 12, color: T.muted }}>{t.description || "—"}</td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, ...statusBadge(t.status) }}>
                          {t.status === "pending" ? "⏳ AWAITING EMAIL" : t.status?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...s.td, padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 56,
                              height: 6,
                              borderRadius: 4,
                              background: "rgba(255,255,255,0.08)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, parseFloat(t.fraud_score || 0))}%`,
                                background: t.fraud_score > 70 ? T.red : t.fraud_score > 30 ? T.amber : T.green,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              color: t.fraud_score > 70 ? T.red : t.fraud_score > 30 ? T.amber : T.green,
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            {parseFloat(t.fraud_score || 0).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ ...s.td, fontSize: 12, color: T.muted }}>{timeAgo(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Send Money Tab */}
      {tab === "send" && (
        <div className="ng-send-row">
          <div className="ng-glass ng-fade" style={{ ...s.card, maxWidth: 480, flex: "1 1 300px", borderRadius: 16 }}>
            <div style={s.h3}>↑ Send Money</div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>
              Transfer funds to another NexaGuard user
            </div>

            <label style={s.label}>Recipient Email</label>
            <input
              style={s.input}
              type="email"
              placeholder="recipient@email.com"
              value={sendForm.to_email}
              onChange={upd("to_email")}
              onFocus={(e) => (e.target.style.borderColor = T.accent)}
              onBlur={(e) => (e.target.style.borderColor = T.border)}
            />

            <label style={s.label}>Amount (USD)</label>
            <input
              style={s.input}
              type="number"
              placeholder="0.00"
              value={sendForm.amount}
              onChange={upd("amount")}
              onFocus={(e) => (e.target.style.borderColor = T.accent)}
              onBlur={(e) => (e.target.style.borderColor = T.border)}
            />

            <label style={s.label}>Description (optional)</label>
            <input
              style={s.input}
              placeholder="e.g. Rent payment"
              value={sendForm.description}
              onChange={upd("description")}
              onFocus={(e) => (e.target.style.borderColor = T.accent)}
              onBlur={(e) => (e.target.style.borderColor = T.border)}
            />

            <div style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>
              Available: <strong style={{ color: T.text }}>${balance.toLocaleString()}</strong>
              {" · "}
              Daily remaining: <strong style={{ color: swRemaining > 0 ? T.text : T.red }}>${swRemaining.toLocaleString()}</strong>
            </div>

            {faceRegistered && parseFloat(sendForm.amount || 0) >= FACE_VERIFY_THRESHOLD && (
              <div
                style={{
                  fontSize: 12,
                  color: "#60a5fa",
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "rgba(96,165,250,0.10)",
                  border: "1px solid rgba(96,165,250,0.25)",
                  borderRadius: 8,
                }}
              >
                🛡️ This amount requires Face ID verification before sending. Fraud block will be bypassed after verification.
              </div>
            )}

            <button
              style={{ ...s.btn, marginTop: 20, opacity: loading ? 0.7 : 1 }}
              onClick={() =>
                requestTransaction("send", sendForm.amount, {
                  to_email: sendForm.to_email,
                  description: sendForm.description,
                })
              }
              disabled={loading}
            >
              {loading ? "Processing..." : "Send Money ↑"}
            </button>
          </div>

          {/* Live risk preview */}
          <div className="ng-glass ng-fade" style={{ ...s.card, flex: "1 1 240px", maxWidth: 320, borderRadius: 16 }}>
            <div style={{ ...s.h3, fontSize: 15, marginBottom: 14 }}>🛡️ Risk Preview</div>
            <RiskGauge score={risk} />
            <div
              style={{
                marginTop: 18,
                fontSize: 12,
                color: T.muted,
                lineHeight: 1.6,
                borderTop: `1px solid ${T.border}`,
                paddingTop: 14,
              }}
            >
              Based on amount and recipient pattern. Actual score is calculated by NexaGuard's ML model
              ({riskInfo.label.toLowerCase()} signals detected).
              {risk >= 35 && (
                <> If medium-risk, you'll get an email confirm link — unless Face ID is verified.</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deposit Tab */}
      {tab === "deposit" && (
        <div className="ng-glass ng-fade" style={{ ...s.card, maxWidth: 480, borderRadius: 16 }}>
          <div style={s.h3}>+ Deposit</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Add funds to your account</div>

          <label style={s.label}>Amount (USD)</label>
          <input
            style={s.input}
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = T.accent)}
            onBlur={(e) => (e.target.style.borderColor = T.border)}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {[100, 500, 1000, 5000].map((a) => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                style={{ ...s.navItem, ...s.navItemActive, fontSize: 13 }}
              >
                +${a.toLocaleString()}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>
            Daily deposit remaining: <strong style={{ color: depRemaining > 0 ? T.text : T.red }}>${depRemaining.toLocaleString()}</strong>
          </div>

          <button
            style={{ ...s.btn, marginTop: 20, background: T.green, opacity: loading ? 0.7 : 1 }}
            onClick={() => doTransaction("deposit", amount)}
            disabled={loading}
          >
            {loading ? "Processing..." : "+ Deposit Funds"}
          </button>
        </div>
      )}

      {/* Withdraw Tab */}
      {tab === "withdraw" && (
        <div className="ng-glass ng-fade" style={{ ...s.card, maxWidth: 480, borderRadius: 16 }}>
          <div style={s.h3}>− Withdraw</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Withdraw funds from your account</div>

          <label style={s.label}>Amount (USD)</label>
          <input
            style={s.input}
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = T.accent)}
            onBlur={(e) => (e.target.style.borderColor = T.border)}
          />

          <div style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>
            Available: <strong style={{ color: T.text }}>${balance.toLocaleString()}</strong>
            {" · "}
            Daily remaining: <strong style={{ color: swRemaining > 0 ? T.text : T.red }}>${swRemaining.toLocaleString()}</strong>
          </div>

          {faceRegistered && parseFloat(amount || 0) >= FACE_VERIFY_THRESHOLD && (
            <div
              style={{
                fontSize: 12,
                color: "#60a5fa",
                marginTop: 10,
                padding: "8px 12px",
                background: "rgba(96,165,250,0.10)",
                border: "1px solid rgba(96,165,250,0.25)",
                borderRadius: 8,
              }}
            >
              🛡️ This amount requires Face ID verification before withdrawing. Fraud block will be bypassed after verification.
            </div>
          )}

          <button
            style={{
              ...s.btn,
              marginTop: 20,
              background: "rgba(239,68,68,0.2)",
              color: T.red,
              border: `1px solid rgba(239,68,68,0.3)`,
              opacity: loading ? 0.7 : 1,
            }}
            onClick={() => requestTransaction("withdraw", amount)}
            disabled={loading}
          >
            {loading ? "Processing..." : "− Withdraw Funds"}
          </button>
        </div>
      )}
    </div>
  );
}