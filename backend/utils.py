import time
import asyncio
import structlog
from functools import wraps
from typing import Any, Callable

# Configure structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

def measure_execution_time(func: Callable[..., Any]) -> Callable[..., Any]:
    """
    Decorator to measure function execution time.
    Supports both synchronous and asynchronous functions.
    """
    if asyncio.iscoroutinefunction(func):
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            start_time = time.perf_counter()
            log = logger.bind(function=func.__name__, async_mode=True)
            try:
                log.info("function_start")
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                log.error("function_failed", error=str(e))
                raise
            finally:
                end_time = time.perf_counter()
                execution_time = (end_time - start_time) * 1000
                log.info("function_complete", duration_ms=round(execution_time, 2))
        return async_wrapper
    else:
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            start_time = time.perf_counter()
            log = logger.bind(function=func.__name__, async_mode=False)
            try:
                log.info("function_start")
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                log.error("function_failed", error=str(e))
                raise
            finally:
                end_time = time.perf_counter()
                execution_time = (end_time - start_time) * 1000
                log.info("function_complete", duration_ms=round(execution_time, 2))
        return sync_wrapper
