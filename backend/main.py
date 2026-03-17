from __future__ import annotations
import os
import random
import asyncio
from typing import List
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

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

from config import settings
from utils import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])

app = FastAPI(
    title="LogAI Platform API",
    description="AI-powered log analysis with Groq/OpenAI routing",
    version="1.0.0",
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV != "production" else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Global Exception Handlers
@app.on_event("startup")
async def startup_event():
    # Start periodic log generation in the background
    asyncio.create_task(periodic_log_generator())

async def periodic_log_generator():
    """Generates a few synthetic logs every minute to keep the system active."""
    while True:
        try:
            generate_logs(count=random.randint(2, 8), save=True)
        except Exception as e:
            logger.error("periodic_log_generation_failed", error=str(e))
        await asyncio.sleep(5)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error("unhandled_exception", path=request.url.path, error=str(exc))
    return HTTPException(status_code=500, detail="Internal Server Error")

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    logger.warning("http_exception", path=request.url.path, status_code=exc.status_code, detail=exc.detail)
    return exc


# ─────────────────────────────────────────────
# Health & Config
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    def is_placeholder(key: str) -> bool:
        return not key or key.startswith("your_") or key.startswith("sk-proj-...") or key.startswith("gsk_...")
    
    return {
        "status": "ok",
        "env": settings.ENV,
        "groq_configured": not is_placeholder(settings.GROQ_API_KEY),
        "openai_configured": not is_placeholder(settings.OPENAI_API_KEY),
        "github_configured": not is_placeholder(settings.GITHUB_TOKEN),
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
# Ingestion
# ─────────────────────────────────────────────

@app.post("/ingest/logs")
async def ingest_logs(logs: List[LogEntry]):
    """Receives logs from external applications."""
    from services.log_service import _save_to_log_file
    for log in logs:
        _save_to_log_file(log.model_dump())
    
    logger.info("logs_ingested", count=len(logs))
    return {"status": "success", "count": len(logs)}

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


@app.post("/pr/check-connection")
async def check_github_connection(request: PRRequest):
    from services.pr_generator import validate_github_connection
    token = request.github_token or settings.GITHUB_TOKEN
    
    is_placeholder = not token or token.startswith("your_") or token.startswith("ghp_your")
    if is_placeholder:
        return {"connected": False, "error": "No valid token found"}
    
    is_valid = await validate_github_connection(request.repo_url, token)
    return {"connected": is_valid}


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
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=settings.PORT, 
        reload=settings.ENV == "development"
    )
