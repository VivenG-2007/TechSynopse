from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from enum import Enum


class TaskType(str, Enum):
    fast = "fast"
    analysis = "analysis"
    fix = "fix"


class LLMRequest(BaseModel):
    task_type: TaskType
    prompt: str
    context: Optional[str] = None
    system_prompt: Optional[str] = None


class LLMResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    content: str
    model_used: str
    provider: str
    fallback_used: bool = False
    tokens_used: Optional[int] = None


class LogEntry(BaseModel):
    timestamp: str
    level: str
    service: str
    message: str
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    metadata: Optional[dict] = None


class LogQuery(BaseModel):
    service: Optional[str] = None
    level: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    search: Optional[str] = None
    limit: int = 100


class Anomaly(BaseModel):
    id: str
    timestamp: str
    service: str
    severity: str
    anomaly_type: str
    description: str
    affected_logs: List[str]
    score: float


class RootCauseRequest(BaseModel):
    anomaly_id: str
    logs: List[LogEntry]
    anomaly: Anomaly


class RootCauseResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    root_cause: str
    confidence: float
    contributing_factors: List[str]
    model_used: str
    provider: str


class FixRequest(BaseModel):
    anomaly: Anomaly
    root_cause: str
    service: str
    language: Optional[str] = "python"


class FixResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    summary: str
    steps: List[str]
    code_fix: Optional[str]
    priority: str
    model_used: str


class PRRequest(BaseModel):
    repo_url: str
    branch_name: str
    title: str
    description: str
    file_path: str
    original_code: str
    fix_description: str
    language: str = "python"
    github_token: Optional[str] = None


class PRResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    pr_url: Optional[str]
    branch_name: str
    title: str
    description: str
    patch: str
    fixed_code: str
    commit_message: str
    model_used: str
    status: str
    error_detail: Optional[str] = None


class LogResponse(BaseModel):
    logs: List[dict]
    count: int


class AnomalyResponse(BaseModel):
    anomalies: List[Anomaly]
    count: Optional[int] = None
