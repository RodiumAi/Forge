"""Verify the Google / GitHub ID tokens minted by the browser SDK.

Same shape as the RodiumAi platform: the web app opens a Firebase popup, gets
an ID token, and posts it here; the server verifies it with the Admin SDK and
never sees the provider credentials. Reusing that model rather than
hand-rolling two OAuth dances keeps one implementation to reason about across
both apps.

Credentials are optional. With `FIREBASE_*` unset the module reports
`enabled = False`, the route answers 503, and the web app hides the buttons —
a clone shows no option it cannot honour.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

from app.config import get_settings

logger = logging.getLogger("firebase_auth")

_init_lock = threading.Lock()
_app = None


class FirebaseAuthError(Exception):
    """Token rejected, or the Admin SDK is not configured."""


@dataclass(frozen=True)
class FederatedIdentity:
    provider: str  # "google" | "github"
    provider_account_id: str  # Firebase uid — stable per provider identity
    email: str
    email_verified: bool
    name: str | None
    picture: str | None


def enabled() -> bool:
    return get_settings().firebase_enabled


def _get_app():
    global _app
    if _app is not None:
        return _app
    with _init_lock:
        if _app is not None:
            return _app
        settings = get_settings()
        if not settings.firebase_enabled:
            raise FirebaseAuthError("firebase_not_configured")
        import firebase_admin
        from firebase_admin import credentials

        cred = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": settings.firebase_project_id,
                "client_email": settings.firebase_client_email,
                "private_key": settings.firebase_private_key_pem,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )
        # Named so we never collide with an app another part of the process
        # may have initialised.
        _app = firebase_admin.initialize_app(cred, name="forge-auth")
        return _app


def _map_provider(raw: str | None) -> str:
    if raw == "google.com":
        return "google"
    if raw == "github.com":
        return "github"
    raise FirebaseAuthError("unsupported_provider")


def verify_id_token(id_token: str) -> FederatedIdentity:
    """Verify and unpack an ID token, or raise `FirebaseAuthError`."""
    app = _get_app()
    from firebase_admin import auth as fb_auth

    try:
        claims = fb_auth.verify_id_token(id_token, app=app)
    except Exception as exc:
        raise FirebaseAuthError("invalid_id_token") from exc

    firebase = claims.get("firebase") or {}
    provider = _map_provider(firebase.get("sign_in_provider"))

    email = (claims.get("email") or "").strip().lower()
    if not email:
        # GitHub accounts that hide their address arrive without one, and an
        # account with no address cannot be verified, linked or mailed.
        raise FirebaseAuthError("email_required")

    uid = claims.get("uid") or claims.get("sub")
    if not uid:
        raise FirebaseAuthError("invalid_id_token")

    return FederatedIdentity(
        provider=provider,
        provider_account_id=str(uid),
        email=email,
        # Google always verifies; GitHub verifies the primary address. We keep
        # the claim rather than assuming, and the caller decides what an
        # unverified address is allowed to do.
        email_verified=bool(claims.get("email_verified")),
        name=claims.get("name") if isinstance(claims.get("name"), str) else None,
        picture=claims.get("picture") if isinstance(claims.get("picture"), str) else None,
    )
