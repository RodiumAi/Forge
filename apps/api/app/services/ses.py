from __future__ import annotations

import asyncio

from app.providers.mail import build_mail_provider


def send_email(*, to: list[str], subject: str, html: str, from_name: str | None = None) -> str:
    """Sync wrapper around MailProvider (SMTP / SES / Resend plateforme)."""
    provider = build_mail_provider()
    text = " "

    async def _run() -> str:
        return await provider.send(to, subject, html, text, from_name=from_name)

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_run())

    # Called from async route: schedule on the running loop.
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(lambda: asyncio.run(_run())).result()
