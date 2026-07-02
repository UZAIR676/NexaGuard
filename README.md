<div align="center">

<img src="https://img.shields.io/badge/NexaGuard-AI%20Financial%20Security-1B2A4A?style=for-the-badge&logoColor=white" />

<h1>🛡️ NexaGuard</h1>

<p><strong>Full-Stack AI-Powered Financial Security & Market Intelligence Platform</strong></p>

<p>
<img src="https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white"/>
<img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white"/>
<img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black"/>
<img src="https://img.shields.io/badge/TensorFlow-2.18-FF6F00?style=flat-square&logo=tensorflow&logoColor=white"/>
<img src="https://img.shields.io/badge/XGBoost-ML-006400?style=flat-square"/>
<img src="https://img.shields.io/badge/DeepFace-Face%20AI-8B0000?style=flat-square"/>
<img src="https://img.shields.io/badge/yFinance-Market%20Data-FFD700?style=flat-square"/>
<img src="https://img.shields.io/badge/Ollama-LLM-black?style=flat-square"/>
</p>

</div>

---

## 🚀 What is NexaGuard?

NexaGuard is an enterprise-grade financial security and market intelligence platform built for the **US market**. It combines **fraud detection AI**, **live stock market analytics**, **LSTM/XGBoost price prediction**, **face biometric authentication**, **real-time geo-IP threat detection**, and a **custom AI financial advisor** — all in one unified full-stack application.

> Built by a solo developer. Runs locally. No paid APIs required.

---

## ✨ Feature Overview

### 🤖 1. AI Financial Advisor (NexaGuard AI Chat)
- Custom AI chat powered by **Qwen 2.5 (7B)** via **Ollama** — runs 100% locally
- Automatically detects mentioned stocks/sectors from user messages (`NVDA`, `tesla`, `AI stocks`, etc.)
- Injects **live market data + technical indicators + ML predictions** into every response
- Streaming token-by-token response via SSE (Server-Sent Events)
- Full conversation history per session
- Responds in user's language (English / Urdu / mix)
- Response structure: Price → Tech Score → ML Signal → BUY/HOLD/SELL → Risk/Opportunity

### 📈 2. Live Stock Market Dashboard
- Real-time quotes for **S&P 500, NASDAQ 100, DOW Jones, Russell 2000, VIX**
- Full coverage: **Top 50 S&P 500 stocks**, NASDAQ 100 stocks, sector ETFs, crypto (BTC/ETH/SOL/XRP/BNB)
- Market movers — top gainers/losers across SP500 and NASDAQ
- Stock fundamentals: P/E, market cap, 52-week range, dividends
- Historical price charts (1D / 1W / 1M / 6M / 1Y)
- Live stock search across all US tickers
- Sector performance heatmap (XLK, XLF, XLV, XLE, etc.)
- Popular ETF overview (SPY, QQQ, GLD, TLT, ARKK, etc.)

### 🧠 3. ML Stock Price Prediction (LSTM + XGBoost Hybrid)
- Custom-trained **LSTM neural network** (TensorFlow/Keras) + **XGBoost** hybrid model
- 16 engineered features: Returns, RSI, MACD, Bollinger Bands %, ATR, SMA/EMA, Momentum, Volume Ratio
- 60-day sequence window → predicts next-day direction
- Outputs: `BUY / HOLD / SELL` signal + confidence level + probability score
- Market-wide scanner: scans 15 top stocks and ranks by predicted upside
- Per-symbol scalers for precision prediction

### 📊 4. Technical Analysis Engine
- Per-stock technical scoring **(0–100)** synthesized from:
  - RSI (Relative Strength Index)
  - MACD crossover signals
  - Bollinger Band position
  - SMA 10/20/50 trend alignment
  - Volume trend
- Overall signal: **STRONG BUY / BUY / HOLD / SELL / STRONG SELL**
- Trend direction + key support/resistance levels

### 🔍 5. Transaction Fraud Detection (Banking ML)
- Custom **Random Forest** model trained on behavioral features
- Scores every transaction **0–100%** fraud risk in real-time
- **3-Tier Response System:**
  | Score | Action |
  |-------|--------|
  | < 40% | ✅ Auto-approve |
  | 40–70% | ⏳ Email confirmation link (30-min expiry) |
  | > 70% | 🚨 Blocked + instant alert |
- Features: amount, balance, is_new_recipient, tx velocity, account age, outgoing flag

### 🌍 6. Geo-IP Impossible Travel Detection
- Tracks transaction IP location via **MaxMind GeoLite2** database
- Calculates travel distance + speed between consecutive transaction IPs
- Flags impossible travel (e.g., New York → London in 5 minutes)
- Auto-holds account + fires real-time alert on detection

### ⚡ 7. Velocity & Behavioral Abuse Detection
- Per-user transaction rate monitoring (2-minute rolling window)
- Per-IP rate limiting across all users
- Dynamic limits based on rolling average fraud score:
  - High fraud history → stricter limits (3 tx/2min)
  - Normal → standard limits (10 tx/2min)
- Auto-hold + email notification on trigger

### 🧾 8. CSV Bulk Fraud Scanner
- Upload any CSV transaction file for bulk ML analysis
- Batch prediction on all rows — detects fraud at scale
- Results: fraud score, risk level (SAFE / LOW / MEDIUM / HIGH RISK), BLOCK / APPROVE action
- Export results back as CSV
- Scan history saved per user in SQLite
- Access restricted to **Admin / Analyst** roles only

### 👤 9. Face Biometric Authentication (DeepFace)
- **100% local** — no external API, no cloud
- Face registration: captures and stores embedding in SQLite
- Face verification on every login attempt
- **Liveness detection** (multi-frame analysis — prevents photo spoofing)
- Similarity score + risk score on every check
- Failed verifications trigger a **HIGH** security alert
- Face ID used as override for high-risk transactions (70%+ fraud score)

### 🔔 10. Real-Time Alert System
- Every security and transaction event generates a structured alert
- Alert types: `success`, `info`, `medium`, `high`
- Categories: `login`, `transaction`, `security`, `user_activity`
- Users see their own alerts; admins see platform-wide alerts
- Email notifications for all critical events

### 🔐 11. Auth & Account Security
- OTP email verification on signup (10-min expiry)
- Secure token-based sessions (new token on every login)
- SHA-256 password hashing
- Login event alerts (timestamp + IP context)
- Daily transaction limits: $5,000 send/withdraw | $10,000 deposit
- Account hold system (manual admin + automatic fraud triggers)

### 👥 12. Role-Based Admin Panel
| Role | Permissions |
|------|-------------|
| **User** | Personal banking, transaction history, alerts |
| **Analyst** | All transactions, CSV scanner, fraud stats, review pending |
| **Admin** | Full access + role management, user deletion, hold/unhold |

- Transaction review: approve or reject pending (flagged) transactions
- User management: promote/demote roles, delete accounts, release holds
- Platform-wide fraud analytics: total scanned, fraud rate, blocked amount, risk distribution

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI, Uvicorn |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **ML / AI** | TensorFlow 2.18 (LSTM), XGBoost, Scikit-learn (Random Forest) |
| **Face AI** | DeepFace (MTCNN detector), OpenCV |
| **LLM** | Qwen 2.5 7B via Ollama (local) |
| **Market Data** | yFinance (real-time), custom caching layer |
| **Geo-IP** | MaxMind GeoLite2 |
| **Database** | SQLite (transactions, users, alerts, face embeddings, scan history) |
| **Email** | SMTP-based transactional email service |

---

## 📁 Project Structure

```
NexaGuard/
├── backend/
│   ├── main.py                      # FastAPI app entry point
│   ├── routes/
│   │   ├── auth.py                  # Auth, transactions, admin, geo-IP
│   │   ├── ai_advisor.py            # AI chat with live market context
│   │   ├── face_auth.py             # Face register / verify / liveness
│   │   ├── fraud.py                 # Credit card fraud detection API
│   │   ├── csv_scanner.py           # Bulk CSV fraud scanner
│   │   ├── ml.py                    # LSTM/XGBoost prediction endpoints
│   │   └── alerts.py                # Real-time alert system
│   ├── services/
│   │   ├── market_data.py           # yFinance live data + indices/sectors/crypto
│   │   ├── technical_indicators.py  # RSI, MACD, BB, SMA/EMA scoring
│   │   ├── fraud_detection.py       # ML inference (Random Forest)
│   │   ├── face_service.py          # DeepFace embeddings + liveness
│   │   ├── lstm_predictor.py        # LSTM/XGBoost prediction service
│   │   ├── banking_fraud.py         # Banking ML inference
│   │   ├── cache.py                 # TTL cache layer
│   │   └── transaction_log.py       # Fraud log aggregation
│   ├── ml/
│   │   ├── train.py                 # LSTM/XGBoost model training
│   │   └── train_banking_model.py   # Banking fraud model training
│   ├── models/
│   │   ├── nexaguard_lstm.keras     # Trained LSTM model
│   │   ├── nexaguard_xgb.pkl        # Trained XGBoost model
│   │   ├── nexaguard_scalers.pkl    # Per-symbol feature scalers
│   │   ├── banking_fraud_model.pkl  # Banking fraud Random Forest
│   │   └── nexaguard_config.json    # Model metadata + metrics
│   ├── geoip/
│   │   └── GeoLite2-City.mmdb       # MaxMind geo-IP database
│   └── requirements.txt
├── frontend/
│   └── src/pages/
│       ├── Dashboard.jsx            # Main overview + stats
│       ├── MarketData.jsx           # Live market + stocks
│       ├── AIAdvisor.jsx            # AI chat interface
│       ├── FraudDetection.jsx       # Manual fraud checker
│       ├── CSVScanner.jsx           # Bulk CSV upload
│       ├── Banking.jsx              # Personal banking
│       ├── AdminPanel.jsx           # Admin controls
│       ├── Alerts.jsx               # Notification center
│       ├── FaceVerificationModal.jsx # Biometric auth UI
│       └── Profile.jsx              # Settings + face ID
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.12+
- Node.js 18+
- [Ollama](https://ollama.ai) installed (for AI chat)

### Backend

```bash
git clone https://github.com/UZAIR676/NexaGuard.git
cd NexaGuard/backend

pip install -r requirements.txt

# Pull the LLM model for AI advisor
ollama pull qwen2.5:7b

# Train ML models (first time)
python ml/train.py
python ml/train_banking_model.py

# Start backend
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔌 API Reference

### Market
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/market/summary` | Full market overview |
| `GET` | `/api/market/indices` | S&P 500, NASDAQ, DOW, VIX |
| `GET` | `/api/market/sectors` | Sector ETF performance |
| `GET` | `/api/market/movers` | Top gainers/losers |
| `GET` | `/api/market/crypto` | BTC/ETH/SOL/XRP/BNB prices |
| `GET` | `/api/stock/{symbol}` | Single stock quote |
| `GET` | `/api/stock/{symbol}/history` | Price history |
| `GET` | `/api/search/{query}` | Ticker search |

### ML Prediction
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ml/predict/{symbol}` | BUY/HOLD/SELL signal + confidence |
| `GET` | `/api/ml/scan` | Scan top 15 stocks |
| `GET` | `/api/ml/status` | Model info + accuracy |

### AI Advisor
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/chat` | Streaming AI chat |
| `DELETE` | `/api/ai/chat/{session_id}` | Clear session |

### Fraud Detection
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/fraud/detect` | Analyze single transaction |
| `GET` | `/api/fraud/stats` | Aggregate fraud stats |
| `POST` | `/api/csv/scan` | Bulk CSV scan |
| `GET` | `/api/csv/history` | Past scan history |

### Auth & Banking
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Register + OTP |
| `POST` | `/api/auth/login` | Login + token |
| `POST` | `/api/auth/transaction` | Make transaction (fraud scored) |
| `GET` | `/api/auth/confirm-transaction` | Email-confirm flagged tx |

### Face Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/face/register` | Register face embedding |
| `POST` | `/api/face/verify` | Verify face (login/tx) |
| `POST` | `/api/face/liveness` | Liveness check (anti-spoof) |

---

## 📬 Contact

**Rana Muhammad Uzair**  
📧 uzairranamuhammad7@gmail.com  
🌐 [uzairrana.netlify.app](https://uzairrana.netlify.app)  
🐙 [github.com/UZAIR676](https://github.com/UZAIR676)  
💼 [linkedin.com/in/uzair-rana-uzair](https://linkedin.com/in/uzair-rana-uzair)

---

<div align="center">
<sub>Built with ❤️ by Rana Muhammad Uzair &nbsp;•&nbsp; NexaGuard © 2026</sub>
</div>
