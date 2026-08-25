from __future__ import annotations

import httpx

from app.errors import SitesError


async def send_resend_email(
    *,
    api_key: str,
    from_email: str,
    from_name: str,
    to: list[str],
    subject: str,
    html: str,
    reply_to: str | None = None,
) -> str:
    payload: dict = {
        "from": f"{from_name} <{from_email}>" if from_name else from_email,
        "to": to,
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
    if response.status_code >= 400:
        raise SitesError(
            502,
            "CONNECTOR_UPSTREAM_ERROR",
            "Resend could not send this email.",
            {"provider": "resend"},
        )
    data = response.json()
    return str(data.get("id") or "")
