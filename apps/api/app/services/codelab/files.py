"""Downloadable files of a codelab (``files/``) and the ZIPs built from them.

Uploads follow the project upload limits (8 MB per file, like images) plus a
codelab budget (file count and total size). Sources, data and archives are
welcome; native executables and installers are refused, by extension and by
their magic bytes, so a codelab never ships a binary that runs on download.
Forge never executes these files.
"""

from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from app.errors import SitesError
from app.services.filesystem import delete_file, project_dir, safe_resolve, write_bytes

FILES_ROOT = "files"
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_TOTAL_BYTES = 50 * 1024 * 1024
MAX_FILES = 500
MAX_PATH_LENGTH = 300
#: A declared download packed at publish time must stay a reasonable download.
MAX_ZIP_BYTES = 60 * 1024 * 1024

BLOCKED_EXTENSIONS = frozenset(
    {
        ".exe",
        ".dll",
        ".msi",
        ".msp",
        ".msix",
        ".appx",
        ".scr",
        ".com",
        ".pif",
        ".cpl",
        ".sys",
        ".drv",
        ".ocx",
        ".lnk",
        ".hta",
        ".jse",
        ".vbe",
        ".vbs",
        ".wsf",
        ".wsh",
        ".reg",
        ".dmg",
        ".pkg",
        ".app",
        ".apk",
        ".aab",
        ".ipa",
        ".deb",
        ".rpm",
        ".so",
        ".dylib",
        ".elf",
        ".bin",
        ".iso",
        ".img",
    }
)

_PART_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,120}$")


@dataclass(frozen=True)
class CodelabFile:
    path: str
    size: int


def _is_executable(body: bytes) -> bool:
    head = body[:4]
    if head[:2] == b"MZ":  # Windows PE
        return True
    if head == b"\x7fELF":  # Linux / Unix ELF
        return True
    # Mach-O (32/64 bit, both byte orders) and universal binaries.
    return head in (
        b"\xfe\xed\xfa\xce",
        b"\xfe\xed\xfa\xcf",
        b"\xce\xfa\xed\xfe",
        b"\xcf\xfa\xed\xfe",
        b"\xca\xfe\xba\xbe",
    )


def normalize_path(raw: str) -> str:
    """``files/<parts>`` from a path given by the client; refuses anything odd.

    Each part is a plain name (letters, digits, ``_ . -``, no leading dot), so
    no traversal, no hidden files, no spaces that break download URLs.
    """
    text = (raw or "").replace("\\", "/").strip().strip("/")
    if text.startswith(FILES_ROOT + "/"):
        text = text[len(FILES_ROOT) + 1 :]
    parts = [part for part in text.split("/") if part]
    if not parts or len(parts) > 12:
        raise SitesError(400, "INVALID_FILE_PATH", "Invalid file path.")
    for part in parts:
        if part in (".", "..") or not _PART_RE.match(part):
            raise SitesError(400, "INVALID_FILE_PATH", f"Invalid file name: {part[:60]}")
    path = "/".join([FILES_ROOT, *parts])
    if len(path) > MAX_PATH_LENGTH:
        raise SitesError(400, "INVALID_FILE_PATH", "File path too long.")
    return path


def check_upload(path: str, body: bytes) -> None:
    suffix = PurePosixPath(path).suffix.lower()
    if suffix in BLOCKED_EXTENSIONS or _is_executable(body):
        raise SitesError(
            400, "FILE_TYPE_BLOCKED", "Executables and installers cannot be shared in a codelab."
        )
    if len(body) > MAX_FILE_BYTES:
        raise SitesError(400, "FILE_TOO_LARGE", "File too large (max 8 MB).")


def list_files(project_id: str) -> list[CodelabFile]:
    root = project_dir(project_id) / FILES_ROOT
    if not root.is_dir():
        return []
    base = project_dir(project_id)
    out: list[CodelabFile] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        rel = path.relative_to(base).as_posix()
        if any(part.startswith(".") for part in rel.split("/")):
            continue
        out.append(CodelabFile(path=rel, size=path.stat().st_size))
    return out


def save_file(project_id: str, raw_path: str, body: bytes) -> CodelabFile:
    path = normalize_path(raw_path)
    check_upload(path, body)
    existing = {item.path: item.size for item in list_files(project_id)}
    if path not in existing and len(existing) >= MAX_FILES:
        raise SitesError(400, "TOO_MANY_FILES", f"A codelab holds at most {MAX_FILES} files.")
    total = sum(size for p, size in existing.items() if p != path) + len(body)
    if total > MAX_TOTAL_BYTES:
        raise SitesError(400, "FILES_QUOTA", "The codelab files exceed 50 MB.")
    target = safe_resolve(project_id, path)
    if target.is_dir():
        raise SitesError(409, "PATH_IS_FOLDER", "A folder already has this name.")
    write_bytes(project_id, path, body)
    return CodelabFile(path=path, size=len(body))


def save_text_file(project_id: str, raw_path: str, text: str) -> CodelabFile:
    """A starter or solution file written by the AI (same checks as an upload)."""
    return save_file(project_id, raw_path, text.encode("utf-8"))


def remove_file(project_id: str, raw_path: str) -> str:
    path = normalize_path(raw_path)
    target = safe_resolve(project_id, path)
    if not target.exists():
        raise SitesError(404, "FILE_NOT_FOUND", "This file does not exist.")
    delete_file(project_id, path)
    # Drop now-empty folders up to files/.
    root = project_dir(project_id) / FILES_ROOT
    parent = target.parent
    while parent != root and parent.is_dir() and not any(parent.iterdir()):
        parent.rmdir()
        parent = parent.parent
    return path


def file_path_on_disk(project_id: str, raw_path: str) -> Path:
    path = normalize_path(raw_path)
    target = safe_resolve(project_id, path)
    if not target.is_file():
        raise SitesError(404, "FILE_NOT_FOUND", "This file does not exist.")
    return target


def zip_folder(project_id: str, relative: str) -> bytes:
    """ZIP of a file or folder under files/ (paths inside are relative to it)."""
    path = normalize_path(relative)
    target = safe_resolve(project_id, path)
    if not target.exists():
        raise SitesError(404, "FILE_NOT_FOUND", f"{path} does not exist.")
    buffer = io.BytesIO()
    total = 0
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        members = [target] if target.is_file() else sorted(p for p in target.rglob("*") if p.is_file())
        for member in members:
            if member.is_symlink():
                continue
            rel = member.name if target.is_file() else member.relative_to(target).as_posix()
            if any(part.startswith(".") for part in rel.split("/")):
                continue
            total += member.stat().st_size
            if total > MAX_ZIP_BYTES:
                raise SitesError(400, "ZIP_TOO_LARGE", f"{path} is too large to pack.")
            archive.write(member, arcname=rel)
    return buffer.getvalue()


def zip_all_files(project_id: str, prefix: str = "") -> bytes:
    """Every file of files/ in one ZIP (the "sources" export)."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in list_files(project_id):
            inner = item.path[len(FILES_ROOT) + 1 :]
            archive.write(safe_resolve(project_id, item.path), arcname=f"{prefix}{inner}")
    return buffer.getvalue()
