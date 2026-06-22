from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests
import json

from services.market_data import get_quote, get_batch_quotes, SP500_TOP50
from services.technical_indicators import analyze_stock

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
    "amazon":    ["AMZN"],  "apple":    ["AAPL"],
    "microsoft": ["MSFT"],  "google":   ["GOOGL"],
    "alphabet":  ["GOOGL"], "tesla":    ["TSLA"],
    "nvidia":    ["NVDA"],  "meta":     ["META"],
    "netflix":   ["NFLX"],  "intel":    ["INTC"],
    "qualcomm":  ["QCOM"],  "broadcom": ["AVGO"],
    "walmart":   ["WMT"],   "jpmorgan": ["JPM"],
    "goldman":   ["GS"],    "palantir": ["PLTR"],
}

KNOWN_SYMBOLS = set(SP500_TOP50 + [
    "GOOG","NFLX","CRM","ORCL","ADBE","PYPL","SHOP",
    "GS","V","MA","CVX","PFE","WMT","COST","DIS",
    "UBER","LYFT","SNAP","SPOT","SQ","ROKU",
    "PLTR","COIN","HOOD","SOFI","NIO","BABA","JD","PDD","BIDU",
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
    return list(symbols)[:3]

def build_context(symbols: list) -> str:
    if not symbols:
        return ""

    blocks = []
    quotes = get_batch_quotes(symbols)
    quote_map = {q["symbol"]: q for q in quotes if "error" not in q}

    for sym in symbols:
        q         = quote_map.get(sym, {})
        full      = get_quote(sym)
        price     = q.get("price", "N/A")
        chg       = q.get("change_pct", 0)
        direction = "UP ▲" if chg >= 0 else "DOWN ▼"
        high52    = full.get("52w_high", "N/A")
        low52     = full.get("52w_low", "N/A")
        mktcap    = full.get("market_cap")
        cap_str   = f"${mktcap/1e9:.1f}B" if mktcap else "N/A"

        # Technical Analysis
        tech         = analyze_stock(sym)
        tech_sum     = tech.get("summary_dict", {})
        tech_score   = tech_sum.get("score", "N/A") if isinstance(tech_sum, dict) else "N/A"
        tech_signal  = tech_sum.get("signal", "N/A") if isinstance(tech_sum, dict) else "N/A"
        tech_trend   = tech_sum.get("trend", "N/A")  if isinstance(tech_sum, dict) else "N/A"
        rsi          = tech.get("rsi", "N/A")
        macd         = tech.get("macd", {}).get("crossover", "N/A") if isinstance(tech.get("macd"), dict) else "N/A"

        # ML Prediction
        try:
            ml_res = requests.get(
                f"http://localhost:8000/api/ml/predict/{sym}", timeout=5
            ).json()
            if "signal" in ml_res:
                ml_line = (
                    f"    ML Signal  : {ml_res['signal']} "
                    f"(UP: {ml_res['up_prob']}% | Confidence: {ml_res['confidence']})"
                )
            else:
                ml_line = "    ML Signal  : Not available"
        except:
            ml_line = "    ML Signal  : Not available"

        block = (
            f"  {sym}:\n"
            f"    Price      : ${price} | Today: {direction} {abs(chg)}%\n"
            f"    52W Range  : ${low52} – ${high52} | Market Cap: {cap_str}\n"
            f"    Tech Score : {tech_score}/100 | Signal: {tech_signal}\n"
            f"    RSI        : {rsi} | MACD: {macd} | Trend: {tech_trend}\n"
            f"{ml_line}"
        )
        blocks.append(block)

    return "\n\n".join(blocks)


SYSTEM = """You are NexaGuard AI — a sharp, data-driven financial advisor backed by real ML-powered technical analysis.

== CRITICAL RULES ==
1. When "=== LIVE MARKET DATA ===" appears, ALWAYS start your reply with the exact current price.
2. Use ONLY the numbers provided — never invent prices.
3. Reference the technical indicators (RSI, MACD, Tech Score, ML Signal) in your answer.
4. If NO live data exists, say so clearly.

== RESPONSE STRUCTURE ==
📍 Current price + today's movement
📊 Tech Score + RSI + MACD signal
🤖 ML Prediction signal
🎯 BUY / HOLD / SELL — clear signal with reasoning
⚡ Key risk or opportunity
🛡️ Powered by NexaGuard Intelligence — invest with data, not emotion.

Max 220 words. Be direct. Match user's language (Urdu/English/mix)."""


class ChatIn(BaseModel):
    message: str
    session_id: str = "default"


def stream_ollama(messages: list, history: list, original_msg: str):
    full_reply = ""
    try:
        res = requests.post(
            OLLAMA_URL,
            json={"model": MODEL, "messages": messages, "stream": True},
            stream=True, timeout=120,
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
    context = build_context(symbols)

    if context:
        user_msg = (
            f"{body.message}\n\n"
            f"=== LIVE MARKET DATA + TECHNICAL ANALYSIS + ML PREDICTION ===\n"
            f"{context}\n"
            f"=== END ===\n\n"
            f"Answer using exact prices, technical signals and ML prediction above. Match user's language."
        )
    else:
        user_msg = (
            f"{body.message}\n\n"
            f"[NO LIVE DATA — inform user and give general analysis only]"
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