from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings

_SKIP_NAMES = {"node_modules", ".git", "dist", ".vite", "__pycache__"}
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")


@dataclass(frozen=True)
class TemplateMeta:
    id: str
    title_en: str
    title_fr: str
    description_en: str
    description_fr: str
    tags: tuple[str, ...]
    boot_hint_en: str
    boot_hint_fr: str
    accent: str | None
    bg: str | None
    preview: str | None
    path: Path


def templates_root() -> Path:
    settings = get_settings()
    # Avoid mkdir on list/preview — Docker mounts are often read-only.
    return Path(settings.templates_root).resolve()


_templates_cache: list[TemplateMeta] | None = None
_templates_cache_mtime: float | None = None


def _localized(raw: object, key: str = "en") -> str:
    if isinstance(raw, dict):
        return str(raw.get(key) or raw.get("en") or next(iter(raw.values()), "") or "")
    return str(raw or "")


def _load_meta(folder: Path) -> TemplateMeta | None:
    meta_path = folder / "template.json"
    if not meta_path.is_file():
        return None
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    tid = str(data.get("id") or folder.name).strip()
    if not _ID_RE.match(tid):
        return None
    if not (folder / "package.json").is_file() or not (folder / "src" / "App.tsx").is_file():
        return None
    tags = data.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    return TemplateMeta(
        id=tid,
        title_en=_localized(data.get("title"), "en") or tid,
        title_fr=_localized(data.get("title"), "fr") or tid,
        description_en=_localized(data.get("description"), "en"),
        description_fr=_localized(data.get("description"), "fr"),
        tags=tuple(str(t) for t in tags if str(t).strip()),
        boot_hint_en=_localized(data.get("bootHint"), "en"),
        boot_hint_fr=_localized(data.get("bootHint"), "fr"),
        accent=str(data["accent"]) if data.get("accent") else None,
        bg=str(data["bg"]) if data.get("bg") else None,
        preview=str(data["preview"]) if data.get("preview") else None,
        path=folder,
    )


def list_templates() -> list[TemplateMeta]:
    global _templates_cache, _templates_cache_mtime
    root = templates_root()
    if not root.is_dir():
        return []
    try:
        mtime = root.stat().st_mtime
    except OSError:
        mtime = None
    if _templates_cache is not None and mtime is not None and mtime == _templates_cache_mtime:
        return _templates_cache

    out: list[TemplateMeta] = []
    try:
        children = sorted(root.iterdir())
    except OSError:
        return []
    for child in children:
        if not child.is_dir() or child.name.startswith("_"):
            continue
        meta = _load_meta(child)
        if meta is not None:
            out.append(meta)
    _templates_cache = out
    _templates_cache_mtime = mtime
    return out


def get_template(template_id: str) -> TemplateMeta | None:
    tid = (template_id or "").strip()
    if not _ID_RE.match(tid):
        return None
    folder = templates_root() / tid
    if not folder.is_dir():
        return None
    return _load_meta(folder)


def preview_path(template_id: str) -> Path | None:
    meta = get_template(template_id)
    if meta is None:
        return None
    path = meta.path / "preview.html"
    return path if path.is_file() else None


def fork_template(template_id: str, project_id: str, app_name: str | None = None) -> TemplateMeta:
    meta = get_template(template_id)
    if meta is None:
        raise FileNotFoundError(f"Unknown template: {template_id}")

    dest = get_settings().projects_path / project_id
    if dest.exists() and any(dest.iterdir()):
        raise FileExistsError(f"Project directory already exists: {project_id}")

    def ignore(directory: str, names: list[str]) -> set[str]:
        return {n for n in names if n in _SKIP_NAMES}

    shutil.copytree(meta.path, dest, ignore=ignore)

    # Drop authoring metadata from the user project copy.
    tpl = dest / "template.json"
    if tpl.is_file():
        tpl.unlink()

    if app_name:
        pkg = dest / "package.json"
        if pkg.is_file():
            try:
                data = json.loads(pkg.read_text(encoding="utf-8"))
                data["name"] = app_name.lower().replace(" ", "-")[:40] or meta.id
                pkg.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
            except (OSError, json.JSONDecodeError):
                pass
        html = dest / "index.html"
        if html.is_file():
            try:
                text = html.read_text(encoding="utf-8")
                text = re.sub(r"<title>.*?</title>", f"<title>{app_name}</title>", text, count=1)
                html.write_text(text, encoding="utf-8")
            except OSError:
                pass

    return meta
