# LogAI Platform

Full-stack AI-powered log analysis platform with Groq/OpenAI LLM routing.

## Architecture

```
Synthetic Log Generator
        │
    ▼ Loki (simulated)
        │
    ▼ Backend (FastAPI)
    ├─ Log Query Service      → /logs
    ├─ Log Parser             → /logs/stats
    ├─ Anomaly Detection      → /anomalies
    ├─ LLM Root Cause         → /analyze/root-cause
    └─ Fix Recommendation     → /analyze/fix, /pr/generate
        │
    ▼ Frontend (React + Vite)
    ├─ Dashboard
    ├─ Log Explorer
    ├─ Incident Panel
    ├─ Root Cause Viewer
    ├─ Fix Suggestions
    ├─ LLM Router Tester
    └─ PR Generator
```

## LLM Routing Logic

```
User Request
    │
    ▼ Select model by task
    │   fast     → Llama 3 8B  (Groq)
    │   analysis → Qwen 32B    (Groq)
    │   fix      → Llama 3 70B (Groq)
    │
    ├─ SUCCESS → return result
    └─ FAILURE → fallback to OpenAI
                    fast     → gpt-3.5-turbo
                    analysis → gpt-4o-mini
                    fix      → gpt-4o
```

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your API keys:
#   GROQ_API_KEY=your_groq_key
#   OPENAI_API_KEY=your_openai_key  (optional, used as fallback)

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | System health + API key status |
| GET | /config/models | Model routing config |
| GET | /logs | Query logs with filters |
| GET | /logs/stats | Log statistics |
| GET | /logs/stream | Live log stream |
| GET | /anomalies | Detected anomalies |
| GET | /anomalies/summary | Anomaly summary |
| POST | /llm/query | Direct LLM query with routing |
| POST | /analyze/root-cause | AI root cause analysis |
| POST | /analyze/fix | AI fix generation |
| POST | /pr/generate | AI PR generation |
| GET | /pr/templates | PR code templates |

## Environment Variables

### Backend (`backend/.env`)

```
GROQ_API_KEY=gsk_...          # Required for real LLM (get from console.groq.com)
OPENAI_API_KEY=sk-...         # Optional fallback
```

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:8000   # Backend URL
```

## Features

- **Live Log Streaming** — Real-time synthetic log generation simulating 8 microservices
- **Anomaly Detection** — Pattern-based anomaly detection with severity scoring
- **AI Root Cause Analysis** — Qwen 32B via Groq analyzes log patterns
- **AI Fix Generation** — Llama 70B generates production-ready code fixes
- **PR Generator** — Full pull request with diff, fixed code, and description
- **LLM Router** — Visual routing diagram + interactive testing
- **Demo Mode** — Works without API keys using mock responses

## Getting Groq API Key (Free)

1. Go to https://console.groq.com
2. Sign up (free tier available)
3. Create API key
4. Add to `backend/.env`
"# temp" 
"# temp" 
