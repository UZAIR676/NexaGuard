"""
NexaGuard — Technical Indicators Engine
Calculates RSI, MACD, Bollinger Bands, EMA, SMA, Volume analysis
Uses market_data.get_stock_history() instead of direct yfinance
so the whole app shares one data source.
"""
import pandas as pd
import numpy as np
from services.market_data import get_stock_history

# ── RSI ────────────────────────────────────────────────────────────────────
def calculate_rsi(prices: pd.Series, period: int = 14) -> float:
    delta = prices.diff()
    # Wilder's smoothing (standard RSI — more accurate than simple rolling mean)
    gain  = delta.where(delta > 0, 0).ewm(com=period - 1, min_periods=period).mean()
    loss  = (-delta.where(delta < 0, 0)).ewm(com=period - 1, min_periods=period).mean()
    rs    = gain / loss
    rsi   = 100 - (100 / (1 + rs))
    return round(float(rsi.iloc[-1]), 2)

def _rsi_label(rsi: float) -> str:
    if rsi < 30:  return "Oversold 🟢"
    if rsi > 70:  return "Overbought 🔴"
    if rsi < 45:  return "Mildly bearish 🟡"
    if rsi > 55:  return "Mildly bullish 🟡"
    return "Neutral ⚪"

# ── MACD ───────────────────────────────────────────────────────────────────
def calculate_macd(prices: pd.Series):
    ema12  = prices.ewm(span=12, adjust=False).mean()
    ema26  = prices.ewm(span=26, adjust=False).mean()
    macd   = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    hist   = macd - signal
    return {
        "macd":      round(float(macd.iloc[-1]), 4),
        "signal":    round(float(signal.iloc[-1]), 4),
        "histogram": round(float(hist.iloc[-1]), 4),
        "crossover": "bullish" if macd.iloc[-1] > signal.iloc[-1] else "bearish"
    }

# ── Bollinger Bands ────────────────────────────────────────────────────────
def calculate_bollinger(prices: pd.Series, period: int = 20):
    sma   = prices.rolling(period).mean()
    std   = prices.rolling(period).std()
    upper = sma + (std * 2)
    lower = sma - (std * 2)
    price = prices.iloc[-1]
    pct_b = (price - lower.iloc[-1]) / (upper.iloc[-1] - lower.iloc[-1])
    return {
        "upper":  round(float(upper.iloc[-1]), 2),
        "middle": round(float(sma.iloc[-1]), 2),
        "lower":  round(float(lower.iloc[-1]), 2),
        "pct_b":  round(float(pct_b), 4),
        "signal": "overbought" if pct_b > 0.8 else "oversold" if pct_b < 0.2 else "neutral"
    }

# ── EMA / SMA ──────────────────────────────────────────────────────────────
def calculate_moving_averages(prices: pd.Series):
    return {
        "sma_20":  round(float(prices.rolling(20).mean().iloc[-1]), 2),
        "sma_50":  round(float(prices.rolling(50).mean().iloc[-1]), 2),
        "sma_200": round(float(prices.rolling(200).mean().iloc[-1]), 2),
        "ema_12":  round(float(prices.ewm(span=12).mean().iloc[-1]), 2),
        "ema_26":  round(float(prices.ewm(span=26).mean().iloc[-1]), 2),
        "trend":   "bullish" if prices.rolling(50).mean().iloc[-1] > prices.rolling(200).mean().iloc[-1] else "bearish"
    }

# ── Volume Analysis ────────────────────────────────────────────────────────
def calculate_volume(volume: pd.Series, prices: pd.Series):
    avg_vol   = volume.rolling(20).mean().iloc[-1]
    cur_vol   = volume.iloc[-1]
    vol_ratio = cur_vol / avg_vol
    obv       = (np.sign(prices.diff()) * volume).cumsum()
    return {
        "current":   int(cur_vol),
        "avg_20d":   int(avg_vol),
        "ratio":     round(float(vol_ratio), 2),
        "signal":    "high" if vol_ratio > 1.5 else "low" if vol_ratio < 0.5 else "normal",
        "obv_trend": "up" if obv.iloc[-1] > obv.iloc[-5] else "down"
    }

# ── Support / Resistance ───────────────────────────────────────────────────
def calculate_support_resistance(prices: pd.Series):
    recent     = prices.tail(60)
    support    = round(float(recent.min()), 2)
    resistance = round(float(recent.max()), 2)
    current    = float(prices.iloc[-1])
    return {
        "support":    support,
        "resistance": resistance,
        "position":   round((current - support) / (resistance - support) * 100, 1)
    }

# ── NexaGuard Technical Score (0–100) ─────────────────────────────────────
def calculate_technical_score(rsi, macd, bollinger, ma, volume) -> dict:
    score = 50

    if rsi < 30:    score += 20
    elif rsi < 45:  score += 10
    elif rsi > 70:  score -= 20
    elif rsi > 55:  score -= 10

    if macd["crossover"] == "bullish":    score += 15
    else:                                  score -= 15

    if bollinger["signal"] == "oversold":    score += 10
    elif bollinger["signal"] == "overbought": score -= 10

    if ma["trend"] == "bullish":  score += 15
    else:                          score -= 15

    if volume["signal"] == "high" and volume["obv_trend"] == "up":    score += 10
    elif volume["signal"] == "high" and volume["obv_trend"] == "down": score -= 10

    score = max(0, min(100, score))

    if score >= 70:   signal = "STRONG BUY"
    elif score >= 55: signal = "BUY"
    elif score >= 45: signal = "HOLD"
    elif score >= 30: signal = "SELL"
    else:             signal = "STRONG SELL"

    return {"score": score, "signal": signal}

# ── Main Analysis Function ─────────────────────────────────────────────────
def analyze_stock(symbol: str) -> dict:
    """
    Full technical analysis using NexaGuard's own market_data service.
    No direct yfinance calls — same data source as dashboard.
    """
    try:
        # Use existing market_data service (same as dashboard)
        history = get_stock_history(symbol.upper(), period="1y", interval="1d")

        if "error" in history or not history.get("data"):
            return {"error": f"No data for {symbol}"}

        df = pd.DataFrame(history["data"])
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()

        if len(df) < 50:
            return {"error": f"Insufficient data: only {len(df)} days"}

        prices = df["close"]
        volume = df["volume"]

        rsi        = calculate_rsi(prices)
        macd       = calculate_macd(prices)
        bollinger  = calculate_bollinger(prices)
        ma         = calculate_moving_averages(prices)
        vol        = calculate_volume(volume, prices)
        sr         = calculate_support_resistance(prices)
        tech_score = calculate_technical_score(rsi, macd, bollinger, ma, vol)

        current_price = round(float(prices.iloc[-1]), 2)
        prev_price    = round(float(prices.iloc[-2]), 2)
        change_pct    = round((current_price - prev_price) / prev_price * 100, 2)

        # AI-ready summary string for ai_advisor prompt injection
        summary = (
            f"  RSI: {rsi} → {_rsi_label(rsi)}\n"
            f"  MACD: {macd['crossover'].upper()} crossover (hist: {macd['histogram']})\n"
            f"  Bollinger: {bollinger['signal'].upper()} (%B: {bollinger['pct_b']})\n"
            f"  Trend: {ma['trend'].upper()} | SMA50: ${ma['sma_50']} | SMA200: ${ma['sma_200']}\n"
            f"  Volume: {vol['signal'].upper()} (ratio: {vol['ratio']}x avg) | OBV: {vol['obv_trend'].upper()}\n"
            f"  Support: ${sr['support']} | Resistance: ${sr['resistance']} | Position: {sr['position']}%\n"
            f"  ⚡ NexaGuard Score: {tech_score['score']}/100 → {tech_score['signal']}"
        )

        return {
            "symbol":             symbol.upper(),
            "price":              current_price,
            "change_pct":         change_pct,
            "rsi":                rsi,
            "macd":               macd,
            "bollinger":          bollinger,
            "moving_avg":         ma,
            "volume":             vol,
            "support_resistance": sr,
            "technical_score":    tech_score,
            "summary":            summary,
            "summary_dict": {
                "signal":     tech_score["signal"],
                "score":      tech_score["score"],
                "trend":      ma["trend"],
                "momentum":   "positive" if macd["crossover"] == "bullish" else "negative",
                "rsi_status": "oversold" if rsi < 30 else "overbought" if rsi > 70 else "mildly_bearish" if rsi < 45 else "mildly_bullish" if rsi > 55 else "neutral"
            }
        }
    except Exception as e:
        return {"error": str(e)}


# ── FastAPI Route ──────────────────────────────────────────────────────────
from fastapi import APIRouter
router = APIRouter(prefix="/api/technical", tags=["technical"])

@router.get("/{symbol}")
def get_technical_route(symbol: str):
    return analyze_stock(symbol.upper())