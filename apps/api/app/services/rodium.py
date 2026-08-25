from __future__ import annotations

import httpx

from app.config import get_settings
from app.i18n import Locale, t
from app.services.llm import RodiumError


async def verify_rodium_api_key(api_key: str, locale: Locale = "fr") -> None:
    settings = get_settings()
    url = settings.rodium_base_url.rstrip("/") + "/models"
    headers = {"Authorization": f"Bearer {api_key}"}

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
        response = await client.get(url, headers=headers)
        if response.status_code in (401, 403):
            raise RodiumError(t("rodium_invalid_key", locale), response.status_code)
        if response.status_code >= 400:
            text = response.text[:500]
            raise RodiumError(
                t("rodium_error", locale, code=response.status_code, body=text),
                response.status_code,
            )
