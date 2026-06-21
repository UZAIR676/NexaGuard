import { useState, useEffect, useRef } from "react";
import { T, s } from "../theme";

const BASE = "http://localhost:8000";

const SUGGESTIONS = [
  "Should I buy AAPL?",
  "TSLA vs NVDA compare karo",
  "Technology sector analysis",
  "MSFT long term investment?",
  "AI stocks best kaunse hain?",
  "AMZN abhi kesa hai?",
];

export default function AIAdvisor({ user }) {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: `Hello ${user?.name || ""}! 👋 I'm NexaGuard AI — your personal financial advisor.\n\nI have access to **real-time stock data** and can help you with:\n• 📈 Stock analysis & recommendations\n• 🔄 Stock comparisons\n• 🏢 Sector trends\n• 💼 Portfolio advice\n\nWhat would you like to know?`,
    }
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sessionId]             = useState(`session_${Date.now()}`);
  const bottomRef               = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text: msg }]);
    setLoading(true);
    setStreaming(true);

    // Add empty AI message for streaming
    setMessages(m => [...m, { role: "ai", text: "" }]);

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

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullText += data.token;
              // Update last AI message
              setMessages(m => {
                const updated = [...m];
                updated[updated.length - 1] = { role: "ai", text: fullText };
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
        updated[updated.length - 1] = { role: "ai", text: "⚠️ Cannot connect to AI. Make sure backend is running." };
        return updated;
      });
    }
    setLoading(false);
    setStreaming(false);
  };

  const clearChat = async () => {
    await fetch(`${BASE}/api/ai/chat/${sessionId}`, { method: "DELETE" });
    setMessages([{ role: "ai", text: `Chat cleared! How can I help you? 🛡️` }]);
  };

  const formatText = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={s.h2}>🤖 AI Stock Advisor</div>
          <div style={s.muted}>Powered by Qwen2.5 + Live Market Data — Real-time intelligence</div>
        </div>
        <button onClick={clearChat} style={{ ...s.navItem, fontSize: 12, padding: "6px 14px" }}>
          🗑️ Clear Chat
        </button>
      </div>

      {/* Chat window */}
      <div style={{
        flex: 1, overflowY: "auto", background: T.card,
        border: `1px solid ${T.border}`, borderRadius: 12,
        padding: 20, marginBottom: 16,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex", gap: 12,
            flexDirection: m.role === "user" ? "row-reverse" : "row",
            alignItems: "flex-start",
          }}>
            {/* Avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: m.role === "ai" ? "rgba(79,142,247,0.2)" : "rgba(34,197,94,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>
              {m.role === "ai" ? "🤖" : "👤"}
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: "75%", padding: "12px 16px", borderRadius: 12,
              background: m.role === "ai" ? T.surface : "rgba(79,142,247,0.15)",
              border: `1px solid ${m.role === "ai" ? T.border : "rgba(79,142,247,0.3)"}`,
              fontSize: 14, lineHeight: 1.7, color: T.text,
            }}>
              {m.text === "" && streaming ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: T.accent, opacity: 0.7,
                    }} />
                  ))}
                  <span style={{ fontSize: 12, color: T.muted, marginLeft: 4 }}>Analyzing...</span>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: formatText(m.text) }} />
              )}
              {/* Streaming cursor */}
              {streaming && i === messages.length - 1 && m.role === "ai" && m.text && (
                <span style={{ display: "inline-block", width: 2, height: 14, background: T.accent, marginLeft: 2, animation: "blink 1s infinite" }} />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {SUGGESTIONS.map(sg => (
          <button key={sg} onClick={() => send(sg)} disabled={loading}
            style={{ ...s.navItem, fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap", opacity: loading ? 0.5 : 1 }}>
            {sg}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          style={{ ...s.input, flex: 1, marginTop: 0, padding: "12px 16px", fontSize: 14 }}
          placeholder="Ask about any stock... e.g. 'Should I buy AAPL?'"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !loading && send()}
          onFocus={e => e.target.style.borderColor = T.accent}
          onBlur={e => e.target.style.borderColor = T.border}
          disabled={loading}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{ ...s.btn, width: "auto", padding: "0 24px", marginTop: 0, opacity: loading || !input.trim() ? 0.5 : 1 }}>
          {loading ? "..." : "Send ↑"}
        </button>
      </div>
    </div>
  );
}