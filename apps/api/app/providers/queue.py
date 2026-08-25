from __future__ import annotations

import json

from redis.asyncio import Redis


class RedisQueue:
    def __init__(self, redis: Redis, stream: str, group: str) -> None:
        self._r = redis
        self._stream = stream
        self._group = group

    async def ensure_group(self) -> None:
        try:
            await self._r.xgroup_create(self._stream, self._group, id="0", mkstream=True)
        except Exception as e:
            if "BUSYGROUP" not in str(e):
                raise

    async def publish(self, payload: dict) -> str:
        return await self._r.xadd(self._stream, {"body": json.dumps(payload)}, maxlen=100_000)

    async def consume(self, consumer: str, count: int = 50, block_ms: int = 5000):
        return await self._r.xreadgroup(
            self._group, consumer, {self._stream: ">"}, count=count, block=block_ms
        )

    async def ack(self, msg_id: str) -> None:
        await self._r.xack(self._stream, self._group, msg_id)

    async def reclaim_stale(self, consumer: str, min_idle_ms: int = 60_000):
        return await self._r.xautoclaim(
            self._stream, self._group, consumer, min_idle_time=min_idle_ms, count=50
        )


async def build_usage_queue() -> RedisQueue:
    from app.config import get_settings

    s = get_settings()
    redis = Redis.from_url(s.redis_url, decode_responses=True)
    return RedisQueue(redis, s.usage_stream, s.usage_consumer_group)
