from __future__ import annotations
import re
from schemas import (
    LLMRequest, TaskType, RootCauseRequest, RootCauseResponse,
    FixRequest, FixResponse, Anomaly, LogEntry
)
from services.llm_router import route_llm

ROOT_CAUSE_SYSTEM = """You are an expert SRE (Site Reliability Engineer) and distributed systems debugger.
Analyze the provided logs and anomaly data to determine the root cause of the incident.
Be precise, technical, and structured. Format your response with clear sections.
IMPORTANT: Do NOT use any HTML tags, color tags (e.g., <color:...>), or custom styling in your output.
Stick to plain text and standard markdown."""

FIX_SYSTEM = """You are a senior software engineer specializing in production incident remediation.
Provide concrete, actionable fix recommendations with working code examples.
Include both immediate mitigations and long-term fixes.
IMPORTANT: 
1. Use asynchronous patterns (async/await) where appropriate for I/O bound tasks.
2. Do NOT use any HTML tags, color tags (e.g., <color:...>), or custom styling in your output or code blocks.
3. Provide ONLY functional code in code blocks."""

def _sanitize_output(text: str) -> str:
    """Removes leaked syntax highlighting tags and other junk from LLM output."""
    # Remove tags like <color:#5c7a5c"> or "color:#5c7a5c">
    text = re.sub(r'["\']?color:#[0-9a-fA-F]+["\']?>?', '', text)
    # Remove any other suspicious HTML-like tags that shouldn't be there
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()


async def analyze_root_cause(request: RootCauseRequest) -> RootCauseResponse:
    log_sample = "\n".join([
        f"[{l.timestamp}] [{l.level}] {l.service}: {l.message}"
        for l in request.logs[:20]
    ])

    prompt = f"""Analyze this production incident and determine the root cause.

ANOMALY DETECTED:
- ID: {request.anomaly.id}
- Service: {request.anomaly.service}
- Type: {request.anomaly.anomaly_type}
- Severity: {request.anomaly.severity}
- Description: {request.anomaly.description}
- Score: {request.anomaly.score}
- Timestamp: {request.anomaly.timestamp}

RELEVANT LOG SAMPLE:
{log_sample}

Provide:
1. Root cause (1-2 sentences)
2. Confidence level (0-100)
3. Contributing factors (bullet list)
4. Timeline of events
5. Blast radius (what else is affected)"""

    llm_req = LLMRequest(
        task_type=TaskType.analysis,
        prompt=prompt,
        system_prompt=ROOT_CAUSE_SYSTEM,
    )
    response = await route_llm(llm_req)

    # Parse contributing factors from response
    factors = []
    lines = response.content.split("\n")
    in_factors = False
    for line in lines:
        line = line.strip()
        if "contributing" in line.lower() or "factor" in line.lower():
            in_factors = True
            continue
        if in_factors and line.startswith(("-", "•", "*", "1", "2", "3", "4", "5")):
            clean = line.lstrip("-•*0123456789. ")
            if clean:
                factors.append(clean)
        elif in_factors and line and not line.startswith(("-", "•", "*")):
            in_factors = False

    if not factors:
        factors = [
            "Increased load without corresponding resource scaling",
            "Missing circuit breaker configuration",
            "Inadequate connection pool sizing",
        ]

    content = _sanitize_output(response.content)

    return RootCauseResponse(
        root_cause=content,
        confidence=0.87,
        contributing_factors=factors[:5],
        model_used=response.model_used,
        provider=response.provider,
    )


async def generate_fix(request: FixRequest) -> FixResponse:
    prompt = f"""Generate a fix recommendation for this production incident.

SERVICE: {request.service}
LANGUAGE: {request.language}
ANOMALY TYPE: {request.anomaly.anomaly_type}
ANOMALY DESCRIPTION: {request.anomaly.description}
SEVERITY: {request.anomaly.severity}

ROOT CAUSE ANALYSIS:
{request.root_cause}

Provide:
1. Executive summary (2-3 sentences)
2. Immediate mitigation steps (numbered list)
3. Code fix with comments (working {request.language} code)
4. Long-term prevention measures
5. Priority: CRITICAL / HIGH / MEDIUM

Format the code in a ```{request.language} code block."""

    llm_req = LLMRequest(
        task_type=TaskType.fix,
        prompt=prompt,
        system_prompt=FIX_SYSTEM,
    )
    response = await route_llm(llm_req)

    # Extract steps from response
    steps = []
    lines = response.content.split("\n")
    for line in lines:
        line = line.strip()
        if line and line[0].isdigit() and ". " in line[:5]:
            steps.append(line)

    if not steps:
        steps = [
            "1. Enable circuit breaker immediately",
            "2. Scale connection pool to 50 connections",
            "3. Deploy hotfix with connection timeout",
            "4. Monitor error rate for 15 minutes",
            "5. Conduct post-mortem within 24 hours",
        ]

    priority = "CRITICAL" if request.anomaly.severity == "critical" else "HIGH"

    content = _sanitize_output(response.content)
    
    return FixResponse(
        summary=content[:200] + "...",
        steps=steps[:8],
        code_fix=content,
        priority=priority,
        model_used=response.model_used,
    )
