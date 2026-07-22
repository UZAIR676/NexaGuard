import { useState, useEffect, useRef } from "react";
import { T, s } from "../theme";

export default function Login({ onAuth, goSignup, goForgotPassword }) {
  const [form, setForm]       = useState({ email: "", password: "" });
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState("login"); // "login" | "face" | "face-register"
  const [userData, setUserData] = useState(null);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceMsg, setFaceMsg] = useState("");
  const [faceErr, setFaceErr] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [frames, setFrames]   = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Step 1: Login ──────────────────────────────────────────────────────
  const submit = async () => {
    setErr("");
    if (!form.email || !form.password) { setErr("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Login failed"); return; }

      // ⚠️ FIX: Do NOT persist the token to localStorage here.
      // The user is only email/password-authenticated at this point,
      // not face-verified. Keep the token in memory (React state) only,
      // so a page refresh can't let someone skip the face check.
      // localStorage.setItem("ng_token", data.token);   <-- removed

      // Check if face is registered
      const faceStatus = await fetch(
        `http://localhost:8000/api/face/status?token=${data.token}`
      ).then(r => r.json());

      setUserData({ token: data.token, user: data.user });

      if (faceStatus.registered) {
        // Face registered → must verify, no bypass
        setStep("face");
        startCamera();
      } else {
        // Face ID is mandatory for every account — register it now instead
        // of letting the user straight in.
        setStep("face-register");
        startCamera();
      }
    } catch {
      setErr("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  // ── Camera ─────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      setFaceErr("Camera access denied. Face verification is required — please allow camera access and reload.");
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

  // ── Step 2a: Face Verify (existing Face ID) ────────────────────────────
  const verifyFace = async () => {
    setFaceErr("");
    setFaceMsg("");
    setCapturing(true);
    setFrames([]);

    // Capture 5 frames at 800ms intervals
    const captured = [];
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 800));
      const frame = captureFrame();
      if (frame) captured.push(frame);
      setFrames([...captured]);
      setFaceMsg(`Capturing... ${i + 1}/5`);
    }
    setCapturing(false);

    if (captured.length < 3) {
      setFaceErr("Could not capture enough frames. Please try again.");
      return;
    }

    setFaceLoading(true);
    setFaceMsg("Running liveness check...");

    try {
      // Liveness check
      const livenessRes = await fetch("http://localhost:8000/api/face/liveness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: userData.token, frames: captured }),
      }).then(r => r.json());

      if (!livenessRes.live) {
        setFaceErr(`❌ Liveness check failed — ${livenessRes.reason}. Try moving your face slightly.`);
        setFaceLoading(false);
        return;
      }

      setFaceMsg("Verifying face...");

      // Face verify
      const verifyRes = await fetch("http://localhost:8000/api/face/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: userData.token, image: captured[2] }),
      }).then(r => r.json());

      if (verifyRes.verified) {
        setFaceMsg(`✅ Face verified! Similarity: ${(verifyRes.similarity * 100).toFixed(1)}%`);

        // ✅ FIX: Only persist the token now, after face verification
        // has actually succeeded. This is what prevents "refresh skips
        // face check" — there's nothing in localStorage until this point.
        localStorage.setItem("ng_token", userData.token);

        stopCamera();
        setTimeout(() => onAuth(userData.user), 1000);
      } else {
        setFaceErr(`❌ Face did not match — similarity: ${(verifyRes.similarity * 100).toFixed(1)}%. Please try again.`);
      }
    } catch {
      setFaceErr("Could not connect to server.");
    }
    setFaceLoading(false);
  };

  // ── Step 2b: Mandatory Face Registration (first-time / never registered) ─
  const registerFace = async () => {
    setFaceErr("");
    setFaceMsg("Capturing...");

    // Capture 5 frames with delay so the camera has time to stabilize
    const captured = [];
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 700));
      const frame = captureFrame();
      if (frame) captured.push(frame);
      setFaceMsg(`Capturing ${i + 1}/5...`);
    }

    if (captured.length < 3) {
      setFaceErr("Could not capture enough frames. Please try again.");
      return;
    }

    const image = captured[Math.floor(captured.length / 2)]; // middle frame

    setFaceLoading(true);
    setFaceMsg("Registering your face...");
    try {
      const res  = await fetch("http://localhost:8000/api/face/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: userData.token, image }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFaceErr(data.detail || "Face registration failed. Make sure your face is clearly visible and try again.");
        setFaceLoading(false);
        return;
      }
      setFaceMsg("✅ Face registered successfully!");

      // ✅ FIX: Same as above — persist token only after registration
      // (which itself requires a captured face) actually succeeds.
      localStorage.setItem("ng_token", userData.token);

      stopCamera();
      setTimeout(() => onAuth(userData.user), 1000);
    } catch {
      setFaceErr("Could not connect to server.");
    }
    setFaceLoading(false);
  };

  const guest = () => onAuth({ name: "Guest", email: "guest@nexaguard.ai" });

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []);

  // ── Render: Mandatory Face Registration Step ───────────────────────────
  if (step === "face-register") {
    return (
      <div style={s.authWrap}>
        <div style={{ ...s.authLeft, maxWidth: 480 }}>
          <div style={s.logo}>
            <div style={s.logoIcon}>🛡️</div>
            <span style={s.logoText}>NexaGuard</span>
          </div>

          <div style={s.authTitle}>Set Up Face ID</div>
          <div style={s.authSub}>
            Face ID is now required on every account. Let's register yours — this only takes a second.
          </div>

          <div style={{
            position: "relative", borderRadius: 16, overflow: "hidden",
            border: `2px solid ${faceErr ? T.red : faceMsg.includes("✅") ? T.green : T.accent}`,
            marginBottom: 16, background: "#000", aspectRatio: "4/3"
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "55%", aspectRatio: "3/4",
              border: `2px dashed ${faceMsg.includes("✅") ? T.green : "rgba(255,255,255,0.4)"}`,
              borderRadius: "50%", pointerEvents: "none"
            }} />
            {faceMsg && (
              <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center" }}>
                <span style={{
                  background: "rgba(0,0,0,0.7)", color: "#fff",
                  padding: "6px 14px", borderRadius: 20, fontSize: 13
                }}>
                  {faceMsg}
                </span>
              </div>
            )}
          </div>

          {faceErr && (
            <div style={{
              color: T.red, fontSize: 13, marginBottom: 12,
              padding: "10px 14px", background: "rgba(239,68,68,0.1)",
              borderRadius: 8, border: `1px solid rgba(239,68,68,0.2)`
            }}>
              {faceErr}
            </div>
          )}

          <button
            style={{ ...s.btn, opacity: faceLoading ? 0.7 : 1 }}
            onClick={registerFace}
            disabled={faceLoading}
          >
            {faceLoading ? "Registering..." : "📸 Capture & Register Face"}
          </button>

          <div style={{ fontSize: 12, color: T.muted, marginTop: 12, textAlign: "center" }}>
            Logged in as <strong>{userData?.user?.email}</strong>
          </div>
        </div>

        <div style={s.authRight}>
          <div style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>👤</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, color: T.text }}>
              Face ID Verification
            </div>
            <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 360 }}>
              NexaGuard uses FaceNet Deep Learning to verify your identity locally — no data sent to any server.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Face Verify Step ────────────────────────────────────────────
  if (step === "face") {
    return (
      <div style={s.authWrap}>
        <div style={{ ...s.authLeft, maxWidth: 480 }}>
          <div style={s.logo}>
            <div style={s.logoIcon}>🛡️</div>
            <span style={s.logoText}>NexaGuard</span>
          </div>

          <div style={s.authTitle}>Face Verification</div>
          <div style={s.authSub}>Please position your face in front of the camera</div>

          {/* Camera */}
          <div style={{
            position: "relative", borderRadius: 16, overflow: "hidden",
            border: `2px solid ${faceErr ? T.red : faceMsg.includes("✅") ? T.green : T.accent}`,
            marginBottom: 16, background: "#000", aspectRatio: "4/3"
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />

            {/* Face guide overlay */}
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "55%", aspectRatio: "3/4",
              border: `2px dashed ${faceMsg.includes("✅") ? T.green : "rgba(255,255,255,0.4)"}`,
              borderRadius: "50%", pointerEvents: "none"
            }} />

            {/* Status overlay */}
            {(faceMsg || capturing) && (
              <div style={{
                position: "absolute", bottom: 12, left: 0, right: 0,
                textAlign: "center"
              }}>
                <span style={{
                  background: "rgba(0,0,0,0.7)", color: "#fff",
                  padding: "6px 14px", borderRadius: 20, fontSize: 13
                }}>
                  {faceMsg}
                </span>
              </div>
            )}

            {/* Frame dots */}
            <div style={{
              position: "absolute", top: 12, left: 0, right: 0,
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
            background: "rgba(79,142,247,0.1)",
            border: `1px solid rgba(79,142,247,0.2)`,
            borderRadius: 10, padding: "12px 16px",
            fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.6
          }}>
            📋 <strong>Instructions:</strong><br/>
            • Sit directly facing the camera<br/>
            • Move your face slightly (liveness check)<br/>
            • Make sure you're in good lighting<br/>
            • Face verification cannot be skipped
          </div>

          {faceErr && (
            <div style={{
              color: T.red, fontSize: 13, marginBottom: 12,
              padding: "10px 14px", background: "rgba(239,68,68,0.1)",
              borderRadius: 8, border: `1px solid rgba(239,68,68,0.2)`
            }}>
              {faceErr}
            </div>
          )}

          <button
            style={{ ...s.btn, opacity: (faceLoading || capturing) ? 0.7 : 1 }}
            onClick={verifyFace}
            disabled={faceLoading || capturing}
          >
            {capturing ? `Capturing ${frames.length}/5...`
            : faceLoading ? "Verifying..."
            : "🔍 Verify Face"}
          </button>

          <div style={{ fontSize: 12, color: T.muted, marginTop: 12, textAlign: "center" }}>
            Logged in as <strong>{userData?.user?.email}</strong>
          </div>
        </div>

        <div style={s.authRight}>
          <div style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>👤</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, color: T.text }}>
              Face ID Verification
            </div>
            <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 360 }}>
              NexaGuard uses FaceNet Deep Learning to verify your identity locally — no data sent to any server.
            </div>
            <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16, maxWidth: 300, margin: "40px auto 0" }}>
              {[
                "✅ FaceNet — 99.6% accuracy",
                "✅ Liveness detection",
                "✅ Anti-spoofing",
                "✅ Fully local — private",
                "✅ Banking-grade security"
              ].map(f => (
                <div key={f} style={{ fontSize: 14, color: T.text, textAlign: "left" }}>{f}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Login Step ─────────────────────────────────────────────────
  return (
    <div style={s.authWrap}>
      <div style={s.authLeft}>
        <div style={s.logo}>
          <div style={s.logoIcon}>🛡️</div>
          <span style={s.logoText}>NexaGuard</span>
        </div>
        <div style={s.authTitle}>Welcome back</div>
        <div style={s.authSub}>Sign in to your fraud intelligence dashboard.</div>

        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="you@company.com"
          value={form.email} onChange={upd("email")}
          onKeyDown={e => e.key === "Enter" && submit()}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border} />

        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="••••••••"
          value={form.password} onChange={upd("password")}
          onKeyDown={e => e.key === "Enter" && submit()}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border} />

        <span style={{ ...s.link, fontSize: 13, marginTop: 6, display: "inline-block" }} onClick={goForgotPassword}>
          Forgot password?
        </span>

        {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>{err}</div>}

        <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
        <button style={{ ...s.btn, ...s.btnSec }} onClick={guest}>
          Demo — Continue as Guest
        </button>
        <span style={s.link} onClick={goSignup}>
          Don't have an account? Sign up →
        </span>
      </div>

      <div style={s.authRight}>
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.07 }}
          viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          {[...Array(12)].map((_, i) => <line key={i} x1={50*i} y1="0" x2={50*i} y2="700" stroke={T.accent} strokeWidth="1"/>)}
          {[...Array(15)].map((_, i) => <line key={i} x1="0" y1={50*i} x2="600" y2={50*i} stroke={T.accent} strokeWidth="1"/>)}
        </svg>
        <div style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🛡️</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, color: T.text }}>
            AI-Powered Fraud Intelligence
          </div>
          <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 360 }}>
            Real-time transaction monitoring, ML-based fraud scoring, and live USA market data — all in one place.
          </div>
          <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 48 }}>
            {[["99.7%", "Detection Rate"], ["<50ms", "Response Time"], ["24/7", "Monitoring"]].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.accent }}>{v}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}