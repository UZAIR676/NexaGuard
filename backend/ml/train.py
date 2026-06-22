"""
NexaGuard — Production ML Training Pipeline
Supports: LSTM, XGBoost, Hybrid
Run: python ml/train.py --model lstm --symbols AAPL MSFT NVDA
"""
import numpy as np
import pandas as pd
import yfinance as yf
import joblib, json, os, argparse, warnings
from datetime import datetime
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
from sklearn.model_selection import TimeSeriesSplit
from collections import Counter
warnings.filterwarnings('ignore')

# ── Config ─────────────────────────────────────────────────────────────────
SEQ_LEN      = 60
PERIOD       = '5y'
MODELS_DIR   = os.path.join(os.path.dirname(__file__), '..', 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURE_COLS = [
    'Returns', 'HL_ratio', 'OC_ratio',
    'SMA_10', 'SMA_20', 'SMA_50',
    'EMA_12', 'EMA_26',
    'MACD', 'MACD_signal', 'MACD_hist',
    'RSI', 'BB_pct', 'Vol_ratio',
    'ATR', 'Momentum'
]

# ── Feature Engineering ────────────────────────────────────────────────────
def add_features(df):
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.copy()

    # Basic
    df['Returns']  = df['Close'].pct_change()
    df['HL_ratio'] = (df['High'] - df['Low']) / df['Close']
    df['OC_ratio'] = (df['Close'] - df['Open']) / df['Open']

    # Moving averages
    df['SMA_10'] = df['Close'].rolling(10).mean()
    df['SMA_20'] = df['Close'].rolling(20).mean()
    df['SMA_50'] = df['Close'].rolling(50).mean()
    df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
    df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()

    # MACD
    df['MACD']        = df['EMA_12'] - df['EMA_26']
    df['MACD_signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['MACD_hist']   = df['MACD'] - df['MACD_signal']

    # RSI
    delta = df['Close'].diff()
    gain  = delta.where(delta > 0, 0).rolling(14).mean()
    loss  = (-delta.where(delta < 0, 0)).rolling(14).mean()
    df['RSI'] = 100 - (100 / (1 + gain / loss))

    # Bollinger
    sma20    = df['Close'].rolling(20).mean()
    std20    = df['Close'].rolling(20).std()
    bb_upper = sma20 + std20 * 2
    bb_lower = sma20 - std20 * 2
    bb_range = bb_upper - bb_lower
    bb_range = bb_range.replace(0, np.nan)
    df['BB_pct'] = ((df['Close'] - bb_lower) / bb_range).squeeze()

    # Volume
    vol_ma = df['Volume'].rolling(20).mean().replace(0, np.nan)
    df['Vol_ratio'] = df['Volume'] / vol_ma

    # ATR (Average True Range)
    high_low   = df['High'] - df['Low']
    high_close = (df['High'] - df['Close'].shift()).abs()
    low_close  = (df['Low']  - df['Close'].shift()).abs()
    tr         = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df['ATR']  = tr.rolling(14).mean() / df['Close']

    # Momentum
    df['Momentum'] = df['Close'].pct_change(10)

    # ── Target (NO leakage) ────────────────────────────────────────────────
    # 2-day forward return > 0.5% = BUY signal
    future_return  = df['Close'].shift(-2) / df['Close'] - 1
    df['Target']   = (future_return > 0.005).astype(int)

    # Drop rows where target would use future data
    df = df.iloc[:-2]

    return df.dropna()

# ── Data Download ──────────────────────────────────────────────────────────
def download_data(symbols):
    all_data = {}
    for i, sym in enumerate(symbols):
        try:
            df = yf.download(sym, period=PERIOD, progress=False, auto_adjust=True)
            if len(df) < 200: continue
            df = add_features(df)
            all_data[sym] = df
            print(f"  ✅ {sym} ({i+1}/{len(symbols)}): {len(df)} rows")
        except Exception as e:
            print(f"  ❌ {sym}: {e}")
    return all_data

# ── Sequence Builder ───────────────────────────────────────────────────────
def make_sequences(data_dict, seq_len=SEQ_LEN):
    X_all, y_all, scalers = [], [], {}
    for sym, df in data_dict.items():
        try:
            scaler = MinMaxScaler()
            # ── Fit scaler only on train portion (no leakage) ──────────────
            n        = len(df)
            train_n  = int(n * 0.8)
            scaler.fit(df[FEATURE_COLS].iloc[:train_n])
            scaled   = scaler.transform(df[FEATURE_COLS])
            targets  = df['Target'].values

            for i in range(seq_len, n):
                X_all.append(scaled[i-seq_len:i])
                y_all.append(targets[i])
            scalers[sym] = scaler
        except Exception as e:
            print(f"  ⚠️ Sequence error {sym}: {e}")

    return np.array(X_all), np.array(y_all), scalers

# ── Time-aware Train/Test Split ────────────────────────────────────────────
def time_split(X, y, test_ratio=0.2):
    split = int(len(X) * (1 - test_ratio))
    return X[:split], X[split:], y[:split], y[split:]

# ── Evaluation ────────────────────────────────────────────────────────────
def evaluate(y_true, y_pred, y_prob=None, name="Model"):
    acc  = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec  = recall_score(y_true, y_pred, zero_division=0)
    f1   = f1_score(y_true, y_pred, zero_division=0)
    print(f"\n{'='*50}")
    print(f"📊 {name} Evaluation")
    print(f"{'='*50}")
    print(f"Accuracy  : {acc*100:.2f}%")
    print(f"Precision : {prec*100:.2f}%")
    print(f"Recall    : {rec*100:.2f}%")
    print(f"F1 Score  : {f1*100:.2f}%")
    print(f"\n{classification_report(y_true, y_pred)}")
    return {"accuracy": acc, "precision": prec, "recall": rec, "f1": f1}

# ── Backtesting ────────────────────────────────────────────────────────────
def backtest(y_true, y_prob, threshold=0.6):
    """Simple backtest — only trade when confidence > threshold"""
    signals  = (y_prob > threshold).astype(int)
    traded   = signals.sum()
    if traded == 0:
        print("⚠️ No trades above threshold")
        return
    correct  = ((signals == 1) & (y_true == 1)).sum()
    win_rate = correct / traded
    print(f"\n📈 Backtest (threshold={threshold})")
    print(f"Total signals : {traded}")
    print(f"Win rate      : {win_rate*100:.1f}%")
    print(f"Edge vs random: {(win_rate - 0.5)*100:+.1f}%")

# ── LSTM Model ─────────────────────────────────────────────────────────────
def train_lstm(X_train, y_train, X_test, y_test):
    try:
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization, Input
        from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
        from tensorflow.keras.optimizers import Adam
    except ImportError:
        print("❌ tensorflow not installed"); return None, None

    ratio = Counter(y_train)[0] / max(Counter(y_train)[1], 1)

    model = Sequential([
        Input(shape=(SEQ_LEN, len(FEATURE_COLS))),
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
    model.compile(optimizer=Adam(0.001), loss='binary_crossentropy', metrics=['accuracy'])

    callbacks = [
        EarlyStopping(patience=10, restore_best_weights=True, monitor='val_loss'),
        ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-6),
    ]

    model.fit(
        X_train, y_train,
        validation_data=(X_test, y_test),
        epochs=100, batch_size=128,
        class_weight={0: 1.0, 1: float(ratio)},
        callbacks=callbacks, verbose=1
    )

    y_prob = model.predict(X_test, verbose=0).flatten()
    y_pred = (y_prob > 0.5).astype(int)
    return model, y_prob, y_pred

# ── XGBoost Model ──────────────────────────────────────────────────────────
def train_xgboost(X_train, y_train, X_test, y_test):
    try:
        from xgboost import XGBClassifier
    except ImportError:
        print("❌ xgboost not installed. Run: pip install xgboost"); return None, None, None

    ratio = Counter(y_train)[0] / max(Counter(y_train)[1], 1)

    # Use last timestep features only for XGBoost
    X_tr = X_train[:, -1, :]
    X_te = X_test[:, -1, :]

    model = XGBClassifier(
        n_estimators=500,
        max_depth=5,
        learning_rate=0.01,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=ratio,
        eval_metric='logloss',
        early_stopping_rounds=20,
        random_state=42,
        verbosity=0
    )
    model.fit(X_tr, y_train, eval_set=[(X_te, y_test)], verbose=100)

    y_prob = model.predict_proba(X_te)[:, 1]
    y_pred = (y_prob > 0.5).astype(int)
    return model, y_prob, y_pred

# ── Save ───────────────────────────────────────────────────────────────────
def save_model(model, scalers, metrics, model_type):
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    if model_type == 'lstm':
        model.save(os.path.join(MODELS_DIR, 'nexaguard_lstm.keras'))
    else:
        joblib.dump(model, os.path.join(MODELS_DIR, 'nexaguard_xgb.pkl'))

    joblib.dump(scalers, os.path.join(MODELS_DIR, 'nexaguard_scalers.pkl'))
    with open(os.path.join(MODELS_DIR, 'nexaguard_config.json'), 'w') as f:
        json.dump({
            'model_type':  model_type,
            'features':    FEATURE_COLS,
            'seq_len':     SEQ_LEN,
            'metrics':     metrics,
            'trained_at':  ts
        }, f, indent=2)
    print(f"\n✅ Model saved to backend/models/")

# ── Main ───────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model',   default='lstm', choices=['lstm','xgboost','hybrid'])
    parser.add_argument('--symbols', nargs='+', default=[
        'AAPL','MSFT','NVDA','TSLA','AMZN','GOOGL','META','JPM',
        'V','XOM','BAC','WFC','GS','MA','JNJ','WMT','COST','NFLX'
    ])
    args = parser.parse_args()

    print(f"\n🚀 NexaGuard ML Training — {args.model.upper()}")
    print(f"Symbols: {args.symbols}\n")

    # Download
    data = download_data(args.symbols)
    if not data:
        print("❌ No data!"); return

    # Sequences
    X, y, scalers = make_sequences(data)
    X_train, X_test, y_train, y_test = time_split(X, y)

    print(f"\n📊 Train: {X_train.shape} | Test: {X_test.shape}")
    print(f"Label balance — UP: {y_train.mean()*100:.1f}% | DOWN: {(1-y_train.mean())*100:.1f}%")

    # Train
    if args.model == 'lstm':
        model, y_prob, y_pred = train_lstm(X_train, y_train, X_test, y_test)
    elif args.model == 'xgboost':
        model, y_prob, y_pred = train_xgboost(X_train, y_train, X_test, y_test)
    elif args.model == 'hybrid':
        print("\n🔄 Training LSTM...")
        lstm_model, lstm_prob, _ = train_lstm(X_train, y_train, X_test, y_test)
        print("\n🔄 Training XGBoost...")
        xgb_model, xgb_prob, _  = train_xgboost(X_train, y_train, X_test, y_test)
        # Ensemble
        y_prob = (lstm_prob * 0.6 + xgb_prob * 0.4)
        y_pred = (y_prob > 0.5).astype(int)
        model  = {'lstm': lstm_model, 'xgb': xgb_model}
        args.model = 'hybrid'

    if model is None:
        print("❌ Training failed"); return

    # Evaluate
    metrics = evaluate(y_test, y_pred, y_prob, args.model.upper())

    # Backtest
    backtest(y_test, y_prob, threshold=0.6)
    backtest(y_test, y_prob, threshold=0.65)

    # Save
    save_model(model, scalers, metrics, args.model)

if __name__ == "__main__":
    main()