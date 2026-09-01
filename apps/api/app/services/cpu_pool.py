"""CPU-bound work pool — never run heavy AST/scans on the asyncio event loop."""

from __future__ import annotations

import atexit
import logging
import os
import sys
from collections.abc import Callable
from concurrent.futures import BrokenExecutor, ProcessPoolExecutor, ThreadPoolExecutor
from typing import Any, TypeVar

logger = logging.getLogger("cpu_pool")

T = TypeVar("T")

_pool: ProcessPoolExecutor | ThreadPoolExecutor | None = None
_MAX_WORKERS = max(1, min(4, (os.cpu_count() or 2)))


def get_cpu_pool() -> ProcessPoolExecutor | ThreadPoolExecutor:
    global _pool
    if _pool is None:
        # ProcessPool on Linux (Docker/prod). ThreadPool on Windows avoids
        # multiprocessing spawn/`__main__` pitfalls under local scripts.
        if sys.platform == "win32":
            _pool = ThreadPoolExecutor(max_workers=_MAX_WORKERS)
            logger.info("ThreadPoolExecutor started workers=%s (win32)", _MAX_WORKERS)
        else:
            _pool = ProcessPoolExecutor(max_workers=_MAX_WORKERS)
            logger.info("ProcessPoolExecutor started workers=%s", _MAX_WORKERS)
        atexit.register(shutdown_cpu_pool)
    return _pool


def shutdown_cpu_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.shutdown(wait=False, cancel_futures=True)
        _pool = None


def run_cpu[T](fn: Callable[..., T], *args: Any, timeout: float | None = 60.0) -> T:
    """Run a picklable callable in the CPU pool (blocking)."""
    try:
        fut = get_cpu_pool().submit(fn, *args)
        return fut.result(timeout=timeout)
    except BrokenExecutor:
        logger.warning("CPU pool broken — recreating")
        shutdown_cpu_pool()
        fut = get_cpu_pool().submit(fn, *args)
        return fut.result(timeout=timeout)


async def run_cpu_async[T](fn: Callable[..., T], *args: Any, timeout: float | None = 60.0) -> T:
    """Async wrapper around run_cpu."""
    import asyncio

    return await asyncio.to_thread(run_cpu, fn, *args, timeout=timeout)
