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
