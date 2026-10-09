"""Image generation through the RodiumAi gateway (FRODI lane, playground or secret key).

Generated images are stored as WebP with responsive variants and described in
the project's media index, so the agent can reference them with their real
dimensions (see ``project_media``).
"""

from __future__ import annotations

import base64
import re
from uuid import uuid4

import httpx

from app.config import get_settings
from app.i18n import t
from app.services.llm import (
    ERR_AUTH_EXPIRED,
    ERR_QUOTA,
    RodiumError,
    _playground_base,
    _raise_rodium_error,
    bills_someone_else,
    gateway_user_token,
)
from app.services.rodium_generation import RodiumGenerationAuth

_IMAGE_TIMEOUT = httpx.Timeout(180.0, connect=30.0)
_LANDSCAPE_RE = re.compile(
    r"\b(banni[eè]re|banner|hero|cover|couverture|header|paysage|landscape|wide|large|panorama|"
    r"fond|background|wallpaper)\b",
    re.I,
)
_PORTRAIT_RE = re.compile(r"\b(portrait|vertical|story|stories|affiche|poster|smartphone|mobile)\b", re.I)


def _slugify_prompt(prompt: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", prompt.lower()).strip("-")[:40]
    return slug or "image"


def size_for_prompt(prompt: str) -> str:
    """Pick the aspect ratio the request implies (square stays the default)."""
    if _PORTRAIT_RE.search(prompt or ""):
        return "1024x1536"
    if _LANDSCAPE_RE.search(prompt or ""):
        return "1536x1024"
    return "1024x1024"


async def request_image_bytes(
    *,
    auth: RodiumGenerationAuth,
    prompt: str,
    size: str = "1024x1024",
    model: str | None = None,
    locale: str = "fr",
) -> bytes:
    """Raw image bytes for one prompt. Raises `RodiumError` on any failure."""
    settings = get_settings()
    model = model or settings.effective_default_image_model
    payload = {
        "model": model,
        "prompt": prompt[:4000],
        "n": 1,
        "size": size,
        "response_format": "b64_json",
    }

    response: httpx.Response | None = None
    has_own_key = bool(auth.api_key_secret or auth.api_key_id)
    async with httpx.AsyncClient(timeout=_IMAGE_TIMEOUT) as client:
        # Same lanes as chat: the user's own token first, FRODI then wallet.
        lane = settings.forge_cloud_enabled and bool(auth.billing_uid)
        token = gateway_user_token(auth) if lane else None
        if lane and not bills_someone_else(auth) and not settings.forge_internal_lane_fallback:
            lane = False
            if not token:
                raise RodiumError(t("rodium_session_expired", locale), 401, ERR_AUTH_EXPIRED)  # type: ignore[arg-type]
        if token:
            response = await client.post(
                settings.rodium_gateway_v1_url + "/images/generations",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload,
            )
            if response.status_code >= 400:
                try:
                    _raise_rodium_error(response, locale)  # type: ignore[arg-type]
                except RodiumError as exc:
                    if exc.code == ERR_QUOTA and has_own_key:
                        lane = False  # the same wallets stand behind both lanes
                        response = None
                    elif lane and exc.status_code in (401, 403):
                        response = None
                    else:
                        raise
            else:
                lane = False
        if lane:
            url = settings.rodium_gateway_internal_url.rstrip("/") + "/internal/forge/images/generations"
            body = {"billing_uid": auth.billing_uid, **payload}
            if auth.actor_uid and auth.actor_uid != auth.billing_uid:
                body["actor_uid"] = auth.actor_uid
            response = await client.post(
                url,
                headers={"X-Forge-Gateway-Token": settings.rodium_forge_gateway_token},
                json=body,
            )
            if response.status_code >= 400:
                try:
                    _raise_rodium_error(response, locale)  # type: ignore[arg-type]
                except RodiumError as exc:
                    if exc.code != ERR_QUOTA or not has_own_key:
                        raise
                    response = None
        if response is None:
            if auth.mode == "playground" and auth.access_token and auth.api_key_id:
                response = await client.post(
                    _playground_base() + "/images/generations",
                    headers={
                        "Authorization": f"Bearer {auth.access_token}",
                        "Content-Type": "application/json",
                    },
                    json={"apiKeyId": auth.api_key_id, **payload},
                )
            else:
                response = await client.post(
                    settings.rodium_base_url.rstrip("/") + "/images/generations",
                    headers={
                        "Authorization": f"Bearer {auth.api_key_secret}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

    if response.status_code >= 400:
        _raise_rodium_error(response, locale)  # type: ignore[arg-type]

    try:
        b64 = response.json()["data"][0]["b64_json"]
        return base64.b64decode(b64)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise RodiumError("Invalid image generation payload") from exc


async def generate_project_image(
    *,
    auth: RodiumGenerationAuth,
    project_id: str,
    prompt: str,
    model: str | None = None,
    locale: str = "fr",
    size: str | None = None,
) -> dict:
    import asyncio

    from app.services.project_media import record_media, save_webp_with_variants

    settings = get_settings()
    size = size or size_for_prompt(prompt)
    raw = await request_image_bytes(auth=auth, prompt=prompt, size=size, model=model, locale=locale)
    stem = f"{_slugify_prompt(prompt)}-{uuid4().hex[:8]}"
    entry = await asyncio.to_thread(save_webp_with_variants, project_id, raw, stem=stem)
    entry.kind = "generated"
    entry.alt = re.sub(r"\s+", " ", prompt).strip()[:140]
    record_media(project_id, entry)
    return {
        "path": "public" + entry.path,
        "public_path": entry.path,
        "width": entry.width,
        "height": entry.height,
        "srcset": entry.srcset,
        "prompt": prompt,
        "model": model or settings.effective_default_image_model,
    }
