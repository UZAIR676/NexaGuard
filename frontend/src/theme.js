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
  authWrap: { minHeight: "100vh", display: "flex", flexWrap: "wrap", background: T.bg, fontFamily: T.font, color: T.text },
  authLeft: { flex: "1 1 320px", display: "flex", flexDirection: "column", justifyContent: "center", padding: "clamp(28px, 6vw, 60px) clamp(20px, 8vw, 80px)", maxWidth: 520, boxSizing: "border-box" },
  authRight: { flex: "1 1 320px", minHeight: 280, background: `linear-gradient(135deg, ${T.accentDim} 0%, #0A0D14 60%)`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "clamp(24px, 6vw, 60px)", position: "relative", overflow: "hidden", boxSizing: "border-box" },

  logo:     { display: "flex", alignItems: "center", gap: 10, marginBottom: 48 },
  logoIcon: { width: 36, height: 36, background: T.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 },
  logoText: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: T.text },

  authTitle: { fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700, marginBottom: 8, letterSpacing: "-0.5px" },
  authSub:   { fontSize: 15, color: T.muted, marginBottom: 36 },

  label: { display: "block", fontSize: 13, fontWeight: 500, color: T.muted, marginBottom: 6, marginTop: 18 },
  input: { width: "100%", padding: "11px 14px", background: "#161C2D", border: `1px solid #1E2740`, borderRadius: 8, color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.2s" },
  btn:   { width: "100%", padding: "12px", background: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 16, transition: "opacity 0.2s" },
  btnSec: { background: "transparent", border: `1px solid #1E2740`, color: T.muted },
  link:  { color: T.accent, cursor: "pointer", fontSize: 14, marginTop: 16, textAlign: "center", display: "block" },

  // NAV
  nav:         { background: "#111520", borderBottom: `1px solid #1E2740`, padding: "0 clamp(12px, 3vw, 24px)", display: "flex", alignItems: "center", flexWrap: "wrap", minHeight: 60, gap: 8, position: "sticky", top: 0, zIndex: 100, fontFamily: T.font },
  navLogo:     { display: "flex", alignItems: "center", gap: 8, marginRight: "clamp(8px, 3vw, 32px)" },
  navItem:     { padding: "6px 12px", borderRadius: 6, fontSize: 14, cursor: "pointer", color: T.muted, transition: "all 0.15s", border: "none", background: "transparent", fontFamily: T.font, whiteSpace: "nowrap" },
  navItemActive: { color: T.text, background: "#161C2D" },
  navRight:    { marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  avatar:      { width: 32, height: 32, borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff", flexShrink: 0 },

  // LAYOUT
  app:  { minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, display: "flex", flexDirection: "column" },
  main: { flex: 1, padding: "clamp(16px, 4vw, 28px) clamp(14px, 4vw, 32px)", maxWidth: 1400, margin: "0 auto", width: "100%", boxSizing: "border-box" },

  // CARDS
  card:     { background: "#161C2D", border: `1px solid #1E2740`, borderRadius: 12, padding: "clamp(14px, 3vw, 20px)", boxSizing: "border-box" },
  statCard: { background: "#161C2D", border: `1px solid #1E2740`, borderRadius: 12, padding: "clamp(14px, 3vw, 20px)", boxSizing: "border-box" },

  // auto-fit: collapses to fewer columns automatically as screen shrinks, no media queries needed
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 20 },

  statLabel:  { fontSize: 12, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" },
  statVal:    { fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 700, letterSpacing: "-1px" },
  statChange: { fontSize: 13, marginTop: 4 },

  h2:    { fontSize: "clamp(17px, 3vw, 20px)", fontWeight: 700, marginBottom: 4, letterSpacing: "-0.3px" },
  h3:    { fontSize: 15, fontWeight: 600, marginBottom: 12 },
  muted: { color: T.muted, fontSize: 13 },

  badge:      { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
  badgeGreen: { background: "rgba(34,197,94,0.15)", color: "#22C55E" },
  badgeRed:   { background: "rgba(239,68,68,0.15)", color: "#EF4444" },
  badgeAmber: { background: "rgba(245,158,11,0.15)", color: "#F59E0B" },

  // tableWrap lets wide tables scroll horizontally on mobile instead of breaking layout
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 480 },
  th:    { textAlign: "left", padding: "8px 12px", fontSize: 12, color: T.muted, fontWeight: 500, borderBottom: `1px solid #1E2740`, textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap" },
  td:    { padding: "12px 12px", fontSize: 14, borderBottom: `1px solid #1E2740` },

  progressBar:  { height: 6, borderRadius: 3, background: "#1E2740", overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", borderRadius: 3, transition: "width 0.6s ease" },
  scoreCircle:  { width: 130, height: 130, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: "4px solid" },
};