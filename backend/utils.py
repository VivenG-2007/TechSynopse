import time
import asyncio
import logging
from functools import wraps
from typing import Any, Callable

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def measure_execution_time(func: Callable[..., Any]) -> Callable[..., Any]:
    """
    Decorator to measure function execution time.
    Supports both synchronous and asynchronous functions.
    """
    if asyncio.iscoroutinefunction(func):
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            start_time = time.perf_counter()
            try:
                return await func(*args, **kwargs)
            finally:
                end_time = time.perf_counter()
                execution_time = (end_time - start_time) * 1000
                logger.info(f"Async function {func.__name__} executed in {execution_time:.2f}ms")
        return async_wrapper
    else:
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            start_time = time.perf_counter()
            try:
                return func(*args, **kwargs)
            finally:
                end_time = time.perf_counter()
                execution_time = (end_time - start_time) * 1000
                logger.info(f"Sync function {func.__name__} executed in {execution_time:.2f}ms")
        return sync_wrapper
