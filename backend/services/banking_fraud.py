"""
NexaGuard — Banking Fraud Detection Service
Uses the banking-specific model (trained on engineered transfer features),
not the credit-card V1-V28 model. See ml/train_banking_model.py for the
data/labeling disclosure.
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

FEATURE_ORDER = [
    "amount", "amount_to_balance_ratio", "is_new_recipient",
    "tx_count_last_24h", "hour_of_day", "is_round_number",
    "account_age_days", "is_outgoing",
]


def predict_banking_fraud(features: dict) -> dict:
    """
    features expects:
      amount, balance, is_new_recipient (0/1), tx_count_last_24h,
      account_age_days, is_outgoing (0/1)
    hour_of_day and is_round_number are derived automatically if not given.
    """
    amount = float(features.get("amount", 0))
    balance = float(features.get("balance", 1)) or 1.0
    amount_to_balance_ratio = amount / balance

    row = {
        "amount": amount,
        "amount_to_balance_ratio": amount_to_balance_ratio,
        "is_new_recipient": int(features.get("is_new_recipient", 0)),
        "tx_count_last_24h": int(features.get("tx_count_last_24h", 0)),
        "hour_of_day": features.get("hour_of_day", datetime.now().hour),
        "is_round_number": 1 if (amount % 100 == 0 or amount % 500 == 0) else 0,
        "account_age_days": float(features.get("account_age_days", 30)),
        "is_outgoing": int(features.get("is_outgoing", 1)),
    }

    arr = np.array([[row[c] for c in FEATURE_ORDER]], dtype=float)

    # Scale the 3 continuous columns (amount, ratio, account_age_days) — indices 0,1,6
    scaled_part = banking_scaler.transform(arr[:, [0, 1, 6]])
    arr[:, [0, 1, 6]] = scaled_part

    proba = banking_model.predict_proba(arr)[0]
    fraud_score = round(float(proba[1]) * 100, 2)

    risk_level = (
        "HIGH RISK" if fraud_score > 70 else
        "MEDIUM RISK" if fraud_score > 30 else
        "LOW RISK" if fraud_score > 10 else
        "SAFE"
    )

    return {
        "fraud_score": fraud_score,
        "risk_level": risk_level,
        "is_fraud": fraud_score > 70,
        "amount": amount,
    }