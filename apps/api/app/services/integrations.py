from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings

_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")
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
    if ".." in logo.replace("\\", "/").split("/"):
        return None
    if not (folder / logo).is_file():
        return None
    if not (folder / "guide.en.md").is_file() or not (folder / "guide.fr.md").is_file():
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
            meta = _load_meta(child)
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
    folder = integrations_root() / tid
    if not folder.is_dir():
        return None
    return _load_meta(folder)


def guide_path(integration_id: str, locale: str) -> Path | None:
    meta = get_integration(integration_id)
    if meta is None:
        return None
    lang = "fr" if locale == "fr" else "en"
    path = meta.path / f"guide.{lang}.md"
    if path.is_file():
        return path
    fallback = meta.path / "guide.en.md"
    return fallback if fallback.is_file() else None


def logo_path(integration_id: str) -> Path | None:
    meta = get_integration(integration_id)
    if meta is None:
        return None
    path = (meta.path / meta.logo).resolve()
    if not str(path).startswith(str(meta.path.resolve())) or not path.is_file():
        return None
    return path


def format_integrations_prompt_block(locale: str = "en") -> str:
    """Compact embed catalog for the agent prompt (one line per provider)."""
    rows = list_integrations()
    if not rows:
        return ""
    by_category: dict[str, list[str]] = {}
    for meta in rows:
        methods = "/".join(m for m in meta.methods if m in _EMBED_METHODS)
        by_category.setdefault(meta.categories[0], []).append(f"{meta.name} ({methods})")
    lines = ["Integrations catalog (drop-in embeds, no backend needed):"]
    for category in sorted(by_category):
        lines.append(f"- {category}: " + ", ".join(sorted(by_category[category])))
    if locale == "fr":
        lines.append(
            'Embeds : iframe en JSX (title, width 100%, loading="lazy", hauteur fixée par le '
            "conteneur) ; widget script dans un composant qui ajoute le <script> une seule fois "
            "dans un useEffect (vérifier qu'il n'existe pas déjà). N'invente jamais d'identifiant "
            "de compte : sans l'URL ou l'id fourni par l'utilisateur, affiche une carte de "
            "remplacement explicite et demande-le en une phrase."
        )
    else:
        lines.append(
            'Embeds: iframes as JSX (title, width 100%, loading="lazy", height set by the '
            "container); script widgets in a component that appends the <script> once in a "
            "useEffect (skip when it already exists). Never invent account ids: without the "
            "URL or id from the user, render an explicit placeholder card and ask for it in one "
            "sentence."
        )
    return "\n".join(lines)


_FENCE_RE = re.compile(r"```[a-zA-Z]*\n(.*?)```", re.S)
_URL_HOST_RE = re.compile(r"https?://([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})")
# Placeholder domains the guides use in their examples: no use for matching.
_PLACEHOLDER_DOMAINS = frozenset({"example.com", "example.org", "yourdomain.com", "your-domain.com"})
# Two-label public suffixes, so "foo.co.uk" keeps "foo.co.uk" instead of "co.uk".
_TWO_LABEL_SUFFIXES = frozenset({"co.uk", "com.au", "co.jp", "com.br"})
_hosts_cache: dict[str, tuple[str, ...]] = {}


def _registrable(host: str) -> str:
    labels = host.lower().strip(".").split(".")
    if len(labels) >= 3 and ".".join(labels[-2:]) in _TWO_LABEL_SUFFIXES:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def embed_hosts(meta: IntegrationMeta) -> tuple[str, ...]:
    """Domains the embed snippet of this integration points at, read from the
    code blocks of its guide ("google.com", "tally.so"). The composer uses them
    to tell whether the user pasted the snippet; empty when the guide only has
    placeholder URLs, and the client then falls back to any iframe/script/URL."""
    cached = _hosts_cache.get(meta.id)
    if cached is not None:
        return cached
    try:
        guide = (meta.path / "guide.en.md").read_text(encoding="utf-8")
    except OSError:
        guide = ""
    out: list[str] = []
    for block in _FENCE_RE.findall(guide):
        for host in _URL_HOST_RE.findall(block):
            domain = _registrable(host)
            if domain in _PLACEHOLDER_DOMAINS or "your" in domain or domain in out:
                continue
            out.append(domain)
    _hosts_cache[meta.id] = tuple(out)
    return _hosts_cache[meta.id]


# Line the composer puts at the top of a message when the user picked
# integrations from the + menu: "[Integrations: Google Maps Embed (google-maps)]".
INTEGRATIONS_MARKER_RE = re.compile(r"\[(?:Integrations|Intégrations)\s*:\s*([^\]]*)\]", re.I)
_MARKER_ID_RE = re.compile(r"\(([a-z0-9][a-z0-9-]{1,62})\)")
_GUIDE_LIMIT = 6000


def parse_integrations_marker(text: str) -> list[str]:
    """Catalog ids named in the integrations marker of a message, in order."""
    match = INTEGRATIONS_MARKER_RE.search(text or "")
    if not match:
        return []
    out: list[str] = []
    for tid in _MARKER_ID_RE.findall(match.group(1)):
        if tid not in out:
            out.append(tid)
    return out[:5]


def format_selected_integrations_block(text: str, locale: str = "en") -> str:
    """Guides of the integrations the user picked for this message, plus the
    rule that ties them to the snippet the user pasted (or asks for it)."""
    metas = [m for m in (get_integration(tid) for tid in parse_integrations_marker(text)) if m]
    if not metas:
        return ""
    names = ", ".join(m.name for m in metas)
    if locale == "fr":
        head = (
            f"L'utilisateur a choisi d'ajouter ces intégrations à ce message : {names}. "
            "Pour chacune, suis son guide ci-dessous. Utilise tel quel le snippet, l'URL "
            "ou l'identifiant qu'il a collé dans son message (src, id de formulaire, clé "
            "publique) : ne le réécris pas et n'invente jamais un identifiant. Convertis "
            "l'iframe en JSX (attributs en camelCase, style en objet, width 100 %, hauteur "
            "fixée par le conteneur) et place-la là où il le demande, sinon dans la section "
            "la plus logique. Un widget script se charge une seule fois dans un useEffect. "
            "S'il manque le snippet ou l'identifiant d'une intégration, place un emplacement "
            "clairement étiqueté à son nom et demande-le en une phrase dans ta réponse."
        )
    else:
        head = (
            f"The user picked these integrations for this message: {names}. For each one, "
            "follow its guide below. Use the snippet, URL or id the user pasted in the "
            "message as is (src, form id, public key): never rewrite it and never invent an "
            "id. Convert an iframe to JSX (camelCase attributes, style as an object, width "
            "100%, height set by its container) and place it where the user asks, otherwise "
            "in the most fitting section. A script widget loads once in a useEffect. When "
            "the snippet or id of an integration is missing, add a clearly labeled "
            "placeholder named after it and ask for it in one sentence in your answer."
        )
    parts = [head]
    for meta in metas:
        path = guide_path(meta.id, locale)
        guide = path.read_text(encoding="utf-8") if path else ""
        if len(guide) > _GUIDE_LIMIT:
            guide = guide[:_GUIDE_LIMIT] + "\n[...]"
        docs = f"\nDocs: {meta.docs_url}" if meta.docs_url else ""
        parts.append(
            f'<integration id="{meta.id}" name="{meta.name}">{docs}\n{guide.strip()}\n</integration>'
        )
    return "\n\n".join(parts)


def clear_integrations_cache() -> None:
    global _cache, _cache_mtime
    _cache = None
    _cache_mtime = None
    _hosts_cache.clear()
