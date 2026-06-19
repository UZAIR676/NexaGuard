"""
NexaGuard — Fraud Detection API Route
"""

from fastapi import APIRouter
from pydantic import BaseModel
from services.fraud_detection import predict_fraud

router = APIRouter()


class Transaction(BaseModel):
    time:   float = 0.0
    amount: float = 0.0
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
    return predict_fraud(tx.dict())


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