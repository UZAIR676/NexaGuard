import { useState, useEffect } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

export default function AdminPanel({ user }) {
  const [tab, setTab]       = useState("users");
  const [users, setUsers]   = useState([]);
  const [txns, setTxns]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState("");

  useEffect(() => { loadUsers(); loadTxns(); }, []);

  const token = localStorage.getItem("ng_token");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/admin/users?token=${token}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { }
    setLoading(false);
  };

  const loadTxns = async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/transactions?token=${token}`);
      const data = await res.json();
      setTxns(Array.isArray(data) ? data : []);
    } catch { }
  };

  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`"${userName}" after deleting this user you cannot undo!`)) return;
    setMsg("");
    try {
      const res  = await fetch(`${BASE}/api/auth/admin/delete-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, user_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`✅ User deleted successfully`);
        loadUsers();
      } else {
        setMsg(`❌ ${data.detail || "Delete failed"}`);
      }
    } catch { setMsg("❌ Server error"); }
  };

  const changeRole = async (userId, role) => {
    setMsg("");
    try {
      const res = await fetch(`${BASE}/api/auth/admin/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, user_id: userId, role }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`✅ Role updated to ${role}`);
        loadUsers();
      }
    } catch { setMsg("❌ Failed to update role"); }
  };

  const roleColor = (r) =>
    r === "admin"   ? { background: "rgba(239,68,68,0.15)",   color: T.red   } :
    r === "analyst" ? { background: "rgba(245,158,11,0.15)",  color: T.amber } :
                      { background: "rgba(79,142,247,0.15)",  color: T.accent };

  const statusColor = (s) =>
    s === "completed" ? T.green :
    s === "blocked"   ? T.red   : T.amber;

  // Stats
  const totalUsers    = users.length;
  const totalAdmins   = users.filter(u => u.role === "admin").length;
  const totalAnalysts = users.filter(u => u.role === "analyst").length;
  const blockedTxns   = txns.filter(t => t.status === "blocked").length;

  const isAdmin = user.role === "admin";

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>👑 Admin Panel</div>
        <div style={s.muted}>Manage users, roles, and monitor all transactions</div>
      </div>

      {/* Stats */}
      <div style={s.grid3} >
        {[
          ["👥 Total Users",    totalUsers,    T.accent],
          ["👑 Admins",         totalAdmins,   T.red],
          ["🔍 Analysts",       totalAnalysts, T.amber],
          ["💳 Transactions",   txns.length,   T.green],
          ["🚨 Blocked",        blockedTxns,   T.red],
          ["✅ Completed",      txns.length - blockedTxns, T.green],
        ].map(([label, val, color]) => (
          <div key={label} style={s.statCard}>
            <div style={s.statLabel}>{label}</div>
            <div style={{ ...s.statVal, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["users","👥 Users"], ["transactions","💳 Transactions"]].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...s.navItem, ...(tab === t ? s.navItemActive : {}) }}>
            {label}
          </button>
        ))}
        <button onClick={() => { loadUsers(); loadTxns(); }}
          style={{ ...s.navItem, ...s.navItemActive, marginLeft: "auto" }}>
          ↻ Refresh
        </button>
      </div>

      {msg && (
        <div style={{ padding: "10px 16px", background: "rgba(79,142,247,0.1)", borderRadius: 8, marginBottom: 16, fontSize: 13, color: T.accent }}>
          {msg}
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div style={s.card}>
          <div style={{ ...s.h3, marginBottom: 16 }}>All Users</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: T.muted }}>Loading...</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {["ID", "Name", "Email", "Role", "Balance", "Joined", isAdmin ? "Change Role" : "Action"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ ...s.td, color: T.muted, fontSize: 12 }}>#{u.id}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{u.name}</td>
                    <td style={{ ...s.td, color: T.muted, fontSize: 12 }}>{u.email}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...roleColor(u.role) }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...s.td, fontWeight: 600, color: T.green }}>
                      ${parseFloat(u.balance || 0).toLocaleString()}
                    </td>
                    <td style={{ ...s.td, color: T.muted, fontSize: 11 }}>
                      {u.created_at?.slice(0, 10)}
                    </td>
                    <td style={s.td}>
                      {u.id === user.id ? (
                        <span style={{ fontSize: 12, color: T.muted }}>You</span>
                      ) : !isAdmin ? (
                        <span style={{ fontSize: 12, color: T.muted }}>View only</span>
                      ) : (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {["user", "analyst", "admin"].map(role => (
                            <button key={role}
                              onClick={() => changeRole(u.id, role)}
                              style={{
                                ...s.navItem,
                                fontSize: 11, padding: "3px 8px",
                                ...(u.role === role ? s.navItemActive : {}),
                              }}>
                              {role}
                            </button>
                          ))}
                          <button
                            onClick={() => deleteUser(u.id, u.name)}
                            style={{ ...s.navItem, fontSize: 11, padding: "3px 8px", color: T.red, borderColor: "rgba(239,68,68,0.3)" }}>
                            🗑️
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {tab === "transactions" && (
        <div style={s.card}>
          <div style={{ ...s.h3, marginBottom: 16 }}>All Transactions</div>
          <table style={s.table}>
            <thead>
              <tr>
                {["ID", "User", "Type", "Amount", "To", "Status", "Fraud Score", "Time"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 ? (
                <tr><td colSpan={8} style={{ ...s.td, textAlign: "center", color: T.muted, padding: 40 }}>No transactions yet</td></tr>
              ) : txns.map(t => (
                <tr key={t.id}>
                  <td style={{ ...s.td, color: T.muted, fontSize: 12 }}>#{t.id}</td>
                  <td style={{ ...s.td, fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{t.user}</div>
                    <div style={{ color: T.muted, fontSize: 11 }}>{t.email}</div>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: "rgba(79,142,247,0.15)", color: T.accent }}>
                      {t.type?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontWeight: 600 }}>${parseFloat(t.amount).toLocaleString()}</td>
                  <td style={{ ...s.td, fontSize: 12, color: T.muted }}>{t.to_email || "—"}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, color: statusColor(t.status), background: `${statusColor(t.status)}22` }}>
                      {t.status?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...s.td, color: t.fraud_score > 70 ? T.red : t.fraud_score > 30 ? T.amber : T.green, fontWeight: 600 }}>
                    {parseFloat(t.fraud_score || 0).toFixed(1)}%
                  </td>
                  <td style={{ ...s.td, fontSize: 11, color: T.muted }}>{t.created_at?.slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}