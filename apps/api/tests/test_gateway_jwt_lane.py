"""Forge Cloud generates with each user's own RodiumAi token.

The gateway bills the token's owner, so no shared secret can spend someone
else's FRODI. The internal lane only remains for shared projects billed to
their owner and, during the transition, when the gateway refuses a token.
"""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.config import clear_settings_cache
from app.services import llm
from app.services.rodium_generation import RodiumGenerationAuth

GATEWAY = "http://gateway.test/v1"
INTERNAL = "http://internal.test"


@pytest.fixture
def cloud(monkeypatch):
    monkeypatch.setenv("RODIUM_FORGE_GATEWAY_TOKEN", "lane-token")
    monkeypatch.setenv("RODIUM_GATEWAY_INTERNAL_URL", INTERNAL)
    monkeypatch.setenv("RODIUM_PROVISION_TOKEN", "provision-token")
    monkeypatch.setenv("RODIUM_GATEWAY_URL", GATEWAY)
    monkeypatch.delenv("FORGE_INTERNAL_LANE_FALLBACK", raising=False)
    clear_settings_cache()
    yield monkeypatch
    clear_settings_cache()


class Upstream:
    """Answers per URL path; records what was asked."""

    def __init__(self, answers: dict[str, httpx.Response]):
        self.answers = answers
        self.calls: list[tuple[str, dict, dict]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content or b"{}")
        self.calls.append((request.url.path, dict(request.headers), body))
        return self.answers.get(request.url.path) or httpx.Response(599, text="unexpected call")

    def install(self, monkeypatch) -> None:
        real = httpx.AsyncClient
        transport = httpx.MockTransport(self.handler)

        def client(*args, **kwargs):
            kwargs["transport"] = transport
            return real(*args, **kwargs)

        monkeypatch.setattr(httpx, "AsyncClient", client)

    def paths(self) -> list[str]:
        return [path for path, _h, _b in self.calls]


def _sse(text: str) -> httpx.Response:
    frame = json.dumps({"choices": [{"delta": {"content": text}}]})
    return httpx.Response(
        200, text=f"data: {frame}\n\ndata: [DONE]\n\n", headers={"content-type": "text/event-stream"}
    )


def _chat(auth: RodiumGenerationAuth) -> str:
    async def run():
        out = []
        async for chunk in llm.stream_chat_completion(
            auth=auth,
            model="google/gemini-3.7-flash",
            messages=[{"role": "user", "content": "hi"}],
            locale="en",
        ):
            if chunk.kind == "token":
                out.append(chunk.content)
        return "".join(out)

    return asyncio.run(run())


def _user(**extra) -> RodiumGenerationAuth:
    return RodiumGenerationAuth(mode="playground", billing_uid="u-1", user_token="jwt-u1", **extra)


class TestChatLanes:
    def test_the_users_own_token_goes_to_the_gateway(self, cloud):
        up = Upstream({"/v1/chat/completions": _sse("ok")})
        up.install(cloud)
        assert _chat(_user()) == "ok"
        assert up.paths() == ["/v1/chat/completions"]
        _path, headers, body = up.calls[0]
        assert headers["authorization"] == "Bearer jwt-u1"
        assert "billing_uid" not in body and "x-forge-gateway-token" not in headers

    def test_a_refused_token_falls_back_to_the_lane_during_the_transition(self, cloud):
        up = Upstream(
            {
                "/v1/chat/completions": httpx.Response(403, json={"error": {"code": "model_not_allowed"}}),
                "/internal/forge/chat/completions": _sse("lane"),
            }
        )
        up.install(cloud)
        assert _chat(_user()) == "lane"
        assert up.paths() == ["/v1/chat/completions", "/internal/forge/chat/completions"]

    def test_without_the_fallback_a_refusal_is_reported(self, cloud):
        cloud.setenv("FORGE_INTERNAL_LANE_FALLBACK", "false")
        clear_settings_cache()
        up = Upstream({"/v1/chat/completions": httpx.Response(401, json={"error": "invalid_token"})})
        up.install(cloud)
        with pytest.raises(llm.RodiumError):
            _chat(_user())
        assert up.paths() == ["/v1/chat/completions"]

    def test_no_token_and_no_fallback_asks_to_sign_in_again(self, cloud):
        cloud.setenv("FORGE_INTERNAL_LANE_FALLBACK", "false")
        clear_settings_cache()
        up = Upstream({})
        up.install(cloud)
        with pytest.raises(llm.RodiumError) as err:
            _chat(RodiumGenerationAuth(mode="playground", billing_uid="u-1"))
        assert err.value.code == llm.ERR_AUTH_EXPIRED
        assert up.paths() == []

    def test_an_owner_billed_project_never_uses_the_collaborators_token(self, cloud):
        up = Upstream({"/internal/forge/chat/completions": _sse("owner")})
        up.install(cloud)
        auth = RodiumGenerationAuth(
            mode="playground",
            billing_uid="owner",
            actor_uid="collab",
            project_id="p",
            frodi_cap_per_cycle=200,
            user_token="jwt-collab",
        )
        assert _chat(auth) == "owner"
        _path, _headers, body = up.calls[0]
        assert up.paths() == ["/internal/forge/chat/completions"]
        assert body["billing_uid"] == "owner" and body["actor_uid"] == "collab"
        assert body["forge_context"]["cap_per_cycle"] == 200

    def test_an_exhausted_balance_is_not_retried_on_the_lane(self, cloud):
        up = Upstream({"/v1/chat/completions": httpx.Response(402, json={"error": "insufficient balance"})})
        up.install(cloud)
        with pytest.raises(llm.RodiumError):
            _chat(_user())
        assert "/internal/forge/chat/completions" not in up.paths()


class TestImageLanes:
    def _image(self, auth):
        from app.services.orchestration.images import request_image_bytes

        return asyncio.run(request_image_bytes(auth=auth, prompt="a loaf", locale="en"))

    def test_images_use_the_users_token(self, cloud):
        up = Upstream({"/v1/images/generations": httpx.Response(200, json={"data": [{"b64_json": "aGk="}]})})
        up.install(cloud)
        assert self._image(_user()) == b"hi"
        assert up.paths() == ["/v1/images/generations"]
        assert up.calls[0][1]["authorization"] == "Bearer jwt-u1"

    def test_a_refused_image_falls_back_to_the_lane(self, cloud):
        up = Upstream(
            {
                "/v1/images/generations": httpx.Response(403, json={"error": {"code": "model_not_allowed"}}),
                "/internal/forge/images/generations": httpx.Response(
                    200, json={"data": [{"b64_json": "aGk="}]}
                ),
            }
        )
        up.install(cloud)
        assert self._image(_user()) == b"hi"
        assert up.paths() == ["/v1/images/generations", "/internal/forge/images/generations"]


class TestTokenRecovery:
    def test_a_missing_token_is_minted_again(self, monkeypatch):
        from fastapi import HTTPException

        from app.services import rodium_generation, rodium_provisioning

        async def no_token(*_a, **_k):
            raise HTTPException(status_code=403, detail="not linked")

        async def reissue(*, email, user_id):
            assert (email, user_id) == ("a@b.co", "sub-1")
            return rodium_provisioning.ProvisionResult(
                user_id=user_id, tokens={"access_token": "fresh", "refresh_token": "r", "expires_in": 3600}
            )

        stored = {}

        class Row:
            rodium_refresh_token_encrypted = None

        class DB:
            def refresh(self, _row):
                pass

            def commit(self):
                stored["committed"] = True

        class User:
            email = "a@b.co"
            rodium_sub = "sub-1"

        monkeypatch.setattr(rodium_generation, "ensure_rodium_access_token", no_token)
        monkeypatch.setattr(rodium_provisioning, "enabled", lambda: True)
        monkeypatch.setattr(rodium_provisioning, "reissue_tokens", reissue)
        monkeypatch.setattr(
            rodium_generation, "store_oauth_tokens", lambda _row, tokens: stored.update(tokens)
        )

        token = asyncio.run(rodium_generation.gateway_access_token(DB(), User(), Row()))
        assert token == "fresh"
        assert stored["refresh_token"] == "r" and stored["committed"]

    def test_a_transient_failure_returns_no_token(self, monkeypatch):
        from fastapi import HTTPException

        from app.services import rodium_generation

        async def busy(*_a, **_k):
            raise HTTPException(status_code=503, detail="unreachable")

        monkeypatch.setattr(rodium_generation, "ensure_rodium_access_token", busy)
        assert asyncio.run(rodium_generation.gateway_access_token(object(), object(), object())) is None
