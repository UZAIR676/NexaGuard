import os
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")


def get_connection():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
    )


def init_transactions_table():
    con = get_connection()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id           SERIAL PRIMARY KEY,
            amount       NUMERIC NOT NULL,
            fraud_score  NUMERIC NOT NULL,
            risk_level   TEXT NOT NULL,
            is_fraud     BOOLEAN NOT NULL,
            merchant     TEXT DEFAULT 'API Transaction',
            created_at   TIMESTAMP DEFAULT NOW()
        )
    """)
    con.commit()
    cur.close()
    con.close()


init_transactions_table()


def log_transaction(amount: float, fraud_score: float, risk_level: str,
                     is_fraud: bool, merchant: str = "API Transaction"):
    con = get_connection()
    cur = con.cursor()
    try:
        cur.execute(
            "INSERT INTO transactions (amount, fraud_score, risk_level, is_fraud, merchant) "
            "VALUES (%s, %s, %s, %s, %s)",
            (amount, fraud_score, risk_level, is_fraud, merchant)
        )
        con.commit()
    finally:
        cur.close()
        con.close()


def get_stats() -> dict:
    con = get_connection()
    cur = con.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM transactions")
        total = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM transactions WHERE is_fraud = TRUE")
        fraud_count = cur.fetchone()[0]

        cur.execute("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE is_fraud = TRUE")
        blocked_amount = float(cur.fetchone()[0])

        fraud_rate = round((fraud_count / total) * 100, 3) if total > 0 else 0.0

        cur.execute("""
            SELECT risk_level, COUNT(*) FROM transactions GROUP BY risk_level
        """)
        dist = {row[0]: row[1] for row in cur.fetchall()}

        return {
            "total_scanned": total,
            "fraud_detected": fraud_count,
            "fraud_rate": fraud_rate,
            "blocked_amount": blocked_amount,
            "risk_distribution": {
                "SAFE": dist.get("SAFE", 0),
                "LOW RISK": dist.get("LOW RISK", 0),
                "MEDIUM RISK": dist.get("MEDIUM RISK", 0),
                "HIGH RISK": dist.get("HIGH RISK", 0),
            },
        }
    finally:
        cur.close()
        con.close()


def get_recent(limit: int = 10) -> list:
    con = get_connection()
    cur = con.cursor()
    try:
        cur.execute(
            "SELECT id, amount, merchant, risk_level, fraud_score, created_at "
            "FROM transactions ORDER BY created_at DESC LIMIT %s",
            (limit,)
        )
        rows = cur.fetchall()
        return [
            {
                "id": f"TXN-{r[0]}",
                "amount": float(r[1]),
                "merchant": r[2],
                "risk": r[3],
                "score": float(r[4]),
                "created_at": r[5].isoformat(),
            }
            for r in rows
        ]
    finally:
        cur.close()
        con.close()


def get_alerts(limit: int = 10) -> list:
    con = get_connection()
    cur = con.cursor()
    try:
        cur.execute(
            "SELECT amount, merchant, risk_level, created_at FROM transactions "
            "WHERE risk_level IN ('HIGH RISK', 'MEDIUM RISK') "
            "ORDER BY created_at DESC LIMIT %s",
            (limit,)
        )
        rows = cur.fetchall()
        alerts = []
        for amount, merchant, risk, created_at in rows:
            kind = "high" if risk == "HIGH RISK" else "medium"
            msg = f"{risk.title()} transaction: ${amount:,.2f} via {merchant}"
            alerts.append({"msg": msg, "type": kind, "created_at": created_at.isoformat()})
        return alerts
    finally:
        cur.close()
        con.close()