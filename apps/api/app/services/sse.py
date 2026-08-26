"""SSE helpers — keep ALB connections alive during long agent runs."""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from typing import Any


def sse_comment(data: str = "ping") -> str:
    """SSE comment line (ignored by EventSource clients, keeps proxies warm)."""
    return f": {data}\n\n"


def sse_data(payload: dict[str, Any]) -> str:
    import json

    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def with_sse_heartbeats(
    source: AsyncIterator[str],
    *,
    interval_s: float = 15.0,
) -> AsyncIterator[str]:
    """
    Wrap an SSE generator and emit comment heartbeats when idle.
    Requires ALB idle_timeout >= longest expected silent gap (recommend 600s).
    """
    if interval_s <= 0:
        async for chunk in source:
            yield chunk
        return

    agen = source.__aiter__()
    pending: asyncio.Task | None = None
    last = time.monotonic()

    try:
        while True:
            if pending is None:
                pending = asyncio.create_task(agen.__anext__())
            done, _ = await asyncio.wait({pending}, timeout=interval_s)
            if not done:
                yield sse_comment(f"hb {int(time.time())}")
                last = time.monotonic()
                continue
            try:
                chunk = pending.result()
            except StopAsyncIteration:
                break
            pending = None
            yield chunk
            last = time.monotonic()
    finally:
        if pending is not None and not pending.done():
            pending.cancel()
            try:
                await pending
            except (asyncio.CancelledError, StopAsyncIteration, Exception):
                pass
