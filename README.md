# 🛡️ NexaGuard — AI-Powered Fraud Detection & Market Intelligence

A full-stack fintech platform combining ML-based fraud detection, live USA market data, and AI-powered stock advisory.

## 🚀 Features

- **🛡️ Fraud Detection** — Random Forest ML model (99.7% accuracy) trained on 284,807 real transactions
- **📊 CSV Bulk Scanner** — Upload any bank statement CSV, scan millions of transactions in seconds
- **📈 Live Market Data** — Real-time S&P 500, NASDAQ, crypto via Yahoo Finance
- **🤖 AI Stock Advisor** — Local LLM (Qwen2.5) + technical indicators + XGBoost ML predictions
- **🏦 Banking** — Send/receive money, deposit/withdraw with fraud protection
- **👥 Role-Based Access** — Admin / Analyst / User roles
- **📧 Email Notifications** — OTP verification + transaction alerts

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Recharts |
| Backend | FastAPI + Python |
| Database | SQLite |
| ML Models | Random Forest, XGBoost, LSTM |
| AI Advisor | Qwen2.5 (local via Ollama) + LangChain |
| Market Data | Yahoo Finance API |
| Email | Gmail SMTP |

## 📁 Project Structure

```
NexaGuard/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── email_service.py     # Email notifications
│   ├── schemas.py           # Pydantic schemas
│   ├── schemas_bank.py      # Banking schemas
│   ├── routes/
│   │   ├── auth.py          # Auth + Banking + Admin
│   │   ├── fraud.py         # Fraud detection API
│   │   ├── ai_advisor.py    # AI chat + market analysis
│   │   ├── csv_scanner.py   # Bulk CSV fraud scan
│   │   └── stocks.py        # All USA stocks
│   ├── services/
│   │   ├── fraud_detection.py   # ML model inference
│   │   ├── market_data.py       # Yahoo Finance
│   │   ├── technical_indicators.py # RSI, MACD, Bollinger
│   │   └── lstm_predictor.py    # XGBoost/LSTM predictor
│   ├── ml/
│   │   └── train.py         # ML training pipeline
│   └── models/              # Trained ML models (gitignored)
└── frontend/
    └── src/
        ├── App.jsx
        ├── theme.js
        ├── api.js
        └── pages/
            ├── Dashboard.jsx
            ├── FraudDetection.jsx
            ├── CSVScanner.jsx
            ├── MarketData.jsx
            ├── AIAdvisor.jsx
            ├── Banking.jsx
            ├── AdminPanel.jsx
            ├── Profile.jsx
            ├── Login.jsx
            └── Signup.jsx
```

## ⚡ Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### AI Advisor (Optional)
```bash
ollama pull qwen2.5:7b
ollama serve
```

### Train ML Model (Optional)
```bash
cd backend
python ml/train.py --model xgboost --symbols AAPL MSFT NVDA TSLA AMZN
```

## 🔑 Environment Variables

Create `backend/.env`:
```
GMAIL_USER=your_email@gmail.com
GMAIL_PASS=your_app_password
SECRET_KEY=your_secret_key
```

## 👤 Default Admin

```
Email: admin@nexaguard.ai
Password: admin123
```

## 📊 ML Model Performance

| Model | Accuracy | Use Case |
|-------|----------|---------|
| Random Forest | 99.7% | Transaction fraud detection |
| XGBoost | 53.4% | Stock direction prediction |
| Technical Score | Rule-based | Buy/Sell/Hold signals |

---
Built with ❤️ — NexaGuard v3.0