"""
NexaGuard — Full Market Scanner
Uses local ticker list — no FTP needed
"""

import yfinance as yf
import json
import time
from datetime import datetime
from tickers import ALL_SYMBOLS, CRYPTO


def fetch_batch(symbols: list, batch_size: int = 100) -> list:
    all_results = []
    total_batches = (len(symbols) + batch_size - 1) // batch_size

    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        print(f"  Batch {batch_num}/{total_batches} — {len(batch)} stocks...", end=" ")

        try:
            data = yf.download(
                tickers=" ".join(batch),
                period="2d",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
                threads=True,
            )

            for sym in batch:
                try:
                    closes = data[sym]["Close"] if len(batch) > 1 else data["Close"]
                    closes = closes.dropna()
                    if len(closes) >= 2:
                        price = round(float(closes.iloc[-1]), 2)
                        prev  = round(float(closes.iloc[-2]), 2)
                        change = round(price - prev, 2)
                        pct    = round((change / prev) * 100, 2)
                        all_results.append({
                            "symbol": sym,
                            "price": price,
                            "change": change,
                            "change_pct": pct,
                            "signal": _signal(pct),
                        })
                except:
                    pass

            print(f"✅ {len(all_results)} total")
            time.sleep(0.3)

        except Exception as e:
            print(f"❌ {e}")

    return all_results


def get_market_movers(results: list, n: int = 10) -> dict:
    valid = [r for r in results if r.get("price", 0) > 1]
    return {
        "top_gainers": sorted(valid, key=lambda x: x["change_pct"], reverse=True)[:n],
        "top_losers":  sorted(valid, key=lambda x: x["change_pct"])[:n],
        "timestamp":   datetime.now().isoformat(),
        "total_scanned": len(results),
    }


def _signal(pct: float) -> str:
    if pct >= 2:    return "STRONG BUY"
    if pct >= 0.5:  return "BUY"
    if pct >= -0.5: return "HOLD"
    if pct >= -2:   return "SELL"
    return "STRONG SELL"


if __name__ == "__main__":
    print("=" * 50)
    print("NexaGuard — Full USA Market Scan")
    print(f"Scanning {len(ALL_SYMBOLS)} symbols...")
    print("=" * 50 + "\n")

    results = fetch_batch(ALL_SYMBOLS)
    movers  = get_market_movers(results, n=10)

    print(f"\n✅ Scanned: {movers['total_scanned']} stocks\n")

    print("📈 TOP 10 GAINERS:")
    for g in movers["top_gainers"]:
        print(f"  {g['symbol']:8}  ${g['price']:>10.2f}  +{g['change_pct']}%  [{g['signal']}]")

    print("\n📉 TOP 10 LOSERS:")
    for l in movers["top_losers"]:
        print(f"  {l['symbol']:8}  ${l['price']:>10.2f}  {l['change_pct']}%  [{l['signal']}]")

    import os; os.makedirs("data", exist_ok=True)
    with open("data/market_snapshot.json", "w") as f:
        json.dump({**movers, "all_data": results}, f, indent=2)

    print("\n💾 Saved to data/market_snapshot.json")
    print("✅ Done!")