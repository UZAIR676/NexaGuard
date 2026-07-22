import { useState, useRef, useEffect } from "react";
import { T, s } from "../theme";

export default function Signup({ onAuth, goLogin }) {
  const [step, setStep]     = useState("signup"); // 'signup' | 'otp' | 'face'
  const [form, setForm]     = useState({ name: "", email: "", password: "", confirm: "" });
  const [otp, setOtp]       = useState("");
  const [err, setErr]       = useState("");
  const [msg, setMsg]       = useState("");
  const [loading, setLoading] = useState(false);

  // ── Face registration state ───────────────────────────────────────────
  const [authData, setAuthData]   = useState(null); // { token, user }
  const [faceErr, setFaceErr]     = useState("");
  const [faceMsg, setFaceMsg]     = useState("");
  const [faceLoading, setFaceLoading] = useState(false);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const signup = async () => {
    setErr("");
    if (!form.name || !form.email || !form.password) { setErr("Please fill in all fields."); return; }
    if (form.password !== form.confirm) { setErr("Passwords don't match."); return; }
    if (form.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Signup failed"); return; }
      setStep("otp");
      setMsg(`OTP sent to ${form.email}`);
    } catch { setErr("Cannot connect to server."); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setErr("");
    if (!otp || otp.length !== 6) { setErr("Enter 6 digit OTP"); return; }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Invalid OTP"); return; }
      localStorage.setItem("ng_token", data.token);
      // Don't log the user in yet — face registration is mandatory first.
      setAuthData(data);
      setStep("face");
      startCamera();
    } catch { setErr("Cannot connect to server."); }
    finally { setLoading(false); }
  };

  const resendOtp = async () => {
    setErr(""); setMsg("");
    try {
      const res = await fetch("http://localhost:8000/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Failed"); return; }
      setMsg("New OTP sent to your email!");
    } catch { setErr("Cannot connect to server."); }
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
      setFaceErr("Camera access denied. Face registration is required to create an account — please allow camera access and try again.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stopCamera(), []);

  const captureFrame = () => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width  = videoRef.current.videoWidth  || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  // ── Register face (mandatory — no skip) ───────────────────────────────
  const registerFace = async () => {
    setFaceErr(""); setFaceMsg("Capturing...");
    const image = captureFrame();
    if (!image) { setFaceErr("Could not access camera. Please try again."); return; }

    setFaceLoading(true);
    setFaceMsg("Registering your face...");
    try {
      const res  = await fetch("http://localhost:8000/api/face/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: authData.token, image }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFaceErr(data.detail || "Face registration failed. Make sure your face is clearly visible and try again.");
        setFaceLoading(false);
        return;
      }
      setFaceMsg("✅ Face registered successfully!");
      stopCamera();
      setTimeout(() => onAuth(authData.user), 1000);
    } catch {
      setFaceErr("Could not connect to server.");
    }
    setFaceLoading(false);
  };

  // ── Render: Face Registration Step ─────────────────────────────────────
  if (step === "face") {
    return (
      <div style={s.authWrap}>
        <div style={{ ...s.authLeft, maxWidth: 480 }}>
          <div style={s.logo}>
            <div style={s.logoIcon}>🛡️</div>
            <span style={s.logoText}>NexaGuard</span>
          </div>

          <div style={s.authTitle}>Register Your Face</div>
          <div style={s.authSub}>
            Face ID is required for every NexaGuard account — it protects your funds with banking-grade verification at login.
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

          <div style={{
            background: "rgba(79,142,247,0.1)",
            border: `1px solid rgba(79,142,247,0.2)`,
            borderRadius: 10, padding: "12px 16px",
            fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.6
          }}>
            📋 <strong>Instructions:</strong><br/>
            • Sit directly facing the camera<br/>
            • Make sure you're in good lighting<br/>
            • This step is required and cannot be skipped
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
            Registering as <strong>{authData?.user?.email}</strong>
          </div>
        </div>

        <div style={s.authRight}>
          <div style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>👤</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, color: T.text }}>
              Face ID Protects Your Account
            </div>
            <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 360 }}>
              NexaGuard uses FaceNet Deep Learning to verify your identity at every login — no one can access your account without your face.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.authWrap}>
      <div style={s.authLeft}>
        <div style={s.logo}>
          <div style={s.logoIcon}>🛡️</div>
          <span style={s.logoText}>NexaGuard</span>
        </div>

        {step === "signup" ? (
          <>
            <div style={s.authTitle}>Create account</div>
            <div style={s.authSub}>Start monitoring financial activity with AI.</div>

            <label style={s.label}>Full Name</label>
            <input style={s.input} placeholder="John Smith" value={form.name} onChange={upd("name")}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={s.label}>Email</label>
            <input style={s.input} type="email" placeholder="you@email.com" value={form.email} onChange={upd("email")}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={s.label}>Password</label>
            <input style={s.input} type="password" placeholder="••••••••" value={form.password} onChange={upd("password")}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            <label style={s.label}>Confirm Password</label>
            <input style={s.input} type="password" placeholder="••••••••" value={form.confirm} onChange={upd("confirm")}
              onKeyDown={e => e.key === "Enter" && signup()}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>⚠️ {err}</div>}

            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={signup} disabled={loading}>
              {loading ? "Sending OTP..." : "Create Account →"}
            </button>
            <span style={s.link} onClick={goLogin}>Already have an account? Sign in →</span>
          </>
        ) : (
          <>
            <div style={s.authTitle}>Verify Email</div>
            <div style={s.authSub}>Enter the 6-digit code sent to your email.</div>

            <div style={{ background: "rgba(79,142,247,0.1)", border: `1px solid rgba(79,142,247,0.2)`, borderRadius: 8, padding: "12px 16px", marginBottom: 8, fontSize: 13, color: T.accent }}>
              📧 {msg || `OTP sent to ${form.email}`}
            </div>

            <label style={s.label}>OTP Code</label>
            <input
              style={{ ...s.input, fontSize: 28, fontWeight: 700, textAlign: "center", letterSpacing: 12 }}
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && verifyOtp()}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.border} />

            {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>⚠️ {err}</div>}

            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={verifyOtp} disabled={loading}>
              {loading ? "Verifying..." : "✅ Verify & Continue"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <span style={s.link} onClick={() => { setStep("signup"); setErr(""); setOtp(""); }}>
                ← Back
              </span>
              <span style={s.link} onClick={resendOtp}>
                Resend OTP
              </span>
            </div>
          </>
        )}
      </div>

      <div style={s.authRight}>
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.07 }}
          viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          {[...Array(12)].map((_, i) => <line key={i} x1={50*i} y1="0" x2={50*i} y2="700" stroke={T.accent} strokeWidth="1"/>)}
          {[...Array(15)].map((_, i) => <line key={i} x1="0" y1={50*i} x2="600" y2={50*i} stroke={T.accent} strokeWidth="1"/>)}
        </svg>
        <div style={{ position: "relative", textAlign: "center", zIndex: 1 }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>
            {step === "otp" ? "📧" : "🚀"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12, color: T.text }}>
            {step === "otp" ? "Check Your Email" : "Join NexaGuard"}
          </div>
          <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 360 }}>
            {step === "otp"
              ? "We sent a 6-digit verification code to your email. It expires in 10 minutes."
              : "Get instant access to AI fraud detection and real-time USA market intelligence."}
          </div>
          {step === "signup" && (
            <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16, maxWidth: 300, margin: "40px auto 0" }}>
              {["✅ Real-time fraud detection", "✅ Live USA market data", "✅ AI-powered insights", "✅ Mandatory Face ID security", "✅ Free to use"].map(f => (
                <div key={f} style={{ fontSize: 14, color: T.text, textAlign: "left" }}>{f}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}