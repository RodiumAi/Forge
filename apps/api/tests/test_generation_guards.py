from __future__ import annotations

import ast
import asyncio
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, call

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.errors import insufficient_rodi
from app.routers import projects as projects_mod
from app.services import rodium_generation as generation_mod
from app.services.orchestration import security_review as security_review_mod


def _request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "client": ("203.0.113.8", 1234),
        }
    )


def test_generation_auth_is_paid_by_default_and_denies_before_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    db = MagicMock()
    monkeypatch.setattr(generation_mod, "_bound_user", lambda _db, current: current)

    def deny(_user, _db):
        raise insufficient_rodi()

    monkeypatch.setattr(generation_mod, "require_rodi_for_paid_capability", deny)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(generation_mod.resolve_generation_auth(db, user))

    assert exc.value.status_code == 402
    db.get.assert_not_called()


def test_generation_auth_allows_explicit_free_usage(monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(id=uuid.uuid4(), rodium_sub=None)
    row = SimpleNamespace(
        selected_rodium_api_key_id=None,
        rodium_api_key_encrypted="encrypted",
    )
    db = MagicMock()
    db.get.return_value = row
    gate = MagicMock()
    monkeypatch.setattr(generation_mod, "_bound_user", lambda _db, current: current)
    monkeypatch.setattr(generation_mod, "require_rodi_for_paid_capability", gate)
    monkeypatch.setattr(generation_mod, "decrypt_secret", lambda _value: "rd_sk_free")

    auth = asyncio.run(generation_mod.resolve_generation_auth(db, user, usage="free"))

    assert auth.mode == "secret"
    assert auth.api_key_secret == "rd_sk_free"
    gate.assert_not_called()


def test_project_naming_is_the_only_explicit_free_call_site() -> None:
    app_root = Path(__file__).resolve().parents[1] / "app"
    free_call_sites: list[str] = []
    for source_path in app_root.rglob("*.py"):
        tree = ast.parse(source_path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            if not isinstance(node.func, ast.Name) or node.func.id != "resolve_generation_auth":
                continue
            if any(
                keyword.arg == "usage"
                and isinstance(keyword.value, ast.Constant)
                and keyword.value.value == "free"
                for keyword in node.keywords
            ):
                free_call_sites.append(source_path.relative_to(app_root).as_posix())

    assert free_call_sites == ["services/project_naming.py"]


def test_security_review_returns_402_before_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    project_id = uuid.uuid4()
    monkeypatch.setattr(projects_mod.rate_limit, "enforce", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(projects_mod, "_owned_project", lambda *_args, **_kwargs: object())

    async def deny(*_args, **_kwargs):
        raise insufficient_rodi()

    llm = AsyncMock(return_value="should not run")
    monkeypatch.setattr(generation_mod, "resolve_generation_auth", deny)
    monkeypatch.setattr(security_review_mod, "run_security_review", llm)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            projects_mod.security_review_project(
                project_id=project_id,
                request=_request(),
                user=user,
                db=MagicMock(),
            )
        )

    assert exc.value.status_code == 402
    llm.assert_not_awaited()


def test_security_review_rate_limits_before_project_or_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    owned = MagicMock()

    def reject(*_args, **_kwargs):
        raise HTTPException(status_code=429, detail="too_many_requests")

    monkeypatch.setattr(projects_mod.rate_limit, "enforce", reject)
    monkeypatch.setattr(projects_mod, "_owned_project", owned)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            projects_mod.security_review_project(
                project_id=uuid.uuid4(),
                request=_request(),
                user=user,
                db=MagicMock(),
            )
        )

    assert exc.value.status_code == 429
    owned.assert_not_called()


def test_security_review_checks_ownership_before_ip_and_project_buckets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    enforce = MagicMock()
    monkeypatch.setattr(projects_mod.rate_limit, "enforce", enforce)

    def not_owned(*_args, **_kwargs):
        raise HTTPException(status_code=404, detail="project_not_found")

    monkeypatch.setattr(projects_mod, "_owned_project", not_owned)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            projects_mod.security_review_project(
                project_id=uuid.uuid4(),
                request=_request(),
                user=user,
                db=MagicMock(),
            )
        )

    assert exc.value.status_code == 404
    assert enforce.call_count == 1
    assert enforce.call_args.args[1] == "security-review-user"


def test_security_review_has_ip_user_and_project_buckets(monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(id=uuid.uuid4())
    project_id = uuid.uuid4()
    enforce = MagicMock()
    monkeypatch.setattr(projects_mod.rate_limit, "enforce", enforce)
    monkeypatch.setattr(projects_mod, "_owned_project", lambda *_args, **_kwargs: object())
    monkeypatch.setattr(
        generation_mod,
        "resolve_generation_auth",
        AsyncMock(return_value=SimpleNamespace(mode="secret")),
    )
    monkeypatch.setattr(
        security_review_mod,
        "run_security_review",
        AsyncMock(return_value="No material findings."),
    )
    request = _request()

    result = asyncio.run(
        projects_mod.security_review_project(
            project_id=project_id,
            request=request,
            user=user,
            db=MagicMock(),
        )
    )

    assert result == {"report": "No material findings."}
    assert enforce.call_args_list == [
        call(
            request,
            "security-review-user",
            limit=projects_mod.SECURITY_REVIEW_USER_LIMIT_PER_HOUR,
            window_seconds=3600,
            subject=str(user.id),
        ),
        call(
            request,
            "security-review-ip",
            limit=projects_mod.SECURITY_REVIEW_IP_LIMIT_PER_HOUR,
            window_seconds=3600,
        ),
        call(
            request,
            "security-review-project",
            limit=projects_mod.SECURITY_REVIEW_LIMIT_PER_HOUR,
            window_seconds=3600,
            subject=str(project_id),
        ),
    ]
