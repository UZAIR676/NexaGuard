<div align="center">

<img src="https://img.shields.io/badge/NexaGuard-AI%20Financial%20Security-1B2A4A?style=for-the-badge&logoColor=white" />

<h1>🛡️ NexaGuard</h1>

<p><strong>Full-Stack AI-Powered Financial Security & Market Intelligence Platform</strong></p>

<p>
<img src="https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white"/>
<img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white"/>
<img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black"/>
<img src="https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat-square&logo=postgresql&logoColor=white"/>
<img src="https://img.shields.io/badge/TensorFlow-2.18-FF6F00?style=flat-square&logo=tensorflow&logoColor=white"/>
<img src="https://img.shields.io/badge/XGBoost-ML-006400?style=flat-square"/>
<img src="https://img.shields.io/badge/DeepFace-Face%20AI-8B0000?style=flat-square"/>
<img src="https://img.shields.io/badge/Groq-LLM-F55036?style=flat-square"/>
</p>

</div>

---

## 🚀 What is NexaGuard?

NexaGuard is a full-stack digital banking platform built around **fraud detection as its core security layer**, with live market intelligence and an AI financial advisor as supporting features (the way most real banking apps — HBL Mobile, Meezan, Chase — pair core banking with a market-watch widget). It combines **layered fraud detection**, **face biometric authentication**, **live stock market analytics + AI sentiment**, and a **Groq-powered AI financial advisor** — all in one full-stack application.

---

## ✨ Feature Overview

### 🔍 1. Transaction Fraud Detection — Layered Pipeline

This is the core of NexaGuard. **Every transaction passes through six independent checks**, not just one ML score — the ML model is one signal among several, not the only line of defense:

| Layer | What it checks | Type |
|---|---|---|
| **1. Account hold check** | Is this account already suspended? | Rule-based |
| **2. Velocity check** | Transaction rate per user (2-min window) + per-IP, with an adaptive limit — tighter if recent fraud scores were high | Rule-based |
| **3. Impossible-travel detection** | Haversine distance between this transaction's IP location and the last one, checked against realistic travel speed (~900 km/h ceiling) | Geo-IP + math |
| **4. ML fraud score** | Random Forest model scores amount, time-of-day, round-number pattern, account age, and direction (in/out) | Machine Learning |
| **5. Daily limits** | Separate caps for send/withdraw vs. deposit | Rule-based |
| **6. 3-tier response** | Score >70% and no Face ID → **blocked**. Score 40–70% and no Face ID → **email-confirmation required**. Face ID verification can override a high score (extra proof of identity) | Decision logic |

**On the ML model and its training data — stated plainly:** the model (`banking_fraud_model.pkl`, a Random Forest) is trained on **synthetically generated transaction data** — 50,000 rows created by a Python script, labeled using a hand-written domain-informed risk formula (amount-to-balance ratio, new-recipient flag, transaction velocity, odd-hour timing, account age, etc.), not on real bank transaction records. This isn't a shortcut unique to this project — labeled real-world fraud data is not publicly available anywhere, for any student or independent project, due to banking privacy regulations. The formula itself reflects real fraud-detection heuristics used in the industry, so the model is learning a reasonable proxy — but its accuracy numbers should be understood as *"how well it reproduces the heuristic it was given,"* not *"how well it catches real fraud."* Run `python ml/train_banking_model.py` to see the actual classification report (precision/recall/F1) for your build — a real, run-produced number belongs in a report, not a guessed one.

A second, separate model (`fraud_model.pkl`, used by the CSV bulk scanner below) *is* trained on the well-known [Kaggle Credit Card Fraud dataset](https://www.kaggle.com/mlg-ulb/creditcardfraud) — real, anonymized European card transactions from 2013. That one has a published, verifiable ROC-AUC score because it's a standard benchmark dataset, but note it's also extremely imbalanced (~0.17% fraud), which makes high scores easier to achieve on it than on a realistic transaction mix.

### 🧾 2. CSV Bulk Fraud Scanner
- Upload a CSV of transactions for batch ML fraud analysis (runs on the Kaggle-trained model above)
- Per-row fraud score, risk level (SAFE / LOW / MEDIUM / HIGH RISK), BLOCK / APPROVE action
- Scan history saved per user, results exportable back to CSV
- Access restricted to **Admin / Analyst** roles

### 📅 3. End-of-Day Transaction Reports (Admin/Analyst)
- Pick any date → see summary stats (total transactions, volume, completed/pending/blocked counts, average fraud score) on screen
- Download a formatted **.xlsx** report — color-coded risk levels, currency formatting, frozen header row — real transaction data with each transaction's already-computed fraud score, nothing re-scanned

### 👤 4. Face Biometric Authentication (DeepFace)
- Face registration + verification via **DeepFace** (MTCNN detector), embeddings stored in Postgres
- **Liveness detection** (multi-frame analysis to resist photo spoofing)
- Mandatory step in login (password → Face ID → optional 2FA), and used as an override for high-risk transactions

### 🔐 5. Auth & Account Security
- Password + **mandatory Face ID** + **optional email-OTP 2FA** — three-layer login, each step independently required
- Secure token-based sessions (new token issued on every login, old one invalidated)
- Real "Recent sign-ins" history (last 5 logins with IP/city/device/time) in Settings
- OTP email verification on signup
- Daily transaction limits, account hold system (manual + automatic fraud triggers)

### ⚙️ 6. Settings — Fully Functional
- **Live theme/accent switching** — dark/light + accent color apply instantly across the whole app via CSS variables, no refresh needed
- **2FA that's actually enforced** at login (not just a stored preference) — email OTP required as the final step when turned on
- Real sign-out-of-other-devices + genuine login history

### 🌍 7. Real-Time Alerts
- Every security/transaction event generates a structured alert (login, transaction, security, user activity)
- Dismissing an alert (✕) **actually deletes it** from the database, not just the UI
- Role-scoped: users see their own alerts, admins see platform-wide

### 📈 8. Live Stock Market Dashboard
- Real-time quotes: S&P 500, NASDAQ 100, DOW Jones, Russell 2000, VIX
- Top 50 S&P 500 + NASDAQ 100 stocks, sector ETFs, crypto (BTC/ETH/SOL/XRP/BNB)
- Market movers, fundamentals (P/E, market cap, 52-week range, dividends), historical charts, sector heatmap

### 🧠 9. ML Stock Price Prediction (LSTM + XGBoost)
- Custom-trained LSTM (TensorFlow/Keras) + XGBoost hybrid, 16 engineered technical features
- Outputs BUY/HOLD/SELL + confidence + probability
- **Honest note:** short-term stock direction prediction is a genuinely hard problem — even well-resourced hedge funds typically land around 55–60% accuracy using technicals alone. Treat any prediction here as one input among several, not a guarantee.

### 📰 10. Market News + AI Sentiment + Combined Outlook
- Live headlines per stock (Google News RSS, no API key needed)
- Each headline classified **Bullish / Bearish / Neutral** by a Groq LLM call
- **Combined AI Outlook** — blends the technical ML signal with the news sentiment score into one verdict, explicitly flagging when the two disagree rather than picking one silently
- The same news context feeds into the AI Advisor chat below, so both surfaces agree

### 🤖 11. AI Financial Advisor (Groq-powered chat)
- Chat interface backed by **Groq's `llama-3.3-70b-versatile`**
- Auto-detects stocks/companies mentioned in the message and injects live price, technical indicators, ML prediction, and news sentiment into the response
- Response structure: price → tech score → ML signal → news sentiment → BUY/HOLD/SELL verdict → key risk

### 📊 12. Technical Analysis Engine
- Per-stock score (0–100) from RSI, MACD, Bollinger Bands, SMA trend alignment, volume trend
- Signal: STRONG BUY / BUY / HOLD / SELL / STRONG SELL

### 👥 13. Role-Based Admin Panel
| Role | Permissions |
|------|-------------|
| **User** | Personal banking, transaction history, alerts |
| **Analyst** | All transactions, CSV scanner, daily reports, fraud stats |
| **Admin** | Full access + role management, user deletion, hold/unhold |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI, Uvicorn |
| **Frontend** | React 18, Vite |
| **Database** | PostgreSQL (Supabase) — single database for the whole app |
| **ML / AI** | TensorFlow 2.18 (LSTM), XGBoost, Scikit-learn (Random Forest) |
| **Face AI** | DeepFace (MTCNN detector), OpenCV |
| **LLM** | Groq (`llama-3.3-70b-versatile`) — used for both the AI Advisor chat and news sentiment classification |
| **Market Data** | yFinance (real-time), custom TTL caching layer |
| **News** | Google News RSS |
| **Geo-IP** | MaxMind GeoLite2 |
| **Email** | SMTP-based transactional email service |

---

## 📁 Project Structure

```
NexaGuard/
├── backend/
│   ├── main.py                      # FastAPI app entry point
│   ├── routes/
│   │   ├── auth.py                  # Auth, transactions, admin, geo-IP, login history
│   │   ├── ai_advisor.py            # AI chat — live market + technicals + ML + news context
│   │   ├── face_auth.py             # Face register / verify / liveness
│   │   ├── fraud.py                 # Credit-card fraud detection API (Kaggle-trained model)
│   │   ├── banking_fraud.py         # Banking fraud inference (synthetic-trained model)
│   │   ├── csv_scanner.py           # Bulk CSV fraud scanner
│   │   ├── ml.py                    # LSTM/XGBoost prediction endpoints
│   │   ├── news.py                  # News headlines + AI sentiment + combined outlook
│   │   ├── reports.py               # End-of-day transaction reports (summary + .xlsx export)
│   │   ├── settings.py              # Theme/2FA/sessions
│   │   └── alerts.py                # Real-time alert system
│   ├── services/
│   │   ├── market_data.py           # yFinance live data + indices/sectors/crypto
│   │   ├── technical_indicators.py  # RSI, MACD, BB, SMA/EMA scoring
│   │   ├── fraud_detection.py       # ML inference (Random Forest, Kaggle dataset)
│   │   ├── face_service.py          # DeepFace embeddings + liveness (lazy-loaded)
│   │   ├── lstm_predictor.py        # LSTM/XGBoost prediction service (lazy-loaded)
│   │   └── cache.py                 # TTL cache layer
│   ├── ml/
│   │   ├── train.py                 # LSTM/XGBoost stock model training
│   │   └── train_banking_model.py   # Banking fraud model training (synthetic data generator)
│   ├── models/                      # Trained model artifacts (.pkl / .keras)
│   ├── geoip/                       # MaxMind GeoLite2 database
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       │   └── Footer.jsx           # Shared copyright footer
│       └── pages/
│           ├── Dashboard.jsx        # Main overview + stats
│           ├── MarketData.jsx       # Live market + stocks + news/AI outlook
│           ├── AIAdvisor.jsx        # AI chat interface
│           ├── CSVScanner.jsx       # Bulk CSV upload
│           ├── Banking.jsx          # Personal banking
│           ├── AdminPanel.jsx       # Admin controls + Daily Report tab
│           ├── Alerts.jsx           # Notification center
│           ├── Settings.jsx         # Theme, 2FA, sessions
│           └── Profile.jsx          # Profile settings
├── CHANGELOG.md                     # What's been built and fixed, session by session
├── PENDING_TASKS.md                 # Known gaps / roadmap for future work
└── package.json                     # Root script: `npm run dev` runs backend + frontend together
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.12+
- Node.js 18+
- A [Groq API key](https://console.groq.com) (for AI Advisor + news sentiment)
- A Postgres database (this project uses [Supabase](https://supabase.com))

### Backend

```bash
git clone https://github.com/UZAIR676/NexaGuard.git
cd NexaGuard/backend

python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

pip install -r requirements.txt

# Set environment variables (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, GROQ_API_KEY, etc.)
# — see .env.example if present, or the env vars referenced in routes/auth.py

# Train ML models (first time)
python ml/train.py
python ml/train_banking_model.py

# Start backend
python -m uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Or both together (from the project root)

```bash
npm install
npm run dev
```

---

## 🔌 API Reference

### Market & News
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/market/summary` | Full market overview |
| `GET` | `/api/market/indices` | S&P 500, NASDAQ, DOW, VIX |
| `GET` | `/api/market/movers` | Top gainers/losers |
| `GET` | `/api/stock/{symbol}` | Single stock quote |
| `GET` | `/api/stock/{symbol}/history` | Price history |
| `GET` | `/api/news/{symbol}` | Headlines + sentiment |
| `GET` | `/api/news/{symbol}/outlook` | Combined technical + news verdict |

### ML Prediction
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ml/predict/{symbol}` | BUY/HOLD/SELL signal + confidence |
| `GET` | `/api/ml/scan` | Scan top stocks |

### AI Advisor
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/chat` | Chat with live market + news context |

### Fraud & Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/fraud/detect` | Analyze single transaction (Kaggle-model) |
| `POST` | `/api/csv/scan` | Bulk CSV scan |
| `GET` | `/api/reports/daily-summary` | End-of-day stats |
| `GET` | `/api/reports/daily-export` | End-of-day .xlsx export |

### Auth & Banking
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Register + OTP |
| `POST` | `/api/auth/login` | Login (step 1 of 3) |
| `POST` | `/api/auth/send-login-2fa` / `/verify-login-2fa` | 2FA (step 3, if enabled) |
| `POST` | `/api/auth/transaction` | Make transaction (runs the full fraud pipeline) |

### Face Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/face/register` | Register face embedding |
| `POST` | `/api/face/verify` | Verify face (login step 2 / transaction override) |
| `POST` | `/api/face/liveness` | Liveness check (anti-spoof) |

### Settings & Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` / `POST` | `/api/settings` | Theme/accent/notification preferences |
| `POST` | `/api/settings/2fa` | Turn 2FA on/off |
| `GET` | `/api/settings/sessions` | Recent sign-ins |
| `GET` | `/api/alerts` | List alerts |
| `DELETE` | `/api/alerts/{id}` | Dismiss (permanently deletes) |

---

## 📬 Contact

**Rana Muhammad Uzair**  
📧 uzairlegend480@gmail.com  
🌐 [uzairrana.netlify.app](https://uzairrana.netlify.app)  
🐙 [github.com/UZAIR676](https://github.com/UZAIR676)  
💼 [linkedin.com/in/uzair-rana-uzair](https://linkedin.com/in/uzair-rana-uzair)

---

<div align="center">
<sub>Built with ❤️ by Rana Muhammad Uzair &nbsp;•&nbsp; NexaGuard © 2026</sub>
</div>