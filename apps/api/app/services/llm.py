from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.config import get_settings
from app.i18n import Locale, t
from app.services.rodium_generation import RodiumGenerationAuth

# ── Error taxonomy ─────────────────────────────────────────────────────────
#
# One stable code per cause the user can actually do something about. These
# travel from here into the SSE `error` frame, into `AgentRun.plan_meta_json`
# (which was NULL on every failed run, making incidents undiagnosable), and
# into the browser, where each maps to a message and a one-click action.
# Adding a code means adding a row to `lib/chat-errors.ts` on the web side.

ERR_NETWORK = "network"  # transport died; retrying is worthwhile
ERR_TIMEOUT = "timeout"  # upstream went quiet past our budget
ERR_AUTH_EXPIRED = "auth_expired"  # RodiumAi session/token no longer valid
ERR_AUTH_BUSY = "auth_busy"  # token refresh contended past its deadline
ERR_INVALID_KEY = "invalid_key"  # the API key is wrong or revoked
ERR_QUOTA = "quota"  # no RODI left
ERR_PAYLOAD_TOO_LARGE = "payload_too_large"
ERR_EMPTY_RESPONSE = "empty_response"  # model returned nothing usable
ERR_UPSTREAM = "upstream"  # upstream said no, for some other reason
ERR_CANCELLED = "cancelled"
ERR_INTERNAL = "internal"

# httpx applies `read` PER CHUNK, not to the whole stream, so the old 300s was
# not a 5-minute cap on a request — it was "wait five minutes for each next
# token, forever". A stream that has sent nothing for a minute is dead; the
# dispatcher's own wall-clock budget covers the legitimately-slow case.
_STREAM_TIMEOUT = httpx.Timeout(60.0, connect=15.0, pool=30.0)
_COMPLETE_TIMEOUT = httpx.Timeout(90.0, connect=15.0, pool=30.0)


class RodiumError(Exception):
    """An upstream generation failure, carrying a stable machine-readable code.

    `code` exists because every consumer used to re-derive the cause by matching
    English substrings against `message` — a classification that breaks silently
    the day those messages get translated. The code is set once, here, where the
    HTTP status and body are still available, and travels unchanged all the way
    to the SSE frame and the browser's error bubble.
    """

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        code: str = "upstream",
    ):
        super().__init__(message)

        self.status_code = status_code

        self.code = code


StreamKind = Literal["token", "thinking"]


_TRANSIENT_NETWORK_MARKERS = (
    "incomplete chunked",
    "peer closed connection",
    "connection reset",
    "server disconnected",
    "remote protocol",
    "read timed out",
    "connect timeout",
    "timed out",
    "temporarily unavailable",
    "connection aborted",
    "broken pipe",
)


@dataclass
class StreamChunk:
    kind: StreamKind

    content: str


def _playground_base() -> str:

    return get_settings()._rodium_oidc_server_base.rstrip("/") + "/api/v1/oauth/playground"


def _gateway_chat_url() -> str:

    return get_settings().rodium_base_url.rstrip("/") + "/chat/completions"


def _raise_rodium_error(response: httpx.Response, locale: Locale) -> None:

    text = response.text[:500]

    lower = text.lower()

    if response.status_code in (401, 403):
        if any(
            token in lower
            for token in (
                "expired",
                "invalid_grant",
                "refresh token",
                "access token",
                "token is invalid",
                "session expired",
                "sign in with rodiumai",
            )
        ):
            raise RodiumError(t("rodium_session_expired", locale), response.status_code, ERR_AUTH_EXPIRED)

        raise RodiumError(t("rodium_invalid_key", locale), response.status_code, ERR_INVALID_KEY)

    # Nest/playground returns 404 {"message":"API key not found."} when the
    # linked key id was deleted or never provisioned — that is a key problem,
    # not a generic upstream outage (which used to show "Retry" forever).
    if response.status_code == 404 and (
        "api key not found" in lower
        or "key not found" in lower
        or ("api key" in lower and "not found" in lower)
        or ("apikey" in lower and "not found" in lower)
        or ("api_key" in lower and "not found" in lower)
        or ("clé" in lower and "introuvable" in lower)
        or ("cle " in lower and "introuvable" in lower)
    ):
        raise RodiumError(t("rodium_invalid_key", locale), response.status_code, ERR_INVALID_KEY)

    if response.status_code == 402 or "quota" in text.lower() or "balance" in text.lower():
        raise RodiumError(t("rodium_quota", locale), response.status_code, ERR_QUOTA)

    if response.status_code == 413 or "entity too large" in lower or "payload_too_large" in lower:
        raise RodiumError(t("rodium_payload_too_large", locale), 413, ERR_PAYLOAD_TOO_LARGE)

    raise RodiumError(
        t("rodium_error", locale, code=response.status_code, body=text),
        response.status_code,
        ERR_UPSTREAM,
    )


def _parse_stream_line(line: str) -> StreamChunk | None:

    if not line.startswith("data: "):
        return None

    data = line[6:].strip()

    if data == "[DONE]":
        return None

    try:
        import json

        parsed = json.loads(data)

        delta = parsed["choices"][0].get("delta") or {}

        reasoning = delta.get("reasoning") or delta.get("reasoning_content") or delta.get("thinking")

        if isinstance(reasoning, str) and reasoning:
            return StreamChunk(kind="thinking", content=reasoning)

        content = delta.get("content")

        if content:
            return StreamChunk(kind="token", content=content)

    except Exception:
        return None

    return None


def is_transient_network_error(exc: BaseException) -> bool:
    """True for flaky upstream disconnects worth retrying."""

    if isinstance(
        exc,
        (
            httpx.RemoteProtocolError,
            httpx.ReadTimeout,
            httpx.ConnectTimeout,
            httpx.WriteTimeout,
            httpx.ConnectError,
            httpx.ReadError,
            httpx.WriteError,
            httpx.ProxyError,
        ),
    ):
        return True

    if isinstance(exc, RodiumError) and exc.status_code is None:
        return any(marker in str(exc).lower() for marker in _TRANSIENT_NETWORK_MARKERS)

    text = str(exc).lower()

    return any(marker in text for marker in _TRANSIENT_NETWORK_MARKERS)


def error_code_for(exc: BaseException) -> str:
    """Best-effort code for an exception that did not come from `RodiumError`.

    The dispatcher catches bare `httpx` and stdlib exceptions too; without this
    they would all land under `internal` and lose the distinction between "the
    network blipped" (retry) and "the model refused" (don't).
    """
    if isinstance(exc, RodiumError):
        return exc.code
    if isinstance(exc, asyncio.TimeoutError):
        return ERR_TIMEOUT
    if isinstance(exc, asyncio.CancelledError):
        return ERR_CANCELLED
    if is_transient_network_error(exc):
        return ERR_NETWORK
    return ERR_INTERNAL


def _network_rodium_error(exc: BaseException, locale: Locale) -> RodiumError:

    return RodiumError(
        t("rodium_error", locale, code="network", body=str(exc)[:200]),
        None,
        ERR_TIMEOUT if isinstance(exc, httpx.ReadTimeout | httpx.ConnectTimeout) else ERR_NETWORK,
    )


async def _stream_playground_chat(
    *,
    access_token: str,
    api_key_id: str,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale,
) -> AsyncIterator[StreamChunk]:

    url = _playground_base() + "/chat/completions"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    payload: dict[str, Any] = {
        "apiKeyId": api_key_id,
        "model": model,
        "messages": messages,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=_STREAM_TIMEOUT) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code >= 400:
                    body = await response.aread()

                    fake = httpx.Response(response.status_code, content=body)

                    _raise_rodium_error(fake, locale)

                async for line in response.aiter_lines():
                    if not line:
                        continue

                    chunk = _parse_stream_line(line)

                    if chunk:
                        yield chunk

    except httpx.HTTPError as exc:
        raise _network_rodium_error(exc, locale) from exc


async def _stream_secret_chat(
    *,
    api_key: str,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale,
) -> AsyncIterator[StreamChunk]:

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": 0.4,
    }

    try:
        async with httpx.AsyncClient(timeout=_STREAM_TIMEOUT) as client:
            async with client.stream("POST", _gateway_chat_url(), headers=headers, json=payload) as response:
                if response.status_code >= 400:
                    body = await response.aread()

                    fake = httpx.Response(response.status_code, content=body)

                    _raise_rodium_error(fake, locale)

                async for line in response.aiter_lines():
                    if not line:
                        continue

                    chunk = _parse_stream_line(line)

                    if chunk:
                        yield chunk

    except httpx.HTTPError as exc:
        raise _network_rodium_error(exc, locale) from exc


async def _stream_with_retries(
    *,
    factory,
    locale: Locale,
    max_attempts: int = 3,
) -> AsyncIterator[StreamChunk]:
    """

    Stream with retries on transient disconnects.



    If the upstream dies mid-stream, restart the whole request (buffer was not

    committed to the caller yet for that attempt — we only yield after reading

    each chunk, so mid-stream failure can duplicate if we already yielded).

    Strategy: retry only when no chunk was yielded yet; otherwise raise so the

    dispatcher can clear task buffers and retry the task.

    """

    last_error: BaseException | None = None

    for attempt in range(max_attempts):
        yielded = False

        try:
            async for chunk in factory():
                yielded = True

                yield chunk

            return

        except RodiumError as exc:
            last_error = exc

            if yielded or not is_transient_network_error(exc) or attempt >= max_attempts - 1:
                raise

            await asyncio.sleep(0.6 * (attempt + 1))

        except httpx.HTTPError as exc:
            last_error = exc

            if yielded or not is_transient_network_error(exc) or attempt >= max_attempts - 1:
                raise _network_rodium_error(exc, locale) from exc

            await asyncio.sleep(0.6 * (attempt + 1))

    if last_error is not None:
        if isinstance(last_error, RodiumError):
            raise last_error

        raise _network_rodium_error(last_error, locale)


async def stream_chat_completion(
    *,
    auth: RodiumGenerationAuth,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale = "fr",
) -> AsyncIterator[StreamChunk]:

    if auth.mode == "playground":
        if not auth.access_token or not auth.api_key_id:
            raise RodiumError(t("rodium_key_required", locale), None, ERR_INVALID_KEY)

        async def playground_factory() -> AsyncIterator[StreamChunk]:

            async for chunk in _stream_playground_chat(
                access_token=auth.access_token or "",
                api_key_id=auth.api_key_id or "",
                model=model,
                messages=messages,
                locale=locale,
            ):
                yield chunk

        async for chunk in _stream_with_retries(factory=playground_factory, locale=locale):
            yield chunk

        return

    if not auth.api_key_secret:
        raise RodiumError(t("rodium_key_required", locale), None, ERR_INVALID_KEY)

    async def secret_factory() -> AsyncIterator[StreamChunk]:

        async for chunk in _stream_secret_chat(
            api_key=auth.api_key_secret or "",
            model=model,
            messages=messages,
            locale=locale,
        ):
            yield chunk

    async for chunk in _stream_with_retries(factory=secret_factory, locale=locale):
        yield chunk


async def complete_chat(
    *,
    auth: RodiumGenerationAuth,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale = "fr",
    temperature: float = 0.4,
) -> str:

    if auth.mode == "playground":
        last_error: BaseException | None = None

        for attempt in range(3):
            parts: list[str] = []

            try:
                async for chunk in _stream_playground_chat(
                    access_token=auth.access_token or "",
                    api_key_id=auth.api_key_id or "",
                    model=model,
                    messages=messages,
                    locale=locale,
                ):
                    if chunk.kind == "token":
                        parts.append(chunk.content)

                return "".join(parts)

            except RodiumError as exc:
                last_error = exc

                if not is_transient_network_error(exc) or attempt >= 2:
                    raise

                await asyncio.sleep(0.6 * (attempt + 1))

        if isinstance(last_error, RodiumError):
            raise last_error

        raise RodiumError(t("rodium_error", locale, code="network", body="retry failed"), None, ERR_NETWORK)

    headers = {
        "Authorization": f"Bearer {auth.api_key_secret}",
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "temperature": temperature,
    }

    last_http: BaseException | None = None

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=_COMPLETE_TIMEOUT) as client:
                response = await client.post(_gateway_chat_url(), headers=headers, json=payload)

            if response.status_code >= 400:
                _raise_rodium_error(response, locale)

            data = response.json()

            try:
                return str(data["choices"][0]["message"]["content"] or "")

            except (KeyError, IndexError, TypeError) as exc:
                raise RodiumError(
                    "Invalid completion payload", response.status_code, ERR_EMPTY_RESPONSE
                ) from exc

        except RodiumError:
            raise

        except httpx.HTTPError as exc:
            last_http = exc

            if not is_transient_network_error(exc) or attempt >= 2:
                raise _network_rodium_error(exc, locale) from exc

            await asyncio.sleep(0.6 * (attempt + 1))

    if last_http is not None:
        raise _network_rodium_error(last_http, locale)

    raise RodiumError(t("rodium_error", locale, code="network", body="retry failed"), None, ERR_NETWORK)
