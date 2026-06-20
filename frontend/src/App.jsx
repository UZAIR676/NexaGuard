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

function Nav({ user, page, setPage, onLogout }) {
  const pages = ["Dashboard", "Fraud Detection", "Market Data", "Alerts", "Settings"];
  return (
    <div style={s.nav}>
      <div style={s.navLogo}>
        <div style={{ ...s.logoIcon, width: 28, height: 28, fontSize: 14 }}>🛡️</div>
        <span style={{ ...s.logoText, fontSize: 16 }}>NexaGuard</span>
      </div>
      {pages.map(p => (
        <button key={p} style={{ ...s.navItem, ...(page === p ? s.navItemActive : {}) }} onClick={() => setPage(p)}>
          {p}
        </button>
      ))}
      <div style={s.navRight}>
        <div style={{ fontSize: 12, color: T.muted }}>{user.email}</div>
        <div
          style={{ ...s.avatar, position: "relative" }}
          title="Profile"
          onClick={() => setPage("Profile")}
        >
          {user.name[0].toUpperCase()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authPage, setAuthPage] = useState("login");
  const [page, setPage] = useState("Dashboard");
  const [loading, setLoading] = useState(true);

  // Auto-login: token check on refresh
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
    "Fraud Detection": <FraudDetection />,
    "Market Data":     <MarketData />,
    "Alerts":          <Alerts />,
    "Settings":        <Settings user={user} />,
    "Profile":         <Profile user={user} onLogout={handleLogout} onUpdate={setUser} />,
  };

  return (
    <div style={s.app}>
      <Nav user={user} page={page} setPage={setPage} onLogout={handleLogout} />
      <div style={s.main}>
        {pages[page]}
      </div>
    </div>
  );
}