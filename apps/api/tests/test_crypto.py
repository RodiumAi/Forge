"""Encryption key resolution for local vs staging-shaped ENCRYPTION_KEY values."""

from __future__ import annotations

import base64
import hashlib

import pytest
from cryptography.fernet import Fernet

from app import crypto
from app.config import get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_non_fernet_encryption_key_derives_like_legacy(monkeypatch):
    material = "a" * 64
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("ENCRYPTION_KEY", material)
    monkeypatch.setenv("SECRET_KEY", "staging-secret-not-the-default-value-xxxxx")
    get_settings.cache_clear()

    expected = Fernet(base64.urlsafe_b64encode(hashlib.sha256(material.encode()).digest()))
    token = crypto.encrypt_secret("hello-forge")
    assert expected.decrypt(token.encode()).decode() == "hello-forge"
    assert crypto.decrypt_secret(token) == "hello-forge"


def test_valid_fernet_encryption_key_used_as_is(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("ENCRYPTION_KEY", key)
    monkeypatch.setenv("SECRET_KEY", "staging-secret-not-the-default-value-xxxxx")
    get_settings.cache_clear()

    token = crypto.encrypt_secret("direct-key")
    assert Fernet(key.encode()).decrypt(token.encode()).decode() == "direct-key"


def test_missing_encryption_key_fails_outside_local(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("ENCRYPTION_KEY", "")
    monkeypatch.setenv("SECRET_KEY", "staging-secret-not-the-default-value-xxxxx")
    get_settings.cache_clear()

    with pytest.raises(RuntimeError, match="ENCRYPTION_KEY"):
        crypto.encrypt_secret("nope")
