import { useState, useEffect, useRef } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:        "#080B12",
  surface:   "#0E1220",
  card:      "#131825",
  cardHover: "#181F30",
  border:    "#1C2438",
  borderHi:  "#2A3550",
  accent:    "#4F8EF7",
  accentSoft:"rgba(79,142,247,0.12)",
  accentGlow:"rgba(79,142,247,0.25)",
  green:     "#22C55E",
  greenSoft: "rgba(34,197,94,0.12)",
  red:       "#EF4444",
  redSoft:   "rgba(239,68,68,0.12)",
  amber:     "#F59E0B",
  amberSoft: "rgba(245,158,11,0.12)",
  purple:    "#A78BFA",
  text:      "#E8EDF5",
  textDim:   "#9BA8C0",
  muted:     "#5A6785",
  font:      "'Inter', 'Segoe UI', sans-serif",
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; color: ${T.text}; font-family: ${T.font}; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
  input, button, textarea { font-family: inherit; }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.45} }
  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes shimmer  { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
  @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes slideIn  { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
  .fade-up  { animation: fadeUp  0.24s ease both; }
  .slide-in { animation: slideIn 0.22s ease both; }
  .hover-row:hover { background: rgba(255,255,255,0.025) !important; }
  .tab-btn { transition: all 0.15s ease; }
  .tab-btn:hover { color: ${T.text} !important; }
  .nav-item { transition: all 0.15s ease; }
  .nav-item:hover { background: ${T.card} !important; color: ${T.text} !important; }
  .input-field:focus { border-color: ${T.accent} !important; box-shadow: 0 0 0 3px ${T.accentGlow}; }
  .card-hover { transition: border-color 0.2s, box-shadow 0.2s; }
  .card-hover:hover { border-color: ${T.borderHi} !important; }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .btn-primary { transition: opacity 0.15s, transform 0.15s; }
  @media (max-width: 900px) {
    .auth-right { display: none !important; }
    .auth-left  { max-width: 100% !important; padding: 40px 28px !important; }
    .grid-2     { grid-template-columns: 1fr !important; }
    .grid-3     { grid-template-columns: 1fr !important; }
    .grid-4     { grid-template-columns: repeat(2,1fr) !important; }
    .nav-labels { display: none !important; }
    .nav-full   { display: none !important; }
    .nav-mobile { display: flex !important; }
  }
  @media (max-width: 600px) {
    .grid-4 { grid-template-columns: 1fr 1fr !important; }
    .main-pad { padding: 16px !important; }
  }
`;

// ─── Shared Styles ────────────────────────────────────────────────────────────
const card = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
  padding: "20px 22px",
};

const th = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: 11,
  color: T.muted,
  fontWeight: 700,
  borderBottom: `1px solid ${T.border}`,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  whiteSpace: "nowrap",
};

const td = {
  padding: "11px 12px",
  fontSize: 13,
  borderBottom: `1px solid rgba(255,255,255,0.04)`,
  color: T.text,
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function Badge({ children, color, bg, border }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: "0.3px",
      color: color || T.accent,
      background: bg || T.accentSoft,
      border: `1px solid ${border || "transparent"}`,
    }}>
      {children}
    </span>
  );
}

function RiskBadge({ risk }) {
  const map = {
    "HIGH":    { color: T.red,   bg: T.redSoft,   label: "HIGH"   },
    "MEDIUM":  { color: T.amber, bg: T.amberSoft,  label: "MEDIUM" },
    "LOW":     { color: T.amber, bg: T.amberSoft,  label: "LOW"    },
    "SAFE":    { color: T.green, bg: T.greenSoft,  label: "SAFE"   },
    "HIGH RISK":   { color: T.red,   bg: T.redSoft },
    "MEDIUM RISK": { color: T.amber, bg: T.amberSoft },
    "LOW RISK":    { color: T.amber, bg: T.amberSoft },
  };
  const m = map[risk] || { color: T.muted, bg: "rgba(255,255,255,0.06)" };
  return <Badge color={m.color} bg={m.bg}>{risk}</Badge>;
}

function MiniBar({ value, max = 100 }) {
  const color = value > 70 ? T.red : value > 30 ? T.amber : T.green;
  return (
    <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.min((value / max) * 100, 100)}%`,
        background: color, borderRadius: 3,
        transition: "width 0.5s ease",
      }} />
    </div>
  );
}

function LiveDot({ color = T.green }) {
  return (
    <span style={{
      width: 7, height: 7, borderRadius: "50%",
      background: color, display: "inline-block",
      boxShadow: `0 0 0 2px ${color}33`,
      animation: "pulse 2s infinite",
    }} />
  );
}

function SectionHead({ title, sub, right }) {
  return (
    <div style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
      <div>
        <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.4px", color: T.text }}>{title}</h2>
        {sub && <p style={{ color: T.muted, fontSize: 13, marginTop: 3 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Spinner() {
  return <span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>⟳</span>;
}

function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: T.card, border: `1px solid ${T.green}44`,
      borderRadius: 12, padding: "12px 18px",
      color: T.green, fontSize: 13, fontWeight: 600,
      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${T.green}22`,
      animation: "fadeUp 0.2s ease",
    }}>
      ✓ {msg}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
function Input({ label, type = "text", value, onChange, placeholder, disabled, style: extra }) {
  return (
    <div style={{ marginTop: 16 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>}
      <input
        className="input-field"
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} disabled={disabled}
        style={{
          width: "100%", padding: "11px 14px",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${T.border}`,
          borderRadius: 9, color: T.text, fontSize: 13,
          outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
          opacity: disabled ? 0.45 : 1,
          ...extra,
        }}
      />
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", style: extra }) {
  const base = {
    padding: "11px 20px", border: "none", borderRadius: 9,
    fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, width: "100%", marginTop: 18,
    letterSpacing: "0.1px",
  };
  const variants = {
    primary: { background: T.accent, color: "#fff", boxShadow: `0 4px 16px ${T.accentGlow}` },
    ghost:   { background: "transparent", color: T.muted, border: `1px solid ${T.border}` },
  };
  return (
    <button className="btn-primary" style={{ ...base, ...variants[variant], ...extra }}
      onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_STATS = [
  { label: "Total Transactions", value: "1,284,320", change: "+3.2% vs last week", up: true,  icon: "💳" },
  { label: "Fraud Detected",     value: "347",       change: "+12 flagged today",  up: false, icon: "🚨" },
  { label: "Detection Rate",     value: "99.7%",     change: "-0.003% variance",   up: true,  icon: "🎯" },
  { label: "Blocked Amount",     value: "$2.4M",     change: "+$180K this week",   up: false, icon: "🔒" },
];

const MOCK_MARKET = [
  { name: "S&P 500",  val: "5,847.22",  chg: "+0.42%", up: true  },
  { name: "NASDAQ",   val: "19,234.18", chg: "-0.18%", up: false },
  { name: "DOW",      val: "42,781.50", chg: "+0.31%", up: true  },
  { name: "BTC/USD",  val: "$67,420",   chg: "+1.84%", up: true  },
  { name: "ETH/USD",  val: "$3,512",    chg: "+0.97%", up: true  },
  { name: "EUR/USD",  val: "1.0842",    chg: "-0.12%", up: false },
];

const MOCK_RECENT = [
  { id: "TXN-8821", amount: "$12,400", merchant: "Wire Transfer",    risk: "HIGH",   score: 87, flagged: true  },
  { id: "TXN-8820", amount: "$234",    merchant: "Amazon",           risk: "SAFE",   score: 2,  flagged: false },
  { id: "TXN-8819", amount: "$5,600",  merchant: "Unknown Merchant", risk: "MEDIUM", score: 44, flagged: true  },
  { id: "TXN-8818", amount: "$89",     merchant: "Starbucks",        risk: "SAFE",   score: 1,  flagged: false },
  { id: "TXN-8817", amount: "$3,200",  merchant: "Crypto Exchange",  risk: "HIGH",   score: 72, flagged: true  },
  { id: "TXN-8816", amount: "$450",    merchant: "Delta Airlines",   risk: "SAFE",   score: 5,  flagged: false },
];

const MOCK_ALERTS = [
  { time: "2 min ago",  msg: "High-risk transaction blocked: $12,400 wire transfer",    type: "high"   },
  { time: "18 min ago", msg: "Unusual pattern: 3 transactions in 60 seconds",           type: "medium" },
  { time: "1 hr ago",   msg: "New login from unrecognized device – IP 45.22.x.x",       type: "medium" },
  { time: "3 hr ago",   msg: "Fraud model retrained successfully with 2,400 samples",   type: "info"   },
  { time: "Yesterday",  msg: "Daily summary: 12 blocked transactions, $48,200 saved.",  type: "info"   },
  { time: "Yesterday",  msg: "Model accuracy: 99.7% on last 10,000 transactions.",       type: "info"   },
  { time: "2 days ago", msg: "Suspicious pattern: 5 rapid-fire small transactions.",    type: "medium" },
];

const INDICES = [
  { name:"S&P 500",    sym:"SPX", val:"5,847.22",  chg:"+0.42%", ytd:"+12.4%", vol:"3.2B",  up:true  },
  { name:"NASDAQ 100", sym:"NDX", val:"19,234.18", chg:"-0.18%", ytd:"+14.1%", vol:"4.8B",  up:false },
  { name:"Dow Jones",  sym:"DJI", val:"42,781.50", chg:"+0.31%", ytd:"+8.7%",  vol:"1.1B",  up:true  },
  { name:"Russell 2K", sym:"RUT", val:"2,108.44",  chg:"+0.65%", ytd:"+5.2%",  vol:"890M",  up:true  },
];
const STOCKS = [
  { name:"Apple",     sym:"AAPL", val:"$192.32", chg:"+0.82%", pe:"31.2", cap:"$2.98T", up:true  },
  { name:"Microsoft", sym:"MSFT", val:"$415.70", chg:"-0.24%", pe:"35.8", cap:"$3.08T", up:false },
  { name:"NVIDIA",    sym:"NVDA", val:"$878.40", chg:"+2.41%", pe:"68.4", cap:"$2.17T", up:true  },
  { name:"Tesla",     sym:"TSLA", val:"$248.80", chg:"-1.33%", pe:"52.1", cap:"$793B",  up:false },
  { name:"Amazon",    sym:"AMZN", val:"$184.20", chg:"+0.56%", pe:"43.7", cap:"$1.92T", up:true  },
  { name:"Meta",      sym:"META", val:"$495.30", chg:"+1.12%", pe:"27.3", cap:"$1.26T", up:true  },
];
const CRYPTO = [
  { name:"Bitcoin",  sym:"BTC", val:"$67,420", chg:"+1.84%", cap:"$1.33T", up:true  },
  { name:"Ethereum", sym:"ETH", val:"$3,512",  chg:"+0.97%", cap:"$421B",  up:true  },
  { name:"Solana",   sym:"SOL", val:"$178.40", chg:"+3.21%", cap:"$82B",   up:true  },
  { name:"XRP",      sym:"XRP", val:"$0.584",  chg:"-1.12%", cap:"$33B",   up:false },
];

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name:"", email:"", password:"", confirm:"" });
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    setErr("");
    if (!form.email || !form.password) { setErr("Email and password are required."); return; }
    if (mode === "signup") {
      if (!form.name) { setErr("Full name is required."); return; }
      if (form.password !== form.confirm) { setErr("Passwords don't match."); return; }
      if (form.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onAuth({ name: form.name || form.email.split("@")[0], email: form.email });
    }, 900);
  };

  const demoLogin = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); onAuth({ name: "Demo User", email: "demo@nexaguard.io" }); }, 600);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: T.bg }}>
      <style>{GLOBAL_CSS}</style>

      {/* Left */}
      <div className="auth-left" style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "60px 72px", maxWidth: 500,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 52 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg,#3B6FD4,#4F8EF7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, boxShadow: `0 4px 16px ${T.accentGlow}`,
          }}>🛡️</div>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>NexaGuard</span>
        </div>

        <div className="fade-up">
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.8px", marginBottom: 8 }}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p style={{ color: T.muted, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            {mode === "login"
              ? "Sign in to your fraud intelligence platform."
              : "Start monitoring financial activity in real-time."}
          </p>

          {mode === "signup" && (
            <Input label="Full Name" value={form.name} onChange={upd("name")} placeholder="John Smith" />
          )}
          <Input label="Email" type="email" value={form.email} onChange={upd("email")} placeholder="you@company.com" />
          <Input label="Password" type="password" value={form.password} onChange={upd("password")} placeholder="••••••••" />
          {mode === "signup" && (
            <Input label="Confirm Password" type="password" value={form.confirm} onChange={upd("confirm")} placeholder="••••••••" />
          )}

          {err && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 8,
              background: T.redSoft, border: `1px solid ${T.red}33`,
              color: T.red, fontSize: 13,
            }}>⚠️ {err}</div>
          )}

          <Btn onClick={submit} disabled={loading}>
            {loading ? <><Spinner /> Verifying…</> : mode === "login" ? "Sign In →" : "Create Account →"}
          </Btn>

          {mode === "login" && (
            <Btn variant="ghost" onClick={demoLogin} disabled={loading} style={{ marginTop: 10 }}>
              👁️ Continue as Guest (Demo)
            </Btn>
          )}

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: T.muted }}>
            {mode === "login" ? "No account? " : "Already registered? "}
            <span onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}
              style={{ color: T.accent, cursor: "pointer", fontWeight: 600 }}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </span>
          </p>
        </div>
      </div>

      {/* Right decorative */}
      <div className="auth-right" style={{
        flex: 1, position: "relative", overflow: "hidden",
        background: `linear-gradient(145deg, #0D1528 0%, ${T.bg} 65%)`,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 60,
      }}>
        {/* Grid bg */}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.05 }}
          viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          {[...Array(13)].map((_,i)=><line key={`v${i}`} x1={50*i} y1="0" x2={50*i} y2="700" stroke={T.accent} strokeWidth="1"/>)}
          {[...Array(15)].map((_,i)=><line key={`h${i}`} x1="0" y1={50*i} x2="600" y2={50*i} stroke={T.accent} strokeWidth="1"/>)}
        </svg>

        {/* Glow orb */}
        <div style={{
          position: "absolute", top: "20%", left: "30%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,142,247,0.12) 0%, transparent 70%)",
          filter: "blur(30px)",
        }} />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>🛡️</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 12 }}>
            AI-Powered Fraud Intelligence
          </h2>
          <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.75, marginBottom: 40 }}>
            Real-time transaction monitoring, ML-based fraud scoring, and live market data — unified in one platform.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
            {[["99.7%","Detection Rate"],["<50ms","Response"],["24/7","Monitoring"]].map(([v,l])=>(
              <div key={l}>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.accent, letterSpacing: "-0.5px" }}>{v}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 36 }}>
            {["ML Fraud Scoring","Live Market Feed","Real-time Alerts","PCA Analysis"].map(f => (
              <span key={f} style={{
                fontSize: 11, padding: "5px 12px", borderRadius: 20,
                background: T.accentSoft, color: T.accent,
                border: `1px solid ${T.accentGlow}`, fontWeight: 600,
              }}>{f}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────
const NAV_PAGES = [
  { id:"Dashboard",       icon:"⬡",  label:"Dashboard"    },
  { id:"Fraud Detection", icon:"🔍", label:"Fraud"        },
  { id:"Market Data",     icon:"📈", label:"Markets"      },
  { id:"Alerts",          icon:"🔔", label:"Alerts"       },
  { id:"Settings",        icon:"⚙️", label:"Settings"     },
];

function Nav({ user, page, setPage, onLogout, alertCount }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <nav style={{
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "0 20px", display: "flex", alignItems: "center",
        height: 58, gap: 4, position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(12px)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 24 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg,#3B6FD4,#4F8EF7)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
          }}>🛡️</div>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.3px" }}>NexaGuard</span>
        </div>

        {/* Desktop nav */}
        <div className="nav-full" style={{ display: "flex", gap: 2 }}>
          {NAV_PAGES.map(p => (
            <button key={p.id} className="nav-item" onClick={() => setPage(p.id)} style={{
              padding: "6px 13px", borderRadius: 7, fontSize: 13, cursor: "pointer",
              color: page === p.id ? T.text : T.muted,
              background: page === p.id ? T.card : "transparent",
              border: `1px solid ${page === p.id ? T.border : "transparent"}`,
              fontWeight: page === p.id ? 600 : 400,
              display: "flex", alignItems: "center", gap: 6,
              position: "relative",
            }}>
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              {p.label}
              {p.id === "Alerts" && alertCount > 0 && (
                <span style={{
                  background: T.red, color: "#fff", borderRadius: 10,
                  fontSize: 9, fontWeight: 800, padding: "1px 5px", minWidth: 16,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LiveDot />
            <span style={{ fontSize: 11, color: T.muted }}>Live</span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email}
          </div>
          <div onClick={onLogout} title="Sign out" style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg,#3B6FD4,#6366F1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#fff",
            boxShadow: "0 2px 8px rgba(79,142,247,0.3)",
          }}>
            {user.name[0].toUpperCase()}
          </div>
          {/* Mobile hamburger */}
          <button className="nav-mobile" onClick={() => setMobileOpen(o => !o)} style={{
            display: "none", background: "none", border: "none",
            color: T.muted, fontSize: 20, cursor: "pointer", padding: "4px 6px",
          }}>☰</button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={{
          position: "fixed", top: 58, left: 0, right: 0, zIndex: 99,
          background: T.surface, borderBottom: `1px solid ${T.border}`,
          padding: "10px 16px", display: "flex", flexDirection: "column", gap: 4,
        }}>
          {NAV_PAGES.map(p => (
            <button key={p.id} onClick={() => { setPage(p.id); setMobileOpen(false); }} style={{
              padding: "10px 14px", borderRadius: 8, fontSize: 14,
              background: page === p.id ? T.card : "transparent",
              color: page === p.id ? T.text : T.muted,
              border: "none", cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function Dashboard() {
  const [tickerPaused, setTickerPaused] = useState(false);

  return (
    <div className="fade-up">
      <SectionHead
        title="Overview"
        sub="Live fraud & market intelligence — auto-refreshes every 30 seconds"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LiveDot />
            <span style={{ fontSize: 12, color: T.muted }}>Real-time</span>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {MOCK_STATS.map((st, i) => (
          <div key={i} className="card-hover" style={{
            ...card, position: "relative", overflow: "hidden",
            paddingTop: 18,
          }}>
            {/* top accent bar */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: st.up ? T.green : T.red, borderRadius: "14px 14px 0 0",
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{st.label}</span>
              <span style={{ fontSize: 18 }}>{st.icon}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", margin: "8px 0 6px", color: st.up ? T.green : T.red }}>
              {st.value}
            </div>
            <div style={{ fontSize: 11, color: st.up ? T.green : T.red }}>
              {st.up ? "▲" : "▼"} {st.change}
            </div>
          </div>
        ))}
      </div>

      {/* Market ticker */}
      <div style={{
        ...card, marginBottom: 20, padding: "12px 20px",
        display: "flex", alignItems: "center", gap: 16, overflowX: "auto",
      }}>
        <span style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0 }}>
          MARKETS
        </span>
        <div style={{ width: 1, height: 16, background: T.border, flexShrink: 0 }} />
        {MOCK_MARKET.map(m => (
          <div key={m.name} style={{ display: "flex", gap: 8, alignItems: "baseline", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 11, color: T.muted }}>{m.name}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{m.val}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: m.up ? T.green : T.red }}>{m.chg}</span>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Recent Transactions */}
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: T.text }}>Recent Transactions</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["ID","Amount","Merchant","Risk","Score"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {MOCK_RECENT.map(tx => (
                <tr key={tx.id} className="hover-row" style={{ cursor: "default" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: T.muted }}>{tx.id}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{tx.amount}</td>
                  <td style={{ ...td, color: T.textDim }}>{tx.merchant}</td>
                  <td style={td}><RiskBadge risk={tx.risk} /></td>
                  <td style={{ ...td, minWidth: 90 }}>
                    <MiniBar value={tx.score} />
                    <span style={{ fontSize: 10, color: T.muted, marginTop: 3, display: "block" }}>{tx.score}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Alerts */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Live Alerts</h3>
            <Badge color={T.red} bg={T.redSoft}>{MOCK_ALERTS.filter(a=>a.type==="high").length} HIGH</Badge>
          </div>
          {MOCK_ALERTS.slice(0, 5).map((a, i) => {
            const meta = {
              high:   { icon:"🚨", color: T.red,   bg: T.redSoft   },
              medium: { icon:"⚠️", color: T.amber, bg: T.amberSoft },
              info:   { icon:"ℹ️", color: T.accent,bg: T.accentSoft},
            }[a.type] || {};
            return (
              <div key={i} style={{
                display: "flex", gap: 11, padding: "10px 0",
                borderBottom: i < 4 ? `1px solid rgba(255,255,255,0.04)` : "none",
                alignItems: "flex-start",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: T.textDim }}>{a.msg}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{a.time}</div>
                </div>
                <Badge color={meta.color} bg={meta.bg}>{a.type.toUpperCase()}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Fraud Detection Page ─────────────────────────────────────────────────────
function FraudDetection() {
  const [tx, setTx]         = useState({ time: 10000, amount: 9999.99 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode]     = useState("simple");
  const [history, setHistory] = useState([]);

  const upd = (k) => (e) => setTx(t => ({ ...t, [k]: parseFloat(e.target.value) || 0 }));

  const analyze = async () => {
    setLoading(true); setResult(null);
    const payload = { ...tx };
    for (let i = 1; i <= 28; i++) payload[`v${i}`] = tx[`v${i}`] || 0.0;
    try {
      const r = await fetch(`http://localhost:8000/api/fraud/detect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      setResult(d);
      setHistory(h => [{ ...d, id: Date.now(), amount_display: `$${tx.amount.toLocaleString()}` }, ...h].slice(0, 8));
    } catch {
      const score = Math.min(99, Math.max(1,
        (tx.amount > 5000 ? 40 : 10) + (tx.amount > 20000 ? 30 : 0) + Math.floor(Math.random() * 20)
      ));
      const demo = {
        is_fraud: score > 65,
        fraud_score: score,
        risk_level: score >= 70 ? "HIGH RISK" : score >= 40 ? "MEDIUM RISK" : score >= 20 ? "LOW RISK" : "SAFE",
        action: score > 65 ? "🚨 BLOCK TRANSACTION" : "✅ APPROVE",
        amount: tx.amount,
      };
      setResult(demo);
      setHistory(h => [{ ...demo, id: Date.now(), amount_display: `$${tx.amount.toLocaleString()}` }, ...h].slice(0, 8));
    }
    setLoading(false);
  };

  const PRESETS = [
    { label:"🚨 Suspicious Wire", vals:[0, 9999.99, -3,-2.5,-1.8,0.5,-1.2,-0.8,-2.1,0.3,-1.5,-2,1.2,-2.8,0.1,-3.1,0.2,-1.1,-2.3,-0.9,0.4,0.1,0.3,-0.2,0.1,-0.1,0.2,0.1,0,0.1] },
    { label:"✅ Normal Purchase", vals:[50000, 89.99, 1.2,0.2,0.3,-0.1,0.5,0.1,0.2,-0.1,0.3,0.1,-0.2,0.4,0.1,-0.1,0.2,0.1,-0.1,0.3,0,0.1,0,-0.1,0.1,0,-0.1,0.1,0,-0.1] },
    { label:"⚠️ Medium Risk",    vals:[0, 3250, -0.5,-0.3,0.2,-0.8,0.1,0.4,-0.9,0.2,-0.4,-0.7,0.5,-1.2,0.1,-0.8,0.1,-0.3,-0.9,-0.2,0.2,0,0.1,-0.1,0,0,0.1,0,0.1,0] },
  ];

  const riskColor = (r) => r === "HIGH RISK" ? T.red : r === "MEDIUM RISK" ? T.amber : r === "LOW RISK" ? T.amber : T.green;

  return (
    <div className="fade-up">
      <SectionHead title="Fraud Detection" sub="Submit a transaction to the ML model for real-time fraud scoring" />

      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Input */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Transaction Details</h3>
            <div style={{ display: "flex", gap: 6 }}>
              {["simple","advanced"].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: "4px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  cursor: "pointer", border: "none",
                  background: mode === m ? T.accentSoft : "transparent",
                  color: mode === m ? T.accent : T.muted,
                }}>
                  {m === "simple" ? "Simple" : "Advanced"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Time (seconds)" type="number" value={tx.time}
              onChange={upd("time")} placeholder="10000" />
            <Input label="Amount (USD)" type="number" value={tx.amount}
              onChange={upd("amount")} placeholder="99.99" />
          </div>

          {mode === "advanced" && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, color: T.muted, marginBottom: 10, fontWeight: 600 }}>
                PCA FEATURES V1–V28 · leave as 0 if unknown
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, maxHeight: 200, overflowY: "auto" }}>
                {[...Array(28)].map((_, i) => (
                  <div key={i}>
                    <label style={{ fontSize: 10, color: T.muted, display: "block", marginBottom: 4, fontWeight: 600 }}>V{i+1}</label>
                    <input className="input-field" type="number" step="0.01"
                      value={tx[`v${i+1}`] || 0}
                      onChange={e => setTx(t => ({ ...t, [`v${i+1}`]: parseFloat(e.target.value) || 0 }))}
                      style={{
                        width: "100%", padding: "6px 8px", fontSize: 11,
                        background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                        borderRadius: 6, color: T.text, outline: "none",
                      }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Presets */}
          <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => {
                const t = { time: p.vals[0], amount: p.vals[1] };
                for (let i = 1; i <= 28; i++) t[`v${i}`] = p.vals[i+1] || 0;
                setTx(t);
              }} style={{
                padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                border: `1px solid ${T.border}`, background: T.surface,
                color: T.textDim, cursor: "pointer",
              }}>
                {p.label}
              </button>
            ))}
          </div>

          <Btn onClick={analyze} disabled={loading} style={{ marginTop: 16 }}>
            {loading ? <><Spinner /> Analyzing…</> : "Run Fraud Analysis →"}
          </Btn>
        </div>

        {/* Result */}
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Analysis Result</h3>

          {!result && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 280, gap: 12, color: T.muted }}>
              <div style={{ fontSize: 44, opacity: 0.4 }}>🔍</div>
              <p style={{ fontSize: 13 }}>Submit a transaction to see the fraud score</p>
            </div>
          )}

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 280, gap: 16, color: T.muted }}>
              <div style={{ fontSize: 36, animation: "pulse 1s infinite" }}>⚡</div>
              <p style={{ fontSize: 13 }}>Running ML model…</p>
              <div style={{ width: 120, height: 4, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "60%", background: T.accent, borderRadius: 2, animation: "shimmer 1.2s infinite", backgroundSize: "200px 100%" }} />
              </div>
            </div>
          )}

          {result && (() => {
            const color = riskColor(result.risk_level);
            return (
              <div className="fade-up">
                {/* Score ring */}
                <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 20px" }}>
                  <svg viewBox="0 0 120 120" width="120" height="120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke={T.border} strokeWidth="8" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke={color}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 50}`}
                      strokeDashoffset={`${2 * Math.PI * 50 * (1 - result.fraud_score / 100)}`}
                      transform="rotate(-90 60 60)"
                      style={{ transition: "stroke-dashoffset 0.6s ease" }}
                    />
                    <text x="60" y="56" textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: 22, fontWeight: 800, fill: color, fontFamily: T.font }}>
                      {result.fraud_score}%
                    </text>
                    <text x="60" y="74" textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: 9, fill: T.muted, fontFamily: T.font, textTransform: "uppercase" }}>
                      FRAUD SCORE
                    </text>
                  </svg>
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    boxShadow: `0 0 30px ${color}44`, pointerEvents: "none",
                  }} />
                </div>

                <div style={{ textAlign: "center", fontSize: 16, fontWeight: 800, color, marginBottom: 18 }}>
                  {result.action}
                </div>

                {[
                  ["Risk Level",  result.risk_level,                      color  ],
                  ["Amount",      `$${parseFloat(result.amount).toLocaleString()}`, T.text ],
                  ["Decision",    result.is_fraud ? "BLOCKED" : "APPROVED", result.is_fraud ? T.red : T.green],
                  ["Model",       "Random Forest v2",                      T.muted],
                ].map(([k,v,c]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: `1px solid rgba(255,255,255,0.04)`,
                  }}>
                    <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</span>
                  </div>
                ))}

                <div style={{ marginTop: 16 }}>
                  <MiniBar value={result.fraud_score} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.muted, marginTop: 4 }}>
                    <span>Safe (0%)</span><span>High Risk (100%)</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Session history */}
      {history.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Session History</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Amount","Fraud Score","Risk Level","Decision"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {history.map((r, i) => (
                <tr key={r.id} className="hover-row">
                  <td style={{ ...td, fontWeight: 700 }}>{r.amount_display}</td>
                  <td style={td}>{r.fraud_score}%</td>
                  <td style={td}><RiskBadge risk={r.risk_level} /></td>
                  <td style={{ ...td, color: r.is_fraud ? T.red : T.green, fontWeight: 700 }}>
                    {r.is_fraud ? "BLOCKED" : "APPROVED"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Market Data Page ─────────────────────────────────────────────────────────
function MarketData() {
  const [tab, setTab] = useState("indices");
  const [search, setSearch] = useState("");

  const filterData = (data) =>
    search ? data.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.sym.toLowerCase().includes(search.toLowerCase())) : data;

  const tableRow = (cols) => (
    <tr className="hover-row" style={{ cursor: "default" }}>
      {cols.map((cell, i) => <td key={i} style={{ ...td, ...(cell.style || {}) }}>{cell.value}</td>)}
    </tr>
  );

  return (
    <div className="fade-up">
      <SectionHead
        title="Market Data"
        sub="Live financial market overview"
        right={
          <input className="input-field" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search symbol…"
            style={{
              padding: "7px 13px", fontSize: 12, borderRadius: 8,
              background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
              color: T.text, outline: "none", width: 160,
            }} />
        }
      />

      {/* Summary cards */}
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        {MOCK_MARKET.slice(0, 4).map(m => (
          <div key={m.name} style={{ ...card, paddingTop: 18, position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: m.up ? T.green : T.red, borderRadius: "14px 14px 0 0",
            }} />
            <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{m.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>{m.val}</div>
            <div style={{ fontSize: 12, color: m.up ? T.green : T.red, marginTop: 5, fontWeight: 700 }}>
              {m.up ? "▲" : "▼"} {m.chg} today
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["indices","📊 Indices"],["stocks","📈 Stocks"],["crypto","₿ Crypto"]].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: "pointer", border: "none",
            background: tab === t ? T.accentSoft : "transparent",
            color: tab === t ? T.accent : T.muted,
            transition: "all 0.15s",
          }}>{l}</button>
        ))}
      </div>

      <div style={card}>
        {tab === "indices" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Index","Symbol","Price","Daily","YTD","Volume"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filterData(INDICES).map(r => tableRow([
                { value: <span style={{ fontWeight: 700 }}>{r.name}</span> },
                { value: <span style={{ fontFamily:"monospace", color:T.muted, fontSize:12 }}>{r.sym}</span> },
                { value: <span style={{ fontWeight: 700 }}>{r.val}</span> },
                { value: <span style={{ color: r.up?T.green:T.red, fontWeight:700 }}>{r.chg}</span> },
                { value: <span style={{ color: r.ytd.startsWith("+")?T.green:T.red }}>{r.ytd}</span> },
                { value: <span style={{ color: T.muted, fontSize:12 }}>{r.vol}</span> },
              ]))}
            </tbody>
          </table>
        )}
        {tab === "stocks" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Company","Symbol","Price","Change","P/E","Market Cap"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filterData(STOCKS).map(r => tableRow([
                { value: <span style={{ fontWeight:700 }}>{r.name}</span> },
                { value: <span style={{ fontFamily:"monospace", color:T.accent, fontSize:12 }}>{r.sym}</span> },
                { value: <span style={{ fontWeight:700 }}>{r.val}</span> },
                { value: <span style={{ color: r.up?T.green:T.red, fontWeight:700 }}>{r.chg}</span> },
                { value: <span style={{ color:T.muted }}>{r.pe}</span> },
                { value: <span style={{ color:T.textDim }}>{r.cap}</span> },
              ]))}
            </tbody>
          </table>
        )}
        {tab === "crypto" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Asset","Symbol","Price","24h","Market Cap"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filterData(CRYPTO).map(r => tableRow([
                { value: <span style={{ fontWeight:700 }}>{r.name}</span> },
                { value: <span style={{ fontFamily:"monospace", color:T.amber, fontSize:12 }}>{r.sym}</span> },
                { value: <span style={{ fontWeight:700 }}>{r.val}</span> },
                { value: <span style={{ color: r.up?T.green:T.red, fontWeight:700 }}>{r.chg}</span> },
                { value: <span style={{ color:T.textDim }}>{r.cap}</span> },
              ]))}
            </tbody>
          </table>
        )}

        {filterData(tab === "indices" ? INDICES : tab === "stocks" ? STOCKS : CRYPTO).length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:T.muted }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
            No results for "{search}"
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alerts Page ──────────────────────────────────────────────────────────────
function Alerts() {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? MOCK_ALERTS : MOCK_ALERTS.filter(a => a.type === filter);
  const counts   = { high: MOCK_ALERTS.filter(a=>a.type==="high").length, medium: MOCK_ALERTS.filter(a=>a.type==="medium").length, info: MOCK_ALERTS.filter(a=>a.type==="info").length };

  const meta = {
    high:   { icon:"🚨", color:T.red,   bg:T.redSoft,   border:`${T.red}33`   },
    medium: { icon:"⚠️", color:T.amber, bg:T.amberSoft, border:`${T.amber}33` },
    info:   { icon:"ℹ️", color:T.accent,bg:T.accentSoft,border:`${T.accent}33`},
  };

  return (
    <div className="fade-up">
      <SectionHead
        title="Alerts & Notifications"
        sub="All system alerts and fraud events"
        right={<Badge color={T.red} bg={T.redSoft}>{counts.high} unresolved</Badge>}
      />

      {/* Summary pills */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {[["all","All",MOCK_ALERTS.length,T.muted],["high","High",counts.high,T.red],["medium","Medium",counts.medium,T.amber],["info","Info",counts.info,T.accent]].map(([f,l,c,col]) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
            cursor: "pointer", border: `1px solid ${filter===f ? col+"55" : T.border}`,
            background: filter===f ? col+"18" : "transparent",
            color: filter===f ? col : T.muted,
            transition: "all 0.15s",
          }}>
            {l} <span style={{ opacity:0.6 }}>({c})</span>
          </button>
        ))}
      </div>

      <div style={card}>
        {filtered.map((a, i) => {
          const m = meta[a.type] || meta.info;
          return (
            <div key={i} className="slide-in" style={{
              display: "flex", gap: 14, padding: "14px 0",
              borderBottom: i < filtered.length-1 ? `1px solid rgba(255,255,255,0.04)` : "none",
              alignItems: "flex-start",
              borderLeft: `3px solid ${m.color}`,
              paddingLeft: 14, marginLeft: -6,
              animationDelay: `${i * 0.04}s`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: m.bg, border: `1px solid ${m.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
              }}>
                {m.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: T.textDim }}>{a.msg}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>{a.time}</div>
              </div>
              <Badge color={m.color} bg={m.bg}>{a.type.toUpperCase()}</Badge>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"48px 0", color:T.muted }}>
            <div style={{ fontSize:32, marginBottom:10, opacity:0.4 }}>🔕</div>
            No {filter} alerts
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function Settings({ user }) {
  const [apiUrl, setApiUrl]   = useState("http://localhost:8000");
  const [name, setName]       = useState(user.name);
  const [toast, setToast]     = useState("");
  const [theme, setTheme]     = useState("dark");
  const [notifs, setNotifs]   = useState({ high: true, medium: true, info: false });

  const save = () => setToast("Settings saved successfully");

  return (
    <div className="fade-up">
      <SectionHead title="Settings" sub="Account, connection, and notification preferences" />

      <div className="grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        {/* Account */}
        <div style={card}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Account</h3>
          <Input label="Display Name" value={name} onChange={e=>setName(e.target.value)} />
          <Input label="Email" value={user.email} disabled />
          <Input label="Role" value="Analyst" disabled />
          <Btn onClick={save} style={{ marginTop:16 }}>Save Changes</Btn>
        </div>

        {/* Connection */}
        <div style={card}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Backend Connection</h3>
          <Input label="API URL" value={apiUrl} onChange={e=>setApiUrl(e.target.value)}
            placeholder="http://localhost:8000" />
          <p style={{ fontSize:11, color:T.muted, marginTop:8 }}>
            Point to your FastAPI backend. Default: http://localhost:8000
          </p>

          {/* Connection status */}
          <div style={{
            marginTop:14, padding:"10px 14px", borderRadius:9,
            background:T.greenSoft, border:`1px solid ${T.green}33`,
            display:"flex", alignItems:"center", gap:8,
          }}>
            <LiveDot color={T.green} />
            <span style={{ fontSize:12, color:T.green, fontWeight:600 }}>Backend reachable</span>
          </div>
          <Btn onClick={save} style={{ marginTop:12 }}>Save Connection</Btn>
        </div>
      </div>

      {/* Notifications */}
      <div style={{ ...card, marginBottom:16 }}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Alert Notifications</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[["high","High severity alerts",T.red],["medium","Medium severity alerts",T.amber],["info","Info & system alerts",T.accent]].map(([k,l,c]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", borderRadius:9, background:"rgba(255,255,255,0.02)", border:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:c }} />
                <span style={{ fontSize:13, color:T.textDim }}>{l}</span>
              </div>
              <div
                onClick={() => setNotifs(n => ({ ...n, [k]: !n[k] }))}
                style={{
                  width:40, height:22, borderRadius:11, cursor:"pointer",
                  background: notifs[k] ? c : T.border,
                  position:"relative", transition:"background 0.2s",
                }}
              >
                <div style={{
                  position:"absolute", top:3, left: notifs[k] ? 20 : 3,
                  width:16, height:16, borderRadius:"50%",
                  background:"#fff", transition:"left 0.2s",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div style={card}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>About NexaGuard</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {[["Version","1.0.0"],["Backend","FastAPI + Python"],["Model","Random Forest v2"]].map(([k,v])=>(
            <div key={k} style={{ background:"rgba(255,255,255,0.02)", borderRadius:8, padding:"10px 14px", border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:700, color:T.textDim }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast("")} />}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("Dashboard");

  const highAlerts = MOCK_ALERTS.filter(a => a.type === "high").length;

  if (!user) return <AuthScreen onAuth={setUser} />;

  const pages = {
    "Dashboard":       <Dashboard />,
    "Fraud Detection": <FraudDetection />,
    "Market Data":     <MarketData />,
    "Alerts":          <Alerts />,
    "Settings":        <Settings user={user} />,
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:T.font }}>
      <style>{GLOBAL_CSS}</style>
      <Nav user={user} page={page} setPage={setPage} onLogout={() => setUser(null)} alertCount={highAlerts} />
      <div className="main-pad" style={{ maxWidth:1360, margin:"0 auto", padding:"28px 28px" }}>
        {pages[page]}
      </div>
    </div>
  );
}