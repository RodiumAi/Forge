"""Request body size limit.

Starlette spools an upload to a temporary file before the route runs, and JSON
bodies are read whole before validation, so a per-field `max_length` or a
post-read size check does not bound what one request costs. This rejects an
oversized body with 413 as soon as the limit is crossed, whether it is declared
in `Content-Length` or streamed with chunked transfer encoding.
"""

import re

# Image uploads are capped at 8 MB by their routes; the largest legitimate JSON
# body is a file save (`FileWriteRequest.content`, 2M characters, up to ~12 MB
# once JSON-escaped). 16 MB clears both without leaving the body unbounded.
MAX_BODY_BYTES = 16 * 1024 * 1024


class MaxBodySizeMiddleware:
    """Reject request bodies over `max_bytes` with 413, chunked bodies included."""

    def __init__(self, app, max_bytes: int = MAX_BODY_BYTES, path_regex: str | None = None):
        self.app = app
        self.max_bytes = max_bytes
        self.path = re.compile(path_regex) if path_regex else None

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or (self.path and not self.path.search(scope["path"])):
            return await self.app(scope, receive, send)

        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None:
            try:
                too_big = int(declared) > self.max_bytes
            except ValueError:
                too_big = True
            if too_big:
                return await self._reject(send)

        received = 0
        started = False
        rejected = False

        async def limited_receive():
            nonlocal received, started, rejected
            message = await receive()
            if message["type"] == "http.request" and not rejected:
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    rejected = True
                    if not started:
                        started = True
                        await self._reject(send)
                    # Tell the app the client is gone so it stops reading.
                    return {"type": "http.disconnect"}
            return message

        async def tracking_send(message):
            nonlocal started
            if rejected:
                # Already answered 413; drop whatever the app says next.
                return
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        await self.app(scope, limited_receive, tracking_send)

    @staticmethod
    async def _reject(send):
        body = b'{"detail":"Payload too large"}'
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


class PublicSiteCorsMiddleware:
    """Open CORS for the published-site intake routes only (`/v1/sites/...`).

    Published sites reach these routes on their own origin through the
    gateway, but a ZIP export hosted anywhere calls the API directly. They
    carry no credentials and accept no cookies, so any origin may call them;
    every other route keeps the strict allowlist of the main CORS middleware,
    which this one wraps.
    """

    PREFIXES = ("/v1/sites/forms", "/v1/sites/hit")

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith(self.PREFIXES):
            return await self.app(scope, receive, send)
        cors = [
            (b"access-control-allow-origin", b"*"),
            (b"access-control-allow-methods", b"POST, OPTIONS"),
            (b"access-control-allow-headers", b"content-type"),
            (b"access-control-max-age", b"86400"),
        ]
        if scope["method"] == "OPTIONS":
            await send({"type": "http.response.start", "status": 204, "headers": cors})
            await send({"type": "http.response.body", "body": b""})
            return

        async def with_cors(message):
            if message["type"] == "http.response.start":
                headers = [
                    (k, v)
                    for k, v in message.get("headers", [])
                    if not k.lower().startswith(b"access-control-")
                ]
                message = {**message, "headers": headers + cors[:1]}
            await send(message)

        await self.app(scope, receive, with_cors)
