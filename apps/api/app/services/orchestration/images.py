"""Image generation via Rodium playground proxy or legacy gateway secret."""

from __future__ import annotations

import base64
import re
from uuid import uuid4

import httpx

from app.config import get_settings
from app.services.filesystem import write_bytes
from app.services.llm import RodiumError, _playground_base, _raise_rodium_error
from app.services.rodium_generation import RodiumGenerationAuth


def _slugify_prompt(prompt: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", prompt.lower()).strip("-")[:40]
    return slug or "image"


async def generate_project_image(
    *,
    auth: RodiumGenerationAuth,
    project_id: str,
    prompt: str,
    model: str | None = None,
    locale: str = "fr",
) -> dict:
    settings = get_settings()
    model = model or settings.effective_default_image_model
    payload = {
        "model": model,
        "prompt": prompt[:4000],
        "n": 1,
        "size": "1024x1024",
        "response_format": "b64_json",
    }

    if auth.mode == "playground":
        url = _playground_base() + "/images/generations"
        headers = {
            "Authorization": f"Bearer {auth.access_token}",
            "Content-Type": "application/json",
        }
        body = {"apiKeyId": auth.api_key_id, **payload}
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=30.0)) as client:
            response = await client.post(url, headers=headers, json=body)
    else:
        url = settings.rodium_base_url.rstrip("/") + "/images/generations"
        headers = {
            "Authorization": f"Bearer {auth.api_key_secret}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=30.0)) as client:
            response = await client.post(url, headers=headers, json=payload)

    if response.status_code >= 400:
        _raise_rodium_error(response, locale)  # type: ignore[arg-type]

    data = response.json()
    try:
        b64 = data["data"][0]["b64_json"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RodiumError("Invalid image generation payload") from exc

    raw = base64.b64decode(b64)
    filename = f"{_slugify_prompt(prompt)}-{uuid4().hex[:8]}.png"
    rel_path = f"public/generated/{filename}"
    write_bytes(project_id, rel_path, raw)
    return {
        "path": rel_path,
        "public_path": f"/{rel_path.removeprefix('public/')}",
        "prompt": prompt,
        "model": model,
    }
