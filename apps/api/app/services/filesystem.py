from __future__ import annotations

import os
import tempfile
from pathlib import Path

from app.config import get_settings
from app.schemas import FileNode


def project_dir(project_id: str) -> Path:
    root = get_settings().projects_path / project_id
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_resolve(project_id: str, relative: str) -> Path:
    base = project_dir(project_id).resolve()
    target = (base / relative).resolve()
    if not str(target).startswith(str(base)):
        raise ValueError("Path escapes project root")
    return target


def _atomic_write(path: Path, data: bytes) -> None:
    """Write via a temp file in the same directory + os.replace.

    A crash or a full disk can no longer leave a half-written source file that
    breaks the preview: either the old content or the new one is visible, never
    a truncated mix.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=".forge-tmp-")
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def write_file(project_id: str, relative: str, content: str) -> None:
    path = safe_resolve(project_id, relative)
    _atomic_write(path, content.encode("utf-8"))
    # Agent often rewrites package.json; force a deps re-check on next preview/install.
    if path.name == "package.json":
        stamp = project_dir(project_id) / "node_modules" / ".forge-deps-stamp"
        if stamp.is_file():
            stamp.unlink(missing_ok=True)


def write_bytes(project_id: str, relative: str, content: bytes) -> None:
    path = safe_resolve(project_id, relative)
    _atomic_write(path, content)


def delete_file(project_id: str, relative: str) -> None:
    path = safe_resolve(project_id, relative)
    base = project_dir(project_id).resolve()
    # Refuse to nuke the workspace root or the private history repo. The agent
    # emits <forge-delete> tags freely and a stray "." would wipe the project.
    if path == base:
        raise ValueError("Refusing to delete the project root")
    if ".git" in path.relative_to(base).parts:
        raise ValueError("Refusing to delete project history")
    if path.is_file():
        path.unlink()
    elif path.is_dir():
        for child in sorted(path.rglob("*"), reverse=True):
            if child.is_file():
                child.unlink()
            else:
                child.rmdir()
        path.rmdir()
    try:
        from app.services.firestore_live import bump_files

        bump_files(project_id, [relative])
    except Exception:
        pass


def read_file(project_id: str, relative: str) -> str:
    path = safe_resolve(project_id, relative)
    if not path.is_file():
        raise FileNotFoundError(relative)
    return path.read_text(encoding="utf-8")


def list_files(project_id: str) -> dict[str, str]:
    base = project_dir(project_id)
    files: dict[str, str] = {}
    skip = {"node_modules", ".git", "dist", ".vite"}
    # .gitignore belongs to the private history repo, not to the user project.
    hidden_files = {".gitignore"}
    for path in base.rglob("*"):
        if not path.is_file():
            continue
        if any(part in skip for part in path.parts):
            continue
        rel = path.relative_to(base).as_posix()
        if rel in hidden_files:
            continue
        try:
            files[rel] = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
    return files


def file_tree(project_id: str) -> list[FileNode]:
    base = project_dir(project_id)
    skip = {"node_modules", ".git", "dist", ".vite"}
    # .gitignore belongs to the private history repo, not to the user project.
    hidden_files = {".gitignore"}

    def walk(dir_path: Path) -> list[FileNode]:
        nodes: list[FileNode] = []
        try:
            entries = sorted(dir_path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except FileNotFoundError:
            return []
        for entry in entries:
            if entry.name in skip:
                continue
            rel = entry.relative_to(base).as_posix()
            if rel in hidden_files:
                continue
            if entry.is_dir():
                nodes.append(FileNode(path=rel, type="dir", children=walk(entry)))
            else:
                nodes.append(FileNode(path=rel, type="file"))
        return nodes

    return walk(base)
