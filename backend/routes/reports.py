"""
NexaGuard — End-of-Day Transaction Reports

Every transaction already gets a fraud_score + risk_level computed live at
the moment it's created (see auth.py's send_money/withdraw flow) — so a
daily report doesn't need to re-run anything through the ML model. It just
pulls the day's rows straight from the `transactions` table, real fields
only (amount, type, status, fraud score, etc.), no fabricated data.

Note: this is intentionally NOT wired into the CSV Scanner (routes/csv_scanner.py).
That scanner expects Time/V1-V28/Amount columns — the anonymized PCA features
from the Kaggle dataset the model was trained on. Real transactions don't have
(and can't meaningfully have) those columns, so faking them would produce
fraud scores that don't mean anything. This is a separate, honest reporting
feature instead.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, date as date_cls
import io, csv

from routes.auth import get_db, get_user_by_token

router = APIRouter(prefix="/api/reports", tags=["reports"])


def require_staff(token: str):
    user = get_user_by_token(token)
    if user["role"] not in ["admin", "analyst"]:
        raise HTTPException(403, "Only admin or analyst can access daily reports")
    return user


def _parse_date(date_str: str | None) -> date_cls:
    if not date_str:
        return datetime.now().date()
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "date must be in YYYY-MM-DD format")


def _fetch_day(day: date_cls):
    con = get_db()
    cur = con.cursor()
    cur.execute("""
        SELECT t.id, t.created_at, t.type, t.amount, t.to_email, t.description,
               t.status, t.fraud_score, t.risk_level, t.is_fraud,
               u.name AS account_holder, u.email AS account_email
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE t.created_at::date = %s
        ORDER BY t.created_at ASC
    """, (day,))
    rows = cur.fetchall()
    cur.close()
    con.close()
    return rows


@router.get("/daily-summary")
def daily_summary(token: str, date: str | None = None):
    """On-screen end-of-day stats — total volume, fraud counts, avg score."""
    require_staff(token)
    day = _parse_date(date)
    rows = _fetch_day(day)

    total_txns   = len(rows)
    total_volume = sum(float(r["amount"] or 0) for r in rows)
    completed    = sum(1 for r in rows if r["status"] == "completed")
    pending      = sum(1 for r in rows if r["status"] == "pending")
    blocked      = sum(1 for r in rows if r["status"] == "blocked")
    flagged      = sum(1 for r in rows if r["is_fraud"])
    avg_score    = (sum(float(r["fraud_score"] or 0) for r in rows) / total_txns) if total_txns else 0

    return {
        "date": str(day),
        "total_transactions": total_txns,
        "total_volume": round(total_volume, 2),
        "completed": completed,
        "pending": pending,
        "blocked": blocked,
        "flagged_as_fraud": flagged,
        "avg_fraud_score": round(avg_score, 2),
    }


@router.get("/daily-export")
def daily_export(token: str, date: str | None = None):
    """Downloads the day's transactions as a CSV — real fields only."""
    require_staff(token)
    day = _parse_date(date)
    rows = _fetch_day(day)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "id", "time", "account_holder", "account_email", "type", "amount",
        "to_email", "description", "status", "fraud_score", "risk_level", "is_fraud",
    ])
    writer.writeheader()
    for r in rows:
        writer.writerow({
            "id":             r["id"],
            "time":           str(r["created_at"]),
            "account_holder": r["account_holder"],
            "account_email":  r["account_email"],
            "type":           r["type"],
            "amount":         float(r["amount"] or 0),
            "to_email":       r["to_email"] or "",
            "description":    r["description"] or "",
            "status":         r["status"],
            "fraud_score":    float(r["fraud_score"] or 0),
            "risk_level":     r["risk_level"],
            "is_fraud":       r["is_fraud"],
        })

    filename = f"nexaguard_transactions_{day}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )