import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
import asyncio
import json
from services.cache import ttl_cache

# ─────────────────────────────────────────────
# ALL USA MARKET SYMBOLS
# ─────────────────────────────────────────────

# Major Indices
INDICES = {
    "S&P 500":      "^GSPC",
    "NASDAQ":       "^IXIC",
    "DOW JONES":    "^DJI",
    "RUSSELL 2000": "^RUT",
    "VIX":          "^VIX",
    "NYSE COMP":    "^NYA",
}

# S&P 500 Sectors (ETFs)
SECTORS = {
    "Technology":       "XLK",
    "Healthcare":       "XLV",
    "Financials":       "XLF",
    "Energy":           "XLE",
    "Consumer Disc.":   "XLY",
    "Industrials":      "XLI",
    "Utilities":        "XLU",
    "Materials":        "XLB",
    "Real Estate":      "XLRE",
    "Communication":    "XLC",
    "Consumer Staples": "XLP",
}

# Top 50 S&P 500 Stocks by Market Cap
SP500_TOP50 = [
    "AAPL","MSFT","NVDA","AMZN","META","GOOGL","BRK-B","LLY","AVGO",
    "JPM","TSLA","UNH","V","XOM","MA","JNJ","PG","HD",
    "ABBV","CRM","BAC","NFLX","AMD","PEP","WMT",
    "ACN","ABT","ADBE","TXN",
    "WFC","AMGN","NKE","INTC","RTX","IBM"
]

# NASDAQ 100 Focus Stocks
NASDAQ_100 = [
    "AAPL","MSFT","NVDA","AMZN","META","GOOGL","TSLA","AVGO","COST","ASML",
    "NFLX","AMD","PEP","ADBE","CSCO","QCOM","TMUS","INTU","TXN","AMAT",
    "ISRG","BKNG","MU","LRCX","ADI","PANW","SNPS","CDNS","REGN","KLAC",
    "MELI","CRWD","FTNT","CEG","ABNB","MNST","TEAM","IDXX","VRSK","DXCM"
]

# Popular ETFs
ETFS = {
    "SPY":  "S&P 500 ETF",
    "QQQ":  "NASDAQ 100 ETF",
    "DIA":  "DOW Jones ETF",
    "IWM":  "Russell 2000 ETF",
    "GLD":  "Gold ETF",
    "SLV":  "Silver ETF",
    "TLT":  "20yr Treasury ETF",
    "USO":  "Oil ETF",
    "ARKK": "ARK Innovation ETF",
    "VTI":  "Total Market ETF",
}

# Crypto (via Yahoo Finance)
CRYPTO = {
    "Bitcoin":  "BTC-USD",
    "Ethereum": "ETH-USD",
    "BNB":      "BNB-USD",
    "Solana":   "SOL-USD",
    "XRP":      "XRP-USD",
}


# ─────────────────────────────────────────────
# CORE FUNCTIONS
# ─────────────────────────────────────────────

def get_quote(symbol: str) -> dict:
    """Single stock — price, change, volume, market cap"""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info

        price = info.last_price
        prev  = info.previous_close

        if not price or not prev:
            return {"symbol": symbol, "error": "no data"}

        change     = price - prev
        change_pct = (change / prev) * 100

        return {
            "symbol":      symbol,
            "price":       round(price, 2),
            "prev_close":  round(prev, 2),
            "change":      round(change, 2),
            "change_pct":  round(change_pct, 2),
            "volume":      info.three_month_average_volume,
            "market_cap":  info.market_cap,
            "52w_high":    info.year_high,
            "52w_low":     info.year_low,
            "signal":      _signal(change_pct),
        }
    except Exception as e:
        return {"symbol": symbol, "error": str(e)}


def get_batch_quotes(symbols: list) -> list:
    """Fetch multiple stocks at once — parallel, much faster than sequential"""
    def fetch_one(sym):
        try:
            t = yf.Ticker(sym)
            info = t.fast_info
            price = info.last_price
            prev = info.previous_close
            if price and prev:
                change = price - prev
                change_pct = (change / prev) * 100
                return {
                    "symbol": sym,
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "signal": _signal(change_pct),
                }
        except Exception:
            return None
        return None

    try:
        with ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(fetch_one, symbols))
        return [r for r in results if r is not None]
    except Exception as e:
        return [{"error": str(e)}]


@ttl_cache(seconds=45)
def get_all_indices() -> list:
    """All major USA indices live — fetched in parallel, cached 20s"""
    with ThreadPoolExecutor(max_workers=len(INDICES)) as pool:
        futures = {name: pool.submit(get_quote, sym) for name, sym in INDICES.items()}
        results = []
        for name, fut in futures.items():
            q = fut.result()
            q["name"] = name
            results.append(q)
    return results


@ttl_cache(seconds=45)
def get_all_sectors() -> list:
    """All 11 S&P 500 sectors performance — fetched in parallel, cached 20s"""
    with ThreadPoolExecutor(max_workers=len(SECTORS)) as pool:
        futures = {name: pool.submit(get_quote, sym) for name, sym in SECTORS.items()}
        results = []
        for name, fut in futures.items():
            q = fut.result()
            q["sector"] = name
            results.append(q)
    return results


@ttl_cache(seconds=45)
def get_market_movers(symbols: tuple = None, top_n: int = 10) -> dict:
    """
    Top gainers and losers from given list.
    Default = SP500 top 50
    """
    if not symbols:
        symbols = tuple(SP500_TOP50)

    quotes = get_batch_quotes(list(symbols))
    valid  = [q for q in quotes if "error" not in q]

    sorted_all = sorted(valid, key=lambda x: x["change_pct"], reverse=True)

    return {
        "top_gainers": sorted_all[:top_n],
        "top_losers":  sorted_all[-top_n:][::-1],
        "timestamp":   datetime.now().isoformat(),
    }


def get_stock_history(symbol: str, period: str = "3mo", interval: str = "1d") -> dict:
    try:
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period=period, interval=interval)

        if hist.empty:
            return {"symbol": symbol, "error": "no history"}

        # ── Technical Indicators ──────────────────────────────
        # EMA
        hist["EMA_20"] = hist["Close"].ewm(span=20, adjust=False).mean()
        hist["EMA_50"] = hist["Close"].ewm(span=50, adjust=False).mean()

        # RSI
        delta = hist["Close"].diff()
        gain  = delta.where(delta > 0, 0).rolling(14).mean()
        loss  = (-delta.where(delta < 0, 0)).rolling(14).mean()
        hist["RSI"] = 100 - (100 / (1 + gain / loss))

        # MACD
        ema12            = hist["Close"].ewm(span=12, adjust=False).mean()
        ema26            = hist["Close"].ewm(span=26, adjust=False).mean()
        hist["MACD"]     = ema12 - ema26
        hist["MACD_sig"] = hist["MACD"].ewm(span=9, adjust=False).mean()
        hist["MACD_hist"]= hist["MACD"] - hist["MACD_sig"]

        # Bollinger Bands
        sma20            = hist["Close"].rolling(20).mean()
        std20            = hist["Close"].rolling(20).std()
        hist["BB_upper"] = sma20 + std20 * 2
        hist["BB_lower"] = sma20 - std20 * 2
        hist["BB_mid"]   = sma20
        # ─────────────────────────────────────────────────────

        records = []
        for date, row in hist.iterrows():
            records.append({
                "date":      date.strftime("%Y-%m-%d"),
                "open":      round(row["Open"],  2),
                "high":      round(row["High"],  2),
                "low":       round(row["Low"],   2),
                "close":     round(row["Close"], 2),
                "volume":    int(row["Volume"]),
                # Indicators
                "ema20":     round(row["EMA_20"],   2) if pd.notna(row["EMA_20"])   else None,
                "ema50":     round(row["EMA_50"],   2) if pd.notna(row["EMA_50"])   else None,
                "rsi":       round(row["RSI"],      2) if pd.notna(row["RSI"])      else None,
                "macd":      round(row["MACD"],     4) if pd.notna(row["MACD"])     else None,
                "macd_sig":  round(row["MACD_sig"], 4) if pd.notna(row["MACD_sig"]) else None,
                "macd_hist": round(row["MACD_hist"],4) if pd.notna(row["MACD_hist"])else None,
                "bb_upper":  round(row["BB_upper"], 2) if pd.notna(row["BB_upper"]) else None,
                "bb_lower":  round(row["BB_lower"], 2) if pd.notna(row["BB_lower"]) else None,
                "bb_mid":    round(row["BB_mid"],   2) if pd.notna(row["BB_mid"])   else None,
            })

        return {
            "symbol":   symbol,
            "period":   period,
            "interval": interval,
            "data":     records,
            "count":    len(records),
        }
    except Exception as e:
        return {"symbol": symbol, "error": str(e)}
def get_stock_fundamentals(symbol: str) -> dict:
    """Deep info — PE ratio, EPS, dividend, beta, analyst ratings"""
    try:
        ticker = yf.Ticker(symbol)
        info   = ticker.info

        return {
            "symbol":           symbol,
            "name":             info.get("longName", "N/A"),
            "sector":           info.get("sector", "N/A"),
            "industry":         info.get("industry", "N/A"),
            "pe_ratio":         info.get("trailingPE"),
            "forward_pe":       info.get("forwardPE"),
            "eps":              info.get("trailingEps"),
            "dividend_yield":   info.get("dividendYield"),
            "beta":             info.get("beta"),
            "market_cap":       info.get("marketCap"),
            "revenue":          info.get("totalRevenue"),
            "profit_margin":    info.get("profitMargins"),
            "debt_to_equity":   info.get("debtToEquity"),
            "analyst_target":   info.get("targetMeanPrice"),
            "recommendation":   info.get("recommendationKey", "N/A"),
            "analyst_count":    info.get("numberOfAnalystOpinions"),
            "description":      info.get("longBusinessSummary", "")[:300],
        }
    except Exception as e:
        return {"symbol": symbol, "error": str(e)}


def get_crypto_prices() -> list:
    """Live crypto prices"""
    results = []
    for name, sym in CRYPTO.items():
        q = get_quote(sym)
        q["name"] = name
        results.append(q)
    return results


def get_etf_overview() -> list:
    """Major ETF performance"""
    results = []
    for sym, name in ETFS.items():
        q = get_quote(sym)
        q["name"] = name
        results.append(q)
    return results


@ttl_cache(seconds=45)
def get_market_summary() -> dict:
    """
    Complete USA market snapshot:
    indices + sectors + top movers + crypto
    """
    return {
        "timestamp": datetime.now().isoformat(),
        "indices":   get_all_indices(),
        "sectors":   get_all_sectors(),
        "movers":    get_market_movers(SP500_TOP50, top_n=5),
        "crypto":    get_crypto_prices(),
        "etfs":      get_etf_overview(),
    }


def search_stock(query: str) -> dict:
    """Search any USA stock by ticker or company name"""
    try:
        ticker = yf.Ticker(query.upper())
        info   = ticker.info
        if not info.get("regularMarketPrice") and not info.get("currentPrice"):
            return {"error": f"'{query}' not found"}

        return {
            "symbol":  query.upper(),
            "name":    info.get("longName", "N/A"),
            "sector":  info.get("sector", "N/A"),
            "price":   info.get("regularMarketPrice") or info.get("currentPrice"),
            "market_cap": info.get("marketCap"),
        }
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────

def _signal(change_pct: float) -> str:
    if change_pct >= 2:   return "STRONG BUY"
    if change_pct >= 0.5: return "BUY"
    if change_pct >= -0.5: return "HOLD"
    if change_pct >= -2:  return "SELL"
    return "STRONG SELL"


# ─────────────────────────────────────────────
# QUICK TEST
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("Testing NexaGuard Market Data Service...\n")

    print("📊 Indices:")
    for idx in get_all_indices():
        print(f"  {idx.get('name','')}: ${idx.get('price','N/A')} ({idx.get('change_pct','?')}%)")

    print("\n🏭 Sectors:")
    for s in get_all_sectors():
        print(f"  {s.get('sector','')}: {s.get('change_pct','?')}% [{s.get('signal','')}]")

    print("\n📈 Top Gainers (S&P500):")
    movers = get_market_movers(SP500_TOP50[:20], top_n=3)
    for g in movers["top_gainers"]:
        print(f"  {g['symbol']}: +{g['change_pct']}%")

    print("\n📉 Top Losers:")
    for l in movers["top_losers"]:
        print(f"  {l['symbol']}: {l['change_pct']}%")

    print("\n💰 Crypto:")
    for c in get_crypto_prices():
        print(f"  {c.get('name','')}: ${c.get('price','N/A')}")

    print("\n✅ NexaGuard Market Data — All systems go!")