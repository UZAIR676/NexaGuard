"""
NexaGuard — CSV Bulk Fraud Scanner (Batch Mode — Fast)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import io, csv, warnings
warnings.filterwarnings('ignore')

router = APIRouter(prefix="/api/csv", tags=["csv"])

# ── Load model once ────────────────────────────────────────────────────────
from services.fraud_detection import model, scaler_amount, scaler_time

# ── Batch Predict ──────────────────────────────────────────────────────────
def batch_predict(df: pd.DataFrame):
    # Build feature matrix — order: Time, V1..V28, Amount
    cols = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]
    X = df[cols].values.astype(float)

    # Scale Time (col 0) and Amount (col 29)
    X[:, 0]  = scaler_time.transform(X[:, 0].reshape(-1, 1)).flatten()
    X[:, 29] = scaler_amount.transform(X[:, 29].reshape(-1, 1)).flatten()

    # Batch predict
    preds  = model.predict(X)
    probas = model.predict_proba(X)[:, 1]
    return preds, probas

def risk_level(score):
    if score >= 70: return "HIGH RISK"
    if score >= 40: return "MEDIUM RISK"
    if score >= 20: return "LOW RISK"
    return "SAFE"

# ── Routes ─────────────────────────────────────────────────────────────────
@router.post("/scan")
async def scan_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Only CSV files allowed")

    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))
    except:
        raise HTTPException(400, "Invalid CSV format")

    df.columns = [c.strip() for c in df.columns]

    if "Time" not in df.columns or "Amount" not in df.columns:
        raise HTTPException(400, "Missing columns: Time and Amount required")

    # Fill missing V columns
    for i in range(1, 29):
        col = f"V{i}"
        if col not in df.columns:
            df[col] = 0.0

    # Batch predict
    preds, probas = batch_predict(df)

    results       = []
    fraud_count   = 0
    total_blocked = 0.0

    for idx in range(len(df)):
        score    = round(float(probas[idx]) * 100, 2)
        is_fraud = bool(preds[idx] == 1)
        amount   = float(df.iloc[idx]["Amount"])

        if is_fraud:
            fraud_count   += 1
            total_blocked += amount

        results.append({
            "row":        idx + 1,
            "amount":     amount,
            "fraud_score": score,
            "is_fraud":   is_fraud,
            "risk_level": risk_level(score),
            "action":     "BLOCK" if is_fraud else "APPROVE",
        })
    total = len(results)
    return {
        "total":         total,
        "fraud_count":   fraud_count,
        "safe_count":    total - fraud_count,
        "fraud_rate":    round(fraud_count / total * 100, 2) if total > 0 else 0,
        "total_blocked": round(total_blocked, 2),
        "results":       results
    }

@router.post("/export")
async def export_results(file: UploadFile = File(...)):
    scan_result = await scan_csv(file)
    results     = scan_result["results"]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["row","amount","fraud_score","is_fraud","risk_level","action"])
    writer.writeheader()
    writer.writerows(results)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nexaguard_scan_results.csv"}
    )