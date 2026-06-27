"""
NexaGuard — Banking Fraud Detection Service
"""
import pickle
import numpy as np
from pathlib import Path
from datetime import datetime

BASE = Path(__file__).parent.parent / "models"

with open(BASE / "banking_fraud_model.pkl", "rb") as f:
    banking_model = pickle.load(f)

with open(BASE / "banking_fraud_scaler.pkl", "rb") as f:
    banking_scaler = pickle.load(f)

# Must match train_banking_model.py feature_cols exactly
FEATURE_ORDER = [
    "amount",
    "hour_of_day",
    "is_round_number",
    "account_age_days",
    "is_outgoing",
]

def predict_banking_fraud(features: dict) -> dict:
    amount = float(features.get("amount", 0))

    row = {
        "amount":          amount,
        "hour_of_day":     features.get("hour_of_day", datetime.now().hour),
        "is_round_number": 1 if (amount % 100 == 0 or amount % 500 == 0) else 0,
        "account_age_days": float(features.get("account_age_days", 30)),
        "is_outgoing":     int(features.get("is_outgoing", 1)),
    }

    arr = np.array([[row[c] for c in FEATURE_ORDER]], dtype=float)

    # Scale amount (col 0) and account_age_days (col 3)
    arr[:, [0, 3]] = banking_scaler.transform(arr[:, [0, 3]])

    proba       = banking_model.predict_proba(arr)[0]
    fraud_score = round(float(proba[1]) * 100, 2)

    risk_level = (
        "HIGH RISK"   if fraud_score > 70 else
        "MEDIUM RISK" if fraud_score > 30 else
        "LOW RISK"    if fraud_score > 10 else
        "SAFE"
    )

    return {
        "fraud_score": fraud_score,
        "risk_level":  risk_level,
        "is_fraud":    fraud_score > 70,
        "amount":      amount,
    }