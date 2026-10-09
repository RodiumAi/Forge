from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.config import get_settings
from app.i18n import Locale, t
from app.services.frodi_cycle import current_frodi_cycle_key
from app.services.rodium_generation import RodiumGenerationAuth


def _current_frodi_cycle_key() -> str:
    """Rolling weekly window key for the collaborator FRODI cap counter (F-1)."""
    return current_frodi_cycle_key()


def bills_someone_else(auth: RodiumGenerationAuth) -> bool:
    """A shared project billed to its owner, generating for a collaborator."""
    return bool(auth.actor_uid and auth.actor_uid != auth.billing_uid)


def gateway_user_token(auth: RodiumGenerationAuth) -> str | None:
    """The user's own token, when the generation bills that same user.

    A project billed to its owner carries the collaborator's identity and a
    per-cycle FRODI ceiling that only the internal lane enforces, so those
    runs never go out with the collaborator's token.
    """
    return None if bills_someone_else(auth) else auth.user_token


def _forge_billing_context(auth: RodiumGenerationAuth) -> dict[str, Any] | None:
    """Build the lane ``forge_context`` for a capped shared-project generation."""
    if not auth.actor_uid or auth.actor_uid == auth.billing_uid:
        return None
    ctx: dict[str, Any] = {"cycle_key": _current_frodi_cycle_key()}
    if auth.project_id:
        ctx["project_id"] = auth.project_id
    if auth.frodi_cap_per_cycle:
        ctx["cap_per_cycle"] = int(auth.frodi_cap_per_cycle)
    return ctx


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


# "notice" chunks carry machine-readable progress from the continuation layer
# (`stream_with_continuation`): JSON in `content`, never shown as model text.
StreamKind = Literal["token", "thinking", "notice"]


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


def _parse_stream_line(line: str, meta: dict[str, Any] | None = None) -> StreamChunk | None:

    if not line.startswith("data: "):
        return None

    data = line[6:].strip()

    if data == "[DONE]":
        return None

    try:
        import json

        parsed = json.loads(data)

        choice = parsed["choices"][0]
        # "length" is the only signal that the output limit cut the answer
        # mid-file; the continuation layer reads it from `meta`.
        finish = choice.get("finish_reason")
        if meta is not None and isinstance(finish, str) and finish:
            meta["finish_reason"] = finish

        delta = choice.get("delta") or {}

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


def _generation_params(temperature: float | None, max_tokens: int | None) -> dict[str, Any]:
    """Sampling fields for the OpenAI-shaped gateway payloads.

    Without `max_tokens` the gateway falls back to a 4096-token output cap for
    Claude and Gemini, which cut multi-file tasks in the middle of a file.
    """
    params: dict[str, Any] = {}
    if temperature is not None:
        params["temperature"] = temperature
    if max_tokens:
        params["max_tokens"] = int(max_tokens)
    return params


async def _stream_playground_chat(
    *,
    access_token: str,
    api_key_id: str,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale,
    meta: dict[str, Any] | None = None,
) -> AsyncIterator[StreamChunk]:

    url = _playground_base() + "/chat/completions"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    # The playground DTO rejects unknown fields, so sampling params are not
    # sent on this legacy lane.
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

                    chunk = _parse_stream_line(line, meta)

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
    temperature: float | None = None,
    max_tokens: int | None = None,
    meta: dict[str, Any] | None = None,
    url: str | None = None,
) -> AsyncIterator[StreamChunk]:

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
        **_generation_params(temperature, max_tokens),
    }

    try:
        async with httpx.AsyncClient(timeout=_STREAM_TIMEOUT) as client:
            async with client.stream(
                "POST", url or _gateway_chat_url(), headers=headers, json=payload
            ) as response:
                if response.status_code >= 400:
                    body = await response.aread()

                    fake = httpx.Response(response.status_code, content=body)

                    _raise_rodium_error(fake, locale)

                async for line in response.aiter_lines():
                    if not line:
                        continue

                    chunk = _parse_stream_line(line, meta)

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


async def _stream_frodi_chat(
    *,
    billing_uid: str,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale,
    actor_uid: str | None = None,
    forge_context: dict[str, Any] | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    meta: dict[str, Any] | None = None,
) -> AsyncIterator[StreamChunk]:
    settings = get_settings()
    url = settings.rodium_gateway_internal_url.rstrip("/") + "/internal/forge/chat/completions"
    headers = {
        "X-Forge-Gateway-Token": settings.rodium_forge_gateway_token,
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "billing_uid": billing_uid,
        "model": model,
        "messages": messages,
        "stream": True,
        **_generation_params(temperature, max_tokens),
    }
    if actor_uid and actor_uid != billing_uid:
        payload["actor_uid"] = actor_uid
    if forge_context:
        payload["forge_context"] = forge_context
    async with httpx.AsyncClient(timeout=_STREAM_TIMEOUT) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            if response.status_code >= 400:
                body = await response.aread()
                _raise_rodium_error(httpx.Response(response.status_code, content=body), locale)
            async for line in response.aiter_lines():
                if not line:
                    continue
                chunk = _parse_stream_line(line, meta)
                if chunk:
                    yield chunk


async def stream_chat_completion(
    *,
    auth: RodiumGenerationAuth,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale = "fr",
    temperature: float | None = None,
    max_tokens: int | None = None,
    meta: dict[str, Any] | None = None,
) -> AsyncIterator[StreamChunk]:
    """Stream one completion. ``meta`` (optional) receives ``finish_reason``."""
    from app.services.orchestration.catalog import is_image_model

    settings = get_settings()
    if is_image_model(model):
        # A run routed to image generation still writes code with a text
        # model; the chat endpoint refuses an image model outright.
        model = settings.effective_default_model
    if settings.forge_cloud_enabled and auth.billing_uid:
        # The gateway with the user's own token first. The internal lane stays
        # for owner-billed shared projects and, during the transition, for a
        # user without a usable token or whose token the gateway refuses.
        lane = bills_someone_else(auth) or settings.forge_internal_lane_fallback
        token = gateway_user_token(auth)
        if token:

            def user_factory() -> AsyncIterator[StreamChunk]:
                return _stream_secret_chat(
                    api_key=token,
                    model=model,
                    messages=messages,
                    locale=locale,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    meta=meta,
                    url=settings.rodium_gateway_v1_url + "/chat/completions",
                )

            try:
                async for chunk in _stream_with_retries(factory=user_factory, locale=locale):
                    yield chunk
                return
            except RodiumError as exc:
                if exc.code == ERR_QUOTA:
                    lane = False  # the same wallets stand behind both lanes
                elif not (lane and exc.status_code in (401, 403)):
                    raise
        elif not lane:
            raise RodiumError(t("rodium_session_expired", locale), 401, ERR_AUTH_EXPIRED)
        if lane:
            try:
                async for chunk in _stream_frodi_chat(
                    billing_uid=auth.billing_uid,
                    model=model,
                    messages=messages,
                    locale=locale,
                    actor_uid=auth.actor_uid,
                    forge_context=_forge_billing_context(auth),
                    temperature=temperature,
                    max_tokens=max_tokens,
                    meta=meta,
                ):
                    yield chunk
                return
            except RodiumError as exc:
                if exc.code != ERR_QUOTA:
                    raise
        # FRODI (+ wallet RODI inside the gateway) exhausted — fall through
        # to optional BYOK / legacy playground credentials if present.

    if auth.mode == "playground" and auth.access_token and auth.api_key_id:

        async def playground_factory() -> AsyncIterator[StreamChunk]:

            async for chunk in _stream_playground_chat(
                access_token=auth.access_token or "",
                api_key_id=auth.api_key_id or "",
                model=model,
                messages=messages,
                locale=locale,
                meta=meta,
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
            temperature=temperature,
            max_tokens=max_tokens,
            meta=meta,
        ):
            yield chunk

    async for chunk in _stream_with_retries(factory=secret_factory, locale=locale):
        yield chunk


# ── Output-limit continuation ───────────────────────────────────────────────
#
# A code task can legitimately need more output than one completion allows.
# When the stream stops on the output limit (finish_reason "length") or leaves
# a <forge-write>/<forge-edit> tag open, the model is asked to pick up where it
# stopped. Re-emitted files win over the truncated ones (see `tags.py`), so the
# caller can keep concatenating tokens and parse the whole text once.

CONTINUATION_MAX_ROUNDS = 2
_CONTINUATION_ASSISTANT_MAX_CHARS = 120_000


def _continuation_prompt(open_paths: list[str]) -> str:
    if open_paths:
        listed = ", ".join(open_paths[:6])
        return (
            "Your previous answer stopped at the output limit before it finished. "
            f"These files were cut off and are NOT applied: {listed}. "
            "Continue now: first re-emit each of them in full (a complete <forge-write> "
            "from the first line, or a complete <forge-edit>), then write any remaining "
            "files of this task you had not started. Do not repeat files you already "
            "closed. No prose."
        )
    return (
        "Your previous answer stopped at the output limit. Every closed tag is applied. "
        "Continue with the remaining files of this task, if any, using forge-write or "
        "forge-edit tags. Do not repeat files you already closed. If nothing is left, "
        "reply with the single word DONE."
    )


def _continuation_join(produced: list[str], head: str) -> str:
    """First text of a continuation round, as it should follow the cut answer."""
    if head.lstrip().startswith("<forge-"):
        previous = produced[-1] if produced else ""
        return head if not previous or previous.endswith("\n") else "\n" + head.lstrip()
    return head


def generation_defaults() -> dict[str, Any]:
    """Sampling defaults for code-generation streams (settings-driven)."""
    settings = get_settings()
    return {
        "temperature": settings.generation_temperature,
        "max_tokens": settings.generation_max_output_tokens or None,
    }


async def stream_with_continuation(
    *,
    auth: RodiumGenerationAuth,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale = "fr",
    max_rounds: int = CONTINUATION_MAX_ROUNDS,
    stream_fn: Any = None,
) -> AsyncIterator[StreamChunk]:
    """`stream_chat_completion` that resumes an answer cut by the output limit.

    Yields the same token/thinking chunks, plus `notice` chunks (JSON) when a
    continuation starts (``{"event": "continue", "open": [...]}``) or when the
    output is still truncated after the last round
    (``{"event": "truncated", "open": [...]}``). ``stream_fn`` defaults to
    `stream_chat_completion` (callers pass their own module-level reference so
    it stays patchable in tests).
    """
    import json

    from app.services.tags import unclosed_paths

    stream = stream_fn or stream_chat_completion
    params = generation_defaults()
    convo = list(messages)
    produced: list[str] = []
    for round_idx in range(max_rounds + 1):
        meta: dict[str, Any] = {}
        # A continuation either re-opens a tag (asked for) or picks up the cut
        # text where it stopped. Its first characters are held back to tell
        # which: a re-opened tag goes on its own line, a resumed text is joined
        # as is (an inserted newline would corrupt the cut file).
        pending: list[str] | None = [] if round_idx > 0 else None
        async for chunk in stream(
            auth=auth,
            model=model,
            messages=convo,
            locale=locale,
            meta=meta,
            **params,
        ):
            if chunk.kind != "token":
                yield chunk
                continue
            if pending is not None:
                pending.append(chunk.content)
                head = "".join(pending)
                start = head.lstrip()
                # Undecided while it could still become "<forge-".
                if not start or (len(start) < 7 and "<forge-".startswith(start)):
                    continue
                joined = _continuation_join(produced, head)
                pending = None
                produced.append(joined)
                yield StreamChunk(kind="token", content=joined)
                continue
            produced.append(chunk.content)
            yield chunk
        if pending:  # the round ended while still undecided
            tail = _continuation_join(produced, "".join(pending))
            produced.append(tail)
            yield StreamChunk(kind="token", content=tail)
        text = "".join(produced)
        open_paths = unclosed_paths(text)
        if not open_paths and meta.get("finish_reason") != "length":
            return
        if round_idx >= max_rounds:
            if open_paths:
                yield StreamChunk(
                    kind="notice", content=json.dumps({"event": "truncated", "open": open_paths})
                )
            return
        yield StreamChunk(kind="notice", content=json.dumps({"event": "continue", "open": open_paths}))
        convo = [
            *messages,
            {"role": "assistant", "content": text[-_CONTINUATION_ASSISTANT_MAX_CHARS:]},
            {"role": "user", "content": _continuation_prompt(open_paths)},
        ]


async def complete_chat(
    *,
    auth: RodiumGenerationAuth,
    model: str,
    messages: list[dict[str, Any]],
    locale: Locale = "fr",
    temperature: float = 0.4,
    max_tokens: int | None = 8192,
) -> str:
    """Non-streaming completion used by the planner and the other short calls.

    Must share the stream path. A FRODI account has no user API key, and the
    old playground branch sent ``Authorization: Bearer `` (empty token). httpx
    rejects that header before the request leaves, and the chat showed it as
    "Connection interrupted".
    """
    parts: list[str] = []
    last_error: BaseException | None = None
    for attempt in range(3):
        parts = []
        try:
            async for chunk in stream_chat_completion(
                auth=auth,
                model=model,
                messages=messages,
                locale=locale,
                temperature=temperature,
                max_tokens=max_tokens,
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
