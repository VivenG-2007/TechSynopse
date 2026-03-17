from __future__ import annotations
import random
import uuid
import os
import httpx
import json
from datetime import datetime, timedelta
from faker import Faker
from schemas import Anomaly
from config import settings

fake = Faker()

ANOMALY_FILE = "anomalies.json"

SERVICES = [
    "auth-service", "api-gateway", "user-service", "payment-service",
    "notification-service", "order-service", "inventory-service", "search-service"
]

LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
LEVEL_WEIGHTS = [20, 50, 15, 12, 3]

ERROR_MESSAGES = {
    "auth-service": [
        "JWT token validation failed: signature mismatch",
        "OAuth2 provider timeout after 30s",
        "Session store connection refused",
        "Rate limit exceeded for IP {ip}",
        "Invalid refresh token - token revoked",
        "LDAP bind failure: connection timeout",
    ],
    "api-gateway": [
        "Upstream service unreachable: {service}",
        "Request timeout after 5000ms to {service}",
        "Circuit breaker OPEN for {service}",
        "SSL certificate validation failed",
        "Rate limit triggered: {n} req/s exceeded",
        "404 route not found: {path}",
    ],
    "payment-service": [
        "Payment gateway connection failed",
        "Transaction {txn_id} timeout - rolling back",
        "Stripe API error: card_declined",
        "Database deadlock detected on payments table",
        "Insufficient funds check failed",
        "Webhook signature verification failed",
    ],
    "user-service": [
        "User {user_id} not found in database",
        "Profile update failed: constraint violation",
        "Email verification token expired",
        "Password hash mismatch for user {user_id}",
        "S3 upload failed: access denied",
    ],
    "order-service": [
        "Order {order_id} processing failed",
        "Inventory service unavailable",
        "Failed to publish order.created event",
        "Kafka producer timeout",
        "Order validation failed: invalid SKU",
    ],
    "notification-service": [
        "Email delivery failed for {email}",
        "SMS gateway error: invalid phone number",
        "Push notification token expired",
        "SMTP connection refused",
        "Template rendering error: missing variable",
    ],
    "inventory-service": [
        "Stock level check failed for SKU {sku}",
        "Warehouse sync timeout",
        "Cache miss storm: Redis unavailable",
        "Bulk update transaction rolled back",
    ],
    "search-service": [
        "Elasticsearch cluster health: RED",
        "Index rebuild timeout",
        "Search query timeout: {query_time}ms",
        "Shard allocation failed",
    ],
}

INFO_MESSAGES = {
    "auth-service": [
        "User {user_id} authenticated successfully",
        "Token refreshed for session {session_id}",
        "New device registered for user {user_id}",
        "Password changed for user {user_id}",
    ],
    "api-gateway": [
        "Request routed to {service} [{status}ms]",
        "Health check passed for {service}",
        "Load balancer rebalanced: {n} nodes active",
    ],
    "payment-service": [
        "Transaction {txn_id} processed: ${amount}",
        "Refund issued for order {order_id}",
        "Payment method validated",
    ],
    "user-service": [
        "User {user_id} profile updated",
        "New user registered: {email}",
        "Account verified for {email}",
    ],
    "order-service": [
        "Order {order_id} created successfully",
        "Order {order_id} status → PROCESSING",
        "Order {order_id} shipped via {carrier}",
    ],
    "notification-service": [
        "Email sent to {email}",
        "Push notification delivered to {n} devices",
        "SMS sent to {phone}",
    ],
    "inventory-service": [
        "Stock updated: SKU {sku} = {n} units",
        "Reorder triggered for SKU {sku}",
        "Cache warmed: {n} products indexed",
    ],
    "search-service": [
        "Search indexed {n} documents",
        "Query executed in {query_time}ms",
        "Index optimized: {n} segments merged",
    ],
}


def _fill_template(template: str) -> str:
    replacements = {
        "{ip}": fake.ipv4(),
        "{service}": random.choice(SERVICES),
        "{n}": str(random.randint(1, 1000)),
        "{path}": f"/{fake.uri_path()}",
        "{txn_id}": f"txn_{uuid.uuid4().hex[:8]}",
        "{user_id}": f"usr_{uuid.uuid4().hex[:8]}",
        "{order_id}": f"ord_{uuid.uuid4().hex[:8]}",
        "{session_id}": f"sess_{uuid.uuid4().hex[:10]}",
        "{email}": fake.email(),
        "{phone}": fake.phone_number(),
        "{sku}": f"SKU-{random.randint(1000, 9999)}",
        "{carrier}": random.choice(["FedEx", "UPS", "DHL", "USPS"]),
        "{amount}": f"{random.randint(10, 9999):.2f}",
        "{status}": str(random.randint(100, 500)),
        "{query_time}": str(random.randint(50, 5000)),
    }
    for key, val in replacements.items():
        template = template.replace(key, val)
    return template



LOG_FILE = "log.txt"
LOG_FILE_JSON = "logs.json"

def _save_to_log_file(log: dict):
    """Saves a log entry to log.txt and logs.json"""
    try:
        # Save to text file (parseable format)
        ts_text = log["timestamp"].replace("T", " ").split(".")[0]
        line = f"{ts_text} {log['level']} {log['service']} {log['message']}\n"
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
            
        # Save to JSON file (raw/JSON format)
        with open(LOG_FILE_JSON, "a", encoding="utf-8") as f:
            f.write(json.dumps(log) + "\n")
            
    except Exception as e:
        print(f"Error saving to log file: {e}")

async def fetch_from_loki(service: str | None = None, limit: int = 100) -> list[dict]:
    loki_url = settings.LOKI_URL
    if not loki_url:
        return []
        
    query = '{job="varlogs"}' # Example label, adjust if needed
    if service:
        query = f'{{service="{service}"}}'
        
    params = {
        "query": query,
        "limit": limit,
    }
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{loki_url}/loki/api/v1/query_range", params=params)
            if response.status_code == 200:
                data = response.json()
                results = []
                for stream in data.get("data", {}).get("result", []):
                    labels = stream.get("stream", {})
                    for entry in stream.get("values", []):
                        # Loki entry is [nanoseconds_timestamp, message_string]
                        ts = datetime.fromtimestamp(int(entry[0]) / 1e9).isoformat() + "Z"
                        msg = entry[1]
                        
                        # Try to parse JSON if message is JSON
                        metadata = {}
                        try:
                            parsed = json.loads(msg)
                            message = parsed.get("message", msg)
                            level = parsed.get("level", "INFO")
                            metadata = parsed
                        except:
                            message = msg
                            level = labels.get("level", "INFO")
                            
                        results.append({
                            "timestamp": ts,
                            "level": level,
                            "service": labels.get("service", service or "unknown"),
                            "message": message,
                            "trace_id": labels.get("trace_id", f"trace_{uuid.uuid4().hex[:16]}"),
                            "span_id": labels.get("span_id", f"span_{uuid.uuid4().hex[:8]}"),
                            "metadata": metadata or labels
                        })
                return results
    except Exception as e:
        print(f"Loki fetch failed: {e}")
    return []

def generate_logs(
    count: int = 100,
    service: str | None = None,
    level: str | None = None,
    inject_anomaly: bool = False,
    save: bool = True,
) -> list[dict]:
    logs = []
    now = datetime.utcnow()

    for i in range(count):
        svc = service or random.choice(SERVICES)
        ts = now - timedelta(seconds=random.randint(0, 3600))

        # Inject anomaly burst if requested
        if inject_anomaly and i > count * 0.6:
            lvl = random.choices(["ERROR", "CRITICAL"], weights=[70, 30])[0]
        else:
            lvl = level or random.choices(LOG_LEVELS, weights=LEVEL_WEIGHTS)[0]

        if lvl in ("ERROR", "CRITICAL"):
            msgs = ERROR_MESSAGES.get(svc, ["Unknown error occurred"])
        else:
            msgs = INFO_MESSAGES.get(svc, ["Operation completed"])

        msg = _fill_template(random.choice(msgs))

        log = {
            "timestamp": ts.isoformat() + "Z",
            "level": lvl,
            "service": svc,
            "message": msg,
            "trace_id": f"trace_{uuid.uuid4().hex[:16]}",
            "span_id": f"span_{uuid.uuid4().hex[:8]}",
            "metadata": {
                "host": f"{svc}-pod-{random.randint(1,5)}",
                "pod_ip": fake.ipv4_private(),
                "namespace": "production",
                "version": f"v{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,20)}",
            },
        }
        logs.append(log)
        if save:
            _save_to_log_file(log)

    return sorted(logs, key=lambda x: x["timestamp"], reverse=True)


def _read_from_log_file(limit: int = 100) -> list[dict]:
    """Reads logs from log.txt and returns them as a list of dictionaries."""
    if not os.path.exists(LOG_FILE):
        return []
    
    logs = []
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            # Read all lines and take the last ones for efficiency (simple implementation)
            lines = f.readlines()
            for line in reversed(lines):
                if len(logs) >= limit:
                    break
                
                parts = line.strip().split(" ", 4)
                if len(parts) >= 5:
                    # Format: YYYY-MM-DD HH:mm:ss LEVEL Source Message
                    ts = f"{parts[0]}T{parts[1]}Z"
                    logs.append({
                        "timestamp": ts,
                        "level": parts[2],
                        "service": parts[3],
                        "message": parts[4],
                        "trace_id": f"trace_{uuid.uuid4().hex[:16]}",
                        "span_id": f"span_{uuid.uuid4().hex[:8]}",
                        "metadata": {"source": "local_file"}
                    })
        return logs
    except Exception as e:
        print(f"Error reading from log file: {e}")
        return []

async def query_logs(
    service: str | None = None,
    level: str | None = None,
    search: str | None = None,
    limit: int = 100,
) -> list[dict]:
    # Try fetching from Loki first if configured
    loki_logs = await fetch_from_loki(service=service, limit=limit)
    if loki_logs:
        # Filter if needed (Loki has its own filtering but we can refine)
        if level:
            loki_logs = [l for l in loki_logs if l["level"] == level]
        if search:
            loki_logs = [l for l in loki_logs if search.lower() in l["message"].lower()]
        return loki_logs[:limit]
        
    # Fallback: Try reading from log.txt
    local_logs = _read_from_log_file(limit=limit * 2)
    
    if service:
        local_logs = [l for l in local_logs if l["service"] == service]
    if level:
        local_logs = [l for l in local_logs if l["level"] == level]
    if search:
        local_logs = [l for l in local_logs if search.lower() in l["message"].lower()]
        
    if len(local_logs) > 0:
        return local_logs[:limit]
        
    # If file is empty or missing, generate new ones and SAVE them
    logs = generate_logs(count=min(limit * 2, 500), service=service, level=level, save=True)
    if search:
        logs = [l for l in logs if search.lower() in l["message"].lower()]
    return logs[:limit]


def get_log_stats() -> dict:
    # Sample from log.txt to get real historical stats if available
    logs = _read_from_log_file(limit=500)
    
    # Get actual total line count from file for the "Total Logs" counter
    total_count = 0
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, 'rb') as f:
                total_count = sum(1 for _ in f)
        except:
            total_count = len(logs)
    
    if not logs:
        logs = generate_logs(count=200, save=True)
        total_count = len(logs)
    
    by_level: dict[str, int] = {}
    by_service: dict[str, int] = {}
    timeline: dict[str, dict] = {} # Bucket by time
    errors = 0
    
    for log in logs:
        lvl = log["level"]
        svc = log["service"]
        by_level[lvl] = by_level.get(lvl, 0) + 1
        by_service[svc] = by_service.get(svc, 0) + 1
        if lvl in ("ERROR", "CRITICAL"):
            errors += 1
            
        ts_str = log["timestamp"]
        try:
            if 'T' in ts_str:
                time_bucket = ts_str.split('T')[1][:5]
            else:
                time_bucket = ts_str.split(' ')[1][:5]
            
            if time_bucket not in timeline:
                timeline[time_bucket] = {"errors": 0, "info": 0}
            
            if lvl in ("ERROR", "CRITICAL"):
                timeline[time_bucket]["errors"] += 1
            else:
                timeline[time_bucket]["info"] += 1
        except:
            pass
            
    formatted_timeline = sorted([
        {"time": k, **v} for k, v in timeline.items()
    ], key=lambda x: x["time"])
    
    return {
        "total": total_count,
        "by_level": by_level,
        "by_service": by_service,
        "error_rate": round(errors / len(logs) * 100, 2) if logs else 0.0,
        "timeline": formatted_timeline[-24:] 
    }
