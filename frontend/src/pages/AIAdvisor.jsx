import { useState, useEffect, useRef, useCallback } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

// ─── Suggestion categories ────────────────────────────────────────────────────
const SUGGESTION_GROUPS = [
  {
    label: "Stocks",
    icon: "📈",
    items: ["Should I buy AAPL?", "AMZN abhi kesa hai?", "MSFT long term?"],
  },
  {
    label: "Compare",
    icon: "⚖️",
    items: ["TSLA vs NVDA", "GOOGL vs META", "AMD vs INTC"],
  },
  {
    label: "Sectors",
    icon: "🏢",
    items: ["AI stocks best kaunse?", "Technology sector analysis", "Energy sector outlook"],
  },
];

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  radius: { sm: 8, md: 12, lg: 16 },
  transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
  userBubble: "rgba(96,165,250,0.13)",
  userBorder: "rgba(96,165,250,0.28)",
  aiBubble: "rgba(255,255,255,0.04)",
  aiBorder: "rgba(255,255,255,0.09)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#e2e8f0'>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code style='background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace'>$1</code>")
    .replace(/•\s/g, "<span style='color:#60a5fa;margin-right:4px'>•</span>")
    .replace(/\n/g, "<br/>");
}

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Typing dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#60a5fa",
          animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <span style={{ fontSize: 11, color: "#60a5fa", marginLeft: 6, fontWeight: 600, letterSpacing: "0.3px" }}>
        Analyzing market data…
      </span>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, isLast, streaming }) {
  const isAI = msg.role === "ai";
  return (
    <div style={{
      display: "flex",
      flexDirection: isAI ? "row" : "row-reverse",
      gap: 10,
      alignItems: "flex-end",
      maxWidth: "100%",
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: isAI ? "rgba(96,165,250,0.15)" : "rgba(74,222,128,0.15)",
        border: `1.5px solid ${isAI ? "rgba(96,165,250,0.3)" : "rgba(74,222,128,0.3)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15,
      }}>
        {isAI ? "🤖" : "👤"}
      </div>

      {/* Content */}
      <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 4, alignItems: isAI ? "flex-start" : "flex-end" }}>
        <div style={{
          padding: "11px 15px",
          borderRadius: isAI ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
          background: isAI ? D.aiBubble : D.userBubble,
          border: `1px solid ${isAI ? D.aiBorder : D.userBorder}`,
          fontSize: 13.5, lineHeight: 1.7, color: "#cbd5e1",
          backdropFilter: "blur(4px)",
          boxShadow: isAI ? "none" : "0 2px 12px rgba(96,165,250,0.08)",
        }}>
          {msg.text === "" && streaming && isLast ? (
            <TypingDots />
          ) : (
            <>
              <div dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
              {streaming && isLast && isAI && msg.text && (
                <span style={{
                  display: "inline-block", width: 2, height: 13,
                  background: "#60a5fa", marginLeft: 2, borderRadius: 1,
                  animation: "blink 0.9s step-end infinite",
                }} />
              )}
            </>
          )}
        </div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", paddingLeft: 4, paddingRight: 4 }}>
          {msg.time}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIAdvisor({ user }) {
  const [messages, setMessages] = useState([
   {
  role: "ai",
  time: timeLabel(),
  text: `Hello ${user?.name || ""}! 👋 I'm **NexaGuard AI** — your personal financial advisor.

I have access to real-time market data and can help you with:
• 📈 Stock analysis & buy/sell recommendations
• ⚖️ Side-by-side stock comparisons
• 🏢 Sector and industry trends
• 💼 Portfolio strategy and investment advice

Ask me about any stock, and I'll help you make informed investment decisions!`,
},
  ]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sessionId]               = useState(`session_${Date.now()}`);
  const [activeGroup, setActiveGroup] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [charCount, setCharCount] = useState(0);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput(""); setCharCount(0);
    setShowSuggestions(false);
    setMessages(m => [...m, { role: "user", text: msg, time: timeLabel() }]);
    setLoading(true); setStreaming(true);
    setMessages(m => [...m, { role: "ai", text: "", time: timeLabel() }]);

    try {
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, session_id: sessionId }),
      });

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullText += data.token;
              setMessages(m => {
                const updated = [...m];
                updated[updated.length - 1] = { role: "ai", text: fullText, time: updated[updated.length - 1].time };
                return updated;
              });
            }
            if (data.done || data.error) break;
          } catch {}
        }
      }
    } catch {
      setMessages(m => {
        const updated = [...m];
        updated[updated.length - 1] = {
          role: "ai",
          text: "⚠️ Backend se connection nahi ho raha. Please check karein ke server chal raha hai.",
          time: updated[updated.length - 1].time,
        };
        return updated;
      });
    }
    setLoading(false); setStreaming(false);
  }, [input, loading, sessionId]);

  const clearChat = async () => {
    await fetch(`${BASE}/api/ai/chat/${sessionId}`, { method: "DELETE" }).catch(() => {});
    setMessages([{ role: "ai", time: timeLabel(), text: "Chat clear ho gaya! Ab kya poochna hai? 🛡️" }]);
    setShowSuggestions(true);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Styles ──
  const headerBtn = (active = false) => ({
    padding: "5px 12px", borderRadius: 8, border: `1px solid ${active ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.1)"}`,
    background: active ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)",
    color: active ? "#60a5fa" : "rgba(255,255,255,0.5)",
    fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 500,
    transition: D.transition, display: "flex", alignItems: "center", gap: 5,
  });

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column", gap: 0 }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .msg-enter { animation: fadeUp 0.22s ease forwards; }
        textarea:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.5px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg,rgba(96,165,250,0.25),rgba(167,139,250,0.25))",
              border: "1px solid rgba(96,165,250,0.3)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>🤖</span>
            AI Stock Advisor
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3, marginLeft: 42 }}>
            Powered by Groq (Llama 3.3 70B) · Real-time market data
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={clearChat} style={headerBtn()}>
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* ── Chat area ── */}
      <div style={{ flex: 1, display: "flex", gap: 12, minHeight: 0 }}>
        <div style={{
          flex: 1, overflowY: "auto",
          background: "rgba(255,255,255,0.015)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: D.radius.lg,
          padding: "20px 18px",
          display: "flex", flexDirection: "column", gap: 18,
        }}>
          {messages.map((m, i) => (
            <div key={i} className="msg-enter">
              <Bubble msg={m} isLast={i === messages.length - 1} streaming={streaming} />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Suggestions ── */}
      {showSuggestions && (
        <div style={{ marginTop: 12 }}>
          {/* Group tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {SUGGESTION_GROUPS.map((g, i) => (
              <button key={i} onClick={() => setActiveGroup(i)} style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${activeGroup === i ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.08)"}`,
                background: activeGroup === i ? "rgba(96,165,250,0.12)" : "transparent",
                color: activeGroup === i ? "#60a5fa" : "rgba(255,255,255,0.4)",
                transition: D.transition,
              }}>
                {g.icon} {g.label}
              </button>
            ))}
          </div>
          {/* Suggestion pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SUGGESTION_GROUPS[activeGroup].items.map(sg => (
              <button key={sg} onClick={() => send(sg)} disabled={loading} style={{
                padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.65)", fontWeight: 500,
                opacity: loading ? 0.4 : 1,
                transition: D.transition,
                display: "flex", alignItems: "center", gap: 5,
              }}>
                ↗ {sg}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input area ── */}
      <div style={{
        marginTop: 10,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid rgba(255,255,255,0.1)`,
        borderRadius: D.radius.lg,
        padding: "10px 14px",
        display: "flex", flexDirection: "column", gap: 8,
        transition: D.transition,
      }}>
        <textarea
          ref={inputRef}
          rows={2}
          style={{
            width: "100%", resize: "none", background: "transparent",
            border: "none", color: "#e2e8f0", fontSize: 13.5, lineHeight: 1.6,
            fontFamily: "inherit", caretColor: "#60a5fa",
            placeholder: "rgba(255,255,255,0.2)",
          }}
          placeholder="Koi bhi stock ke baare mein puchho… (Enter = send, Shift+Enter = new line)"
          value={input}
          onChange={e => { setInput(e.target.value); setCharCount(e.target.value.length); }}
          onKeyDown={handleKey}
          disabled={loading}
        />

        {/* Bottom bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
              {charCount > 0 ? `${charCount} chars` : "Enter ↵ to send"}
            </span>
            {!showSuggestions && (
              <button onClick={() => setShowSuggestions(true)} style={{
                fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none",
                cursor: "pointer", padding: 0,
              }}>
                💡 Suggestions
              </button>
            )}
          </div>

          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              padding: "7px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              border: "none",
              background: loading || !input.trim()
                ? "rgba(255,255,255,0.06)"
                : "linear-gradient(135deg,#3b82f6,#6366f1)",
              color: loading || !input.trim() ? "rgba(255,255,255,0.3)" : "#fff",
              transition: D.transition,
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: !loading && input.trim() ? "0 4px 14px rgba(59,130,246,0.35)" : "none",
            }}>
            {loading ? (
              <>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                Thinking…
              </>
            ) : (
              <>Send ↑</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}