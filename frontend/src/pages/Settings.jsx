import { useState, useRef, useEffect } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

export default function Settings({ user, onUpdate }) {
  const token = localStorage.getItem("ng_token");

  // Profile
  const [name, setName]               = useState(user?.name || "");
  const [currentPw, setCurrentPw]     = useState("");
  const [newPw, setNewPw]             = useState("");
  const [profileMsg, setProfileMsg]   = useState("");
  const [profileErr, setProfileErr]   = useState("");
  const [profileLoad, setProfileLoad] = useState(false);

  // Face ID
  const [faceStatus, setFaceStatus]   = useState(null);
  const [faceStep, setFaceStep]       = useState("idle"); // idle | camera | capturing | processing | done | error
  const [faceMsg, setFaceMsg]         = useState("");
  const [faceErr, setFaceErr]         = useState("");
  const [frames, setFrames]           = useState([]);

  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadFaceStatus();
    return () => stopCamera();
  }, []);

  // ── Face Status ──────────────────────────────────────────────────────
  const loadFaceStatus = async () => {
    try {
      const r = await fetch(`${BASE}/api/face/status?token=${token}`);
      const d = await r.json();
      setFaceStatus(d);
    } catch { }
  };

  // ── Camera ───────────────────────────────────────────────────────────
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

  // ── Register Face ─────────────────────────────────────────────────────
  const registerFace = async () => {
    setFaceErr("");
    setFrames([]);
    setFaceStep("capturing");

    // Capture 5 frames
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
      // Use the best frame (middle frame)
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

  // ── Profile Update ────────────────────────────────────────────────────
  const updateProfile = async () => {
    setProfileErr("");
    setProfileMsg("");
    if (!name.trim()) { setProfileErr("Name cannot be empty"); return; }
    setProfileLoad(true);
    try {
      const res = await fetch(`${BASE}/api/auth/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, current_password: currentPw, new_password: newPw }),
      }).then(r => r.json());

      if (res.error || res.detail) {
        setProfileErr(res.detail || res.error);
      } else {
        setProfileMsg("✅ Profile updated!");
        onUpdate && onUpdate(res.user);
        setCurrentPw("");
        setNewPw("");
      }
    } catch {
      setProfileErr("Server error");
    }
    setProfileLoad(false);
  };

  const isCapturing  = faceStep === "capturing";
  const isProcessing = faceStep === "processing";
  const isDone       = faceStep === "done";
  const isCamera     = faceStep === "camera" || isCapturing;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={s.h2}>Settings</div>
        <div style={s.muted}>Manage your profile and security</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Profile Card ── */}
        <div style={s.card}>
          <div style={s.h3}>👤 Profile</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>
            Update your name and password
          </div>

          <label style={s.label}>Full Name</label>
          <input style={s.input} value={name}
            onChange={e => setName(e.target.value)}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <label style={s.label}>Email</label>
          <input style={{ ...s.input, opacity: 0.6 }} value={user?.email} disabled />

          <label style={s.label}>Role</label>
          <input style={{ ...s.input, opacity: 0.6 }} value={user?.role?.toUpperCase()} disabled />

          <div style={{ borderTop: `1px solid ${T.border}`, margin: "20px 0", paddingTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Change Password</div>

            <label style={s.label}>Current Password</label>
            <input style={s.input} type="password" placeholder="••••••••"
              value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={s.label}>New Password</label>
            <input style={s.input} type="password" placeholder="••••••••"
              value={newPw} onChange={e => setNewPw(e.target.value)}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />
          </div>

          {profileErr && (
            <div style={{ color: T.red, fontSize: 13, marginBottom: 12,
              padding: "10px 14px", background: "rgba(239,68,68,0.1)",
              borderRadius: 8, border: `1px solid rgba(239,68,68,0.2)` }}>
              {profileErr}
            </div>
          )}
          {profileMsg && (
            <div style={{ color: T.green, fontSize: 13, marginBottom: 12,
              padding: "10px 14px", background: "rgba(34,197,94,0.1)",
              borderRadius: 8, border: `1px solid rgba(34,197,94,0.2)` }}>
              {profileMsg}
            </div>
          )}

          <button style={{ ...s.btn, opacity: profileLoad ? 0.7 : 1 }}
            onClick={updateProfile} disabled={profileLoad}>
            {profileLoad ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* ── Face ID Card ── */}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={s.h3}>🔐 Face ID</div>
            {faceStatus?.registered && (
              <span style={{ ...s.badge, ...s.badgeGreen }}>✅ Registered</span>
            )}
          </div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>
            FaceNet Deep Learning — fully local, banking-grade security
          </div>

          {/* Status */}
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

          {/* Camera Section */}
          {isCamera && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                position: "relative", borderRadius: 12, overflow: "hidden",
                border: `2px solid ${isDone ? T.green : T.accent}`,
                background: "#000", aspectRatio: "4/3", marginBottom: 12
              }}>
                <video ref={videoRef} autoPlay playsInline muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />

                {/* Face guide oval */}
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "55%", aspectRatio: "3/4",
                  border: `2px dashed rgba(255,255,255,0.5)`,
                  borderRadius: "50%", pointerEvents: "none"
                }} />

                {/* Status */}
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

                {/* Frame dots */}
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

              {/* Instructions */}
              <div style={{
                fontSize: 12, color: T.muted, lineHeight: 1.7,
                padding: "10px 14px", background: T.surface,
                borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 12
              }}>
                📋 Sit directly facing the camera · Make sure lighting is good · Move your face slightly
              </div>
            </div>
          )}

          {/* Done message */}
          {isDone && faceMsg && (
            <div style={{
              color: T.green, fontSize: 13, marginBottom: 16,
              padding: "12px 16px", background: "rgba(34,197,94,0.1)",
              borderRadius: 8, border: `1px solid rgba(34,197,94,0.2)`
            }}>
              {faceMsg}
            </div>
          )}

          {/* Error */}
          {faceErr && (
            <div style={{
              color: T.red, fontSize: 13, marginBottom: 16,
              padding: "12px 16px", background: "rgba(239,68,68,0.1)",
              borderRadius: 8, border: `1px solid rgba(239,68,68,0.2)`
            }}>
              {faceErr}
            </div>
          )}

          {/* Buttons */}
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

          {/* Info */}
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
    </div>
  );
}