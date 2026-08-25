from __future__ import annotations

import base64
import os
from typing import Protocol

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings


class KeyProvider(Protocol):
    async def generate_data_key(self, context: str) -> tuple[bytes, bytes]:
        """Retourne (dek_plaintext, dek_encrypted_blob)."""
        ...

    async def decrypt_data_key(self, blob: bytes, context: str) -> bytes:
        ...


class LocalKeyProvider:
    """Développement et tests. Master key = DEV_MASTER_KEY (32 octets base64)."""

    def __init__(self) -> None:
        s = get_settings()
        if not s.dev_master_key:
            raise RuntimeError("DEV_MASTER_KEY manquante")
        self._master = base64.b64decode(s.dev_master_key)
        if len(self._master) != 32:
            raise RuntimeError("DEV_MASTER_KEY doit faire 32 octets")

    async def generate_data_key(self, context: str) -> tuple[bytes, bytes]:
        dek = os.urandom(32)
        nonce = os.urandom(12)
        blob = nonce + AESGCM(self._master).encrypt(nonce, dek, context.encode())
        return dek, blob

    async def decrypt_data_key(self, blob: bytes, context: str) -> bytes:
        nonce, ct = blob[:12], blob[12:]
        return AESGCM(self._master).decrypt(nonce, ct, context.encode())


class KmsKeyProvider:
    """Production. AAD = contexte (ex. connector_account.id)."""

    def __init__(self) -> None:
        import boto3

        s = get_settings()
        self._kms = boto3.client("kms", region_name=s.object_store_region or "eu-west-1")
        self._key_id = s.kms_key_id

    async def generate_data_key(self, context: str) -> tuple[bytes, bytes]:
        r = self._kms.generate_data_key(
            KeyId=self._key_id,
            KeySpec="AES_256",
            EncryptionContext={"ctx": context},
        )
        return r["Plaintext"], r["CiphertextBlob"]

    async def decrypt_data_key(self, blob: bytes, context: str) -> bytes:
        r = self._kms.decrypt(
            CiphertextBlob=blob,
            EncryptionContext={"ctx": context},
        )
        return r["Plaintext"]


def build_key_provider() -> KeyProvider:
    s = get_settings()
    return LocalKeyProvider() if s.key_provider == "local" else KmsKeyProvider()
