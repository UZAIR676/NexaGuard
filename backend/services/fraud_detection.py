"""
NexaGuard — Fraud Detection Service
Uses trained Random Forest model
"""

import pickle
import numpy as np
from pathlib import Path

# Load model & scaler
BASE = Path(__file__).parent.parent / "models"

with open(BASE / "fraud_model.pkl", "rb") as f:
    model = pickle.load(f)

with open(BASE / "scaler.pkl", "rb") as f:
    scaler = pickle.load(f)

print("✅ Fraud model loaded!")


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

    # Build feature array (same order as training)
    features = [transaction.get("time", 0)]
    for i in range(1, 29):
        features.append(transaction.get(f"v{i}", 0.0))
    features.append(transaction.get("amount", 0.0))

    arr = np.array(features).reshape(1, -1)

    # Scale Time & Amount (index 0 and 29)
    arr[0][0]  = scaler.transform([[arr[0][0]]])[0][0]
    arr[0][29] = scaler.transform([[arr[0][29]]])[0][0]

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
    # Test with fake transaction
    test = {
        "time": 10000, "amount": 9999.99,
        "v1": -3.0, "v2": -2.5, "v3": -1.8,
        "v4": 0.5,  "v5": -1.2, "v6": -0.8,
        "v7": -2.1, "v8": 0.3,  "v9": -1.5,
        "v10": -2.0, "v11": 1.2, "v12": -2.8,
        "v13": 0.1, "v14": -3.1, "v15": 0.2,
        "v16": -1.1, "v17": -2.3, "v18": -0.9,
        "v19": 0.4, "v20": 0.1,  "v21": 0.3,
        "v22": -0.2, "v23": 0.1, "v24": -0.1,
        "v25": 0.2, "v26": 0.1,  "v27": 0.0,
        "v28": 0.1
    }

    result = predict_fraud(test)
    print("\n🔍 Fraud Detection Test:")
    print(f"  Amount:      ${result['amount']}")
    print(f"  Fraud Score: {result['fraud_score']}%")
    print(f"  Risk Level:  {result['risk_level']}")
    print(f"  Action:      {result['action']}")