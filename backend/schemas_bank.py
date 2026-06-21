from pydantic import BaseModel

# ── Transaction ────────────────────────────────────────────────────────────
class TransactionIn(BaseModel):
    token: str
    type: str          # 'send' | 'receive' | 'deposit' | 'withdraw'
    amount: float
    to_email: str = ""
    description: str = ""
    fraud_score: float = 0.0

# ── Admin ──────────────────────────────────────────────────────────────────
class RoleUpdateIn(BaseModel):
    token: str
    user_id: int
    role: str          # 'user' | 'analyst' | 'admin'

class BalanceUpdateIn(BaseModel):
    token: str
    user_id: int
    balance: float