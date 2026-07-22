import os
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests
import json
import difflib
from groq import Groq

from services.market_data import get_quote, get_batch_quotes, SP500_TOP50
from services.technical_indicators import analyze_stock

router = APIRouter(prefix="/api/ai", tags=["ai"])

# ── Groq setup ──────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile" 

chat_sessions = {}

def get_history(session_id: str):
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    return chat_sessions[session_id]

# Broad sector / theme groups -> list of tickers
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
}

# Individual company name (and common aliases) -> single ticker.
# Add new companies here in ONE place — KNOWN_SYMBOLS builds itself from this.
COMPANY_MAP = {
    "amazon": "AMZN", "amzn": "AMZN",
    "apple": "AAPL", "aapl": "AAPL",
    "microsoft": "MSFT", "msft": "MSFT",
    "google": "GOOGL", "alphabet": "GOOGL", "googl": "GOOGL",
    "tesla": "TSLA", "tsla": "TSLA",
    "nvidia": "NVDA", "nvda": "NVDA",
    "meta": "META", "facebook": "META",
    "netflix": "NFLX", "nflx": "NFLX",
    "intel": "INTC",
    "qualcomm": "QCOM",
    "broadcom": "AVGO",
    "walmart": "WMT",
    "jpmorgan": "JPM", "jp morgan": "JPM",
    "goldman": "GS", "goldman sachs": "GS",
    "palantir": "PLTR",
    "salesforce": "CRM",
    "oracle": "ORCL",
    "adobe": "ADBE",
    "paypal": "PYPL",
    "shopify": "SHOP",
    "visa": "V",
    "mastercard": "MA",
    "chevron": "CVX",
    "pfizer": "PFE",
    "costco": "COST",
    "disney": "DIS",
    "uber": "UBER",
    "lyft": "LYFT",
    "snapchat": "SNAP", "snap": "SNAP",
    "spotify": "SPOT",
    "block": "SQ", "square": "SQ",
    "roku": "ROKU",
    "coinbase": "COIN",
    "robinhood": "HOOD",
    "sofi": "SOFI",
    "nio": "NIO",
    "alibaba": "BABA",
    "amd": "AMD",
}

# Built automatically — every ticker mentioned above (plus S&P top 50) is "known"
KNOWN_SYMBOLS = set(SP500_TOP50) | set(COMPANY_MAP.values())

def extract_symbols(text: str) -> list:
    text_lower = text.lower()
    words = text_lower.replace("?", " ").replace(",", " ").replace("!", " ").split()
    symbols = set()

    # 1. Direct ticker match (e.g. "AMZN", "NVDA")
    for word in text.upper().split():
        clean = word.strip("?,!.()")
        if clean in KNOWN_SYMBOLS:
            symbols.add(clean)

    # 2. Exact company name match (e.g. "amazon", "tesla")
    for word in words:
        clean = word.strip("?,!.()")
        if clean in COMPANY_MAP:
            symbols.add(COMPANY_MAP[clean])

    # 3. Fuzzy match to catch typos (e.g. "amzon", "gogle", "teslaa")
    if not symbols:
        for word in words:
            clean = word.strip("?,!.()")
            if len(clean) < 3:
                continue
            close = difflib.get_close_matches(clean, COMPANY_MAP.keys(), n=1, cutoff=0.8)
            if close:
                symbols.add(COMPANY_MAP[close[0]])

    # 4. Sector / theme keywords (e.g. "tech stocks", "ai stocks")
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
1. Use the RESPONSE STRUCTURE below ONLY when "=== LIVE MARKET DATA ===" is present in the message — that means the user is asking about a specific stock/ticker.
2. For everything else — greetings, general questions, opinions, follow-up questions, "should I do this or not", clarifying questions, portfolio strategy talk, or any casual conversation — just reply naturally and directly like a normal helpful advisor. Do NOT force the emoji template on these; answer the actual question being asked.
3. When live data IS present: use ONLY the numbers provided — never invent prices — and reference the technical indicators (RSI, MACD, Tech Score, ML Signal) in your answer.
4. If the user clearly wants stock data but none was found, say so clearly and ask them to name the stock/ticker — don't dump an empty template.

== RESPONSE STRUCTURE (only when live stock data is provided) ==
📍 Current price + today's movement
📊 Tech Score + RSI + MACD signal
🤖 ML Prediction signal
🎯 BUY / HOLD / SELL — clear signal with reasoning
⚡ Key risk or opportunity
🛡️ Powered by NexaGuard Intelligence — invest with data, not emotion.

Max 220 words. Be direct and conversational — sound like a knowledgeable advisor, not a form.

== LANGUAGE RULE ==
Always reply ONLY in English, regardless of what language or script the user writes in (Urdu, Roman Urdu, Hindi, mixed, etc.). Never reply in Urdu, Hindi, Devanagari script, or any other language — English only, every time."""


class ChatIn(BaseModel):
    message: str
    session_id: str = "default"


def stream_groq(messages: list, history: list, original_msg: str):
    full_reply = ""
    try:
        stream = groq_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            stream=True,
            temperature=0.7,
        )
        for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                full_reply += token
                yield f"data: {json.dumps({'token': token})}\n\n"
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
            f"[No stock symbol detected in this message — if the user is asking a general question, "
            f"greeting, or having a normal conversation, just respond naturally. Only mention missing "
            f"live data if they were clearly trying to ask about a specific stock.]"
        )

    messages = [{"role": "system", "content": SYSTEM}]
    for h in history[-8:]:
        messages.append({"role": h["role"], "content": h["text"]})
    messages.append({"role": "user", "content": user_msg})

    return StreamingResponse(
        stream_groq(messages, history, body.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/chat/{session_id}")
def clear_chat(session_id: str):
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"success": True}