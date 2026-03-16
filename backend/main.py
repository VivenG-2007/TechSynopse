from __future__ import annotations
import os
import random
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from schemas import (
    LLMRequest, LLMResponse,
    LogQuery, Anomaly,
    RootCauseRequest, RootCauseResponse,
    FixRequest, FixResponse,
    PRRequest, PRResponse,
    LogEntry, LogResponse, AnomalyResponse
)
from services.llm_router import route_llm, GROQ_MODELS, OPENAI_FALLBACK
from services.log_service import query_logs, get_log_stats, generate_logs
from services.anomaly_detection import detect_anomalies, get_anomaly_summary
from services.analyzer import analyze_root_cause, generate_fix
from services.pr_generator import generate_pr

load_dotenv()

app = FastAPI(
    title="LogAI Platform API",
    description="AI-powered log analysis with Groq/OpenAI routing",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Health & Config
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
    }


@app.get("/config/models")
def get_model_config():
    return {
        "groq_models": {k.value: v for k, v in GROQ_MODELS.items()},
        "openai_fallback": {k.value: v for k, v in OPENAI_FALLBACK.items()},
        "routing": {
            "fast": "llama3-8b-8192 → gpt-3.5-turbo",
            "analysis": "qwen-qwq-32b → gpt-4o-mini",
            "fix": "llama3-70b-8192 → gpt-4o",
        },
    }


# ─────────────────────────────────────────────
# LLM Router
# ─────────────────────────────────────────────

@app.post("/llm/query", response_model=LLMResponse)
async def llm_query(request: LLMRequest):
    try:
        return await route_llm(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# Logs
# ─────────────────────────────────────────────

@app.get("/logs", response_model=LogResponse)
async def get_logs(
    service: str | None = None,
    level: str | None = None,
    search: str | None = None,
    limit: int = 100,
):
    logs = await query_logs(service=service, level=level, search=search, limit=limit)
    return {"logs": logs, "count": len(logs)}


@app.get("/logs/stats")
def get_stats():
    return get_log_stats()


@app.get("/logs/stream", response_model=LogResponse)
def stream_logs(service: str | None = None, count: int = 20):
    """Returns fresh synthetic logs simulating a live stream."""
    logs = generate_logs(count=count, service=service, inject_anomaly=random.random() > 0.7)
    return {"logs": logs, "count": len(logs)}


# ─────────────────────────────────────────────
# Anomaly Detection
# ─────────────────────────────────────────────

@app.get("/anomalies", response_model=AnomalyResponse)
def get_anomalies(count: int = 5):
    anomalies = detect_anomalies(count=count)
    return {"anomalies": anomalies, "count": len(anomalies)}


@app.get("/anomalies/summary")
def anomaly_summary():
    return get_anomaly_summary()


# ─────────────────────────────────────────────
# Root Cause Analysis
# ─────────────────────────────────────────────

@app.post("/analyze/root-cause", response_model=RootCauseResponse)
async def root_cause(request: RootCauseRequest):
    try:
        return await analyze_root_cause(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# Fix Recommendations
# ─────────────────────────────────────────────

@app.post("/analyze/fix", response_model=FixResponse)
async def fix_recommendation(request: FixRequest):
    try:
        return await generate_fix(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# PR Generator
# ─────────────────────────────────────────────

@app.post("/pr/generate", response_model=PRResponse)
async def create_pr(request: PRRequest):
    try:
        return await generate_pr(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pr/templates")
def pr_templates():
    return {
        "templates": [
            {
                "id": "connection_pool",
                "name": "DB Connection Pool Fix",
                "language": "python",
                "description": "Fix connection pool exhaustion with proper limits and circuit breaker",
                "original_code": """from sqlalchemy import create_engine

DATABASE_URL = "postgresql://user:pass@db/prod"
engine = create_engine(DATABASE_URL)

def get_user(user_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            f"SELECT * FROM users WHERE id = '{user_id}'"
        )
        return result.fetchone()
""",
            },
            {
                "id": "retry_logic",
                "name": "Add Retry Logic",
                "language": "python",
                "description": "Add exponential backoff retry to external API calls",
                "original_code": """import httpx

def call_payment_api(payload: dict):
    response = httpx.post(
        "https://api.payment-provider.com/charge",
        json=payload,
        timeout=5.0
    )
    return response.json()
""",
            },
            {
                "id": "rate_limiter",
                "name": "Add Rate Limiter",
                "language": "python",
                "description": "Implement token bucket rate limiting for API endpoints",
                "original_code": """from fastapi import FastAPI

app = FastAPI()

@app.post("/api/login")
async def login(credentials: dict):
    user = authenticate(credentials)
    return {"token": generate_token(user)}
""",
            },
            {
                "id": "memory_leak",
                "name": "Fix Memory Leak",
                "language": "python",
                "description": "Fix unbounded cache growth causing memory leak",
                "original_code": """cache = {}

def get_data(key: str):
    if key not in cache:
        cache[key] = fetch_from_db(key)
    return cache[key]
""",
            },
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
