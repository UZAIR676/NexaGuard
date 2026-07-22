import { useState, useRef, useEffect } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

export default function Profile({ user, onLogout, onUpdate }) {
  const token = localStorage.getItem("ng_token");

  // ── Profile fields ──────────────────────────────────────────────────
  const [form, setForm]     = useState({ name: user.name || "" });
  const [msg, setMsg]       = useState("");
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  // ── Password fields ─────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwMsg, setPwMsg]   = useState("");
  const [pwErr, setPwErr]   = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // ── Tabs ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("profile");

  // ── Face ID state (from Settings.jsx) ───────────────────────────────
  const [faceStatus, setFaceStatus] = useState(null);
  const [faceStep, setFaceStep]     = useState("idle"); // idle | camera | capturing | processing | done | error
  const [faceMsg, setFaceMsg]       = useState("");
  const [faceErr, setFaceErr]       = useState("");
  const [frames, setFrames]         = useState([]);

  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadFaceStatus();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Responsive tracking ──────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 720 : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Profile save ──────────────────────────────────────────────────────
  const save = async () => {
    setMsg(""); setErr("");
    if (!form.name.trim()) { setErr("Name khali nahi ho sakta"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/auth/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: form.name }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Update failed"); return; }
      onUpdate({ ...user, name: form.name });
      setMsg("✅ Profile updated!");
    } catch { setErr("Server se connect nahi ho raha"); }
    setLoading(false);
  };

  // ── Password change ──────────────────────────────────────────────────
  const changePassword = async () => {
    setPwMsg(""); setPwErr("");
    if (!pwForm.current)                 { setPwErr("Current password required"); return; }
    if (!pwForm.newPw)                   { setPwErr("New password required"); return; }
    if (pwForm.newPw.length < 6)         { setPwErr("Min 6 characters chahiye"); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwErr("Passwords match nahi kar rahe"); return; }
    setPwLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/auth/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: user.name, current_password: pwForm.current, new_password: pwForm.newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwErr(data.detail || "Failed"); return; }
      setPwMsg("✅ Password changed!");
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch { setPwErr("Server se connect nahi ho raha"); }
    setPwLoading(false);
  };

  // ── Face status ───────────────────────────────────────────────────────
  const loadFaceStatus = async () => {
    try {
      const r = await fetch(`${BASE}/api/face/status?token=${token}`);
      const d = await r.json();
      setFaceStatus(d);
    } catch { }
  };

  // ── Camera ────────────────────────────────────────────────────────────
  const startCamera = async () => {
    setFaceErr("");
    setFaceMsg("");
    setFrames([]);
    setFaceStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      setFaceErr("Camera access denied — please allow camera access in your browser.");
      setFaceStep("error");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const captureFrame = () => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width  = videoRef.current.videoWidth  || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  // ── Register Face ────────────────────────────────────────────────────
  const registerFace = async () => {
    setFaceErr("");
    setFrames([]);
    setFaceStep("capturing");

    const captured = [];
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 700));
      const frame = captureFrame();
      if (frame) captured.push(frame);
      setFrames([...captured]);
      setFaceMsg(`Capturing ${i + 1}/5 — move your face slightly`);
    }

    if (captured.length < 3) {
      setFaceErr("Could not capture enough frames — please try again.");
      setFaceStep("error");
      return;
    }

    setFaceStep("processing");
    setFaceMsg("Registering face...");

    try {
      const bestFrame = captured[Math.floor(captured.length / 2)];

      const res = await fetch(`${BASE}/api/face/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, image: bestFrame }),
      }).then(r => r.json());

      if (res.error) {
        setFaceErr(`❌ ${res.error}`);
        setFaceStep("error");
        return;
      }

      const conf = parseFloat(res.confidence) || 0;
      const pct  = conf <= 1 ? (conf * 100).toFixed(0) : conf.toFixed(0);
      setFaceMsg(`✅ Face ID registered! Confidence: ${pct}%`);
      setFaceStep("done");
      stopCamera();
      loadFaceStatus();
    } catch {
      setFaceErr("Could not connect to server.");
      setFaceStep("error");
    }
  };

  // ── Delete Face ───────────────────────────────────────────────────────
  const deleteFace = async () => {
    if (!window.confirm("Are you sure you want to remove Face ID?")) return;
    try {
      const res = await fetch(`${BASE}/api/face/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).then(r => r.json());
      if (res.success) {
        setFaceStatus({ ...faceStatus, registered: false });
        setFaceStep("idle");
        setFaceMsg("");
      }
    } catch { }
  };

  const isCapturing  = faceStep === "capturing";
  const isProcessing = faceStep === "processing";
  const isDone       = faceStep === "done";
  const isCamera     = faceStep === "camera" || isCapturing;

  const avatarColors = ["#4F8EF7","#22C55E","#F59E0B","#EF4444","#8B5CF6"];
  const avatarColor  = avatarColors[user.name?.charCodeAt(0) % avatarColors.length] || T.accent;
  const roleColor    = user.role === "admin" ? T.red : user.role === "analyst" ? T.amber : T.accent;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      {/* Responsive rules — inline style objects can't do media queries,
          so a small <style> block handles breakpoint behavior. */}
      <style>{`
        .np-banner { flex-wrap: wrap; }
        .np-tabs { flex-wrap: wrap; }
        .np-faceid-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 720px) {
          .np-faceid-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
        }
        @media (max-width: 480px) {
          .np-banner-balance { margin-left: 0 !important; text-align: left !important; width: 100%; }
          .np-tabs button { flex: 1 1 auto; text-align: center; }
        }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <div style={s.h2}>Profile</div>
        <div style={s.muted}>Manage your account</div>
      </div>

      {/* Avatar Banner */}
      <div className="np-banner" style={{ ...s.card, marginBottom: 20, display: "flex", alignItems: "center", gap: 24, padding: 28 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%", background: avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 700, color: "#fff",
          boxShadow: `0 0 24px ${avatarColor}55`, flexShrink: 0
        }}>
          {user.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{user.name}</div>
          <div style={{ color: T.muted, fontSize: 14 }}>{user.email}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ ...s.badge, ...s.badgeGreen }}>● Active</span>
            <span style={{ ...s.badge, color: roleColor, background: `${roleColor}22` }}>
              {user.role?.toUpperCase()}
            </span>
            {faceStatus?.registered && (
              <span style={{ ...s.badge, ...s.badgeGreen }}>🔐 Face ID</span>
            )}
          </div>
        </div>
        <div className="np-banner-balance" style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 12, color: T.muted }}>Balance</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.green }}>
            ${parseFloat(user.balance || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="np-tabs" style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {[
          ["profile", "👤 Profile"],
          ["password", "🔑 Password"],
          ["faceid", "🔐 Face ID"],
          ["danger", "⚠️ Account"],
        ].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...s.navItem, ...(tab === t ? s.navItemActive : {}), whiteSpace: "nowrap" }}>
            {l}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === "profile" && (
        <div style={s.card}>
          <div style={s.h3}>Account Details</div>
          <label style={s.label}>Full Name</label>
          <input style={s.input} value={form.name} onChange={e => setForm({ name: e.target.value })}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <label style={s.label}>Email</label>
          <input style={{ ...s.input, opacity: 0.5 }} value={user.email} disabled />

          <label style={s.label}>Role</label>
          <input style={{ ...s.input, opacity: 0.5 }} value={user.role?.toUpperCase()} disabled />

          {msg && <div style={{ color: T.green, fontSize: 13, marginTop: 12 }}>{msg}</div>}
          {err && <div style={{ color: T.red,   fontSize: 13, marginTop: 12 }}>⚠️ {err}</div>}

          <button style={{ ...s.btn, marginTop: 20, opacity: loading ? 0.7 : 1, width: isMobile ? "100%" : undefined }} onClick={save} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Password Tab */}
      {tab === "password" && (
        <div style={s.card}>
          <div style={s.h3}>Change Password</div>
          <label style={s.label}>Current Password</label>
          <input style={s.input} type="password" placeholder="••••••••"
            value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <label style={s.label}>New Password</label>
          <input style={s.input} type="password" placeholder="••••••••"
            value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <label style={s.label}>Confirm New Password</label>
          <input style={s.input} type="password" placeholder="••••••••"
            value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          {pwMsg && <div style={{ color: T.green, fontSize: 13, marginTop: 12 }}>{pwMsg}</div>}
          {pwErr && <div style={{ color: T.red,   fontSize: 13, marginTop: 12 }}>⚠️ {pwErr}</div>}

          <button style={{ ...s.btn, marginTop: 20, opacity: pwLoading ? 0.7 : 1, width: isMobile ? "100%" : undefined }} onClick={changePassword} disabled={pwLoading}>
            {pwLoading ? "Changing..." : "Change Password"}
          </button>
        </div>
      )}

      {/* Face ID Tab */}
      {tab === "faceid" && (
        <div className="np-faceid-grid">
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={s.h3}>🔐 Face ID</div>
              {faceStatus?.registered && (
                <span style={{ ...s.badge, ...s.badgeGreen }}>✅ Registered</span>
              )}
            </div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>
              FaceNet Deep Learning — fully local, banking-grade security
            </div>

            {faceStatus?.registered ? (
              <div style={{
                padding: "14px 16px", borderRadius: 10, marginBottom: 16,
                background: "rgba(34,197,94,0.08)",
                border: `1px solid rgba(34,197,94,0.2)`
              }}>
                <div style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>
                  ✅ Face ID is active
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                  Your face will be automatically verified on login
                </div>
              </div>
            ) : (
              <div style={{
                padding: "14px 16px", borderRadius: 10, marginBottom: 16,
                background: "rgba(245,158,11,0.08)",
                border: `1px solid rgba(245,158,11,0.2)`
              }}>
                <div style={{ fontSize: 13, color: T.amber, fontWeight: 600 }}>
                  ⚠️ Face ID is not registered
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                  Register it to add extra security at login
                </div>
              </div>
            )}

            {isCamera && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  position: "relative", borderRadius: 12, overflow: "hidden",
                  border: `2px solid ${isDone ? T.green : T.accent}`,
                  background: "#000", aspectRatio: "4/3", marginBottom: 12
                }}>
                  <video ref={videoRef} autoPlay playsInline muted
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />

                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "55%", aspectRatio: "3/4",
                    border: `2px dashed rgba(255,255,255,0.5)`,
                    borderRadius: "50%", pointerEvents: "none"
                  }} />

                  {faceMsg && (
                    <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center" }}>
                      <span style={{
                        background: "rgba(0,0,0,0.75)", color: "#fff",
                        padding: "5px 14px", borderRadius: 20, fontSize: 12
                      }}>
                        {faceMsg}
                      </span>
                    </div>
                  )}

                  <div style={{
                    position: "absolute", top: 10, left: 0, right: 0,
                    display: "flex", justifyContent: "center", gap: 6
                  }}>
                    {[0,1,2,3,4].map(i => (
                      <div key={i} style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: frames.length > i ? T.green : "rgba(255,255,255,0.3)",
                        transition: "background 0.3s"
                      }} />
                    ))}
                  </div>
                </div>

                <div style={{
                  fontSize: 12, color: T.muted, lineHeight: 1.7,
                  padding: "10px 14px", background: T.surface,
                  borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 12
                }}>
                  📋 Sit directly facing the camera · Make sure lighting is good · Move your face slightly
                </div>
              </div>
            )}

            {isDone && faceMsg && (
              <div style={{
                color: T.green, fontSize: 13, marginBottom: 16,
                padding: "12px 16px", background: "rgba(34,197,94,0.1)",
                borderRadius: 8, border: `1px solid rgba(34,197,94,0.2)`
              }}>
                {faceMsg}
              </div>
            )}

            {faceErr && (
              <div style={{
                color: T.red, fontSize: 13, marginBottom: 16,
                padding: "12px 16px", background: "rgba(239,68,68,0.1)",
                borderRadius: 8, border: `1px solid rgba(239,68,68,0.2)`
              }}>
                {faceErr}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              {faceStep === "idle" && !faceStatus?.registered && (
                <button style={s.btn} onClick={startCamera}>
                  📷 Set Up Face ID
                </button>
              )}

              {faceStep === "camera" && (
                <button style={s.btn} onClick={registerFace}>
                  📸 Capture & Register
                </button>
              )}

              {(isCapturing || isProcessing) && (
                <button style={{ ...s.btn, opacity: 0.7 }} disabled>
                  {isCapturing ? `Capturing ${frames.length}/5...` : "Processing..."}
                </button>
              )}

              {faceStatus?.registered && faceStep === "idle" && (
                <>
                  <button style={s.btn} onClick={startCamera}>
                    🔄 Update Face ID
                  </button>
                  <button style={{
                    ...s.btn,
                    background: "rgba(239,68,68,0.15)",
                    color: T.red,
                    border: `1px solid rgba(239,68,68,0.3)`
                  }} onClick={deleteFace}>
                    🗑️ Remove Face ID
                  </button>
                </>
              )}

              {(faceStep === "camera" || isCapturing) && (
                <button style={{ ...s.btn, ...s.btnSec }} onClick={() => { stopCamera(); setFaceStep("idle"); setFaceMsg(""); }}>
                  Cancel
                </button>
              )}
            </div>

            <div style={{
              marginTop: 20, padding: "12px 14px",
              background: T.surface, borderRadius: 8,
              border: `1px solid ${T.border}`, fontSize: 12, color: T.muted, lineHeight: 1.6
            }}>
              🛡️ <strong>Privacy:</strong> Your face data is stored only on your own server.
              No external API is used — the FaceNet model runs fully locally.
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      {tab === "danger" && (
        <div style={{ ...s.card, borderColor: "rgba(239,68,68,0.3)" }}>
          <div style={{ ...s.h3, color: T.red }}>Account Actions</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>
            Sign out from your current session.
          </div>
          <button onClick={onLogout} style={{
            ...s.btn, background: "rgba(239,68,68,0.15)", color: T.red,
            border: `1px solid rgba(239,68,68,0.3)`, width: isMobile ? "100%" : "auto", padding: "10px 24px"
          }}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}