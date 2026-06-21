from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests
import json

from services.market_data import get_quote, get_batch_quotes, SP500_TOP50

router = APIRouter(prefix="/api/ai", tags=["ai"])

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen2.5:7b"

chat_sessions = {}

def get_history(session_id: str):
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    return chat_sessions[session_id]

SECTOR_MAP = {
    "technology":    ["AAPL", "MSFT", "NVDA", "AMD", "GOOGL"],
    "tech":          ["AAPL", "MSFT", "NVDA", "AMD", "GOOGL"],
    "semiconductor": ["NVDA", "AMD", "INTC", "QCOM", "AVGO"],
    "ev":            ["TSLA", "NIO"],
    "electric":      ["TSLA", "NIO"],
    "finance":       ["JPM", "BAC", "GS", "V", "MA"],
    "financial":     ["JPM", "BAC", "GS", "V", "MA"],
    "banking":       ["JPM", "BAC", "GS"],
    "energy":        ["XOM", "CVX"],
    "healthcare":    ["JNJ", "PFE", "UNH"],
    "pharma":        ["JNJ", "PFE"],
    "retail":        ["WMT", "COST", "AMZN"],
    "ecommerce":     ["AMZN", "SHOP"],
    "crypto":        ["COIN", "HOOD"],
    "social":        ["META", "SNAP"],
    "streaming":     ["NFLX", "SPOT", "ROKU"],
    "ai":            ["NVDA", "MSFT", "GOOGL", "AMD", "PLTR"],
    "amazon":    ["AMZN"],
    "apple":     ["AAPL"],
    "microsoft": ["MSFT"],
    "google":    ["GOOGL"],
    "alphabet":  ["GOOGL"],
    "tesla":     ["TSLA"],
    "nvidia":    ["NVDA"],
    "meta":      ["META"],
    "netflix":   ["NFLX"],
    "intel":     ["INTC"],
    "qualcomm":  ["QCOM"],
    "broadcom":  ["AVGO"],
    "walmart":   ["WMT"],
    "jpmorgan":  ["JPM"],
    "goldman":   ["GS"],
    "palantir":  ["PLTR"],
}

KNOWN_SYMBOLS = set(SP500_TOP50 + [
    "GOOG", "NFLX", "CRM", "ORCL", "ADBE", "PYPL", "SHOP",
    "GS", "V", "MA", "CVX", "PFE", "WMT", "COST", "DIS",
    "UBER", "LYFT", "SNAP", "SPOT", "SQ", "ROKU",
    "PLTR", "COIN", "HOOD", "SOFI", "NIO", "BABA", "JD", "PDD", "BIDU",
])

def extract_symbols(text: str) -> list:
    text_lower = text.lower()
    symbols = set()
    for word in text.upper().split():
        clean = word.strip("?,!.()")
        if clean in KNOWN_SYMBOLS:
            symbols.add(clean)
    for keyword, stocks in SECTOR_MAP.items():
        if keyword in text_lower:
            symbols.update(stocks)
    return list(symbols)[:5]

def build_stock_context(symbols: list) -> str:
    if not symbols:
        return ""
    lines = []
    quotes = get_batch_quotes(symbols)
    for q in quotes:
        if "error" in q:
            continue
        sym = q.get("symbol", "")
        price = q.get("price", "N/A")
        change_pct = q.get("change_pct", 0)
        change = q.get("change", 0)
        signal = q.get("signal", "")
        direction = "UP ▲" if change_pct >= 0 else "DOWN ▼"

        full = get_quote(sym)
        high52 = full.get("52w_high", "N/A")
        low52  = full.get("52w_low", "N/A")
        mktcap = full.get("market_cap")
        cap_str = f"${mktcap/1e9:.1f}B" if mktcap else "N/A"

        # How far from 52W high/low (useful for buy/sell decision)
        try:
            from_high = round(((price - high52) / high52) * 100, 1)
            from_low  = round(((price - low52)  / low52)  * 100, 1)
            position  = f"{from_high}% from 52W high | +{from_low}% from 52W low"
        except:
            position = ""

        lines.append(
            f"  {sym}:\n"
            f"    Current Price : ${price}\n"
            f"    Today         : {direction} {abs(change_pct)}% (${change})\n"
            f"    52W Range     : ${low52} – ${high52}\n"
            f"    Position      : {position}\n"
            f"    Market Cap    : {cap_str}\n"
            f"    NexaGuard Signal: {signal}"
        )
    return "\n".join(lines)

# ── System Prompt ──────────────────────────────────────────────────────────
SYSTEM = """You are NexaGuard AI — a sharp, data-driven financial advisor. You speak in the same language the user writes in (Urdu, English, or mix).

== CRITICAL RULES ==
1. When "=== LIVE MARKET DATA ===" is in the message, ALWAYS start your reply with the exact current price. Example: "AMZN abhi $244.39 pe trade ho raha hai, aaj +2.08% upar hai."
2. Use ONLY the numbers from the LIVE DATA block — never invent prices.
3. If NO live data exists, say so clearly and give general analysis only.

== RESPONSE STRUCTURE (follow this order) ==
📍 Current price + today's movement
📊 52W position — near high or low? What does it mean?
🎯 BUY / HOLD / SELL — clear signal with 2-3 sentence reasoning
⚡ Key risk or opportunity to watch
🧠 NexaGuard sees the data — you make the move.

Keep response under 220 words. Use emojis. Be direct and confident."""

class ChatIn(BaseModel):
    message: str
    session_id: str = "default"

def stream_ollama(messages: list, history: list, original_msg: str):
    full_reply = ""
    try:
        res = requests.post(
            OLLAMA_URL,
            json={"model": MODEL, "messages": messages, "stream": True},
            stream=True,
            timeout=120,
        )
        for line in res.iter_lines():
            if not line:
                continue
            chunk = json.loads(line.decode("utf-8"))
            token = chunk.get("message", {}).get("content", "")
            if token:
                full_reply += token
                yield f"data: {json.dumps({'token': token})}\n\n"
            if chunk.get("done", False):
                break
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    finally:
        if full_reply:
            history.append({"role": "user", "text": original_msg})
            history.append({"role": "assistant", "text": full_reply})
        yield f"data: {json.dumps({'done': True})}\n\n"

@router.post("/chat")
def ai_chat(body: ChatIn):
    history = get_history(body.session_id)
    symbols = extract_symbols(body.message)
    stock_context = build_stock_context(symbols)

    if stock_context:
        user_msg = (
            f"{body.message}\n\n"
            f"=== LIVE MARKET DATA ===\n"
            f"{stock_context}\n"
            f"=== END ===\n\n"
            f"Answer in the same language as the user's question. Quote exact prices from live data."
        )
    else:
        user_msg = (
            f"{body.message}\n\n"
            f"[NO LIVE DATA — tell user and give general analysis only]"
        )

    messages = [{"role": "system", "content": SYSTEM}]
    for h in history[-8:]:
        messages.append({"role": h["role"], "content": h["text"]})
    messages.append({"role": "user", "content": user_msg})

    return StreamingResponse(
        stream_ollama(messages, history, body.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@router.delete("/chat/{session_id}")
def clear_chat(session_id: str):
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"success": True}