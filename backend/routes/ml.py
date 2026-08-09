from fastapi import APIRouter
import numpy as np
import pandas as pd
import yfinance as yf
import joblib, json, os
import warnings
warnings.filterwarnings('ignore')

router = APIRouter(prefix="/api/ml", tags=["ml"])

MODELS_DIR   = os.path.join(os.path.dirname(__file__), '..', 'models')
SEQ_LEN      = 60
FEATURE_COLS = [
    'Returns', 'HL_ratio', 'OC_ratio',
    'SMA_10', 'SMA_20', 'SMA_50',
    'EMA_12', 'EMA_26',
    'MACD', 'MACD_signal', 'MACD_hist',
    'RSI', 'BB_pct', 'Vol_ratio',
    'ATR', 'Momentum'
]

# ── LSTM Compatibility Patch ───────────────────────────────────────────────
def _load_lstm_safe(path):
    """
    Purane models mein 'batch_shape' hota tha, naye TF mein 'batch_input_shape'.
    Pehle normal load try karo, fail hone par custom_objects + compile=False se try.
    """
    from tensorflow.keras.models import load_model as keras_load
    import tensorflow as tf

    # Try 1: Normal load
    try:
        return keras_load(path)
    except Exception:
        pass

    # Try 2: compile=False (ignore optimizer state)
    try:
        return keras_load(path, compile=False)
    except Exception:
        pass

    # Try 3: Rebuild from weights — batch_shape issue ka permanent fix
    try:
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization, Input

        # Config file se architecture padho
        config_path = os.path.join(MODELS_DIR, 'nexaguard_config.json')
        with open(config_path) as f:
            cfg = json.load(f)
        n_features = len(cfg.get('features', FEATURE_COLS))
        seq_len    = cfg.get('seq_len', SEQ_LEN)

        model = Sequential([
            Input(shape=(seq_len, n_features)),
            LSTM(128, return_sequences=True),
            Dropout(0.3),
            BatchNormalization(),
            LSTM(64, return_sequences=True),
            Dropout(0.3),
            BatchNormalization(),
            LSTM(32, return_sequences=False),
            Dropout(0.2),
            Dense(16, activation='relu'),
            Dense(1,  activation='sigmoid')
        ])
        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

        # .keras format — weights alag file nahi hoti, try h5 fallback
        h5_path = path.replace('.keras', '.h5')
        if os.path.exists(h5_path):
            model.load_weights(h5_path)
            print("⚠️ Loaded weights from .h5 fallback")
            return model

        print("⚠️ Architecture rebuild ho gayi lekin weights load nahi hue — retrain karo")
        return None
    except Exception as e:
        print(f"❌ LSTM load completely failed: {e}")
        return None

# ── Model Load (ek baar startup pe) ───────────────────────────────────────
def load_model():
    config_path = os.path.join(MODELS_DIR, 'nexaguard_config.json')
    if not os.path.exists(config_path):
        return None, None, None

    with open(config_path) as f:
        config = json.load(f)

    model_type = config.get('model_type', 'lstm')

    scalers_path = os.path.join(MODELS_DIR, 'nexaguard_scalers.pkl')
    if not os.path.exists(scalers_path):
        return None, None, model_type
    scalers = joblib.load(scalers_path)

    if model_type == 'lstm':
        model = _load_lstm_safe(os.path.join(MODELS_DIR, 'nexaguard_lstm.keras'))

    elif model_type == 'xgboost':
        model = joblib.load(os.path.join(MODELS_DIR, 'nexaguard_xgb.pkl'))

    elif model_type == 'hybrid':
        xgb_m  = joblib.load(os.path.join(MODELS_DIR, 'nexaguard_xgb.pkl'))
        lstm_m = _load_lstm_safe(os.path.join(MODELS_DIR, 'nexaguard_lstm.keras'))
        model  = {'lstm': lstm_m, 'xgb': xgb_m}

    else:
        model = None

    return model, scalers, model_type

# Was eagerly loaded here at import time — this duplicated the same
# tensorflow.keras load that services/lstm_predictor.py also does, so the
# server was paying that ~10-20s cost TWICE on every startup. Now it's
# lazy: _ensure_model_loaded() is called on first request to any endpoint
# below instead, so uvicorn boots in seconds.
MODEL, SCALERS, MODEL_TYPE = None, None, None

def _ensure_model_loaded():
    global MODEL, SCALERS, MODEL_TYPE
    if MODEL is not None:
        return
    print("🔄 Loading ML model (first request)...")
    try:
        MODEL, SCALERS, MODEL_TYPE = load_model()
        if MODEL is not None:
            print(f"✅ ML Model loaded! Type: {MODEL_TYPE}")
        else:
            print("⚠️ ML Model not loaded — XGBoost use hoga agar available ho")
    except Exception as e:
        print(f"⚠️ ML load error: {e}")
        MODEL, SCALERS, MODEL_TYPE = None, None, None

# ── Feature Engineering ────────────────────────────────────────────────────
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
    delta             = df['Close'].diff()
    gain              = delta.where(delta > 0, 0).rolling(14).mean()
    loss              = (-delta.where(delta < 0, 0)).rolling(14).mean()
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

# ── Predict Core ───────────────────────────────────────────────────────────
def predict_symbol(sym: str):
    _ensure_model_loaded()
    if MODEL is None:
        return {"error": "Model not loaded. Run: python ml/train.py --model xgboost"}

    df = yf.download(sym, period='6mo', progress=False, auto_adjust=True)
    if len(df) < SEQ_LEN + 10:
        return {"error": f"Not enough data for {sym}"}

    df = add_features(df)
    if len(df) < SEQ_LEN:
        return {"error": "Not enough processed data after feature engineering"}

    scaler = SCALERS.get(sym) or list(SCALERS.values())[0]
    scaled = scaler.transform(df[FEATURE_COLS])
    seq    = scaled[-SEQ_LEN:].reshape(1, SEQ_LEN, len(FEATURE_COLS))

    # ── FIX: NaN price bug ──────────────────────────────────────────────
    # yfinance kabhi kabhi aaj ka partial/incomplete row deta hai jismein
    # Close abhi NaN hota hai (market-open se pehle ya data lag ki wajah
    # se). Pehle seedha df['Close'].iloc[-1] le liya jata tha jo NaN ho
    # sakta tha aur frontend mein "$NaN" dikhta tha. Ab last VALID close
    # dhoondte hain — agar koi bhi valid close na mile to explicit error
    # return karte hain (silently NaN pass nahi karte).
    current_price = df['Close'].iloc[-1]
    if pd.isna(current_price):
        valid_closes = df['Close'].dropna()
        if valid_closes.empty:
            return {"error": f"No valid price data for {sym}"}
        current_price = valid_closes.iloc[-1]
    current_price = float(current_price)

    # ── Predict by model type ──────────────────────────────────────────────
    if MODEL_TYPE == 'lstm':
        if MODEL is None:
            return {"error": "LSTM model failed to load — retrain: python ml/train.py --model xgboost"}
        prob = float(MODEL.predict(seq, verbose=0)[0][0])

    elif MODEL_TYPE == 'xgboost':
        prob = float(MODEL.predict_proba(seq[:, -1, :])[0][1])

    elif MODEL_TYPE == 'hybrid':
        probs = []
        if MODEL.get('lstm'):
            probs.append(float(MODEL['lstm'].predict(seq, verbose=0)[0][0]) * 0.6)
        if MODEL.get('xgb'):
            probs.append(float(MODEL['xgb'].predict_proba(seq[:, -1, :])[0][1]) * 0.4)
        if not probs:
            return {"error": "Hybrid model ke dono components load nahi hue"}
        prob = sum(probs)

    up_prob = round(prob * 100, 2)

    if prob >= 0.60:
        signal, confidence = "BUY", "HIGH"
    elif prob >= 0.55:
        signal, confidence = "BUY", "MEDIUM"
    elif prob <= 0.35:
        signal, confidence = "SELL", "HIGH"
    elif prob <= 0.40:
        signal, confidence = "SELL", "MEDIUM"
    else:
        signal, confidence = "HOLD", "LOW"

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