import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import pickle
from pathlib import Path

np.random.seed(42)
N = 8000

MODELS_DIR = Path(__file__).parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


def generate_dataset(n=N):
    rows = []
    for _ in range(n):
        tx_type = np.random.choice(["send", "withdraw", "deposit", "receive"], p=[0.45, 0.15, 0.2, 0.2])

        balance = float(np.random.lognormal(mean=8, sigma=1.2))          # account balance, skewed
        balance = max(50, min(balance, 500000))

        # Outgoing transactions risk-relevant; incoming (deposit/receive) lower baseline risk
        if tx_type in ["send", "withdraw"]:
            amount = float(np.random.lognormal(mean=5, sigma=1.5))
        else:
            amount = float(np.random.lognormal(mean=5.5, sigma=1.2))
        amount = max(1, min(amount, balance * 3 if balance > 0 else amount))

        amount_to_balance_ratio = amount / balance if balance > 0 else 1.0
        is_new_recipient = np.random.choice([0, 1], p=[0.7, 0.3]) if tx_type == "send" else 0
        tx_count_last_24h = np.random.poisson(1.5)
        hour_of_day = np.random.randint(0, 24)
        is_round_number = 1 if amount % 100 == 0 or amount % 500 == 0 else 0
        account_age_days = float(np.random.exponential(scale=200))
        account_age_days = max(0, min(account_age_days, 3000))

        # --- Rule-based synthetic risk score (domain heuristics) ---
        risk = 0.0
        risk += min(amount_to_balance_ratio, 3) * 18
        risk += is_new_recipient * 22
        risk += min(tx_count_last_24h, 10) * 4
        risk += 15 if hour_of_day in [0, 1, 2, 3, 4] else 0
        risk += 8 if is_round_number else 0
        risk += 20 if account_age_days < 3 else (8 if account_age_days < 14 else 0)
        risk += 10 if tx_type in ["send", "withdraw"] else -5

        risk += np.random.normal(0, 12)  # noise so it's not a pure lookup table
        is_fraud = 1 if risk > 55 else 0

        rows.append({
            "amount": amount,
            "amount_to_balance_ratio": amount_to_balance_ratio,
            "is_new_recipient": is_new_recipient,
            "tx_count_last_24h": tx_count_last_24h,
            "hour_of_day": hour_of_day,
            "is_round_number": is_round_number,
            "account_age_days": account_age_days,
            "is_outgoing": 1 if tx_type in ["send", "withdraw"] else 0,
            "is_fraud": is_fraud,
        })

    return pd.DataFrame(rows)


def main():
    print("Generating synthetic banking transaction dataset...")
    df = generate_dataset()
    print(f"Dataset shape: {df.shape}, fraud rate: {df['is_fraud'].mean():.3f}")

    feature_cols = [
        "amount", "amount_to_balance_ratio", "is_new_recipient",
        "tx_count_last_24h", "hour_of_day", "is_round_number",
        "account_age_days", "is_outgoing",
    ]
    X = df[feature_cols]
    y = df["is_fraud"]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X[["amount", "amount_to_balance_ratio", "account_age_days"]])
    X_full = X.copy()
    X_full[["amount", "amount_to_balance_ratio", "account_age_days"]] = X_scaled

    X_train, X_test, y_train, y_test = train_test_split(X_full, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(n_estimators=150, max_depth=10, class_weight="balanced", random_state=42)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    print(classification_report(y_test, preds))

    with open(MODELS_DIR / "banking_fraud_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(MODELS_DIR / "banking_fraud_scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)

    print("✅ Saved banking_fraud_model.pkl and banking_fraud_scaler.pkl to", MODELS_DIR)


if __name__ == "__main__":
    main()