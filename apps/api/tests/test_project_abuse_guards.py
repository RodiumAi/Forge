"""Anti-abuse gates on project creation and publication."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import ANY, MagicMock, call

import pytest
from fastapi import HTTPException

from app.routers import projects as projects_mod
from app.routers import publish as publish_mod
from app.schemas import ProjectCreate


def _user(*, verified: bool):
    return SimpleNamespace(
        id=uuid.uuid4(),
        email_verified_at=datetime.now(UTC) if verified else None,
    )


def test_project_creation_requires_verified_email(monkeypatch: pytest.MonkeyPatch) -> None:
    enforce = MagicMock()
    monkeypatch.setattr(projects_mod.rate_limit, "enforce", enforce)
    db = MagicMock()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            projects_mod.create_project(
                body=ProjectCreate(name="Demo"),
                request=MagicMock(),
                user=_user(verified=False),
                db=db,
            )
        )

    assert exc.value.status_code == 403
    enforce.assert_not_called()
    db.query.assert_not_called()


def test_project_creation_enforces_rate_and_total_quota(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    enforce = MagicMock()
    monkeypatch.setattr(projects_mod.rate_limit, "enforce", enforce)
    user = _user(verified=True)
    db = MagicMock()
    db.query.return_value.filter.return_value.scalar.return_value = projects_mod.MAX_PROJECTS_PER_USER

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            projects_mod.create_project(
                body=ProjectCreate(name="Demo"),
                request=MagicMock(),
                user=user,
                db=db,
            )
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == "project_quota_exceeded"
    assert enforce.call_count == 2
    enforce.assert_has_calls(
        [
            call(
                ANY,
                "project-create-ip",
                limit=projects_mod.PROJECT_CREATION_IP_LIMIT_PER_HOUR,
                window_seconds=3600,
            ),
            call(
                ANY,
                "project-create",
                limit=projects_mod.PROJECT_CREATION_LIMIT_PER_HOUR,
                window_seconds=3600,
                subject=str(user.id),
            ),
        ]
    )
    db.add.assert_not_called()


def test_publication_requires_verified_email(monkeypatch: pytest.MonkeyPatch) -> None:
    enforce = MagicMock()
    monkeypatch.setattr(publish_mod.rate_limit, "enforce", enforce)
    db = MagicMock()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            publish_mod.publish_now(
                project_id=uuid.uuid4(),
                request=MagicMock(),
                user=_user(verified=False),
                db=db,
            )
        )

    assert exc.value.status_code == 403
    enforce.assert_not_called()
    db.get.assert_not_called()


def test_publication_rate_limit_runs_before_project_work(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(verified=True)
    db = MagicMock()

    def reject(*_args, **_kwargs):
        raise HTTPException(status_code=429, detail="too_many_requests")

    monkeypatch.setattr(publish_mod.rate_limit, "enforce", reject)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            publish_mod.publish_now(
                project_id=uuid.uuid4(),
                request=MagicMock(),
                user=user,
                db=db,
            )
        )

    assert exc.value.status_code == 429
    db.get.assert_not_called()
