"""
NexaGuard — Fraud Detection Service (v2 — Fixed)
Uses trained Random Forest model + separate Time/Amount scalers
"""

import pickle
import numpy as np
from pathlib import Path

# Load model & scalers
BASE = Path(__file__).parent.parent / "models"

with open(BASE / "fraud_model.pkl", "rb") as f:
    model = pickle.load(f)

with open(BASE / "scaler_amount.pkl", "rb") as f:
    scaler_amount = pickle.load(f)

with open(BASE / "scaler_time.pkl", "rb") as f:
    scaler_time = pickle.load(f)

print("✅ Fraud model + scalers loaded!")


def predict_fraud(transaction: dict) -> dict:
    """
    Input: transaction dict with these fields:
    {
        "time": 10000,
        "amount": 150.0,
        "v1": -1.35, "v2": -0.07, ... "v28": 0.01
    }
    Output: fraud prediction with risk score
    """

    # Build feature array (same order as training: Time, V1..V28, Amount)
    features = [transaction.get("time", 0)]
    for i in range(1, 29):
        features.append(transaction.get(f"v{i}", 0.0))
    features.append(transaction.get("amount", 0.0))

    arr = np.array(features, dtype=float).reshape(1, -1)

    # Scale Time (index 0) and Amount (index 29) — FIX: separate scalers
    arr[0][0]  = scaler_time.transform([[arr[0][0]]])[0][0]
    arr[0][29] = scaler_amount.transform([[arr[0][29]]])[0][0]

    # Predict
    pred  = model.predict(arr)[0]
    proba = model.predict_proba(arr)[0]

    fraud_score = round(float(proba[1]) * 100, 2)

    return {
        "is_fraud":    bool(pred == 1),
        "fraud_score": fraud_score,
        "risk_level":  _risk_level(fraud_score),
        "action":      "🚨 BLOCK TRANSACTION" if pred == 1 else "✅ APPROVE",
        "amount":      transaction.get("amount", 0),
    }


def _risk_level(score: float) -> str:
    if score >= 70: return "HIGH RISK"
    if score >= 40: return "MEDIUM RISK"
    if score >= 20: return "LOW RISK"
    return "SAFE"


if __name__ == "__main__":
    # Test: same v-values, different amounts — Amount should now matter
    for amt in [2, 500, 5000, 25000, 99999]:
        test = {
            "time": 3, "amount": amt,
            "v1": 0.0, "v2": 0.0, "v3": 0.0, "v4": 0.0, "v5": 0.0,
            "v6": 0.0, "v7": 0.0, "v8": 0.0, "v9": 0.0, "v10": 0.0,
            "v11": 0.0, "v12": 0.0, "v13": 0.0, "v14": 0.0, "v15": 0.0,
            "v16": 0.0, "v17": 0.0, "v18": 0.0, "v19": 0.0, "v20": 0.0,
            "v21": 0.0, "v22": 0.0, "v23": 0.0, "v24": 0.0, "v25": 0.0,
            "v26": 0.0, "v27": 0.0, "v28": 0.0
        }
        result = predict_fraud(test)
        print(f"\nAmount: ${amt}")
        print(f"  Fraud Score: {result['fraud_score']}%")
        print(f"  Risk Level:  {result['risk_level']}")
        print(f"  Action:      {result['action']}")