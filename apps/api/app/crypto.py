import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


def _fernet_from_material(material: str) -> Fernet:
    digest = hashlib.sha256(material.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _fernet() -> Fernet:
    settings = get_settings()
    raw = (settings.encryption_key or "").strip()
    if raw:
        try:
            key = raw.encode("utf-8") if isinstance(raw, str) else raw
            return Fernet(key)
        except Exception:
            # Prod historically stored a random/hex string in ENCRYPTION_KEY,
            # not a Fernet key. Derive so existing ciphertext stays readable.
            return _fernet_from_material(raw)
    # Empty ENCRYPTION_KEY: deriving from SECRET_KEY is only acceptable locally;
    # elsewhere SECRET_KEY may be a public default.
    if not settings.is_local:
        raise RuntimeError("ENCRYPTION_KEY is required (a valid Fernet key) outside local environments")
    return _fernet_from_material(settings.secret_key)


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
