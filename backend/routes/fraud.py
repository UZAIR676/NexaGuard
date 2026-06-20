"""
NexaGuard — Fraud Detection API Route
"""

from fastapi import APIRouter
from pydantic import BaseModel
from services.fraud_detection import predict_fraud
from services.transaction_log import log_transaction, get_stats, get_recent, get_alerts

router = APIRouter()


class Transaction(BaseModel):
    time:   float = 0.0
    amount: float = 0.0
    merchant: str = "API Transaction"
    v1:  float = 0.0;  v2:  float = 0.0;  v3:  float = 0.0
    v4:  float = 0.0;  v5:  float = 0.0;  v6:  float = 0.0
    v7:  float = 0.0;  v8:  float = 0.0;  v9:  float = 0.0
    v10: float = 0.0;  v11: float = 0.0;  v12: float = 0.0
    v13: float = 0.0;  v14: float = 0.0;  v15: float = 0.0
    v16: float = 0.0;  v17: float = 0.0;  v18: float = 0.0
    v19: float = 0.0;  v20: float = 0.0;  v21: float = 0.0
    v22: float = 0.0;  v23: float = 0.0;  v24: float = 0.0
    v25: float = 0.0;  v26: float = 0.0;  v27: float = 0.0
    v28: float = 0.0


@router.post("/api/fraud/detect")
def detect_fraud(tx: Transaction):
    payload = tx.dict()
    merchant = payload.pop("merchant", "API Transaction")
    result = predict_fraud(payload)

    # Log every check so dashboard stats/recent/alerts are real, not mock
    log_transaction(
        amount=result["amount"],
        fraud_score=result["fraud_score"],
        risk_level=result["risk_level"],
        is_fraud=result["is_fraud"],
        merchant=merchant,
    )
    return result


@router.get("/api/fraud/test")
def test_fraud():
    """Test with a suspicious transaction"""
    suspicious = {
        "time": 10000, "amount": 9999.99,
        "v1": -3.0, "v2": -2.5, "v3": -1.8,
        "v4": 0.5,  "v5": -1.2, "v6": -0.8,
        "v7": -2.1, "v8": 0.3,  "v9": -1.5,
        "v10": -2.0, "v11": 1.2, "v12": -2.8,
        "v13": 0.1,  "v14": -3.1, "v15": 0.2,
        "v16": -1.1, "v17": -2.3, "v18": -0.9,
        "v19": 0.4,  "v20": 0.1,  "v21": 0.3,
        "v22": -0.2, "v23": 0.1,  "v24": -0.1,
        "v25": 0.2,  "v26": 0.1,  "v27": 0.0,
        "v28": 0.1
    }
    return predict_fraud(suspicious)


@router.get("/api/fraud/stats")
def fraud_stats():
    """Real aggregate stats for the dashboard (replaces mock numbers)"""
    return get_stats()


@router.get("/api/fraud/recent")
def fraud_recent(limit: int = 10):
    """Most recent logged transactions (replaces MOCK_RECENT)"""
    return get_recent(limit)


@router.get("/api/fraud/alerts")
def fraud_alerts(limit: int = 10):
    """Recent medium/high risk events (replaces MOCK_ALERTS)"""
    return get_alerts(limit)