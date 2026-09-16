"""Security boundaries around the private per-project Git repository."""

from __future__ import annotations

import shutil
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.routers import files as files_router
from app.services import history
from app.services.filesystem import project_dir, write_file


@pytest.mark.skipif(shutil.which("git") is None, reason="git is required")
def test_snapshot_neutralises_a_preexisting_malicious_git_filter(project):
    """A config planted before the path guard shipped must never execute."""
    write_file(project, "src/App.tsx", "export default () => null")
    assert history.snapshot(project, "initial") is not None

    repo = project_dir(project)
    git_config = repo / ".git" / "config"
    proof = repo / "public" / "rce-proof.txt"
    proof.parent.mkdir(parents=True, exist_ok=True)

    # Bypass the now-protected filesystem helper to model a workspace already
    # poisoned before deployment of the fix.
    git_config.write_text(
        """\
[core]
\trepositoryformatversion = 0
\tbare = false
[filter "poc"]
\tclean = touch public/rce-proof.txt
\tsmudge = cat
""",
        encoding="utf-8",
    )
    (repo / ".gitattributes").write_text("trigger.txt filter=poc\n", encoding="utf-8")
    (repo / "trigger.txt").write_text("trigger\n", encoding="utf-8")

    history.snapshot(project, "must be safe")

    assert not proof.exists()
    sanitised = git_config.read_text(encoding="utf-8")
    assert '[filter "poc"]' not in sanitised
    assert "hooksPath = /dev/null" in sanitised


def test_file_content_endpoint_refuses_git_config(project, monkeypatch):
    """Pin the exact authenticated endpoint used by the reported exploit."""
    project_id = uuid.uuid4()
    snapshot = MagicMock()
    monkeypatch.setattr(files_router, "_owned", MagicMock())
    monkeypatch.setattr(files_router.history, "snapshot", snapshot)

    with pytest.raises(HTTPException) as exc:
        files_router.put_file_content(
            project_id=project_id,
            body=files_router.FileWriteRequest(
                path=".git/config",
                content='[filter "poc"]\n\tclean = id\n',
            ),
            request=SimpleNamespace(headers={}),
            user=SimpleNamespace(id=uuid.uuid4()),
            db=MagicMock(),
        )

    assert exc.value.status_code == 400
    assert "project history" in str(exc.value.detail)


def test_public_asset_endpoint_does_not_expose_git_metadata(project, monkeypatch):
    """The legacy root-file fallback must still pass through the path guard."""
    project_id = uuid.uuid4()
    repo = project_dir(str(project_id))
    (repo / ".git").mkdir()
    (repo / ".git" / "config").write_text("[core]\n", encoding="utf-8")
    monkeypatch.setattr(files_router, "_owned", MagicMock())

    with pytest.raises(HTTPException) as exc:
        files_router.get_public_asset(
            project_id=project_id,
            asset_path=".git/config",
            request=SimpleNamespace(headers={}),
            user=SimpleNamespace(id=uuid.uuid4()),
            db=MagicMock(),
        )

    assert exc.value.status_code == 404
