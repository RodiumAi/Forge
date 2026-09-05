"""HTTP errors that carry a machine-readable code.

Every response body here has the shape::

    {"detail": {"code": "INSUFFICIENT_RODI", "message": "…"}}

The code is the contract: the browser maps it to a translated sentence and,
where one exists, a single button that resolves the situation (top up, sign in
again, open settings). Matching on the English `message` — which is what the
client used to do — breaks the moment those strings are translated, and gives
no way to attach an action.

Codes are mirrored in `apps/web/lib/chat-errors.ts`. Adding one here without a
row there means the user gets the raw message and a generic Retry.
"""

from __future__ import annotations

from fastapi import HTTPException


class SitesError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, extra: dict | None = None):
        payload = {"code": code, "message": message}
        if extra:
            payload.update(extra)
        super().__init__(status_code=status_code, detail=payload)
        self.code = code


def insufficient_rodi(message: str = "Insufficient RODI credits.") -> SitesError:
    return SitesError(402, "INSUFFICIENT_RODI", message)


def quota_exceeded(code: str, message: str, extra: dict | None = None) -> SitesError:
    return SitesError(429, code, message, extra)


def recipient_not_allowed() -> SitesError:
    return SitesError(403, "EMAIL_RECIPIENT_NOT_ALLOWED", "This recipient is not allowed.")


def provider_not_configured(name: str) -> SitesError:
    return SitesError(503, "PROVIDER_NOT_CONFIGURED", f"{name} is not configured on the Forge API.")


def rodium_link_expired(message: str) -> SitesError:
    """The RodiumAi OAuth link is dead — re-linking is the only way forward.

    Distinct from a plain 403: the client signs the user out so the next login
    re-links in one step, instead of leaving a signed-in UI where every prompt
    fails.
    """
    return SitesError(403, "RODIUM_LINK_EXPIRED", message)


def generation_failed(code: str, message: str, status_code: int = 502) -> SitesError:
    """A generation attempt that never got as far as opening a stream.

    `code` comes from the taxonomy in `app/services/llm.py` so the pre-stream
    and mid-stream failures classify identically on the client.
    """
    return SitesError(status_code, code, message)
