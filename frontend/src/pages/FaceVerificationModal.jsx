import { useEffect, useRef, useState } from "react";

const BASE = "http://localhost:8000";
const MAX_RETRIES = 3;

const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(10,12,20,0.82)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "fvFadeIn 0.25s ease",
  },
  card: {
    background: "rgba(18,22,38,0.96)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: "36px 32px 28px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
    position: "relative",
    animation: "fvSlideUp 0.3s ease",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 18,
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: 22,
    cursor: "pointer",
    lineHeight: 1,
    padding: 4,
  },
  title: { fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 24 },
  reason: {
    display: "inline-block",
    background: "rgba(96,165,250,0.12)",
    color: "#60a5fa",
    border: "1px solid rgba(96,165,250,0.25)",
    borderRadius: 8,
    fontSize: 12,
    padding: "4px 10px",
    marginBottom: 20,
    fontWeight: 600,
  },
  videoWrap: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    background: "#0a0c14",
    aspectRatio: "4/3",
    marginBottom: 16,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)",
    display: "block",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    marginBottom: 16,
    minHeight: 22,
  },
  dot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  }),
  btn: (color = "#3b82f6") => ({
    width: "100%",
    padding: "13px 0",
    borderRadius: 12,
    border: "none",
    background: color,
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 10,
    transition: "opacity 0.2s",
  }),
  cancelBtn: {
    width: "100%",
    padding: "11px 0",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    cursor: "pointer",
  },
  successWrap: { textAlign: "center", padding: "20px 0 8px" },
  failWrap: { textAlign: "center", padding: "20px 0 8px" },
};

export default function FaceVerificationModal({ reason = "Security check", onSuccess, onFail }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // phase: "camera" | "capturing" | "verifying" | "success" | "fail" | "error"
  const [phase, setPhase] = useState("camera");
  const [statusMsg, setStatusMsg] = useState("Position your face in the camera");
  const [statusColor, setStatusColor] = useState("#f59e0b");
  const [frames, setFrames] = useState([]);
  const [retriesLeft, setRetriesLeft] = useState(MAX_RETRIES);
  const [errMsg, setErrMsg] = useState("");

  const token = localStorage.getItem("ng_token");

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
      setStatusMsg("Camera ready — click Verify when ready");
      setStatusColor("#22c55e");
    } catch {
      setErrMsg("Camera access denied. Please allow camera.");
      setPhase("error");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const captureFrame = () => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const handleVerify = async () => {
    setErrMsg("");
    setPhase("capturing");
    setFrames([]);

    // Capture 5 frames (same as login)
    const captured = [];
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 800));
      const frame = captureFrame();
      if (frame) captured.push(frame);
      setFrames([...captured]);
      setStatusMsg(`Capturing... ${i + 1}/5`);
      setStatusColor("#f59e0b");
    }

    if (captured.length < 3) {
      setErrMsg("Could not capture enough frames. Please try again.");
      setPhase("camera");
      return;
    }

    setPhase("verifying");
    setStatusMsg("Running liveness check...");
    setStatusColor("#f59e0b");

    try {
      // Step 1: Liveness check
      const livenessRes = await fetch(`${BASE}/api/face/liveness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, frames: captured }),
      }).then((r) => r.json());

      if (!livenessRes.live) {
        const newRetries = retriesLeft - 1;
        setRetriesLeft(newRetries);
        if (newRetries <= 0) {
          stopCamera();
          setPhase("fail");
        } else {
          setErrMsg(`❌ Liveness failed — ${livenessRes.reason}. ${newRetries} attempt${newRetries !== 1 ? "s" : ""} left.`);
          setPhase("camera");
          setStatusMsg("Try again — move your face slightly");
          setStatusColor("#f59e0b");
        }
        return;
      }

      // Step 2: Face verify
      setStatusMsg("Verifying face identity...");
      const verifyRes = await fetch(`${BASE}/api/face/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, image: captured[2] }),
      }).then((r) => r.json());

      if (verifyRes.verified) {
        setStatusMsg(`✅ Face verified! (${(verifyRes.similarity * 100).toFixed(1)}% match)`);
        setStatusColor("#22c55e");
        stopCamera();
        setPhase("success");
        setTimeout(() => onSuccess && onSuccess(), 1500);
      } else {
        const newRetries = retriesLeft - 1;
        setRetriesLeft(newRetries);
        if (newRetries <= 0) {
          stopCamera();
          setPhase("fail");
        } else {
          setErrMsg(
            `❌ Face did not match (${(verifyRes.similarity * 100).toFixed(1)}% similarity). ${newRetries} attempt${newRetries !== 1 ? "s" : ""} left.`
          );
          setPhase("camera");
          setStatusMsg("Please try again");
          setStatusColor("#ef4444");
        }
      }
    } catch {
      setErrMsg("Could not connect to server.");
      setPhase("camera");
    }
  };

  const handleClose = () => {
    stopCamera();
    onFail && onFail();
  };

  return (
    <>
      <style>{`
        @keyframes fvFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fvSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fvPop { 0% { transform: scale(0.6); opacity: 0 } 70% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
      `}</style>

      <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && handleClose()}>
        <div style={S.card}>
          <button style={S.closeBtn} onClick={handleClose}>×</button>

          <div style={S.title}>🛡️ Face Verification</div>
          <div style={S.subtitle}>Required before completing this transaction</div>
          <div style={S.reason}>{reason}</div>

          {/* SUCCESS */}
          {phase === "success" && (
            <div style={S.successWrap}>
              <div style={{ fontSize: 56, animation: "fvPop 0.4s ease" }}>✅</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e", marginTop: 12 }}>Face Verified!</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 8 }}>
                Identity confirmed. Proceeding with transaction…
              </div>
            </div>
          )}

          {/* FAIL */}
          {phase === "fail" && (
            <div style={S.failWrap}>
              <div style={{ fontSize: 56, animation: "fvPop 0.4s ease" }}>❌</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", marginTop: 12 }}>Verification Failed</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "8px 0 24px" }}>
                Maximum attempts reached. Transaction has been blocked.
              </div>
              <button style={S.btn("#ef4444")} onClick={handleClose}>Close</button>
            </div>
          )}

          {/* ERROR */}
          {phase === "error" && (
            <div style={S.failWrap}>
              <div style={{ fontSize: 56 }}>⚠️</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b", marginTop: 12 }}>Setup Error</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "8px 0 24px" }}>{errMsg}</div>
              <button style={S.btn("#f59e0b")} onClick={handleClose}>Close</button>
            </div>
          )}

          {/* CAMERA / CAPTURING / VERIFYING */}
          {(phase === "camera" || phase === "capturing" || phase === "verifying") && (
            <>
              <div style={S.statusBar}>
                <div style={S.dot(statusColor)} />
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{statusMsg}</span>
              </div>

              {/* Video */}
              <div style={S.videoWrap}>
                <video ref={videoRef} autoPlay playsInline muted style={S.video} />

                {/* Face guide oval */}
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "55%", aspectRatio: "3/4",
                  border: `2px dashed ${phase === "verifying" ? "#22c55e" : "rgba(255,255,255,0.35)"}`,
                  borderRadius: "50%", pointerEvents: "none",
                  transition: "border-color 0.3s",
                }} />

                {/* Frame capture dots */}
                <div style={{
                  position: "absolute", top: 12, left: 0, right: 0,
                  display: "flex", justifyContent: "center", gap: 6,
                }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: frames.length > i ? "#22c55e" : "rgba(255,255,255,0.25)",
                      transition: "background 0.3s",
                    }} />
                  ))}
                </div>

                {/* Status overlay during capturing/verifying */}
                {(phase === "capturing" || phase === "verifying") && (
                  <div style={{
                    position: "absolute", bottom: 12, left: 0, right: 0,
                    textAlign: "center",
                  }}>
                    <span style={{
                      background: "rgba(0,0,0,0.7)", color: "#fff",
                      padding: "6px 14px", borderRadius: 20, fontSize: 13,
                    }}>
                      {statusMsg}
                    </span>
                  </div>
                )}
              </div>

              {/* Error message */}
              {errMsg && (
                <div style={{
                  color: "#ef4444", fontSize: 13, marginBottom: 12,
                  padding: "10px 14px", background: "rgba(239,68,68,0.1)",
                  borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)",
                }}>
                  {errMsg}
                </div>
              )}

              {/* Verify button */}
              <button
                style={{
                  ...S.btn("#3b82f6"),
                  opacity: phase !== "camera" ? 0.6 : 1,
                  cursor: phase !== "camera" ? "not-allowed" : "pointer",
                }}
                onClick={handleVerify}
                disabled={phase !== "camera"}
              >
                {phase === "capturing"
                  ? `Capturing ${frames.length}/5...`
                  : phase === "verifying"
                  ? "Verifying..."
                  : "🔍 Verify My Face"}
              </button>

              <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                {retriesLeft < MAX_RETRIES
                  ? `${retriesLeft} attempt${retriesLeft !== 1 ? "s" : ""} remaining`
                  : `${MAX_RETRIES} attempts allowed`}
              </div>

              <button style={S.cancelBtn} onClick={handleClose}>
                Cancel transaction
              </button>

              {/* Tips */}
              <div style={{
                marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.25)",
                lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12,
              }}>
                💡 Sit directly facing the camera · Good lighting · Move face slightly for liveness check
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}