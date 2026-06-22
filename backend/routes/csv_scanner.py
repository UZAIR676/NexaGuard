"""
NexaGuard — CSV Bulk Fraud Scanner (Batch Mode + DB Save)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import io, csv, warnings, sqlite3, os, json
from datetime import datetime
warnings.filterwarnings('ignore')

router = APIRouter(prefix="/api/csv", tags=["csv"])
DB     = os.path.join(os.path.dirname(__file__), '..', 'nexaguard.db')

def init_db():
    con = sqlite3.connect(DB)
    con.execute("""
        CREATE TABLE IF NOT EXISTS csv_scans (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_token    TEXT,
            filename      TEXT,
            total         INTEGER,
            fraud_count   INTEGER,
            safe_count    INTEGER,
            fraud_rate    REAL,
            total_blocked REAL,
            results       TEXT,
            created_at    TEXT DEFAULT (datetime('now'))
        )
    """)
    con.commit()
    con.close()

init_db()

from services.fraud_detection import model, scaler_amount, scaler_time
from routes.auth import get_user_by_token

def require_staff(token: str):
    user = get_user_by_token(token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Only admin or analyst can access the CSV scanner")
    return user

def batch_predict(df: pd.DataFrame):
    cols = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]
    X    = df[cols].values.astype(float)
    X[:, 0]  = scaler_time.transform(X[:, 0].reshape(-1, 1)).flatten()
    X[:, 29] = scaler_amount.transform(X[:, 29].reshape(-1, 1)).flatten()
    preds  = model.predict(X)
    probas = model.predict_proba(X)[:, 1]
    return preds, probas

def risk_level(score):
    if score >= 70: return "HIGH RISK"
    if score >= 40: return "MEDIUM RISK"
    if score >= 20: return "LOW RISK"
    return "SAFE"

@router.post("/scan")
async def scan_csv(file: UploadFile = File(...), token: str = ""):
    require_staff(token)
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

    for i in range(1, 29):
        col = f"V{i}"
        if col not in df.columns:
            df[col] = 0.0

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
            "row":         idx + 1,
            "amount":      amount,
            "fraud_score": score,
            "is_fraud":    is_fraud,
            "risk_level":  risk_level(score),
            "action":      "BLOCK" if is_fraud else "APPROVE",
        })

    results.sort(key=lambda x: x["fraud_score"], reverse=True)
    total = len(results)

    scan_data = {
        "total":         total,
        "fraud_count":   fraud_count,
        "safe_count":    total - fraud_count,
        "fraud_rate":    round(fraud_count / total * 100, 2) if total > 0 else 0,
        "total_blocked": round(total_blocked, 2),
        "results":       results,
    }

    # ✅ FIX: cursor pe lastrowid hota hai, connection pe nahi
    try:
        con = sqlite3.connect(DB)
        cur = con.execute("""
            INSERT INTO csv_scans
              (user_token, filename, total, fraud_count, safe_count, fraud_rate, total_blocked, results)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            token, file.filename, total, fraud_count,
            total - fraud_count,
            round(fraud_count / total * 100, 2) if total > 0 else 0,
            round(total_blocked, 2),
            json.dumps(results[:1000]),
        ))
        scan_data["scan_id"] = cur.lastrowid   # ✅ cur.lastrowid
        con.commit()
        con.close()
    except Exception as e:
        print(f"DB save error: {e}")

    return scan_data


@router.get("/history")
async def get_history(token: str = ""):
    require_staff(token)
    try:
        con  = sqlite3.connect(DB)
        rows = con.execute("""
            SELECT id, filename, total, fraud_count, fraud_rate, total_blocked, created_at
            FROM csv_scans WHERE user_token=?
            ORDER BY created_at DESC LIMIT 20
        """, (token,)).fetchall()
        con.close()
        return [
            {"id": r[0], "filename": r[1], "total": r[2], "fraud_count": r[3],
             "fraud_rate": r[4], "total_blocked": r[5], "created_at": r[6]}
            for r in rows
        ]
    except:
        return []


@router.get("/history/{scan_id}")
async def get_scan_detail(scan_id: int, token: str = ""):
    require_staff(token)
    try:
        con = sqlite3.connect(DB)
        row = con.execute("""
            SELECT id, filename, total, fraud_count, safe_count, fraud_rate, total_blocked, results, created_at
            FROM csv_scans WHERE id=? AND user_token=?
        """, (scan_id, token)).fetchone()
        con.close()
        if not row:
            raise HTTPException(404, "Scan not found")
        return {
            "id": row[0], "filename": row[1], "total": row[2],
            "fraud_count": row[3], "safe_count": row[4],
            "fraud_rate": row[5], "total_blocked": row[6],
            "results": json.loads(row[7]),
            "created_at": row[8],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/export")
async def export_results(file: UploadFile = File(...), token: str = ""):
    require_staff(token)
    # Re-scan the file for export (fresh scan, no DB save needed)
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Only CSV files allowed")
    content = await file.read()
    df = pd.read_csv(io.StringIO(content.decode('utf-8')))
    df.columns = [c.strip() for c in df.columns]
    for i in range(1, 29):
        if f"V{i}" not in df.columns:
            df[f"V{i}"] = 0.0

    preds, probas = batch_predict(df)
    results = []
    for idx in range(len(df)):
        score    = round(float(probas[idx]) * 100, 2)
        is_fraud = bool(preds[idx] == 1)
        results.append({
            "row":         idx + 1,
            "amount":      float(df.iloc[idx]["Amount"]),
            "fraud_score": score,
            "is_fraud":    is_fraud,
            "risk_level":  risk_level(score),
            "action":      "BLOCK" if is_fraud else "APPROVE",
        })

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["row","amount","fraud_score","is_fraud","risk_level","action"])
    writer.writeheader()
    writer.writerows(results)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nexaguard_scan_results.csv"}
    )