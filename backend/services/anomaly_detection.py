from __future__ import annotations
import uuid
import random
import os
import json
from datetime import datetime, timedelta
from schemas import Anomaly


ANOMALY_TYPES = [
    {
        "type": "error_spike",
        "description": "Sudden spike in error rate - {n}% above baseline in {service}",
        "severity": "critical",
    },
    {
        "type": "latency_surge",
        "description": "P99 latency exceeded {n}ms threshold in {service}",
        "severity": "high",
    },
    {
        "type": "circuit_breaker_open",
        "description": "Circuit breaker tripped for {service} after {n} consecutive failures",
        "severity": "critical",
    },
    {
        "type": "memory_leak",
        "description": "Memory usage growing at {n}MB/min in {service}, possible leak",
        "severity": "high",
    },
    {
        "type": "connection_pool_exhaustion",
        "description": "DB connection pool at {n}% capacity in {service}",
        "severity": "critical",
    },
    {
        "type": "dependency_failure",
        "description": "Downstream dependency {dep} returning 5xx in {service}",
        "severity": "high",
    },
    {
        "type": "log_volume_anomaly",
        "description": "Log volume {n}x above normal - potential cascading failure in {service}",
        "severity": "medium",
    },
    {
        "type": "authentication_failures",
        "description": "{n} auth failures in 60s - possible credential stuffing in {service}",
        "severity": "critical",
    },
]

SERVICES = [
    "auth-service", "api-gateway", "payment-service",
    "user-service", "order-service", "notification-service"
]

DEPS = ["postgres", "redis", "kafka", "elasticsearch", "s3", "stripe-api"]


def _fill(template: str, service: str) -> str:
    return (
        template
        .replace("{n}", str(random.randint(80, 999)))
        .replace("{service}", service)
        .replace("{dep}", random.choice(DEPS))
    )



ANOMALY_FILE = "anomalies.json"

def _load_anomalies() -> list[Anomaly]:
    if not os.path.exists(ANOMALY_FILE):
        return []
    try:
        with open(ANOMALY_FILE, "r") as f:
            data = json.load(f)
            return [Anomaly(**a) for a in data]
    except Exception as e:
        print(f"Error loading anomalies: {e}")
        return []

def _save_anomalies(anomalies: list[Anomaly]):
    try:
        with open(ANOMALY_FILE, "w") as f:
            json.dump([a.model_dump() for a in anomalies], f, indent=2)
    except Exception as e:
        print(f"Error saving anomalies: {e}")

def detect_anomalies(count: int = 5) -> list[Anomaly]:
    # Load existing anomalies
    existing = _load_anomalies()
    
    # If we already have enough, refresh timestamps if they are stale (> 24h)
    now = datetime.utcnow()
    refreshed = False
    if len(existing) >= count:
        for a in existing:
            # Check if older than 24h
            ts = datetime.fromisoformat(a.timestamp.replace("Z", ""))
            if (now - ts).total_seconds() > 86400:
                # Refresh to current window (within last 2 hours)
                new_ts = now - timedelta(minutes=random.randint(0, 120))
                a.timestamp = new_ts.isoformat() + "Z"
                refreshed = True
        
        if refreshed:
            _save_anomalies(existing)
            
        recent: list[Anomaly] = sorted(existing, key=lambda x: x.timestamp, reverse=True)
        return recent[:count]
    
    # Otherwise generate some new ones
    new_anomalies = []
    now = datetime.utcnow()

    for _ in range(count - len(existing)):
        template = random.choice(ANOMALY_TYPES)
        service = random.choice(SERVICES)
        ts = now - timedelta(minutes=random.randint(0, 120))

        from services.log_service import generate_logs
        
        # Generate some synthetic logs related to this anomaly and store them in log.txt
        related_logs = generate_logs(
            count=random.randint(5, 15),
            service=service,
            level=template["severity"].upper() if template["severity"] != "medium" else "WARNING",
            inject_anomaly=True,
            save=True
        )
        
        anomaly = Anomaly(
            id=f"anm_{uuid.uuid4().hex[:12]}",
            timestamp=ts.isoformat() + "Z",
            service=service,
            severity=template["severity"],
            anomaly_type=template["type"],
            description=_fill(template["description"], service),
            affected_logs=[log["trace_id"] for log in related_logs],
            score=round(random.uniform(0.65, 0.99), 3),
        )
        new_anomalies.append(anomaly)
    
    all_anomalies = existing + new_anomalies
    _save_anomalies(all_anomalies)
    
    final_list: list[Anomaly] = sorted(all_anomalies, key=lambda x: x.timestamp, reverse=True)
    return final_list[:count]


def get_anomaly_summary() -> dict:
    anomalies = detect_anomalies(15) # Get a larger set for summary
    return {
        "total": len(anomalies),
        "critical": sum(1 for a in anomalies if a.severity == "critical"),
        "high": sum(1 for a in anomalies if a.severity == "high"),
        "medium": sum(1 for a in anomalies if a.severity == "medium"),
        "by_service": {
            svc: sum(1 for a in anomalies if a.service == svc)
            for svc in set(a.service for a in anomalies)
        },
        "anomalies": [a.model_dump() for a in anomalies],
    }
