from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings

_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")
_LOGO_RE = re.compile(r"^[A-Za-z0-9._-]{1,80}\.(?:svg|png|jpe?g|webp|gif|ico)$")
# Catalog is drop-in static embeds only (paste iframe / script / link).
_ACCESS_OK = frozenset({"yes"})
_EMBED_METHODS = frozenset({"iframe", "script", "link"})


@dataclass(frozen=True)
class IntegrationMeta:
    id: str
    name: str
    categories: tuple[str, ...]
    access: str
    methods: tuple[str, ...]
    docs_url: str
    badge: str | None
    enabled_hint: bool
    logo: str
    title_en: str
    title_fr: str
    blurb_en: str
    blurb_fr: str
    path: Path


def integrations_root() -> Path:
    settings = get_settings()
    root = Path(settings.integrations_root)
    if root.is_absolute():
        return root.resolve()
    resolved = root.resolve()
    if resolved.is_dir():
        return resolved
    repo_root = Path(__file__).resolve().parents[4]
    return (repo_root / root).resolve()


def _safe_under(root: Path, *parts: str) -> Path | None:
    """Join ``parts`` under ``root`` and reject any path escape."""
    base = root.resolve()
    candidate = base.joinpath(*parts).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        return None
    return candidate


_cache: list[IntegrationMeta] | None = None
_cache_mtime: float | None = None


def _localized(raw: object, key: str = "en") -> str:
    if isinstance(raw, dict):
        return str(raw.get(key) or raw.get("en") or next(iter(raw.values()), "") or "")
    return str(raw or "")


def _load_meta(folder: Path) -> IntegrationMeta | None:
    meta_path = folder / "integration.json"
    if not meta_path.is_file():
        return None
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    tid = str(data.get("id") or folder.name).strip()
    if not _ID_RE.match(tid) or tid != folder.name:
        return None
    access = str(data.get("access") or "").strip().lower()
    if access not in _ACCESS_OK:
        return None
    categories = data.get("categories") or []
    if not isinstance(categories, list) or not categories:
        return None
    methods = data.get("methods") or []
    if not isinstance(methods, list):
        methods = []
    method_set = {str(m).strip() for m in methods if str(m).strip()}
    if not method_set.intersection(_EMBED_METHODS):
        return None
    logo = str(data.get("logo") or "logo.svg").strip() or "logo.svg"
    if not _LOGO_RE.match(logo):
        return None
    logo_file = _safe_under(folder, logo)
    if logo_file is None or not logo_file.is_file():
        return None
    guide_en = _safe_under(folder, "guide.en.md")
    guide_fr = _safe_under(folder, "guide.fr.md")
    if guide_en is None or not guide_en.is_file() or guide_fr is None or not guide_fr.is_file():
        return None
    i18n = data.get("i18n") if isinstance(data.get("i18n"), dict) else {}
    en = i18n.get("en") if isinstance(i18n.get("en"), dict) else {}
    fr = i18n.get("fr") if isinstance(i18n.get("fr"), dict) else {}
    badge_raw = data.get("badge")
    badge = str(badge_raw).strip() if badge_raw else None
    return IntegrationMeta(
        id=tid,
        name=str(data.get("name") or tid).strip() or tid,
        categories=tuple(str(c).strip() for c in categories if str(c).strip()),
        access=access,
        methods=tuple(str(m).strip() for m in methods if str(m).strip()),
        docs_url=str(data.get("docsUrl") or "").strip(),
        badge=badge,
        enabled_hint=bool(data.get("enabledHint")),
        logo=logo,
        title_en=str(en.get("title") or data.get("name") or tid),
        title_fr=str(fr.get("title") or data.get("name") or tid),
        blurb_en=_localized(en.get("blurb"), "en")
        if isinstance(en.get("blurb"), dict)
        else str(en.get("blurb") or ""),
        blurb_fr=_localized(fr.get("blurb"), "fr")
        if isinstance(fr.get("blurb"), dict)
        else str(fr.get("blurb") or ""),
        path=folder,
    )


def list_integrations(
    *,
    category: str | None = None,
    q: str | None = None,
    access: str | None = None,
) -> list[IntegrationMeta]:
    global _cache, _cache_mtime
    root = integrations_root()
    if not root.is_dir():
        return []
    try:
        mtime = root.stat().st_mtime
    except OSError:
        mtime = None
    if _cache is not None and mtime is not None and mtime == _cache_mtime:
        rows = _cache
    else:
        out: list[IntegrationMeta] = []
        try:
            children = sorted(root.iterdir())
        except OSError:
            return []
        for child in children:
            if not child.is_dir() or child.name.startswith("_"):
                continue
            if not _ID_RE.match(child.name):
                continue
            safe = _safe_under(root, child.name)
            if safe is None or not safe.is_dir():
                continue
            meta = _load_meta(safe)
            if meta is not None:
                out.append(meta)
        _cache = out
        _cache_mtime = mtime
        rows = out

    filtered = rows
    if category:
        cat = category.strip().lower()
        filtered = [m for m in filtered if cat in {c.lower() for c in m.categories}]
    if access:
        acc = access.strip().lower()
        filtered = [m for m in filtered if m.access == acc]
    if q:
        needle = q.strip().lower()
        if needle:
            filtered = [
                m
                for m in filtered
                if needle in m.id
                or needle in m.name.lower()
                or needle in m.title_en.lower()
                or needle in m.title_fr.lower()
                or needle in m.blurb_en.lower()
                or needle in m.blurb_fr.lower()
                or any(needle in c.lower() for c in m.categories)
            ]
    return list(filtered)


def get_integration(integration_id: str) -> IntegrationMeta | None:
    tid = (integration_id or "").strip()
    if not _ID_RE.match(tid):
        return None
    folder = _safe_under(integrations_root(), tid)
    if folder is None or not folder.is_dir():
        return None
    return _load_meta(folder)


def guide_path(integration_id: str, locale: str) -> Path | None:
    meta = get_integration(integration_id)
    if meta is None:
        return None
    lang = "fr" if locale == "fr" else "en"
    path = _safe_under(meta.path, f"guide.{lang}.md")
    if path is not None and path.is_file():
        return path
    fallback = _safe_under(meta.path, "guide.en.md")
    return fallback if fallback is not None and fallback.is_file() else None


def logo_path(integration_id: str) -> Path | None:
    meta = get_integration(integration_id)
    if meta is None or not _LOGO_RE.match(meta.logo):
        return None
    path = _safe_under(meta.path, meta.logo)
    if path is None or not path.is_file():
        return None
    return path


def clear_integrations_cache() -> None:
    global _cache, _cache_mtime
    _cache = None
    _cache_mtime = None
