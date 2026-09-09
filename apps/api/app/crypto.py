import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


def _fernet() -> Fernet:
    settings = get_settings()
    raw = (settings.encryption_key or "").strip()
    if raw:
        try:
            key = raw.encode("utf-8") if isinstance(raw, str) else raw
            return Fernet(key)
        except Exception:
            pass
    # No valid explicit ENCRYPTION_KEY. Deriving one from SECRET_KEY is only
    # acceptable locally; anywhere else the SECRET_KEY may be a public default,
    # which would leave stored API keys / refresh tokens readable.
    if not settings.is_local:
        raise RuntimeError("ENCRYPTION_KEY is required (a valid Fernet key) outside local environments")
    digest = hashlib.sha256((raw or settings.secret_key).encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt secret") from exc


def mask_api_key(key: str) -> str:
    if len(key) <= 8:
        return "*" * len(key)
    return f"{key[:6]}…{key[-4:]}"
