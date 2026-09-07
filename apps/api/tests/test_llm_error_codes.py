"""Stable codes from `_raise_rodium_error` — the browser maps each to a CTA."""

from __future__ import annotations

import httpx
import pytest

from app.services.llm import (
    ERR_INVALID_KEY,
    ERR_UPSTREAM,
    RodiumError,
    _raise_rodium_error,
)


def _response(status: int, body: str) -> httpx.Response:
    return httpx.Response(status, content=body.encode("utf-8"))


def test_api_key_not_found_404_is_invalid_key_not_upstream() -> None:
    # Nest playground: linked apiKeyId deleted / never provisioned.
    with pytest.raises(RodiumError) as caught:
        _raise_rodium_error(
            _response(404, '{"message":"API key not found.","error":"Not Found","statusCode":404}'),
            "en",
        )
    assert caught.value.code == ERR_INVALID_KEY
    assert caught.value.status_code == 404


def test_unrelated_404_stays_upstream() -> None:
    with pytest.raises(RodiumError) as caught:
        _raise_rodium_error(_response(404, '{"message":"Model route missing"}'), "en")
    assert caught.value.code == ERR_UPSTREAM


def test_401_key_rejection_is_invalid_key() -> None:
    with pytest.raises(RodiumError) as caught:
        _raise_rodium_error(_response(401, '{"message":"Unauthorized"}'), "fr")
    assert caught.value.code == ERR_INVALID_KEY
