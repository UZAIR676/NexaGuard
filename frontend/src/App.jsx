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
import ForgotPassword from "./pages/ForgotPassword";

// Icon shown next to every nav item's label — keeps all buttons visually consistent.
const PAGE_ICONS = {
  "Dashboard":    "📊",
  "Banking":      "🏦",
  "Market Data":  "📈",
  "AI Advisor":   "🤖",
  "Alerts":       "🔔",
  "Settings":     "⚙️",
  "CSV Scanner":  "📄",
  "Admin Panel":  "👑",
  "Profile":      "👤",
};

// Injects responsive CSS once. Handles nav collapse on small screens.
function ResponsiveStyles() {
  return (
    <style>{`
      .ng-nav-toggle { display: none; }

      @media (max-width: 900px) {
        .ng-nav {
          flex-wrap: wrap !important;
          padding: 8px 12px !important;
          height: auto !important;
          row-gap: 0 !important;
        }
        .ng-nav-logo {
          order: 1;
          margin-right: auto !important;
        }
        .ng-nav-toggle {
          order: 2;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          width: 34px;
          height: 34px;
          font-size: 16px;
          cursor: pointer;
          color: inherit;
          flex-shrink: 0;
        }
        .ng-nav-right {
          order: 3;
          margin-left: 8px !important;
          gap: 8px !important;
        }
        /* hide role badge + email text in the top bar on mobile, keep only avatar */
        .ng-nav-right .ng-role-badge,
        .ng-nav-right .ng-user-email {
          display: none !important;
        }
        .ng-nav-items {
          display: none;
          flex-direction: column;
          width: 100%;
          order: 4;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #1E2740;
          gap: 4px;
        }
        .ng-nav-items.open {
          display: flex !important;
        }
        .ng-nav-items button {
          width: 100%;
          text-align: left;
        }
        /* show role + email inside the dropdown instead */
        .ng-mobile-userinfo {
          display: flex !important;
          flex-direction: column;
          gap: 6px;
          padding: 4px 12px 10px;
          margin-bottom: 4px;
          border-bottom: 1px solid #1E2740;
        }
      }

      .ng-mobile-userinfo { display: none; }
    `}</style>
  );
}

function Nav({ user, page, setPage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const basePages = ["Dashboard", "Banking", "Market Data", "AI Advisor", "Alerts", "Settings"];
  const isStaff = user.role === "admin" || user.role === "analyst";
  const extraPages = isStaff ? ["CSV Scanner", "Admin Panel"] : [];
  const allPages = [...basePages, ...extraPages];

  const roleColor =
    user.role === "admin"   ? T.red   :
    user.role === "analyst" ? T.amber : T.accent;

  const handleNavClick = (p) => {
    setPage(p);
    setMenuOpen(false);
  };

  return (
    <div style={s.nav} className="ng-nav">
      <div style={s.navLogo} className="ng-nav-logo">
        <div style={{ ...s.logoIcon, width: 28, height: 28, fontSize: 14 }}>🛡️</div>
        <span style={{ ...s.logoText, fontSize: 16 }}>NexaGuard</span>
      </div>

      <button
        className="ng-nav-toggle"
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Toggle menu"
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      <div className={`ng-nav-items${menuOpen ? " open" : ""}`}>
        <div className="ng-mobile-userinfo">
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: `${roleColor}22`, color: roleColor, fontWeight: 600, alignSelf: "flex-start" }}>
            {user.role?.toUpperCase()}
          </span>
          <div style={{ fontSize: 12, color: T.muted, wordBreak: "break-all" }}>{user.email}</div>
        </div>
        {allPages.map(p => (
          <button
            key={p}
            style={{ ...s.navItem, ...(page === p ? s.navItemActive : {}) }}
            onClick={() => handleNavClick(p)}
          >
            {PAGE_ICONS[p] ? `${PAGE_ICONS[p]} ${p}` : p}
          </button>
        ))}
      </div>

      <div style={s.navRight} className="ng-nav-right">
        <span className="ng-role-badge" style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: `${roleColor}22`, color: roleColor, fontWeight: 600 }}>
          {user.role?.toUpperCase()}
        </span>
        <div className="ng-user-email" style={{ fontSize: 12, color: T.muted }}>{user.email}</div>
        <div style={{ ...s.avatar, cursor: "pointer" }} title="Profile" onClick={() => handleNavClick("Profile")}>
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
    if (authPage === "login")
      return <Login onAuth={setUser} goSignup={() => setAuthPage("signup")} goForgotPassword={() => setAuthPage("forgot")} />;
    if (authPage === "forgot")
      return <ForgotPassword goLogin={() => setAuthPage("login")} />;
    return <Signup onAuth={setUser} goLogin={() => setAuthPage("login")} />;
  }

  const pages = {
    "Dashboard":       <Dashboard user={user} />,
    "Banking":         <Banking user={user} onBalanceUpdate={handleBalanceUpdate} />,
    "Market Data":     <MarketData />,
    "Alerts":          <Alerts user={user} />,
    "Settings":        <Settings user={user} />,
    "AI Advisor": <AIAdvisor user={user} />,
    "CSV Scanner": <CSVScanner user={user} />,
    "Profile":         <Profile user={user} onLogout={handleLogout} onUpdate={setUser} />,
    "Admin Panel":     <AdminPanel user={user} />,
  };

  return (
    <div style={s.app}>
      <ResponsiveStyles />
      <Nav user={user} page={page} setPage={setPage} />
      <div style={s.main}>
        {pages[page] || <Dashboard />}
      </div>
    </div>
  );
}