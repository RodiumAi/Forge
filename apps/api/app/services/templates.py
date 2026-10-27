from __future__ import annotations

import json
import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings
from app.kinds import get_kind, resolve_kind
from app.services.typography import TEXT_EXTS, strip_long_dashes

_SKIP_NAMES = {"node_modules", ".git", "dist", ".vite", "__pycache__"}
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")

#: Layouts every slides kit provides, one example slide each (docs/templates/slides-style-guide.md).
SLIDES_LAYOUTS: tuple[str, ...] = (
    "title",
    "section",
    "text",
    "two-columns",
    "image-text",
    "quote",
    "key-numbers",
    "chart",
    "table",
    "team",
    "timeline",
    "thanks",
)


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
    kind: str = "web"
    tone: str = ""
    fg: str | None = None
    muted: str | None = None
    #: Usable on the Free plan; every other kit starts at Starter.
    free: bool = False

    @property
    def required_plan(self) -> str | None:
        """The lowest Forge plan that may start a project from this kit, None for Free."""
        if self.kind == "design_system":
            return "builder"
        return None if self.free else "starter"


def _parse_kind(raw: object) -> str:
    return resolve_kind(str(raw or "web"))


def templates_root() -> Path:
    settings = get_settings()
    # Avoid mkdir on list/preview — Docker mounts are often read-only.
    root = Path(settings.templates_root)
    if root.is_absolute():
        return root.resolve()
    resolved = root.resolve()
    if resolved.is_dir():
        return resolved
    # Relative path against the repo root (uvicorn/pytest run from apps/api,
    # Docker from /; the default "data/templates" lives at the repo root).
    repo_root = Path(__file__).resolve().parents[4]
    return (repo_root / root).resolve()


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
    kind = _parse_kind(data.get("kind"))
    if not _has_kit_files(folder, kind):
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
        kind=kind,
        tone=str(data.get("tone") or "").strip(),
        fg=str(data["fg"]) if data.get("fg") else None,
        muted=str(data["muted"]) if data.get("muted") else None,
        free=data.get("free") is True,
    )


def _has_kit_files(folder: Path, kind: str) -> bool:
    """Minimal files a kit of ``kind`` needs to be forkable."""
    if kind == "slides":
        # A document kit: the deck plus its slide bodies, rendered by the Forge player.
        return (folder / "deck.json").is_file() and (folder / "slides").is_dir()
    if kind == "codelab":
        # A document kit: codelab.json plus its Markdown steps, rendered by the codelab player.
        return (folder / "codelab.json").is_file() and (folder / "steps").is_dir()
    if kind == "design_system":
        return (folder / "design-system.json").is_file()
    return (folder / "package.json").is_file() and (folder / "src" / "App.tsx").is_file()


def list_templates(*, kind: str | None = None) -> list[TemplateMeta]:
    global _templates_cache, _templates_cache_mtime
    root = templates_root()
    if not root.is_dir():
        return []
    try:
        mtime = root.stat().st_mtime
    except OSError:
        mtime = None
    if _templates_cache is not None and mtime is not None and mtime == _templates_cache_mtime:
        rows = _templates_cache
    else:
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
        rows = out
    if get_kind(kind) is not None:
        return [m for m in rows if m.kind == kind]
    return rows


def get_template(template_id: str) -> TemplateMeta | None:
    tid = (template_id or "").strip()
    if not _ID_RE.match(tid):
        return None
    root = os.path.realpath(templates_root())
    folder = os.path.realpath(os.path.join(root, tid))
    # The id is already a plain slug; this keeps the folder inside the templates root anyway.
    if not folder.startswith(root + os.sep) or not os.path.isdir(folder):
        return None
    return _load_meta(Path(folder))


def preview_path(template_id: str) -> Path | None:
    meta = get_template(template_id)
    if meta is None:
        return None
    path = meta.path / "preview.html"
    return path if path.is_file() else None


def preview_image_path(template_id: str) -> Path | None:
    """The gallery card as a still image (``preview.png``, rendered from
    ``preview.html`` by ``scripts/render_template_previews.py``): an <img>
    costs nothing to show, where an iframe per card had to lay out a page."""
    meta = get_template(template_id)
    if meta is None:
        return None
    path = meta.path / "preview.png"
    return path if path.is_file() else None


#: Upper bound on the deck documents a gallery card reads (DESIGN.md included).
_DECK_PREVIEW_MAX_SLIDES = 40
_DECK_PREVIEW_MAX_DESIGN = 200_000


def template_deck(template_id: str) -> dict | None:
    """The deck of a slides kit as the gallery cards play it.

    ``{"deck", "slides": [...], "design"}``: deck.json, the slide bodies in deck
    order (a missing body becomes an empty slide), and the DESIGN.md text the
    player derives its theme tokens from. Image paths stay as written
    (``public/...``); the client maps them onto ``/templates/{id}/media/``.
    None when the template is unknown or not a slides kit.
    """
    meta = get_template(template_id)
    if meta is None or meta.kind != "slides":
        return None
    try:
        deck = json.loads((meta.path / "deck.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(deck, dict):
        return None
    slides: list[dict] = []
    for ref in (deck.get("slides") or [])[:_DECK_PREVIEW_MAX_SLIDES]:
        sid = str((ref or {}).get("id") or "") if isinstance(ref, dict) else ""
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", sid):
            continue
        body: dict = {"id": sid, "elements": []}
        path = meta.path / "slides" / f"{sid}.json"
        if path.is_file():
            try:
                loaded = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    body = {**loaded, "id": sid}
            except (OSError, json.JSONDecodeError):
                pass
        slides.append(body)
    design = ""
    design_path = meta.path / "DESIGN.md"
    if design_path.is_file():
        design = design_path.read_text(encoding="utf-8", errors="replace")[:_DECK_PREVIEW_MAX_DESIGN]
    return {"deck": deck, "slides": slides, "design": design}


#: Upper bounds on what the public detail view of a kit reads.
_DETAIL_MAX_STEP_CHARS = 60_000
_DETAIL_MAX_FILES = 60
_JSX_TAG_RE = re.compile(r"<([A-Z][A-Za-z0-9]*)\b[^>]*/>")
_SCREEN_RE = re.compile(r"^([A-Z][A-Za-z0-9]*)Screen\.tsx$")


def _read_json(path: Path) -> dict | None:
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return loaded if isinstance(loaded, dict) else None


def _site_sections(folder: Path) -> list[str]:
    """Top-level blocks of a site kit, in page order, read from src/App.tsx."""
    app = folder / "src" / "App.tsx"
    if not app.is_file():
        return []
    try:
        text = app.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    start, end = text.find("<main"), text.find("</main>")
    body = text[start:end] if start >= 0 and end > start else text
    out: list[str] = []
    for name in _JSX_TAG_RE.findall(body):
        if name.endswith("Background") or name in out:
            continue
        out.append(name)
    return out[:24]


def _app_screens(folder: Path) -> list[str]:
    """Screens of a mobile kit (src/screens/*Screen.tsx), onboarding first."""
    screens_dir = folder / "src" / "screens"
    if not screens_dir.is_dir():
        return []
    names = sorted(m.group(1) for p in screens_dir.iterdir() if (m := _SCREEN_RE.match(p.name)))
    names.sort(key=lambda n: (n != "Onboarding", n != "Home"))
    return names[:12]


def _codelab_detail(folder: Path) -> dict | None:
    codelab = _read_json(folder / "codelab.json")
    if codelab is None:
        return None
    steps: dict[str, str] = {}
    for step in codelab.get("steps") or []:
        if not isinstance(step, dict):
            continue
        sid, rel = str(step.get("id") or ""), str(step.get("file") or "")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", sid) or ".." in rel.replace("\\", "/").split("/"):
            continue
        path = (folder / rel).resolve()
        if not str(path).startswith(str(folder.resolve())) or not path.is_file():
            continue
        steps[sid] = path.read_text(encoding="utf-8", errors="replace")[:_DETAIL_MAX_STEP_CHARS]
    files: list[str] = []
    files_root = folder / "files"
    if files_root.is_dir():
        for path in sorted(files_root.rglob("*")):
            if path.is_file() and not (_SKIP_NAMES & set(path.parts)):
                files.append(path.relative_to(files_root).as_posix())
            if len(files) >= _DETAIL_MAX_FILES:
                break
    return {"codelab": codelab, "steps": steps, "files": files}


def template_detail(template_id: str) -> dict | None:
    """What the public template page shows beyond the catalogue row.

    Always ``{"id", "kind", "fg", "muted", "tone", "fonts"}``, plus per kind:
    ``sections`` (site blocks in page order), ``screens`` (app screens),
    ``codelab`` + ``steps`` + ``files`` (codelab document, step Markdown by id,
    files under files/), ``design_system`` (design-system.json). Slides use
    ``/deck``. None for an unknown template.
    """
    meta = get_template(template_id)
    if meta is None:
        return None
    raw = _read_json(meta.path / "template.json") or {}
    fonts = raw.get("fonts") if isinstance(raw.get("fonts"), dict) else {}
    out: dict = {
        "id": meta.id,
        "kind": meta.kind,
        "fg": meta.fg,
        "muted": meta.muted,
        "tone": meta.tone,
        "fonts": {k: str(v) for k, v in fonts.items() if isinstance(v, str)},
    }
    if meta.kind == "web":
        out["sections"] = _site_sections(meta.path)
    elif meta.kind == "mobile":
        out["screens"] = _app_screens(meta.path)
    elif meta.kind == "codelab":
        out.update(_codelab_detail(meta.path) or {})
    elif meta.kind == "design_system":
        doc = _read_json(meta.path / "design-system.json")
        if doc is not None:
            out["design_system"] = doc
    return out


def fork_template(template_id: str, project_id: str, app_name: str | None = None) -> TemplateMeta:
    meta = get_template(template_id)
    if meta is None:
        raise FileNotFoundError(f"Unknown template: {template_id}")

    dest = get_settings().projects_path / project_id
    if dest.exists() and any(dest.iterdir()):
        raise FileExistsError(f"Project directory already exists: {project_id}")

    def ignore(directory: str, names: list[str]) -> set[str]:
        skip = {n for n in names if n in _SKIP_NAMES}
        # The gallery image is the kit's card, not part of the user's app.
        if Path(directory) == meta.path and "preview.png" in names:
            skip.add("preview.png")
        return skip

    shutil.copytree(meta.path, dest, ignore=ignore)

    # Drop authoring metadata from the user project copy, but remember which kit
    # it came from (and its tone) for the agent, outside the published files.
    tpl = dest / "template.json"
    if tpl.is_file():
        tpl.unlink()
    origin = dest / ".forge" / "template.json"
    origin.parent.mkdir(parents=True, exist_ok=True)
    origin.write_text(
        json.dumps(
            {"id": meta.id, "kind": meta.kind, "tone": meta.tone, "boot_hint": meta.boot_hint_en},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    # House typography: the user's copy of a template carries no long dashes
    # (the template sources are left untouched).
    for file in dest.rglob("*"):
        if not file.is_file() or not file.name.lower().endswith(TEXT_EXTS):
            continue
        try:
            text = file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        cleaned = strip_long_dashes(text)
        if cleaned != text:
            file.write_text(cleaned, encoding="utf-8")

    if meta.kind == "slides":
        _finish_slides_fork(dest, app_name)
        _snapshot(project_id, meta.id)
        return meta
    if meta.kind == "codelab":
        _finish_codelab_fork(dest, app_name)
        _snapshot(project_id, meta.id)
        return meta

    if meta.kind == "design_system":
        _finish_design_system_fork(dest, app_name)
        _snapshot(project_id, meta.id)
        return meta

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

    # Default Forge favicon when the template has none.
    from app.services.scaffold import ensure_favicon_link, install_default_favicon

    install_default_favicon(project_id)
    html_path = dest / "index.html"
    if html_path.is_file():
        try:
            text = html_path.read_text(encoding="utf-8")
            updated = ensure_favicon_link(text)
            if updated != text:
                html_path.write_text(updated, encoding="utf-8")
        except OSError:
            pass

    _snapshot(project_id, meta.id)
    return meta


def _snapshot(project_id: str, template_id: str) -> None:
    # Baseline checkpoint: the user can always roll back to the pristine fork.
    try:
        from app.services import history

        history.snapshot(project_id, f"forked template: {template_id}")
    except Exception:  # pragma: no cover - history is best effort
        pass


def _is_generic_project_name(name: str) -> bool:
    from app.i18n import MESSAGES

    generic = {
        messages["new_project"].casefold() for messages in MESSAGES.values() if "new_project" in messages
    }
    return name.strip().casefold() in generic


def _finish_slides_fork(dest: Path, app_name: str | None) -> None:
    """Validate the copied deck against the contract and title it after the project.

    A blank or generic project name ("New project", "Nouveau projet") keeps the
    kit's own deck title.

    A slides kit has no package.json, index.html or favicon: the deck is data
    rendered by the Forge player. Every document is checked so a broken kit
    fails the fork instead of opening an editor on an invalid deck.
    """
    from app.contracts.forge_design import dump_document, validate_deck, validate_slide

    deck_path = dest / "deck.json"
    deck = validate_deck(json.loads(deck_path.read_text(encoding="utf-8")))
    for ref in deck.slides:
        slide_path = dest / "slides" / f"{ref.id}.json"
        validate_slide(json.loads(slide_path.read_text(encoding="utf-8")))
        notes = dest / "notes" / f"{ref.id}.md"
        if not notes.is_file():
            notes.parent.mkdir(parents=True, exist_ok=True)
            notes.write_text("", encoding="utf-8")
    name = (app_name or "").strip()
    # A blank or generic project name ("New project") keeps the kit's own deck
    # title: it reads better than a placeholder on the cover and in exports.
    if name and not _is_generic_project_name(name):
        deck.title = name[:200]
    deck_path.write_text(
        json.dumps(dump_document(deck), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _finish_codelab_fork(dest: Path, app_name: str | None) -> None:
    """Validate the copied codelab against the contract and title it after the project.

    A codelab kit is data (codelab.json, steps/*.md, files/) rendered by the
    Forge codelab player: every step listed must exist, so a broken kit fails
    the fork instead of opening an editor on a codelab with missing steps.
    """
    from app.contracts.forge_design import dump_document, validate_codelab

    codelab_path = dest / "codelab.json"
    codelab = validate_codelab(json.loads(codelab_path.read_text(encoding="utf-8")))
    for step in codelab.steps:
        if not (dest / step.file).is_file():
            raise FileNotFoundError(f"Codelab kit step missing: {step.file}")
    name = (app_name or "").strip()
    if name:
        codelab.title = name[:200]
    codelab_path.write_text(
        json.dumps(dump_document(codelab), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _finish_design_system_fork(dest: Path, app_name: str | None) -> None:
    """Validate the copied design system, name it after the project, regenerate DESIGN.md.

    A kit whose logo is the generated wordmark gets a wordmark with the new
    name; an uploaded logo is kept as it is. The kit's preview is authoring
    material and is not part of the project.
    """
    from app.contracts.forge_design import dump_document, validate_design_system
    from app.services.design_system.logo import wordmark_svg
    from app.services.design_system.render import design_md
    from app.services.design_system.tokens import LOGO_PATH, colors_of, font_families

    path = dest / "design-system.json"
    document = dump_document(validate_design_system(json.loads(path.read_text(encoding="utf-8"))))
    name = (app_name or "").strip()
    if name:
        document["name"] = name[:120]
    if (document.get("logo") or {}).get("src") == LOGO_PATH:
        colors = colors_of(document)
        families = font_families(document)
        logo = dest / LOGO_PATH
        logo.parent.mkdir(parents=True, exist_ok=True)
        logo.write_text(
            wordmark_svg(
                document["name"],
                colors.get("accent", "#f2620a"),
                colors.get("fg", "#111111"),
                families[0] if families else "Inter",
            ),
            encoding="utf-8",
        )
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (dest / "DESIGN.md").write_text(design_md(document), encoding="utf-8")
    preview = dest / "preview.html"
    if preview.is_file():
        preview.unlink()
