"""
NexaGuard — CSV Bulk Fraud Scanner (Batch Mode + DB Save)
Now on Postgres (same DB as everything else) instead of a separate
nexaguard.db SQLite file — one database, one source of truth.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import io, csv, warnings, json
warnings.filterwarnings('ignore')

router = APIRouter(prefix="/api/csv", tags=["csv"])

from routes.auth import get_db, get_user_by_token

def init_db():
    con = get_db()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS csv_scans (
            id            SERIAL PRIMARY KEY,
            user_token    TEXT,
            filename      TEXT,
            total         INTEGER,
            fraud_count   INTEGER,
            safe_count    INTEGER,
            fraud_rate    REAL,
            total_blocked REAL,
            results       TEXT,
            created_at    TIMESTAMP DEFAULT NOW()
        )
    """)
    con.commit()
    cur.close()
    con.close()

init_db()

from services.fraud_detection import model, scaler_amount, scaler_time

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

    try:
        con = get_db()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO csv_scans
              (user_token, filename, total, fraud_count, safe_count, fraud_rate, total_blocked, results)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
        """, (
            token, file.filename, total, fraud_count,
            total - fraud_count,
            round(fraud_count / total * 100, 2) if total > 0 else 0,
            round(total_blocked, 2),
            json.dumps(results[:1000]),
        ))
        scan_data["scan_id"] = cur.fetchone()["id"]
        con.commit()
        cur.close()
        con.close()
    except Exception as e:
        print(f"DB save error: {e}")

    return scan_data


@router.get("/history")
async def get_history(token: str = ""):
    require_staff(token)
    try:
        con = get_db()
        cur = con.cursor()
        cur.execute("""
            SELECT id, filename, total, fraud_count, fraud_rate, total_blocked, created_at
            FROM csv_scans WHERE user_token=%s
            ORDER BY created_at DESC LIMIT 20
        """, (token,))
        rows = cur.fetchall()
        cur.close()
        con.close()
        return [
            {"id": r["id"], "filename": r["filename"], "total": r["total"],
             "fraud_count": r["fraud_count"], "fraud_rate": r["fraud_rate"],
             "total_blocked": r["total_blocked"],
             "created_at": str(r["created_at"]) if r["created_at"] else None}
            for r in rows
        ]
    except Exception as e:
        print(f"History fetch error: {e}")
        return []


@router.get("/history/{scan_id}")
async def get_scan_detail(scan_id: int, token: str = ""):
    require_staff(token)
    try:
        con = get_db()
        cur = con.cursor()
        cur.execute("""
            SELECT id, filename, total, fraud_count, safe_count, fraud_rate, total_blocked, results, created_at
            FROM csv_scans WHERE id=%s AND user_token=%s
        """, (scan_id, token))
        row = cur.fetchone()
        cur.close()
        con.close()
        if not row:
            raise HTTPException(404, "Scan not found")
        return {
            "id": row["id"], "filename": row["filename"], "total": row["total"],
            "fraud_count": row["fraud_count"], "safe_count": row["safe_count"],
            "fraud_rate": row["fraud_rate"], "total_blocked": row["total_blocked"],
            "results": json.loads(row["results"]),
            "created_at": str(row["created_at"]) if row["created_at"] else None,
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