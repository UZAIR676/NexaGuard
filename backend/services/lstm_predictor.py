"""
NexaGuard — ML Prediction Service
"""
import numpy as np
import pandas as pd
import yfinance as yf
import joblib, json, os
from fastapi import APIRouter
from pydantic import BaseModel

router     = APIRouter(prefix="/api/ml", tags=["ml"])
MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')

# ── Load Model ─────────────────────────────────────────────────────────────
_model   = None
_scalers = None
_config  = None

def load_model():
    global _model, _scalers, _config
    try:
        config_path = os.path.join(MODELS_DIR, 'nexaguard_config.json')
        if not os.path.exists(config_path):
            return False

        with open(config_path) as f:
            _config = json.load(f)

        _scalers = joblib.load(os.path.join(MODELS_DIR, 'nexaguard_scalers.pkl'))

        model_type = _config.get('model_type', 'lstm')
        if model_type == 'lstm':
            from tensorflow.keras.models import load_model as keras_load
            _model = keras_load(os.path.join(MODELS_DIR, 'nexaguard_lstm.keras'))
        elif model_type == 'xgboost':
            _model = joblib.load(os.path.join(MODELS_DIR, 'nexaguard_xgb.pkl'))
        elif model_type == 'hybrid':
            from tensorflow.keras.models import load_model as keras_load
            _model = {
                'lstm': keras_load(os.path.join(MODELS_DIR, 'nexaguard_lstm.keras')),
                'xgb':  joblib.load(os.path.join(MODELS_DIR, 'nexaguard_xgb.pkl'))
            }
        print(f"✅ ML Model loaded: {model_type} | Accuracy: {_config.get('metrics', {}).get('accuracy', 0)*100:.1f}%")
        return True
    except Exception as e:
        print(f"⚠️ ML Model not loaded: {e}")
        return False

load_model()

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
    hl                = df['High'] - df['Low']
    hc                = (df['High'] - df['Close'].shift()).abs()
    lc                = (df['Low']  - df['Close'].shift()).abs()
    tr                = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    df['ATR']         = tr.rolling(14).mean() / df['Close']
    df['Momentum']    = df['Close'].pct_change(10)
    return df.dropna()

# ── Predict ────────────────────────────────────────────────────────────────
def predict_symbol(symbol: str) -> dict:
    if _model is None:
        return {"error": "Model not loaded. Train first: python ml/train.py"}

    try:
        features   = _config['features']
        seq_len    = _config['seq_len']
        model_type = _config.get('model_type', 'lstm')

        df = yf.download(symbol.upper(), period='1y', progress=False, auto_adjust=True)
        if len(df) < seq_len + 50:
            return {"error": f"Insufficient data for {symbol}"}

        df     = add_features(df)
        scaler = _scalers.get(symbol.upper())

        if scaler is None:
            from sklearn.preprocessing import MinMaxScaler
            scaler = MinMaxScaler()
            scaler.fit(df[features])

        scaled = scaler.transform(df[features])
        seq    = scaled[-seq_len:].reshape(1, seq_len, len(features))

        if model_type == 'lstm':
            prob = float(_model.predict(seq, verbose=0)[0][0])
        elif model_type == 'xgboost':
            prob = float(_model.predict_proba(seq[:, -1, :])[0][1])
        elif model_type == 'hybrid':
            lstm_prob = float(_model['lstm'].predict(seq, verbose=0)[0][0])
            xgb_prob  = float(_model['xgb'].predict_proba(seq[:, -1, :])[0][1])
            prob      = lstm_prob * 0.6 + xgb_prob * 0.4

        # Signal
        if prob >= 0.65:   signal, confidence = "STRONG BUY",  "high"
        elif prob >= 0.55: signal, confidence = "BUY",         "moderate"
        elif prob >= 0.45: signal, confidence = "HOLD",        "low"
        elif prob >= 0.35: signal, confidence = "SELL",        "moderate"
        else:              signal, confidence = "STRONG SELL", "high"

        return {
            "symbol":      symbol.upper(),
            "up_prob":     round(prob * 100, 2),
            "down_prob":   round((1 - prob) * 100, 2),
            "signal":      signal,
            "confidence":  confidence,
            "model_type":  model_type,
            "model_accuracy": round(_config.get('metrics', {}).get('accuracy', 0) * 100, 1)
        }
    except Exception as e:
        return {"error": str(e)}

# ── Routes ─────────────────────────────────────────────────────────────────
@router.get("/predict/{symbol}")
def predict(symbol: str):
    return predict_symbol(symbol.upper())

@router.get("/models")
def model_info():
    if _config is None:
        return {"status": "No model trained yet", "train_cmd": "python ml/train.py"}
    return {
        "status":     "loaded",
        "model_type": _config.get('model_type'),
        "features":   len(_config.get('features', [])),
        "seq_len":    _config.get('seq_len'),
        "accuracy":   round(_config.get('metrics', {}).get('accuracy', 0) * 100, 1),
        "trained_at": _config.get('trained_at')
    }