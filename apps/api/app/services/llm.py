from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.config import get_settings
from app.i18n import Locale, t
from app.services.rodium_generation import RodiumGenerationAuth


class RodiumError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


StreamKind = Literal["token", "thinking"]


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
    if response.status_code in (401, 403):
        raise RodiumError(t("rodium_invalid_key", locale), response.status_code)
    if response.status_code == 402 or "quota" in text.lower() or "balance" in text.lower():
        raise RodiumError(t("rodium_quota", locale), response.status_code)
    raise RodiumError(
        t("rodium_error", locale, code=response.status_code, body=text),
        response.status_code,
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
        reasoning = (
            delta.get("reasoning")
            or delta.get("reasoning_content")
            or delta.get("thinking")
        )
        if isinstance(reasoning, str) and reasoning:
            return StreamChunk(kind="thinking", content=reasoning)
        content = delta.get("content")
        if content:
            return StreamChunk(kind="token", content=content)
    except Exception:
        return None
    return None


async def _stream_playground_chat(
    *,
    access_token: str,
    api_key_id: str,
    model: str,
    messages: list[dict[str, str]],
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
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
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
        raise RodiumError(
            t("rodium_error", locale, code="network", body=str(exc)[:200]),
            None,
        ) from exc


async def _stream_secret_chat(
    *,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
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
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
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
        raise RodiumError(
            t("rodium_error", locale, code="network", body=str(exc)[:200]),
            None,
        ) from exc


async def stream_chat_completion(
    *,
    auth: RodiumGenerationAuth,
    model: str,
    messages: list[dict[str, str]],
    locale: Locale = "fr",
) -> AsyncIterator[StreamChunk]:
    if auth.mode == "playground":
        if not auth.access_token or not auth.api_key_id:
            raise RodiumError(t("rodium_key_required", locale))
        async for chunk in _stream_playground_chat(
            access_token=auth.access_token,
            api_key_id=auth.api_key_id,
            model=model,
            messages=messages,
            locale=locale,
        ):
            yield chunk
        return
    if not auth.api_key_secret:
        raise RodiumError(t("rodium_key_required", locale))
    async for chunk in _stream_secret_chat(
        api_key=auth.api_key_secret,
        model=model,
        messages=messages,
        locale=locale,
    ):
        yield chunk


async def complete_chat(
    *,
    auth: RodiumGenerationAuth,
    model: str,
    messages: list[dict[str, str]],
    locale: Locale = "fr",
    temperature: float = 0.4,
) -> str:
    if auth.mode == "playground":
        parts: list[str] = []
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
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=30.0)) as client:
        response = await client.post(_gateway_chat_url(), headers=headers, json=payload)
    if response.status_code >= 400:
        _raise_rodium_error(response, locale)
    data = response.json()
    try:
        return str(data["choices"][0]["message"]["content"] or "")
    except (KeyError, IndexError, TypeError) as exc:
        raise RodiumError("Invalid completion payload") from exc
