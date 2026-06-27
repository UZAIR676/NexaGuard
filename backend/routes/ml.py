from fastapi import APIRouter
import numpy as np
import pandas as pd
import yfinance as yf
import joblib, json, os
import warnings
warnings.filterwarnings('ignore')

router = APIRouter(prefix="/api/ml", tags=["ml"])

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
SEQ_LEN = 60
FEATURE_COLS = [
    'Returns', 'HL_ratio', 'OC_ratio',
    'SMA_10', 'SMA_20', 'SMA_50',
    'EMA_12', 'EMA_26',
    'MACD', 'MACD_signal', 'MACD_hist',
    'RSI', 'BB_pct', 'Vol_ratio',
    'ATR', 'Momentum'
]

# ── Model Load (ek baar) ───────────────────────────────────────────────────
def load_model():
    config_path = os.path.join(MODELS_DIR, 'nexaguard_config.json')
    if not os.path.exists(config_path):
        return None, None, None
    
    with open(config_path) as f:
        config = json.load(f)
    
    model_type = config.get('model_type', 'lstm')
    scalers = joblib.load(os.path.join(MODELS_DIR, 'nexaguard_scalers.pkl'))
    
    if model_type == 'lstm':
        from tensorflow.keras.models import load_model as keras_load
        model = keras_load(os.path.join(MODELS_DIR, 'nexaguard_lstm.keras'))
    elif model_type == 'xgboost':
        model = joblib.load(os.path.join(MODELS_DIR, 'nexaguard_xgb.pkl'))
    elif model_type == 'hybrid':
        lstm_m = None
        xgb_m = joblib.load(os.path.join(MODELS_DIR, 'nexaguard_xgb.pkl'))
        try:
            from tensorflow.keras.models import load_model as keras_load
            lstm_m = keras_load(os.path.join(MODELS_DIR, 'nexaguard_lstm.keras'))
        except:
            pass
        model = {'lstm': lstm_m, 'xgb': xgb_m}
    
    return model, scalers, model_type

MODEL, SCALERS, MODEL_TYPE = load_model()

# ── Feature Engineering (train.py se same) ────────────────────────────────
def add_features(df):
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.copy()
    df['Returns']     = df['Close'].pct_change()
    df['HL_ratio']    = (df['High'] - df['Low']) / df['Close']
    df['OC_ratio']    = (df['Close'] - df['Open']) / df['Open']
    df['SMA_10']      = df['Close'].rolling(10).mean()
    df['SMA_20']      = df['Close'].rolling(20).mean()
    df['SMA_50']      = df['Close'].rolling(50).mean()
    df['EMA_12']      = df['Close'].ewm(span=12, adjust=False).mean()
    df['EMA_26']      = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD']        = df['EMA_12'] - df['EMA_26']
    df['MACD_signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['MACD_hist']   = df['MACD'] - df['MACD_signal']
    delta = df['Close'].diff()
    gain  = delta.where(delta > 0, 0).rolling(14).mean()
    loss  = (-delta.where(delta < 0, 0)).rolling(14).mean()
    df['RSI']         = 100 - (100 / (1 + gain / loss))
    sma20             = df['Close'].rolling(20).mean()
    std20             = df['Close'].rolling(20).std()
    bb_upper          = sma20 + std20 * 2
    bb_lower          = sma20 - std20 * 2
    bb_range          = (bb_upper - bb_lower).replace(0, np.nan)
    df['BB_pct']      = ((df['Close'] - bb_lower) / bb_range).squeeze()
    vol_ma            = df['Volume'].rolling(20).mean().replace(0, np.nan)
    df['Vol_ratio']   = df['Volume'] / vol_ma
    high_low          = df['High'] - df['Low']
    high_close        = (df['High'] - df['Close'].shift()).abs()
    low_close         = (df['Low']  - df['Close'].shift()).abs()
    tr                = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df['ATR']         = tr.rolling(14).mean() / df['Close']
    df['Momentum']    = df['Close'].pct_change(10)
    return df.dropna()

# ── Predict ────────────────────────────────────────────────────────────────
def predict_symbol(sym: str):
    if MODEL is None:
        return {"error": "Model not trained yet. Run: python ml/train.py"}
    
    # Fresh data download
    df = yf.download(sym, period='6mo', progress=False, auto_adjust=True)
    if len(df) < SEQ_LEN + 10:
        return {"error": f"Not enough data for {sym}"}
    
    df = add_features(df)
    if len(df) < SEQ_LEN:
        return {"error": "Not enough processed data"}
    
    # Scaler — trained symbol ka use karo, warna generic
    scaler = SCALERS.get(sym)
    if scaler is None:
        # Pehle available scaler se fit karo
        scaler = list(SCALERS.values())[0]
    
    scaled = scaler.transform(df[FEATURE_COLS])
    seq    = scaled[-SEQ_LEN:].reshape(1, SEQ_LEN, len(FEATURE_COLS))
    
    current_price = float(df['Close'].iloc[-1])
    
    # Predict
    if MODEL_TYPE == 'lstm':
        prob = float(MODEL.predict(seq, verbose=0)[0][0])
    elif MODEL_TYPE == 'xgboost':
        prob = float(MODEL.predict_proba(seq[:, -1, :])[0][1])
    elif MODEL_TYPE == 'hybrid':
        probs = []
        if MODEL.get('lstm'):
            probs.append(float(MODEL['lstm'].predict(seq, verbose=0)[0][0]) * 0.6)
        if MODEL.get('xgb'):
            probs.append(float(MODEL['xgb'].predict_proba(seq[:, -1, :])[0][1]) * 0.4)
        prob = sum(probs)
    
    up_prob = round(prob * 100, 2)
    
    if prob >= 0.65:
        signal     = "BUY"
        confidence = "HIGH"
    elif prob >= 0.55:
        signal     = "BUY"
        confidence = "MEDIUM"
    elif prob <= 0.35:
        signal     = "SELL"
        confidence = "HIGH" if prob <= 0.25 else "MEDIUM"
    else:
        signal     = "HOLD"
        confidence = "LOW"
    
    return {
        "symbol":     sym,
        "price":      current_price,
        "signal":     signal,
        "up_prob":    up_prob,
        "confidence": confidence,
        "model_type": MODEL_TYPE,
    }

# ── Endpoints ──────────────────────────────────────────────────────────────
@router.get("/predict/{symbol}")
def predict(symbol: str):
    return predict_symbol(symbol.upper())

@router.get("/scan")
def scan_market():
    symbols = [
        "AAPL","MSFT","NVDA","TSLA","AMZN",
        "GOOGL","META","JPM","V","AMD",
        "INTC","NFLX","XOM","JNJ","WMT"
    ]
    results = []
    for sym in symbols:
        try:
            r = predict_symbol(sym)
            if "error" not in r:
                results.append(r)
        except Exception as e:
            print(f"⚠️ {sym}: {e}")
    
    results.sort(key=lambda x: x.get("up_prob", 0), reverse=True)
    return results

@router.get("/status")
def model_status():
    config_path = os.path.join(MODELS_DIR, 'nexaguard_config.json')
    if not os.path.exists(config_path):
        return {"loaded": False, "message": "No model found. Run: python ml/train.py"}
    with open(config_path) as f:
        config = json.load(f)
    return {
        "loaded":      MODEL is not None,
        "model_type":  config.get("model_type"),
        "trained_at":  config.get("trained_at"),
        "metrics":     config.get("metrics"),
        "scalers":     list(SCALERS.keys()) if SCALERS else [],
    }