import { useState, useEffect } from "react";
import { T, s } from "./theme";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import MarketData from "./pages/MarketData";
import FraudDetection from "./pages/FraudDetection";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import AdminPanel from "./pages/AdminPanel";
import Banking from "./pages/Banking";
import AIAdvisor from "./pages/AIAdvisor";
import CSVScanner from "./pages/CSVScanner";
function Nav({ user, page, setPage }) {
const basePages = ["Dashboard", "Banking","CSV Scanner", "Fraud Detection", "Market Data", "AI Advisor", "Alerts", "Settings"];
  const extraPages = (user.role === "admin" || user.role === "analyst") ? ["Admin Panel"] : [];
  const allPages = [...basePages, ...extraPages];

  const roleColor =
    user.role === "admin"   ? T.red   :
    user.role === "analyst" ? T.amber : T.accent;

  return (
    <div style={s.nav}>
      <div style={s.navLogo}>
        <div style={{ ...s.logoIcon, width: 28, height: 28, fontSize: 14 }}>🛡️</div>
        <span style={{ ...s.logoText, fontSize: 16 }}>NexaGuard</span>
      </div>
      {allPages.map(p => (
        <button key={p} style={{ ...s.navItem, ...(page === p ? s.navItemActive : {}) }} onClick={() => setPage(p)}>
          {p === "Admin Panel" ? "👑 Admin" : p === "Banking" ? "🏦 Banking" : p}
        </button>
      ))}
      <div style={s.navRight}>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: `${roleColor}22`, color: roleColor, fontWeight: 600 }}>
          {user.role?.toUpperCase()}
        </span>
        <div style={{ fontSize: 12, color: T.muted }}>{user.email}</div>
        <div style={{ ...s.avatar, cursor: "pointer" }} title="Profile" onClick={() => setPage("Profile")}>
          {user.name[0].toUpperCase()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser]         = useState(null);
  const [authPage, setAuthPage] = useState("login");
  const [page, setPage]         = useState("Dashboard");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ng_token");
    if (token) {
      fetch(`http://localhost:8000/api/auth/me?token=${token}`)
        .then(r => r.json())
        .then(data => {
          if (data.email) setUser(data);
          else localStorage.removeItem("ng_token");
        })
        .catch(() => localStorage.removeItem("ng_token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("ng_token");
    setUser(null);
    setAuthPage("login");
    setPage("Dashboard");
  };

  const handleBalanceUpdate = (newBalance) => {
    setUser(u => ({ ...u, balance: newBalance }));
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontFamily: T.font }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🛡️</div>
          <div>Loading NexaGuard...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authPage === "login") return <Login onAuth={setUser} goSignup={() => setAuthPage("signup")} />;
    return <Signup onAuth={setUser} goLogin={() => setAuthPage("login")} />;
  }

  const pages = {
    "Dashboard":       <Dashboard />,
    "Banking":         <Banking user={user} onBalanceUpdate={handleBalanceUpdate} />,
    "Fraud Detection": <FraudDetection />,
    "Market Data":     <MarketData />,
    "Alerts":          <Alerts />,
    "Settings":        <Settings user={user} />,
    "AI Advisor": <AIAdvisor user={user} />,
    "CSV Scanner": <CSVScanner />,
    "Profile":         <Profile user={user} onLogout={handleLogout} onUpdate={setUser} />,
    "Admin Panel":     <AdminPanel user={user} />,
  };

  return (
    <div style={s.app}>
      <Nav user={user} page={page} setPage={setPage} />
      <div style={s.main}>
        {pages[page] || <Dashboard />}
        
      </div>
    </div>
  );
}