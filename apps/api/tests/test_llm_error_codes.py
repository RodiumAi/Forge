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


def test_wrapped_read_timeout_is_retried_as_transient() -> None:
    # str(httpx.ReadTimeout("")) is empty, so the wrapped message holds no
    # marker; the classification must come from the error code instead.
    from app.services.llm import ERR_TIMEOUT, _network_rodium_error, is_transient_network_error

    wrapped = _network_rodium_error(httpx.ReadTimeout(""), "fr")
    assert wrapped.code == ERR_TIMEOUT
    assert is_transient_network_error(wrapped)


def test_upstream_error_without_status_is_not_transient() -> None:
    from app.services.llm import is_transient_network_error

    assert not is_transient_network_error(RodiumError("model refused", None, ERR_UPSTREAM))


def test_the_provider_body_never_reaches_the_message() -> None:
    body = (
        '{"error":{"message":"messages: text content blocks must be non-empty",'
        '"type":"invalid_request_error","code":"invalid_parameter"}}'
    )
    with pytest.raises(RodiumError) as caught:
        _raise_rodium_error(_response(400, body), "fr")
    assert caught.value.code == ERR_UPSTREAM
    assert "{" not in str(caught.value) and "400" not in str(caught.value)
    assert caught.value.detail == body


def test_user_error_message_hides_internal_errors() -> None:
    from app.services.llm import user_error_message

    assert "Traceback" not in user_error_message(KeyError("slides"), "fr")
    assert user_error_message(KeyError("slides"), "en") == (
        "Something went wrong on our side. Please try again in a moment."
    )
    assert user_error_message(RodiumError("Session expirée.", 401), "fr") == "Session expirée."
