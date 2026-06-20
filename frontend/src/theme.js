export const T = {
  bg:        "#0A0D14",
  surface:   "#111520",
  card:      "#161C2D",
  border:    "#1E2740",
  accent:    "#4F8EF7",
  accentDim: "#1E3A6E",
  green:     "#22C55E",
  red:       "#EF4444",
  amber:     "#F59E0B",
  text:      "#E8EDF5",
  muted:     "#6B7A99",
  font:      "'Inter', 'Segoe UI', sans-serif",
};

export const s = {
  // AUTH
  authWrap: { minHeight: "100vh", display: "flex", background: T.bg, fontFamily: T.font, color: T.text },
  authLeft: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 80px", maxWidth: 520 },
  authRight: { flex: 1, background: `linear-gradient(135deg, ${T.accentDim} 0%, #0A0D14 60%)`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 60, position: "relative", overflow: "hidden" },

  logo:     { display: "flex", alignItems: "center", gap: 10, marginBottom: 48 },
  logoIcon: { width: 36, height: 36, background: T.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 },
  logoText: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text },

  authTitle: { fontSize: 32, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.5px" },
  authSub:   { fontSize: 15, color: T.muted, marginBottom: 36 },

  label: { display: "block", fontSize: 13, fontWeight: 500, color: T.muted, marginBottom: 6, marginTop: 18 },
  input: { width: "100%", padding: "11px 14px", background: "#161C2D", border: `1px solid #1E2740`, borderRadius: 8, color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.2s" },
  btn:   { width: "100%", padding: "12px", background: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 16, transition: "opacity 0.2s" },
  btnSec: { background: "transparent", border: `1px solid #1E2740`, color: T.muted },
  link:  { color: T.accent, cursor: "pointer", fontSize: 14, marginTop: 16, textAlign: "center", display: "block" },

  // NAV
  nav:         { background: "#111520", borderBottom: `1px solid #1E2740`, padding: "0 24px", display: "flex", alignItems: "center", height: 60, gap: 8, position: "sticky", top: 0, zIndex: 100, fontFamily: T.font },
  navLogo:     { display: "flex", alignItems: "center", gap: 8, marginRight: 32 },
  navItem:     { padding: "6px 12px", borderRadius: 6, fontSize: 14, cursor: "pointer", color: T.muted, transition: "all 0.15s", border: "none", background: "transparent", fontFamily: T.font },
  navItemActive: { color: T.text, background: "#161C2D" },
  navRight:    { marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 },
  avatar:      { width: 32, height: 32, borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff" },

  // LAYOUT
  app:  { minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, display: "flex", flexDirection: "column" },
  main: { flex: 1, padding: "28px 32px", maxWidth: 1400, margin: "0 auto", width: "100%", boxSizing: "border-box" },

  // CARDS
  card:     { background: "#161C2D", border: `1px solid #1E2740`, borderRadius: 12, padding: 20 },
  statCard: { background: "#161C2D", border: `1px solid #1E2740`, borderRadius: 12, padding: 20 },

  grid2: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, marginBottom: 20 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 },

  statLabel:  { fontSize: 12, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" },
  statVal:    { fontSize: 28, fontWeight: 700, letterSpacing: "-1px" },
  statChange: { fontSize: 13, marginTop: 4 },

  h2:    { fontSize: 20, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.3px" },
  h3:    { fontSize: 15, fontWeight: 600, marginBottom: 12 },
  muted: { color: T.muted, fontSize: 13 },

  badge:      { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  badgeGreen: { background: "rgba(34,197,94,0.15)", color: "#22C55E" },
  badgeRed:   { background: "rgba(239,68,68,0.15)", color: "#EF4444" },
  badgeAmber: { background: "rgba(245,158,11,0.15)", color: "#F59E0B" },

  table: { width: "100%", borderCollapse: "collapse" },
  th:    { textAlign: "left", padding: "8px 12px", fontSize: 12, color: T.muted, fontWeight: 500, borderBottom: `1px solid #1E2740`, textTransform: "uppercase", letterSpacing: "0.4px" },
  td:    { padding: "12px 12px", fontSize: 14, borderBottom: `1px solid #1E2740` },

  progressBar:  { height: 6, borderRadius: 3, background: "#1E2740", overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", borderRadius: 3, transition: "width 0.6s ease" },
  scoreCircle:  { width: 130, height: 130, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: "4px solid" },
};
