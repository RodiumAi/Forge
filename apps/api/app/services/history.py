"""Per-project file history — snapshots, diff and restore.

Every project workspace under ``data/projects/{id}`` gets its own private git
repository. It is an implementation detail: the user never sees git, and the
repo is excluded from every listing (``list_files``/``file_tree`` already skip
``.git``) and from export/publish.

Why this exists: an agent turn rewrites arbitrary files, and before this there
was no way back. A bad turn was final. Now every batch of writes is preceded by
a snapshot, so the UI can offer "restore this checkpoint" on any turn.

Design constraints:
- Never raise into the write path. History is best-effort; losing a snapshot
  must never block a legitimate write.
- Never touch the user's global git identity (`-c user.*` per invocation).
- Never run a hook (`--no-verify`, `core.hooksPath=/dev/null`).
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from app.services.filesystem import project_dir

logger = logging.getLogger("history")

_AUTHOR_NAME = "Forge"
_AUTHOR_EMAIL = "forge@rodiumai.local"
_TIMEOUT = 30

# Never version build output or dependencies: they are huge and reproducible.
_GITIGNORE = """\
node_modules/
dist/
.vite/
.forge-deps-stamp
*.log
"""


@dataclass
class Snapshot:
    id: str
    label: str
    created_at: str
    files_changed: int = 0
    stats: dict[str, int] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "created_at": self.created_at,
            "files_changed": self.files_changed,
        }


class HistoryUnavailable(RuntimeError):
    """Git is missing or the repository is unusable."""


def _git_exe() -> str | None:
    return shutil.which("git")


def _run(repo: Path, args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    exe = _git_exe()
    if not exe:
        raise HistoryUnavailable("git executable not found")
    cmd = [
        exe,
        "-c",
        f"user.name={_AUTHOR_NAME}",
        "-c",
        f"user.email={_AUTHOR_EMAIL}",
        "-c",
        "core.hooksPath=",
        "-c",
        "commit.gpgsign=false",
        "-C",
        str(repo),
        *args,
    ]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=_TIMEOUT,
    )
    if check and proc.returncode != 0:
        raise HistoryUnavailable(f"git {' '.join(args[:2])} failed: {proc.stderr.strip()}")
    return proc


def is_available() -> bool:
    return _git_exe() is not None


def ensure_repo(project_id: str, initial_label: str = "initial state") -> tuple[Path, bool]:
    """Create the project history repo on first use.

    Returns (repo_path, created_now). `created_now` matters because the initial
    commit already captures the whole workspace: callers must not then report
    "nothing changed" for what is really the very first checkpoint.
    """
    repo = project_dir(project_id)
    if (repo / ".git").is_dir():
        return repo, False

    ignore = repo / ".gitignore"
    if not ignore.is_file():
        ignore.write_text(_GITIGNORE, encoding="utf-8")

    _run(repo, ["init", "--quiet", "--initial-branch=main"])
    _run(repo, ["add", "-A"])
    _run(repo, ["commit", "--quiet", "--allow-empty", "--no-verify", "-m", initial_label])
    return repo, True


def snapshot(project_id: str, label: str) -> str | None:
    """Commit the current workspace state. Returns the snapshot id, or None.

    Returns None when nothing changed (no empty checkpoints in the timeline) or
    when history is unavailable — callers must treat that as non-fatal.
    """
    try:
        repo, created = ensure_repo(project_id, label)
        if created:
            return _run(repo, ["rev-parse", "HEAD"]).stdout.strip()
        _run(repo, ["add", "-A"])
        status = _run(repo, ["status", "--porcelain"])
        if not status.stdout.strip():
            return None
        message = f"{label}\n\nforge-snapshot-at: {datetime.now(UTC).isoformat()}"
        _run(repo, ["commit", "--quiet", "--no-verify", "-m", message])
        head = _run(repo, ["rev-parse", "HEAD"])
        return head.stdout.strip()
    except HistoryUnavailable as exc:
        logger.warning("snapshot skipped for %s: %s", project_id, exc)
        return None
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("snapshot failed for %s: %s", project_id, exc)
        return None


def list_snapshots(project_id: str, limit: int = 50) -> list[Snapshot]:
    """Most recent first. Empty when history has never been initialised."""
    repo = project_dir(project_id)
    if not (repo / ".git").is_dir():
        return []
    try:
        out = _run(
            repo,
            ["log", f"-{limit}", "--pretty=format:%H%x1f%s%x1f%cI", "--no-merges"],
        )
    except (HistoryUnavailable, OSError, subprocess.SubprocessError):
        return []

    snapshots: list[Snapshot] = []
    for line in out.stdout.splitlines():
        parts = line.split("\x1f")
        if len(parts) != 3:
            continue
        commit, subject, created = parts
        snapshots.append(Snapshot(id=commit, label=subject, created_at=created))
    return snapshots


def snapshot_files(project_id: str, snapshot_id: str) -> list[str]:
    """Paths touched by a snapshot, relative to the project root."""
    repo = project_dir(project_id)
    try:
        out = _run(
            repo,
            ["show", "--pretty=format:", "--name-only", snapshot_id],
        )
    except (HistoryUnavailable, OSError, subprocess.SubprocessError):
        return []
    return [line.strip() for line in out.stdout.splitlines() if line.strip()]


def diff(project_id: str, snapshot_id: str) -> str:
    """Unified diff introduced by a snapshot (capped for UI display)."""
    repo = project_dir(project_id)
    try:
        out = _run(repo, ["show", "--format=", "--unified=3", snapshot_id])
    except (HistoryUnavailable, OSError, subprocess.SubprocessError):
        return ""
    return out.stdout[:200_000]


def restore(project_id: str, snapshot_id: str) -> str | None:
    """Roll the workspace back to a snapshot, keeping it in the timeline.

    This is a forward-only restore: instead of rewriting history, it writes the
    old tree as a NEW snapshot. Undo is therefore itself undoable, and no work
    is ever destroyed.
    """
    repo, _ = ensure_repo(project_id)
    # Guard: refuse an unknown/ambiguous id rather than silently doing nothing.
    _run(repo, ["cat-file", "-e", f"{snapshot_id}^{{commit}}"])

    # Save any uncommitted edits first so a restore never eats manual changes.
    snapshot(project_id, "before restore")

    _run(repo, ["restore", "--source", snapshot_id, "--staged", "--worktree", "--", "."])
    # `restore` does not remove files that only exist in the current tree.
    _run(repo, ["clean", "-fd"], check=False)

    short = snapshot_id[:8]
    _run(repo, ["add", "-A"])
    status = _run(repo, ["status", "--porcelain"])
    if not status.stdout.strip():
        return None
    _run(repo, ["commit", "--quiet", "--no-verify", "-m", f"restore checkpoint {short}"])
    return _run(repo, ["rev-parse", "HEAD"]).stdout.strip()
