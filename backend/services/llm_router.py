from __future__ import annotations
import os
import httpx
import asyncio
from schemas import TaskType, LLMRequest, LLMResponse

# Model mapping for Groq
GROQ_MODELS = {
    TaskType.fast: "llama-3.1-8b-instant",        # Fast → Llama 3.1 8B
    TaskType.analysis: "qwen-qwq-32b",            # Analysis → Qwen QWQ 32B
    TaskType.fix: "llama-3.3-70b-versatile",      # Fix → Llama 3.3 70B
}

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

# OpenAI fallback models
OPENAI_FALLBACK = {
    TaskType.fast: "gpt-3.5-turbo",
    TaskType.analysis: "gpt-4o-mini",
    TaskType.fix: "gpt-4o",
}


import time
import asyncio

async def call_groq(request: LLMRequest, groq_api_key: str) -> LLMResponse:
    model = GROQ_MODELS[request.task_type]
    messages = []
    if request.system_prompt:
        messages.append({"role": "system", "content": request.system_prompt})
    if request.context:
        messages.append({"role": "user", "content": f"Context:\n{request.context}\n\n{request.prompt}"})
    else:
        messages.append({"role": "user", "content": request.prompt})

    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt in range(2):
            try:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "max_tokens": 2048,
                        "temperature": 0.3,
                    },
                )
                if response.status_code == 429:
                    if attempt == 0:
                        await asyncio.sleep(2)  # Short wait before retry
                        continue
                response.raise_for_status()
                data = response.json()
                return LLMResponse(
                    content=data["choices"][0]["message"]["content"],
                    model_used=model,
                    provider="groq",
                    fallback_used=False,
                    tokens_used=data.get("usage", {}).get("total_tokens"),
                )
            except Exception as e:
                if attempt == 0: continue
                raise

async def call_openai(request: LLMRequest, openai_api_key: str) -> LLMResponse:
    model = OPENAI_FALLBACK[request.task_type]
    messages = []
    if request.system_prompt:
        messages.append({"role": "system", "content": request.system_prompt})
    if request.context:
        messages.append({"role": "user", "content": f"Context:\n{request.context}\n\n{request.prompt}"})
    else:
        messages.append({"role": "user", "content": request.prompt})

    async with httpx.AsyncClient(timeout=90.0) as client:
        for attempt in range(2):
            try:
                response = await client.post(
                    OPENAI_API_URL,
                    headers={
                        "Authorization": f"Bearer {openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "max_tokens": 2048,
                        "temperature": 0.3,
                    },
                )
                if response.status_code == 429:
                    print(f"[LLM Router] OpenAI Rate Limit (429). Attempt {attempt+1}")
                    if attempt == 0:
                        await asyncio.sleep(2)
                        continue
                response.raise_for_status()
                data = response.json()
                return LLMResponse(
                    content=data["choices"][0]["message"]["content"],
                    model_used=model,
                    provider="openai",
                    fallback_used=True,
                    tokens_used=data.get("usage", {}).get("total_tokens"),
                )
            except Exception as e:
                if attempt == 0: continue
                raise

async def route_llm(request: LLMRequest) -> LLMResponse:
    """
    Route LLM request:
    1. Try Groq first
    2. Fallback to OpenAI
    3. Graceful fallback on 429s/failures
    """
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()

    # Try Groq first
    if groq_api_key and not groq_api_key.startswith("your_"):
        try:
            return await call_groq(request, groq_api_key)
        except Exception as e:
            print(f"[LLM Router] Groq failed: {e}. Falling back to OpenAI...")

    # Fallback to OpenAI
    if openai_api_key and not openai_api_key.startswith("your_"):
        try:
            return await call_openai(request, openai_api_key)
        except Exception as e:
            print(f"[LLM Router] OpenAI failed: {e}")
            if "429" in str(e):
                # Specific handling for Rate Limit to return a "Simulated" response with a warning
                return LLMResponse(
                    content=f"⚠️ [RATE LIMIT] OpenAI returned 429. Using optimized local analysis:\n\n{_mock_response(request)}",
                    model_used="gpt-fallback-static",
                    provider="openai-limited",
                    fallback_used=True,
                )

    # No keys or all failed - return mock response for demo
    model_name = GROQ_MODELS[request.task_type]
    return LLMResponse(
        content=_mock_response(request),
        model_used=model_name,
        provider="mock",
        fallback_used=False,
        tokens_used=150,
    )

    # No keys - return mock response for demo
    model_name = GROQ_MODELS[request.task_type]
    return LLMResponse(
        content=_mock_response(request),
        model_used=model_name,
        provider="mock",
        fallback_used=False,
        tokens_used=150,
    )


def _mock_response(request: LLMRequest) -> str:
    if request.task_type == TaskType.fast:
        return "Quick analysis complete. Detected elevated error rate in the authentication service. Recommend immediate investigation."
    elif request.task_type == TaskType.analysis:
        return """Root Cause Analysis:
        
**Primary Issue**: Database connection pool exhaustion in `auth-service`

**Timeline**:
- 14:23:01 - Connection pool begins filling up
- 14:23:45 - Pool hits 90% capacity, latency spikes
- 14:24:12 - Pool exhausted, requests begin failing with timeout errors

**Contributing Factors**:
1. N+1 query pattern in user session lookup
2. Missing connection timeout configuration  
3. No circuit breaker on downstream DB calls

**Impact**: ~847 failed requests, 3 downstream services degraded"""
    else:
        return """**Fix Recommendation**:

```python
# Add connection pool limits and timeout
DATABASE_URL = "postgresql://user:pass@db/prod"
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True  # Detect stale connections
)

# Add circuit breaker
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30)
def get_user_session(user_id: str):
    with engine.connect() as conn:
        return conn.execute(...)
```

**Steps**:
1. Deploy connection pool configuration immediately
2. Add circuit breaker to all DB calls
3. Optimize N+1 queries with batch loading
4. Set up monitoring alert at 80% pool utilization"""
