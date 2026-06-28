from fastapi import FastAPI, Query
from routes.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from routes.ai_advisor import router as ai_router
from services.lstm_predictor import router as ml_router
from routes.csv_scanner import router as csv_router
from routes.ml import router as ml_router
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from routes.face_auth import router as face_router

from services.market_data import (
    get_quote, get_batch_quotes, get_all_indices,
    get_all_sectors, get_market_movers, get_stock_history,
    get_stock_fundamentals, get_crypto_prices, get_etf_overview,
    get_market_summary, search_stock, SP500_TOP50, NASDAQ_100
)
from routes.fraud import router as fraud_router
from services.technical_indicators import router as technical_router
from routes.alerts import router as alerts_router

app = FastAPI(title="NexaGuard API", version="1.0.0")

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(fraud_router)
app.include_router(auth_router)  
app.include_router(ai_router)
app.include_router(technical_router)
app.include_router(ml_router)
app.include_router(csv_router)
app.include_router(alerts_router)
app.include_router(ml_router)
app.include_router(face_router)
# Market endpoints
@app.get("/api/market/summary")
def market_summary():
    return get_market_summary()

@app.get("/api/market/indices")
def indices():
    return get_all_indices()

@app.get("/api/market/sectors")
def sectors():
    return get_all_sectors()

@app.get("/api/market/movers")
def movers(market: str = "sp500", top: int = 10):
    symbols = NASDAQ_100 if market == "nasdaq" else SP500_TOP50
    return get_market_movers(tuple(symbols), top_n=top)

@app.get("/api/market/crypto")
def crypto():
    return get_crypto_prices()

@app.get("/api/market/etfs")
def etfs():
    return get_etf_overview()

@app.get("/api/stock/{symbol}")
def stock_quote(symbol: str):
    return get_quote(symbol.upper())

@app.get("/api/stock/{symbol}/history")
def stock_history(symbol: str, period: str = "3mo", interval: str = "1d"):
    return get_stock_history(symbol.upper(), period, interval)

@app.get("/api/stock/{symbol}/fundamentals")
def stock_fundamentals(symbol: str):
    return get_stock_fundamentals(symbol.upper())

@app.get("/api/stocks/batch")
def batch(symbols: str = Query(...)):
    sym_list = [s.strip().upper() for s in symbols.split(",")]
    return get_batch_quotes(sym_list)

@app.get("/api/search/{query}")
def search(query: str):
    return search_stock(query)

@app.get("/")
def root():
    return {"status": "NexaGuard API running", "version": "1.0.0"}