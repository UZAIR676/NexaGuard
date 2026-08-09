"""
NexaGuard — Market News + AI Sentiment + Combined Outlook

Three things happen here:
1. Live headlines for a symbol (Google News RSS — free, no API key).
2. Each headline gets classified Bullish/Bearish/Neutral by the same Groq
   LLM already used in the AI Advisor chat, then blended with the existing
   price/technical ML prediction (services/lstm_predictor.py) into one
   combined verdict — two independent signals agreeing (or disagreeing) is
   far more useful to show than either alone.
3. On-demand per-article AI summary (/article/summary) — fetched only when
   the user clicks "Summary" on a specific headline, not for all headlines
   up front, to keep the main news call fast and cheap.

NOTE ON DEPENDENCIES:
This file relies on two extra packages beyond the original requirements:
    pip install googlenewsdecoder trafilatura
- googlenewsdecoder: Google News RSS "link" fields are no longer simple
  redirects — newer links encode the destination in an opaque Google
  protobuf blob (not plain base64 of a URL), which requires calling
  Google's own batchexecute endpoint to resolve. This package implements
  that resolution properly instead of guessing.
- trafilatura: extracts the main readable body text from an arbitrary
  news page far more reliably than manually hunting for <p> tags — it
  understands boilerplate/nav/ad removal and works across most site
  layouts without per-site tuning.
"""
import os
import re
import json
from urllib.parse import quote

import feedparser
import requests
import trafilatura
from googlenewsdecoder import gnewsdecoder
from bs4 import BeautifulSoup
from fastapi import APIRouter
from groq import Groq

from routes.auth import get_user_by_token
from services.lstm_predictor import predict_symbol

router = APIRouter(prefix="/api/news", tags=["news"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"

# Used when fetching article pages (for summaries) — without a
# browser-like User-Agent a lot of news sites just refuse the request.
_FETCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# Symbol → company name, just for building a better search query.
# (Kept local/small rather than importing ai_advisor's COMPANY_MAP, to
# avoid a circular import — ai_advisor doesn't need to know about news.)
SYMBOL_NAMES = {
    "AMZN": "Amazon", "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Google",
    "TSLA": "Tesla", "NVDA": "Nvidia", "META": "Meta", "NFLX": "Netflix",
    "INTC": "Intel", "QCOM": "Qualcomm", "AVGO": "Broadcom", "WMT": "Walmart",
    "JPM": "JPMorgan", "GS": "Goldman Sachs", "PLTR": "Palantir", "CRM": "Salesforce",
    "ORCL": "Oracle", "ADBE": "Adobe", "PYPL": "PayPal", "SHOP": "Shopify",
    "V": "Visa", "MA": "Mastercard", "CVX": "Chevron", "PFE": "Pfizer",
    "COST": "Costco", "DIS": "Disney", "UBER": "Uber", "LYFT": "Lyft",
    "SNAP": "Snapchat", "SPOT": "Spotify", "SQ": "Block", "ROKU": "Roku",
    "COIN": "Coinbase", "HOOD": "Robinhood", "SOFI": "SoFi", "NIO": "Nio",
    "BABA": "Alibaba", "AMD": "AMD", "^GSPC": "S&P 500",
}


def _fetch_headlines(symbol: str, limit: int = 8):
    name  = SYMBOL_NAMES.get(symbol.upper(), symbol)
    query = f"{name} stock"
    url   = f"https://news.google.com/rss/search?q={quote(query)}&hl=en-US&gl=US&ceid=US:en"

    try:
        feed = feedparser.parse(url)
    except Exception as e:
        print(f"⚠️ News fetch error: {e}")
        return []

    articles = []
    for entry in feed.entries[:limit]:
        source = ""
        if getattr(entry, "source", None):
            source = entry.source.get("title", "")
        articles.append({
            "title":     entry.get("title", ""),
            "link":      entry.get("link", ""),
            "published": entry.get("published", ""),
            "source":    source,
        })
    return articles


def _resolve_real_url(google_url: str, timeout: float):
    """Resolves a Google News redirect link to the real publisher URL
    using googlenewsdecoder (talks to Google's batchexecute endpoint,
    the only reliable way to decode the newer link format), with a
    plain-redirect fallback for any older-style links."""
    try:
        result = gnewsdecoder(google_url, interval=1)
        if result and result.get("status") and result.get("decoded_url"):
            return result["decoded_url"]
    except Exception as e:
        print(f"⚠️ gnewsdecoder failed: {e}")

    # Fallback: maybe it's already a direct link, or a simple redirect.
    try:
        resp = requests.get(google_url, headers=_FETCH_HEADERS, timeout=timeout, allow_redirects=True)
        if "news.google.com" not in resp.url:
            return resp.url
    except Exception:
        pass

    return None


def _extract_article_text(url: str, html: str = None) -> str:
    """Pulls the main readable body text out of an arbitrary news page.
    trafilatura does the heavy lifting (boilerplate/nav/ad removal, works
    across most site layouts); falls back to a manual <p>-tag scrape only
    if trafilatura comes back empty."""
    try:
        downloaded = html if html is not None else trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(
                downloaded,
                include_comments=False,
                include_tables=False,
                favor_precision=True,
            )
            if text and len(text.strip()) >= 200:
                return text.strip()
    except Exception as e:
        print(f"⚠️ trafilatura extraction failed: {e}")

    # Fallback: manual <p>-tag scrape from whatever HTML we already have.
    if html:
        try:
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
                tag.decompose()
            text = " ".join(p.get_text(" ", strip=True) for p in soup.find_all("p"))
            return text.strip()
        except Exception:
            pass

    return ""


def _analyze_sentiment(headlines: list) -> list:
    """Returns a Bullish/Bearish/Neutral label per headline, same order."""
    if not headlines:
        return []
    if not GROQ_API_KEY:
        return ["Neutral"] * len(headlines)

    numbered = "\n".join(f"{i+1}. {h}" for i, h in enumerate(headlines))
    prompt = (
        "Classify each headline's sentiment for the stock/company it discusses "
        "as exactly one of: Bullish, Bearish, Neutral. Return ONLY a JSON array "
        'like [{"i":1,"sentiment":"Bullish"}] — no other text, no markdown fences.'
        f"\n\nHeadlines:\n{numbered}"
    )
    try:
        resp = groq_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=600,
        )
        raw = resp.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        parsed  = json.loads(raw)
        mapping = {item["i"]: item["sentiment"] for item in parsed}
        return [mapping.get(i + 1, "Neutral") for i in range(len(headlines))]
    except Exception as e:
        print(f"⚠️ Sentiment analysis error: {e}")
        return ["Neutral"] * len(headlines)


@router.get("/{symbol}")
def get_news(symbol: str, token: str, limit: int = 8):
    get_user_by_token(token)  # any logged-in user can view news

    articles   = _fetch_headlines(symbol, limit)
    sentiments = _analyze_sentiment([a["title"] for a in articles])
    for a, sent in zip(articles, sentiments):
        a["sentiment"] = sent

    bullish = sum(1 for s in sentiments if s == "Bullish")
    bearish = sum(1 for s in sentiments if s == "Bearish")
    total   = len(sentiments) or 1
    news_score = round((bullish - bearish) / total * 100, 1)  # -100..100

    return {
        "symbol": symbol.upper(),
        "articles": articles,
        "news_sentiment_score": news_score,
        "bullish_count": bullish,
        "bearish_count": bearish,
        "neutral_count": max(len(articles) - bullish - bearish, 0),
    }


@router.get("/{symbol}/outlook")
def get_combined_outlook(symbol: str, token: str):
    """Blends the existing price/technical ML signal with live news
    sentiment into one combined verdict."""
    get_user_by_token(token)

    ml_result   = predict_symbol(symbol.upper())
    news_result = get_news(symbol, token, limit=8)

    ml_signal = ml_result.get("signal", "N/A")
    news_score = news_result["news_sentiment_score"]
    bullish_ml = ml_signal in ("BUY", "STRONG BUY")
    bearish_ml = ml_signal in ("SELL", "STRONG SELL")

    if "error" in ml_result:
        verdict = f"News only — technical model unavailable ({ml_result['error']})"
    elif news_score >= 30 and bullish_ml:
        verdict = "✅ Strong Buy — technicals and news both bullish"
    elif news_score <= -30 and bearish_ml:
        verdict = "🔻 Strong Sell — technicals and news both bearish"
    elif news_score >= 30 and bearish_ml:
        verdict = "⚠️ Mixed — news is bullish but technicals say sell"
    elif news_score <= -30 and bullish_ml:
        verdict = "⚠️ Mixed — technicals say buy but news is bearish"
    else:
        verdict = f"{ml_signal} (technical) — news roughly neutral"

    return {
        "symbol": symbol.upper(),
        "technical_prediction": ml_result,
        "news_sentiment_score": news_score,
        "news_summary": (
            f"{news_result['bullish_count']} bullish / "
            f"{news_result['bearish_count']} bearish / "
            f"{news_result['neutral_count']} neutral headlines"
        ),
        "articles": news_result["articles"],
        "combined_verdict": verdict,
    }


# ── On-demand article summary ───────────────────────────────────────────
# Note: this path has TWO segments ("/article/summary"), so it can never be
# shadowed by the "/{symbol}" (one segment) route above, regardless of
# where it's placed in this file.
@router.get("/article/summary")
def summarize_article(url: str, token: str):
    """Resolves the real publisher URL, extracts its text, and asks Groq
    for a short 2-3 sentence summary IN OUR OWN WORDS (never a verbatim
    excerpt of the source). Called only when the user clicks "Summary" on
    a specific headline — not for every headline up front."""
    get_user_by_token(token)

    real_url = _resolve_real_url(url, timeout=6.0) or url

    html = None
    try:
        resp = requests.get(real_url, headers=_FETCH_HEADERS, timeout=8.0)
        resp.raise_for_status()
        html = resp.text
        real_url = resp.url  # follow any further redirects the site itself does
    except Exception as e:
        # requests failed outright (403, timeout, etc) — trafilatura's own
        # fetcher sometimes succeeds where requests doesn't, so still try
        # extraction directly from the URL before giving up.
        print(f"⚠️ requests fetch failed for {real_url}: {e}")

    text = _extract_article_text(real_url, html)
    text = text[:6000]  # cap what we send to the LLM

    if not text or len(text) < 200:
        return {
            "summary": None,
            "error": (
                "Could not extract readable text from this page "
                "(it may be behind a paywall or require JavaScript)."
            ),
            "resolved_url": real_url,
        }

    if not GROQ_API_KEY:
        return {"summary": None, "error": "Summary service not configured.", "resolved_url": real_url}

    try:
        prompt = (
            "Summarize the following news article in 2-3 concise sentences, "
            "entirely in your own words. Do not quote any phrase directly "
            "from the text. Focus on what happened and why it matters for "
            "the stock/company involved.\n\n"
            f"Article text:\n{text}"
        )
        resp = groq_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=220,
        )
        summary = resp.choices[0].message.content.strip()
        return {"summary": summary, "resolved_url": real_url}
    except Exception as e:
        return {"summary": None, "error": f"Summary generation failed: {e}", "resolved_url": real_url}