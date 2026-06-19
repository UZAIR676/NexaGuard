import { useState, useEffect, useRef } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:       "#0A0D14",
  surface:  "#111520",
  card:     "#161C2D",
  border:   "#1E2740",
  accent:   "#4F8EF7",
  accentDim:"#1E3A6E",
  green:    "#22C55E",
  red:      "#EF4444",
  amber:    "#F59E0B",
  text:     "#E8EDF5",
  muted:    "#6B7A99",
  font:     "'Inter', 'Segoe UI', sans-serif",
};

// ─── Inline styles ────────────────────────────────────────────────────────────
const s = {
  app: { minHeight:"100vh", background:T.bg, color:T.text, fontFamily:T.font, display:"flex", flexDirection:"column" },

  // AUTH
  authWrap: { minHeight:"100vh", display:"flex", background:T.bg },
  authLeft: { flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"60px 80px", maxWidth:520 },
  authRight: { flex:1, background:`linear-gradient(135deg, ${T.accentDim} 0%, #0A0D14 60%)`, display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", padding:60, position:"relative", overflow:"hidden" },
  logo: { display:"flex", alignItems:"center", gap:10, marginBottom:48 },
  logoIcon: { width:36, height:36, background:T.accent, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 },
  logoText: { fontSize:22, fontWeight:700, letterSpacing:"-0.5px", color:T.text },
  authTitle: { fontSize:32, fontWeight:700, marginBottom:8, letterSpacing:"-0.5px" },
  authSub: { fontSize:15, color:T.muted, marginBottom:36 },
  label: { display:"block", fontSize:13, fontWeight:500, color:T.muted, marginBottom:6, marginTop:18 },
  input: { width:"100%", padding:"11px 14px", background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:14, outline:"none", boxSizing:"border-box", transition:"border 0.2s" },
  btn: { width:"100%", padding:"12px", background:T.accent, color:"#fff", border:"none", borderRadius:8, fontSize:15, fontWeight:600, cursor:"pointer", marginTop:24, transition:"opacity 0.2s" },
  btnSec: { background:"transparent", border:`1px solid ${T.border}`, color:T.muted, marginTop:12 },
  link: { color:T.accent, cursor:"pointer", fontSize:14, marginTop:16, textAlign:"center", display:"block" },

  // NAV
  nav: { background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"0 24px", display:"flex", alignItems:"center", height:60, gap:8, position:"sticky", top:0, zIndex:100 },
  navLogo: { display:"flex", alignItems:"center", gap:8, marginRight:32 },
  navItem: { padding:"6px 12px", borderRadius:6, fontSize:14, cursor:"pointer", color:T.muted, transition:"all 0.15s", border:"none", background:"transparent" },
  navItemActive: { color:T.text, background:T.card },
  navRight: { marginLeft:"auto", display:"flex", alignItems:"center", gap:12 },
  avatar: { width:32, height:32, borderRadius:"50%", background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, cursor:"pointer" },

  // LAYOUT
  main: { flex:1, padding:"28px 28px", maxWidth:1400, margin:"0 auto", width:"100%" },

  // CARDS
  card: { background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:20 },
  grid2: { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16, marginBottom:20 },
  grid3: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:20 },
  grid4: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 },

  statCard: { background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:20 },
  statLabel: { fontSize:12, color:T.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" },
  statVal: { fontSize:28, fontWeight:700, letterSpacing:"-1px" },
  statChange: { fontSize:13, marginTop:4 },

  h2: { fontSize:20, fontWeight:700, marginBottom:4, letterSpacing:"-0.3px" },
  h3: { fontSize:15, fontWeight:600, marginBottom:12 },
  muted: { color:T.muted, fontSize:13 },

  badge: { display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:20, fontSize:12, fontWeight:600 },
  badgeGreen: { background:"rgba(34,197,94,0.15)", color:T.green },
  badgeRed:   { background:"rgba(239,68,68,0.15)",  color:T.red   },
  badgeAmber: { background:"rgba(245,158,11,0.15)", color:T.amber },

  table: { width:"100%", borderCollapse:"collapse" },
  th: { textAlign:"left", padding:"8px 12px", fontSize:12, color:T.muted, fontWeight:500, borderBottom:`1px solid ${T.border}`, textTransform:"uppercase", letterSpacing:"0.4px" },
  td: { padding:"12px 12px", fontSize:14, borderBottom:`1px solid ${T.border}` },

  // FRAUD
  fraudRow: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 },
  scoreCircle: { width:120, height:120, borderRadius:"50%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", border:"4px solid" },
  progressBar: { height:6, borderRadius:3, background:T.border, overflow:"hidden", marginBottom:8 },
  progressFill: { height:"100%", borderRadius:3, transition:"width 0.6s ease" },
};

// ─── Fake data ────────────────────────────────────────────────────────────────
const MOCK_STATS = [
  { label:"Total Transactions", value:"1,284,320", change:"+3.2%", up:true },
  { label:"Fraud Detected",     value:"347",       change:"+12 today", up:false },
  { label:"Fraud Rate",         value:"0.027%",    change:"-0.003%", up:true },
  { label:"Blocked Amount",     value:"$2.4M",     change:"+$180K", up:false },
];
const MOCK_MARKET = [
  { name:"S&P 500",    val:"5,847.22", chg:"+0.42%", up:true },
  { name:"NASDAQ",     val:"19,234.18",chg:"-0.18%", up:false },
  { name:"DOW",        val:"42,781.50",chg:"+0.31%", up:true },
  { name:"BTC/USD",    val:"$67,420",  chg:"+1.84%", up:true },
  { name:"ETH/USD",    val:"$3,512",   chg:"+0.97%", up:true },
  { name:"EUR/USD",    val:"1.0842",   chg:"-0.12%", up:false },
];
const MOCK_RECENT = [
  { id:"TXN-8821", amount:"$12,400", merchant:"Wire Transfer",    risk:"HIGH",   score:87, flagged:true  },
  { id:"TXN-8820", amount:"$234",    merchant:"Amazon",           risk:"SAFE",   score:2,  flagged:false },
  { id:"TXN-8819", amount:"$5,600",  merchant:"Unknown Merchant", risk:"MEDIUM", score:44, flagged:true  },
  { id:"TXN-8818", amount:"$89",     merchant:"Starbucks",        risk:"SAFE",   score:1,  flagged:false },
  { id:"TXN-8817", amount:"$3,200",  merchant:"Crypto Exchange",  risk:"HIGH",   score:72, flagged:true  },
  { id:"TXN-8816", amount:"$450",    merchant:"Delta Airlines",   risk:"SAFE",   score:5,  flagged:false },
];
const MOCK_ALERTS = [
  { time:"2 min ago",  msg:"High-risk transaction blocked: $12,400 wire transfer", type:"high" },
  { time:"18 min ago", msg:"Unusual pattern: 3 transactions in 60 seconds",        type:"medium" },
  { time:"1 hr ago",   msg:"New login from unrecognized device – IP 45.22.x.x",    type:"medium" },
  { time:"3 hr ago",   msg:"Fraud model retrained with 2,400 new samples",         type:"info" },
];

// ─── Components ───────────────────────────────────────────────────────────────

function GlowDot({ color }) {
  return (
    <span style={{
      display:"inline-block", width:7, height:7, borderRadius:"50%",
      background:color, boxShadow:`0 0 6px ${color}`, marginRight:6
    }}/>
  );
}

function StatCard({ label, value, change, up }) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={s.statVal}>{value}</div>
      <div style={{...s.statChange, color: up ? T.green : T.red}}>{change}</div>
    </div>
  );
}

function MiniBar({ value, max=100, color }) {
  return (
    <div style={s.progressBar}>
      <div style={{...s.progressFill, width:`${(value/max)*100}%`, background:color}}/>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ name:"", email:"", password:"", confirm:"" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const upd = (k) => (e) => setForm(f => ({...f, [k]:e.target.value}));

  const submit = () => {
    setErr("");
    if (!form.email || !form.password) { setErr("Please fill in all fields."); return; }
    if (mode === "signup") {
      if (!form.name) { setErr("Name is required."); return; }
      if (form.password !== form.confirm) { setErr("Passwords don't match."); return; }
      if (form.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onAuth({ name: form.name || form.email.split("@")[0], email: form.email });
    }, 900);
  };

  return (
    <div style={s.authWrap}>
      {/* Left panel */}
      <div style={s.authLeft}>
        <div style={s.logo}>
          <div style={s.logoIcon}>🛡️</div>
          <span style={s.logoText}>NexaGuard</span>
        </div>

        <div style={s.authTitle}>{mode === "login" ? "Welcome back" : "Create account"}</div>
        <div style={s.authSub}>
          {mode === "login" ? "Sign in to your fraud intelligence dashboard." : "Start monitoring financial activity with AI."}
        </div>

        {mode === "signup" && (
          <>
            <label style={s.label}>Full Name</label>
            <input style={s.input} placeholder="John Smith" value={form.name} onChange={upd("name")}
              onFocus={e=>e.target.style.borderColor=T.accent}
              onBlur={e=>e.target.style.borderColor=T.border}/>
          </>
        )}
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="you@company.com" value={form.email} onChange={upd("email")}
          onFocus={e=>e.target.style.borderColor=T.accent}
          onBlur={e=>e.target.style.borderColor=T.border}/>

        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="••••••••" value={form.password} onChange={upd("password")}
          onFocus={e=>e.target.style.borderColor=T.accent}
          onBlur={e=>e.target.style.borderColor=T.border}/>

        {mode === "signup" && (
          <>
            <label style={s.label}>Confirm Password</label>
            <input style={s.input} type="password" placeholder="••••••••" value={form.confirm} onChange={upd("confirm")}
              onFocus={e=>e.target.style.borderColor=T.accent}
              onBlur={e=>e.target.style.borderColor=T.border}/>
          </>
        )}

        {err && <div style={{color:T.red, fontSize:13, marginTop:12}}>{err}</div>}

        <button style={{...s.btn, opacity: loading ? 0.7 : 1}} onClick={submit} disabled={loading}>
          {loading ? "Verifying..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        {mode === "login" && (
          <button style={{...s.btn, ...s.btnSec}} onClick={() => {}}>
            Demo — Sign in as Guest
          </button>
        )}

        <span style={s.link} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}>
          {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </span>
      </div>

      {/* Right decorative panel */}
      <div style={s.authRight}>
        {/* Abstract grid lines */}
        <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0.07}} viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          {[...Array(12)].map((_,i)=><line key={i} x1={50*i} y1="0" x2={50*i} y2="700" stroke={T.accent} strokeWidth="1"/>)}
          {[...Array(15)].map((_,i)=><line key={i} x1="0" y1={50*i} x2="600" y2={50*i} stroke={T.accent} strokeWidth="1"/>)}
        </svg>
        <div style={{position:"relative", textAlign:"center", zIndex:1}}>
          <div style={{fontSize:48, marginBottom:20}}>🛡️</div>
          <div style={{fontSize:24, fontWeight:700, marginBottom:12, color:T.text}}>AI-Powered Fraud Intelligence</div>
          <div style={{color:T.muted, fontSize:15, lineHeight:1.7, maxWidth:360}}>
            Real-time transaction monitoring, ML-based fraud scoring, and live market data — all in one place.
          </div>
          <div style={{display:"flex", gap:24, justifyContent:"center", marginTop:40}}>
            {[["99.7%","Detection Rate"],["<50ms","Response Time"],["24/7","Monitoring"]].map(([v,l])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:T.accent}}>{v}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function Nav({ user, page, setPage, onLogout }) {
  const pages = ["Dashboard","Fraud Detection","Market Data","Alerts","Settings"];
  return (
    <div style={s.nav}>
      <div style={s.navLogo}>
        <div style={{...s.logoIcon, width:28, height:28, fontSize:14}}>🛡️</div>
        <span style={{...s.logoText, fontSize:16}}>NexaGuard</span>
      </div>
      {pages.map(p => (
        <button key={p} style={{...s.navItem, ...(page===p ? s.navItemActive : {})}} onClick={() => setPage(p)}>
          {p}
        </button>
      ))}
      <div style={s.navRight}>
        <div style={{fontSize:12, color:T.muted}}>{user.email}</div>
        <div style={s.avatar} title="Sign out" onClick={onLogout}>
          {user.name[0].toUpperCase()}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function Dashboard() {
  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={s.h2}>Overview</div>
        <div style={s.muted}>Live fraud & market intelligence — updated every 30 seconds</div>
      </div>

      {/* Stats row */}
      <div style={s.grid4}>
        {MOCK_STATS.map(st => <StatCard key={st.label} {...st}/>)}
      </div>

      {/* Market ticker */}
      <div style={{...s.card, marginBottom:20, padding:"14px 20px"}}>
        <div style={{display:"flex", gap:28, overflowX:"auto"}}>
          {MOCK_MARKET.map(m => (
            <div key={m.name} style={{whiteSpace:"nowrap"}}>
              <span style={{fontSize:12, color:T.muted}}>{m.name} </span>
              <span style={{fontWeight:600}}>{m.val} </span>
              <span style={{fontSize:12, color: m.up ? T.green : T.red}}>{m.chg}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={s.grid2}>
        {/* Recent transactions */}
        <div style={s.card}>
          <div style={s.h3}>Recent Transactions</div>
          <table style={s.table}>
            <thead>
              <tr>
                {["ID","Amount","Merchant","Risk","Score"].map(h=>(
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_RECENT.map(tx => (
                <tr key={tx.id}>
                  <td style={s.td}><span style={{fontFamily:"monospace", fontSize:12, color:T.muted}}>{tx.id}</span></td>
                  <td style={{...s.td, fontWeight:600}}>{tx.amount}</td>
                  <td style={s.td}>{tx.merchant}</td>
                  <td style={s.td}>
                    <span style={{...s.badge,
                      ...(tx.risk==="HIGH" ? s.badgeRed : tx.risk==="MEDIUM" ? s.badgeAmber : s.badgeGreen)}}>
                      {tx.risk==="HIGH" && <GlowDot color={T.red}/>}
                      {tx.risk}
                    </span>
                  </td>
                  <td style={s.td}>
                    <MiniBar value={tx.score} color={tx.score>70 ? T.red : tx.score>30 ? T.amber : T.green}/>
                    <span style={{fontSize:11, color:T.muted}}>{tx.score}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Alerts */}
        <div style={s.card}>
          <div style={s.h3}>Live Alerts</div>
          {MOCK_ALERTS.map((a,i) => (
            <div key={i} style={{display:"flex", gap:12, padding:"12px 0", borderBottom: i<MOCK_ALERTS.length-1 ? `1px solid ${T.border}` : "none", alignItems:"flex-start"}}>
              <div style={{fontSize:18, marginTop:1}}>
                {a.type==="high" ? "🚨" : a.type==="medium" ? "⚠️" : "ℹ️"}
              </div>
              <div>
                <div style={{fontSize:13, lineHeight:1.5}}>{a.msg}</div>
                <div style={{fontSize:11, color:T.muted, marginTop:3}}>{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Fraud Detection Page ─────────────────────────────────────────────────────
function FraudDetection() {
  const [tx, setTx] = useState({ time:10000, amount:9999.99 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("simple"); // simple | advanced

  const BACKEND = "http://localhost:8000";

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    // Build payload with zeros for V features
    const payload = { ...tx };
    for (let i = 1; i <= 28; i++) payload[`v${i}`] = tx[`v${i}`] || 0.0;
    try {
      const r = await fetch(`${BACKEND}/api/fraud/detect`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      setResult(d);
    } catch {
      // Demo mode — simulate response
      const score = Math.min(99, Math.max(1,
        (tx.amount > 5000 ? 40 : 10) +
        (tx.amount > 20000 ? 30 : 0) +
        Math.floor(Math.random()*20)
      ));
      setResult({
        is_fraud: score > 65,
        fraud_score: score,
        risk_level: score>=70?"HIGH RISK": score>=40?"MEDIUM RISK": score>=20?"LOW RISK":"SAFE",
        action: score > 65 ? "🚨 BLOCK TRANSACTION" : "✅ APPROVE",
        amount: tx.amount
      });
    }
    setLoading(false);
  };

  const riskColor = (r) => r==="HIGH RISK" ? T.red : r==="MEDIUM RISK" ? T.amber : r==="LOW RISK" ? T.amber : T.green;

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={s.h2}>Fraud Detection</div>
        <div style={s.muted}>Submit a transaction to the ML model for real-time fraud scoring</div>
      </div>

      <div style={{...s.fraudRow}}>
        {/* Input form */}
        <div style={s.card}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
            <div style={s.h3}>Transaction Details</div>
            <div style={{display:"flex", gap:8}}>
              {["simple","advanced"].map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{
                  ...s.navItem, fontSize:12, padding:"4px 10px",
                  ...(mode===m ? s.navItemActive : {})
                }}>{m==="simple"?"Simple":"Advanced (V1-V28)"}</button>
              ))}
            </div>
          </div>

          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div>
              <label style={s.label}>Transaction Time (seconds)</label>
              <input style={s.input} type="number" value={tx.time}
                onChange={e=>setTx(t=>({...t,time:parseFloat(e.target.value)||0}))}
                onFocus={e=>e.target.style.borderColor=T.accent}
                onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <div>
              <label style={s.label}>Amount (USD)</label>
              <input style={s.input} type="number" value={tx.amount}
                onChange={e=>setTx(t=>({...t,amount:parseFloat(e.target.value)||0}))}
                onFocus={e=>e.target.style.borderColor=T.accent}
                onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
          </div>

          {mode === "advanced" && (
            <div style={{marginTop:16}}>
              <div style={{fontSize:12, color:T.muted, marginBottom:10}}>PCA Feature Vector (V1–V28) — leave as 0 if unknown</div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, maxHeight:220, overflowY:"auto"}}>
                {[...Array(28)].map((_,i)=>(
                  <div key={i}>
                    <label style={{...s.label, marginTop:4}}>V{i+1}</label>
                    <input style={{...s.input, padding:"7px 10px"}} type="number" step="0.01"
                      value={tx[`v${i+1}`]||0}
                      onChange={e=>setTx(t=>({...t,[`v${i+1}`]:parseFloat(e.target.value)||0}))}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button style={{...s.btn, marginTop:20, opacity:loading?0.7:1}} onClick={analyze} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze Transaction"}
          </button>

          <div style={{marginTop:12, display:"flex", gap:8, flexWrap:"wrap"}}>
            {[["Suspicious Wire",[0,9999.99,-3,-2.5,-1.8,0.5,-1.2,-0.8,-2.1,0.3,-1.5,-2,1.2,-2.8,0.1,-3.1,0.2,-1.1,-2.3,-0.9,0.4,0.1,0.3,-0.2,0.1,-0.1,0.2,0.1,0,0.1]],
               ["Normal Purchase",[50000,89.99,1.2,0.2,0.3,-0.1,0.5,0.1,0.2,-0.1,0.3,0.1,-0.2,0.4,0.1,-0.1,0.2,0.1,-0.1,0.3,0,0.1,0,-0.1,0.1,0,-0.1,0.1,0,-0.1]]]
              .map(([label,vals])=>(
              <button key={label} onClick={()=>{
                const t={time:vals[0],amount:vals[1]};
                for(let i=1;i<=28;i++) t[`v${i}`]=vals[i+1]||0;
                setTx(t);
              }} style={{...s.navItem,...s.navItemActive, fontSize:12, padding:"5px 12px"}}>
                Use: {label}
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        <div style={s.card}>
          <div style={s.h3}>Analysis Result</div>
          {!result && !loading && (
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:300, color:T.muted}}>
              <div style={{fontSize:48, marginBottom:12}}>🔍</div>
              <div style={{fontSize:14}}>Submit a transaction to see fraud analysis</div>
            </div>
          )}
          {loading && (
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:300, color:T.muted}}>
              <div style={{fontSize:36, marginBottom:12}}>⚡</div>
              <div style={{fontSize:14}}>Running ML model...</div>
            </div>
          )}
          {result && (
            <div>
              {/* Score circle */}
              <div style={{...s.scoreCircle, borderColor: riskColor(result.risk_level),
                boxShadow:`0 0 30px ${riskColor(result.risk_level)}44`}}>
                <div style={{fontSize:32, fontWeight:700, color: riskColor(result.risk_level)}}>{result.fraud_score}%</div>
                <div style={{fontSize:11, color:T.muted}}>Fraud Score</div>
              </div>

              {/* Action */}
              <div style={{
                textAlign:"center", fontSize:16, fontWeight:700, marginBottom:16,
                color: result.is_fraud ? T.red : T.green
              }}>
                {result.action}
              </div>

              {/* Details */}
              {[
                ["Risk Level", result.risk_level, riskColor(result.risk_level)],
                ["Amount", `$${parseFloat(result.amount).toLocaleString()}`, T.text],
                ["Decision", result.is_fraud ? "BLOCKED" : "APPROVED", result.is_fraud ? T.red : T.green],
                ["Model", "Random Forest v2", T.muted],
              ].map(([k,v,c])=>(
                <div key={k} style={{display:"flex", justifyContent:"space-between", padding:"10px 0",
                  borderBottom:`1px solid ${T.border}`}}>
                  <span style={{color:T.muted, fontSize:13}}>{k}</span>
                  <span style={{fontWeight:600, color:c, fontSize:13}}>{v}</span>
                </div>
              ))}

              <div style={{marginTop:16}}>
                <div style={{fontSize:12, color:T.muted, marginBottom:6}}>Risk Score Gauge</div>
                <MiniBar value={result.fraud_score} color={riskColor(result.risk_level)}/>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:T.muted}}>
                  <span>Safe (0%)</span><span>High Risk (100%)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History table */}
      <div style={s.card}>
        <div style={s.h3}>Recent Analyses (Session)</div>
        <table style={s.table}>
          <thead>
            <tr>{["Transaction","Amount","Score","Risk","Action"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {MOCK_RECENT.map(tx=>(
              <tr key={tx.id}>
                <td style={{...s.td, fontFamily:"monospace", fontSize:12, color:T.muted}}>{tx.id}</td>
                <td style={{...s.td,fontWeight:600}}>{tx.amount}</td>
                <td style={s.td}>{tx.score}%</td>
                <td style={s.td}>
                  <span style={{...s.badge, ...(tx.risk==="HIGH"?s.badgeRed:tx.risk==="MEDIUM"?s.badgeAmber:s.badgeGreen)}}>{tx.risk}</span>
                </td>
                <td style={{...s.td, color: tx.flagged ? T.red : T.green, fontWeight:600}}>
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

// ─── Market Data Page ─────────────────────────────────────────────────────────
function MarketData() {
  const [tab, setTab] = useState("indices");

  const INDICES = [
    { name:"S&P 500",    sym:"SPX",   val:"5,847.22",  chg:"+0.42%",  ytd:"+12.4%", up:true },
    { name:"NASDAQ 100", sym:"NDX",   val:"19,234.18", chg:"-0.18%",  ytd:"+14.1%", up:false },
    { name:"Dow Jones",  sym:"DJI",   val:"42,781.50", chg:"+0.31%",  ytd:"+8.7%",  up:true },
    { name:"Russell 2000",sym:"RUT",  val:"2,108.44",  chg:"+0.65%",  ytd:"+5.2%",  up:true },
  ];
  const CRYPTO = [
    { name:"Bitcoin",  sym:"BTC",  val:"$67,420",  chg:"+1.84%", cap:"$1.33T", up:true },
    { name:"Ethereum", sym:"ETH",  val:"$3,512",   chg:"+0.97%", cap:"$421B",  up:true },
    { name:"Solana",   sym:"SOL",  val:"$178.40",  chg:"+3.21%", cap:"$82B",   up:true },
    { name:"XRP",      sym:"XRP",  val:"$0.5842",  chg:"-1.12%", cap:"$33B",   up:false },
  ];
  const STOCKS = [
    { name:"Apple",    sym:"AAPL", val:"$192.32", chg:"+0.82%", pe:"31.2", up:true },
    { name:"Microsoft",sym:"MSFT", val:"$415.70", chg:"-0.24%", pe:"35.8", up:false },
    { name:"NVIDIA",   sym:"NVDA", val:"$878.40", chg:"+2.41%", pe:"68.4", up:true },
    { name:"Tesla",    sym:"TSLA", val:"$248.80", chg:"-1.33%", pe:"52.1", up:false },
    { name:"Amazon",   sym:"AMZN", val:"$184.20", chg:"+0.56%", pe:"43.7", up:true },
    { name:"Meta",     sym:"META", val:"$495.30", chg:"+1.12%", pe:"27.3", up:true },
  ];

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={s.h2}>Market Data</div>
        <div style={s.muted}>Live financial market overview — connect backend for real data</div>
      </div>

      {/* Market summary cards */}
      <div style={s.grid4}>
        {MOCK_MARKET.slice(0,4).map(m=>(
          <div key={m.name} style={s.statCard}>
            <div style={s.statLabel}>{m.name}</div>
            <div style={{...s.statVal, fontSize:22}}>{m.val}</div>
            <div style={{...s.statChange, color: m.up ? T.green : T.red}}>{m.chg} today</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex", gap:8, marginBottom:16}}>
        {["indices","stocks","crypto"].map(t=>(
          <button key={t} style={{...s.navItem, ...(tab===t?s.navItemActive:{}), textTransform:"capitalize"}}
            onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      <div style={s.card}>
        {tab === "indices" && (
          <table style={s.table}>
            <thead><tr>{["Index","Symbol","Value","Daily Chg","YTD Return"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {INDICES.map(r=>(
                <tr key={r.sym}>
                  <td style={{...s.td, fontWeight:600}}>{r.name}</td>
                  <td style={{...s.td, fontFamily:"monospace", color:T.muted}}>{r.sym}</td>
                  <td style={{...s.td, fontWeight:600}}>{r.val}</td>
                  <td style={{...s.td, color: r.up?T.green:T.red, fontWeight:600}}>{r.chg}</td>
                  <td style={{...s.td, color: r.ytd.startsWith("+")?T.green:T.red}}>{r.ytd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "stocks" && (
          <table style={s.table}>
            <thead><tr>{["Company","Symbol","Price","Change","P/E"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {STOCKS.map(r=>(
                <tr key={r.sym}>
                  <td style={{...s.td, fontWeight:600}}>{r.name}</td>
                  <td style={{...s.td, fontFamily:"monospace", color:T.accent}}>{r.sym}</td>
                  <td style={{...s.td, fontWeight:600}}>{r.val}</td>
                  <td style={{...s.td, color: r.up?T.green:T.red, fontWeight:600}}>{r.chg}</td>
                  <td style={s.td}>{r.pe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "crypto" && (
          <table style={s.table}>
            <thead><tr>{["Asset","Symbol","Price","24h Change","Market Cap"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {CRYPTO.map(r=>(
                <tr key={r.sym}>
                  <td style={{...s.td, fontWeight:600}}>{r.name}</td>
                  <td style={{...s.td, fontFamily:"monospace", color:T.amber}}>{r.sym}</td>
                  <td style={{...s.td, fontWeight:600}}>{r.val}</td>
                  <td style={{...s.td, color: r.up?T.green:T.red, fontWeight:600}}>{r.chg}</td>
                  <td style={s.td}>{r.cap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Alerts Page ──────────────────────────────────────────────────────────────
function Alerts() {
  const all = [
    ...MOCK_ALERTS,
    { time:"Yesterday", msg:"Daily fraud summary: 12 blocked transactions, $48,200 saved.", type:"info" },
    { time:"Yesterday", msg:"Model accuracy update: 99.7% on last 10,000 transactions.", type:"info" },
    { time:"2 days ago", msg:"Suspicious pattern detected: 5 rapid-fire small transactions.", type:"medium" },
  ];
  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={s.h2}>Alerts & Notifications</div>
        <div style={s.muted}>All system alerts and fraud events</div>
      </div>
      <div style={s.card}>
        {all.map((a,i)=>(
          <div key={i} style={{display:"flex", gap:14, padding:"14px 0", borderBottom: i<all.length-1 ? `1px solid ${T.border}`:"none", alignItems:"flex-start"}}>
            <div style={{
              width:36, height:36, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
              background: a.type==="high"?"rgba(239,68,68,0.15)": a.type==="medium"?"rgba(245,158,11,0.15)":"rgba(79,142,247,0.15)",
              fontSize:18, flexShrink:0
            }}>
              {a.type==="high" ? "🚨" : a.type==="medium" ? "⚠️" : "ℹ️"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14, lineHeight:1.5}}>{a.msg}</div>
              <div style={{fontSize:11, color:T.muted, marginTop:4}}>{a.time}</div>
            </div>
            <span style={{...s.badge,
              ...(a.type==="high"?s.badgeRed: a.type==="medium"?s.badgeAmber: {...s.badgeGreen, color:T.accent, background:"rgba(79,142,247,0.15)"})}}>
              {a.type.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function Settings({ user }) {
  const [apiUrl, setApiUrl] = useState("http://localhost:8000");
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={s.h2}>Settings</div>
        <div style={s.muted}>Account, API configuration, and preferences</div>
      </div>
      <div style={{...s.grid2, alignItems:"start"}}>
        <div style={s.card}>
          <div style={s.h3}>Account</div>
          <label style={s.label}>Display Name</label>
          <input style={s.input} defaultValue={user.name}
            onFocus={e=>e.target.style.borderColor=T.accent}
            onBlur={e=>e.target.style.borderColor=T.border}/>
          <label style={s.label}>Email</label>
          <input style={s.input} defaultValue={user.email} disabled style={{...s.input, opacity:0.5}}/>
          <label style={s.label}>Role</label>
          <input style={{...s.input, opacity:0.5}} value="Analyst" disabled/>
        </div>
        <div style={s.card}>
          <div style={s.h3}>Backend Connection</div>
          <label style={s.label}>API URL</label>
          <input style={s.input} value={apiUrl} onChange={e=>setApiUrl(e.target.value)}
            onFocus={e=>e.target.style.borderColor=T.accent}
            onBlur={e=>e.target.style.borderColor=T.border}/>
          <div style={{fontSize:12, color:T.muted, marginTop:6}}>
            Point this to your FastAPI backend. Default: http://localhost:8000
          </div>
          <button style={{...s.btn, marginTop:16}} onClick={()=>{setSaved(true); setTimeout(()=>setSaved(false),2000)}}>
            {saved ? "✓ Saved!" : "Save Settings"}
          </button>
        </div>
      </div>
      <div style={{...s.card, marginTop:0}}>
        <div style={s.h3}>About NexaGuard</div>
        <div style={{color:T.muted, fontSize:14, lineHeight:1.8}}>
          NexaGuard is an AI-powered financial fraud detection and market intelligence platform.<br/>
          Backend: FastAPI + Random Forest ML model · Frontend: React<br/>
          Version: 1.0.0
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("Dashboard");

  if (!user) return <AuthScreen onAuth={setUser}/>;

  const pages = { "Dashboard":<Dashboard/>, "Fraud Detection":<FraudDetection/>, "Market Data":<MarketData/>, "Alerts":<Alerts/>, "Settings":<Settings user={user}/> };

  return (
    <div style={s.app}>
      <Nav user={user} page={page} setPage={setPage} onLogout={()=>setUser(null)}/>
      <div style={s.main}>
        {pages[page]}
      </div>
    </div>
  );
}