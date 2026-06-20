from pydantic import BaseModel

# ── Auth ───────────────────────────────────────────────────────────────────
class SignupIn(BaseModel):
    name: str
    email: str
    password: str

class LoginIn(BaseModel):
    email: str
    password: str

class UpdateIn(BaseModel):
    token: str
    name: str

# ── Admin ──────────────────────────────────────────────────────────────────
class RoleUpdateIn(BaseModel):
    token: str
    user_id: int
    role: str  # 'user' | 'analyst' | 'admin'

# ── Transactions ───────────────────────────────────────────────────────────
class TransactionIn(BaseModel):
    token: str
    type: str          # 'send' | 'receive' | 'deposit' | 'withdraw'
    amount: float
    to_email: str = ""
    description: str = ""
    fraud_score: float = 0.0

# ── Fraud ──────────────────────────────────────────────────────────────────
class FraudCheckIn(BaseModel):
    time: float = 0
    amount: float = 0
    v1: float = 0;  v2: float = 0;  v3: float = 0;  v4: float = 0
    v5: float = 0;  v6: float = 0;  v7: float = 0;  v8: float = 0
    v9: float = 0;  v10: float = 0; v11: float = 0; v12: float = 0
    v13: float = 0; v14: float = 0; v15: float = 0; v16: float = 0
    v17: float = 0; v18: float = 0; v19: float = 0; v20: float = 0
    v21: float = 0; v22: float = 0; v23: float = 0; v24: float = 0
    v25: float = 0; v26: float = 0; v27: float = 0; v28: float = 0