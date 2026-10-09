"""Five-layer prompt builder (cache-friendly, deterministic order)."""

from __future__ import annotations

import re
from typing import Any

from app.prompts.system import THEME_QUALITY_HINT, system_prompt_with_design
from app.services.ai_rules import ensure_ai_rules_md, load_ai_rules_md
from app.services.attachments import (
    carried_reference_markers,
    enrich_user_message_with_vision,
    with_carried_references,
)
from app.services.filesystem import list_files, project_dir, read_file
from app.services.project_media import format_project_media_layer
from app.services.prototype_mode import format_prototype_plugins_layer
from app.services.template_examples import format_template_example_layer

DESIGN_MAX_CHARS = 12_000
RECENT_DISK_PATHS = 3
# DESIGN.md and AI_RULES.md are not here: they travel in layer 2, once.
FORCED_PATHS = ("src/index.css", "src/App.tsx")
_LAYER2_PATHS = frozenset({"DESIGN.md", "AI_RULES.md"})
SCAFFOLD_EXTRA_K = 8
# A plan task may name a directory ("src/components"): its files are expanded,
# smallest first, up to this many.
FOCUS_DIR_MAX_FILES = 12
SURGICAL_EDIT_HINT = (
    "Surgical edit mode: make the smallest correct change. For an existing file use "
    "forge-edit SEARCH/REPLACE blocks copied exactly from its current content; "
    "rewrite a whole file only when most of it changes. Preserve unrelated imports, "
    "JSX, and CSS. src/index.css is the shared foundation: never rewrite it, touch it "
    "only with a small forge-edit; page styles belong in the page's own "
    "src/styles/<page>.css."
)


def _budgets() -> tuple[int, int]:
    from app.config import get_settings

    settings = get_settings()
    total = max(20_000, int(settings.context_full_files_max_chars))
    css = max(8_000, min(int(settings.context_css_reserved_chars), total // 2))
    return total, css


_SELECTION_RE = re.compile(
    r"\[(?:Selection|Sélection):\s*[^|\]]*\|[^|\]]*\|?\s*text:\"([^\"]*)\"",
    re.I,
)
_LOGO_RE = re.compile(r"\b(logo|favicon|navbar|header|brand)\b", re.I)
_SMALL_QUERY_RE = re.compile(
    r"\b(change|modifie|modifier|remplace|mets|update|fix|texte|titre|title|hero|"
    r"couleur|color|bouton|button|label)\b",
    re.I,
)
_SCAFFOLD_QUERY_RE = re.compile(
    r"\b(scaffold|build|crée|creer|create|génère|genere|generate|site|landing|"
    r"ecommerce|e-commerce|boutique|shop|portfolio|saas|restaurant|resto|"
    r"page|section|home|accueil|collection|pricing|menu)\b",
    re.I,
)


def _is_small_edit_query(query: str) -> bool:
    text = query or ""
    if len(text) > 220:
        return False
    return bool(_SMALL_QUERY_RE.search(text))


def select_files(query: str, files: dict[str, str], k: int = 4) -> list[str]:
    tokens = [t.lower() for t in re.findall(r"[a-zA-Z0-9_./-]{2,}", query or "") if len(t) > 1]
    scores: dict[str, float] = {p: 0.0 for p in files}
    selection_text = ""
    m = _SELECTION_RE.search(query or "")
    if m:
        selection_text = (m.group(1) or "").strip().lower()

    scaffoldish = bool(_SCAFFOLD_QUERY_RE.search(query or ""))
    effective_k = SCAFFOLD_EXTRA_K if scaffoldish and k < SCAFFOLD_EXTRA_K else k

    for path, content in files.items():
        pl = path.lower()
        cl = content.lower()
        for tok in tokens:
            if tok in pl:
                scores[path] += 3.0
            if tok in cl:
                scores[path] += 1.0 + min(cl.count(tok), 5) * 0.2
        if path.endswith((".tsx", ".ts", ".css")):
            scores[path] += 0.3
        if selection_text and selection_text in cl:
            scores[path] += 8.0
        for tok in (
            "hero",
            "footer",
            "navbar",
            "header",
            "contact",
            "skills",
            "projects",
            "logo",
            "collection",
            "product",
            "cart",
            "pricing",
            "menu",
        ):
            if tok in tokens and tok in pl:
                scores[path] += 4.0
        if scaffoldish and ("/components/" in pl or pl.endswith(("app.tsx", "index.css"))):
            scores[path] += 1.5

    if _LOGO_RE.search(query or ""):
        for path in files:
            pl = path.lower()
            if "navbar" in pl or "header" in pl or pl.endswith("app.tsx"):
                scores[path] += 6.0

    ranked = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    small = _is_small_edit_query(query)
    limit = 2 if small else effective_k
    picked: list[str] = []
    for path, score in ranked:
        if score <= 0 and len(picked) >= 1:
            continue
        if path not in picked:
            picked.append(path)
        if len(picked) >= limit:
            break

    if small:
        for forced in FORCED_PATHS:
            if forced in files and forced not in picked and scores.get(forced, 0) > 0:
                picked.append(forced)
        return picked[: limit + 1]

    for forced in FORCED_PATHS:
        if forced in files and forced not in picked:
            picked.append(forced)
    # Always keep index.css when scaffolding / building sections
    if "src/index.css" in files and "src/index.css" not in picked:
        picked.append("src/index.css")
    # Put index.css first so the full CSS budget is reserved before other files.
    if "src/index.css" in picked:
        picked = ["src/index.css"] + [p for p in picked if p != "src/index.css"]
    return picked[: effective_k + len(FORCED_PATHS)]


_RECENT_SOURCE_EXTS = (".tsx", ".ts", ".jsx", ".js", ".css", ".html")


def recent_disk_paths(project_id: str, files: dict[str, str], limit: int = RECENT_DISK_PATHS) -> list[str]:
    """Source files most recently modified on disk, newest first.

    Visual edits (text/image tools) write straight to disk without a chat
    message: keyword selection can miss those files entirely, and the model —
    told to emit complete file contents — then regenerates them from stale
    conversation memory, silently reverting the user's manual changes. Forcing
    the freshest files into the full-content layer closes that hole.
    """
    root = project_dir(project_id)
    scored: list[tuple[float, str]] = []
    for path in files:
        if not path.endswith(_RECENT_SOURCE_EXTS):
            continue
        try:
            scored.append((-(root / path).stat().st_mtime, path))
        except OSError:
            continue
    scored.sort()
    return [path for _, path in scored[:limit]]


def merge_context_paths(
    selected: list[str],
    focus_paths: list[str] | None,
    recent_paths: list[str],
    files: dict[str, str],
) -> list[str]:
    """Final full-content layer order: task focus, then selection, then recency.

    A focus entry naming a directory ("src/components") expands to the files
    under it, which used to be dropped silently.
    """
    ordered: list[str] = []

    def add(path: str) -> None:
        if path in files and path not in ordered:
            ordered.append(path)

    for path in focus_paths or []:
        clean = (path or "").strip().strip("/")
        if clean in files:
            add(clean)
            continue
        prefix = clean + "/"
        under = sorted((p for p in files if p.startswith(prefix)), key=lambda p: (len(files[p]), p))
        for child in under[:FOCUS_DIR_MAX_FILES]:
            add(child)
    for path in [*selected, *recent_paths]:
        add(path)
    return ordered


_CSS_SELECTOR_CLASS_RE = re.compile(r"\.([A-Za-z_][\w-]*)")
_TSX_CLASSNAME_RE = re.compile(r"""className\s*=\s*(?:"([^"]+)"|'([^']+)'|\{`([^`]+)`\})""")


def _css_skeleton_classes(content: str, limit: int = 40) -> list[str]:
    seen: list[str] = []
    for prelude in re.findall(r"([^{}]+)\{", re.sub(r"/\*.*?\*/", "", content, flags=re.S)):
        for name in _CSS_SELECTOR_CLASS_RE.findall(prelude):
            if name not in seen:
                seen.append(name)
                if len(seen) >= limit:
                    return seen
    return seen


def _skeleton_for_file(path: str, content: str) -> str:
    lines = content.splitlines()
    n = len(lines)
    if path.endswith((".css", ".scss")):
        # Class names are what other files need from a stylesheet: without them
        # the model cannot reuse a foundation utility it was not shown in full.
        classes = _css_skeleton_classes(content)
        listed = " ".join("." + c for c in classes) if classes else "—"
        return f"{path}  ({n} lines)\n  classes: {listed}"
    exports = []
    for line in lines[:80]:
        if re.search(r"^\s*(export\s+(default\s+)?|function\s+|const\s+\w+\s*=)", line):
            exports.append(line.strip()[:120])
            if len(exports) >= 4:
                break
    imports = []
    for line in lines[:40]:
        if line.strip().startswith("import "):
            imports.append(line.strip()[:100])
            if len(imports) >= 4:
                break
    head = "\n".join(exports) if exports else "\n".join(lines[:3])
    imp = ", ".join(imports) if imports else "—"
    out = f"{path}  ({n} lines)\n  imports: {imp}\n  {head}"
    if path.endswith((".tsx", ".jsx")):
        used: list[str] = []
        for match in _TSX_CLASSNAME_RE.finditer(content):
            for token in re.split(r"\s+", (match.group(1) or match.group(2) or match.group(3) or "").strip()):
                token = re.sub(r"\$\{[^}]*\}", "", token)
                if token and re.match(r"^[A-Za-z_][\w-]*$", token) and token not in used:
                    used.append(token)
        if used:
            out += "\n  classNames: " + " ".join(used[:30])
    return out


def build_file_skeletons(files: dict[str, str], max_files: int = 120) -> str:
    parts = ["Project file tree (skeletons):\n"]
    for path in sorted(files.keys())[:max_files]:
        parts.append(_skeleton_for_file(path, files[path]))
        parts.append("")
    if len(files) > max_files:
        parts.append(f"... {len(files) - max_files} more files not listed")
    return "\n".join(parts).rstrip() + "\n"


DESIGN_PATH = "DESIGN.md"


def _selected_file_blocks(files: dict[str, str], paths: list[str]) -> str:
    """Emit full selected files. Always reserve budget for src/index.css first."""
    parts = [
        "Selected files (full, CURRENT on-disk state — the user may have edited "
        "these outside the chat; they OVERRIDE any version of the same files "
        "appearing earlier in this conversation):\n"
    ]
    total_budget, css_budget = _budgets()
    used = 0
    ordered = [p for p in paths if p not in _LAYER2_PATHS]
    if "src/index.css" in files:
        ordered = ["src/index.css"] + [p for p in ordered if p != "src/index.css"]

    # Phase 1: always include as much of index.css as the reserved budget allows.
    css = files.get("src/index.css")
    if css is not None:
        css_chunk = css
        if len(css_chunk) > css_budget:
            half = css_budget // 2
            css_chunk = (
                css_chunk[:half]
                + "\n/* index.css PARTIAL VIEW (middle omitted): never rewrite this file in full, "
                "use forge-edit */\n" + css_chunk[-half:]
            )
        block = f"\n--- src/index.css ---\n{css_chunk}\n"
        parts.append(block)
        used += len(block)

    # Phase 2: remaining files with leftover budget. A file that does not fit is
    # skipped (and named) rather than ending the layer, so the smaller files
    # after it still get in.
    omitted: list[str] = []
    for path in ordered:
        if path == "src/index.css":
            continue
        content = files.get(path)
        if content is None:
            continue
        chunk = f"\n--- {path} ---\n{content}\n"
        if used + len(chunk) > total_budget:
            omitted.append(path)
            continue
        parts.append(chunk)
        used += len(chunk)
    if omitted:
        parts.append(
            "\nNot shown in full (context budget), do not rewrite them with forge-write: "
            + ", ".join(omitted[:20])
            + "\n"
        )
    return "".join(parts)


def load_design_md(project_id: str) -> str | None:
    """The project's locked charter, or None.

    The placeholder charter a blank scaffold ships with is not a brand: treating
    it as LOCKED pinned every new site to Forge's own dark/orange identity.
    """
    from app.services.brand_charter import is_default_charter

    try:
        raw = read_file(project_id, DESIGN_PATH)
    except FileNotFoundError:
        return None
    text = raw.strip()
    if not text or is_default_charter(text):
        return None
    if len(text) > DESIGN_MAX_CHARS:
        return text[:DESIGN_MAX_CHARS] + "\n\n… (DESIGN.md truncated)\n"
    return text


def _omit_blocks(text: str, tag: str, placeholder: str) -> str:
    """Replace each `<tag ...>...</tag>` span with `placeholder`.

    A plain scan rather than a lazy regex: a reply with many opening tags and
    no closing one would otherwise be rescanned from every opening.
    """
    opening, closing = f"<{tag}", f"</{tag}>"
    parts: list[str] = []
    pos = 0
    while True:
        start = text.find(opening, pos)
        if start < 0:
            break
        end = text.find(closing, start + len(opening))
        if end < 0:
            break
        parts.append(text[pos:start])
        parts.append(placeholder)
        pos = end + len(closing)
    parts.append(text[pos:])
    return "".join(parts)


def _sanitize_turn(role: str, content: str, *, limit: int) -> str:
    text = content or ""
    if role == "assistant":
        text = _omit_blocks(text, "forge-write", "[file write omitted]")
        text = _omit_blocks(text, "forge-edit", "[file edit omitted]")
        text = re.sub(r"<forge-delete[^>]*\/?>", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if not text:
            text = "[assistant update applied]"
    return text[:limit]


_GATEWAY_CONTENT_MAX = 480_000

FINAL_USER_TURN_MAX = 60_000
_ATTACHMENT_MARKER_RE = re.compile(
    r"\[(?:Image attached|Image jointe|Reference screenshot|Capture de référence|Files|Fichiers)\s*:[^\]]*\]"
)


def _final_user_turn(content: str, limit: int = FINAL_USER_TURN_MAX) -> str:
    """Truncate the final user turn without losing attachment markers.

    Inlined documents can push the image markers past any cap; a marker that
    does not reach the LLM means the vision parts are never built and the
    model answers as if nothing was attached.
    """
    text = content or ""
    if len(text) <= limit:
        return text
    truncated = text[:limit] + "\n\n[…attachment text truncated…]"
    lost = [m for m in _ATTACHMENT_MARKER_RE.findall(text) if m not in truncated]
    if lost:
        truncated += "\n" + "\n".join(lost)
    return truncated


def _gateway_safe_content(text: str, *, fallback: str) -> str:
    """Nest playground rejects empty or oversized message content."""
    out = (text or "").strip() or fallback
    if len(out) > _GATEWAY_CONTENT_MAX:
        out = out[: _GATEWAY_CONTENT_MAX - 96] + "\n\n[…truncated for gateway message size limit…]"
    return out


async def build_llm_messages(
    *,
    project_id: str,
    history: list[tuple[str, str]],
    user_query: str,
    db=None,
    user_id=None,
    locale: str = "en",
    auth=None,
    model: str | None = None,
    surgical_edit: bool = False,
    focus_paths: list[str] | None = None,
    carry_references: bool = True,
) -> list[dict[str, Any]]:
    """
    history: list of (role, content) including the latest user message.
    Layers 1–2 stable; 3 volatile; 4 compacted; 5 = last user turn already in history.

    ``carry_references``: re-attach the most recent reference screenshot to the
    final turn when that turn has none, so a follow-up about the same design is
    answered WITH the image (callers on a text-only lite model pass False).
    """
    carried = carried_reference_markers(history) if carry_references else []
    ensure_ai_rules_md(project_id)
    files = list_files(project_id)
    design = load_design_md(project_id)
    has_design = bool(design)

    platform = "web"
    if db is not None:
        try:
            from uuid import UUID

            from app.models import Project

            row = db.get(Project, UUID(str(project_id)))
            if row is not None and getattr(row, "platform", None) in ("web", "mobile"):
                platform = row.platform
        except Exception:
            platform = "web"

    layer1 = system_prompt_with_design(has_design, platform=platform)
    layer2_parts = []
    ai_rules = load_ai_rules_md(project_id)
    if ai_rules:
        layer2_parts.append("AI_RULES.md (project conventions, follow strictly):\n\n" + ai_rules)
    if design:
        layer2_parts.append(
            "DESIGN.md (LOCKED graphic charter, follow strictly; "
            "do NOT rewrite this file or invent a new brand/logo/palette):\n\n" + design
        )
    layer2_parts.append(THEME_QUALITY_HINT)
    media = format_project_media_layer(project_id)
    if media:
        layer2_parts.append(media)
    example = format_template_example_layer(project_id, files, user_query, platform=platform)
    if example:
        layer2_parts.append(example)
    layer2_parts.append(build_file_skeletons(files))
    layer2 = "\n\n".join(layer2_parts)

    selected = select_files(user_query, files, k=4)
    ordered = merge_context_paths(selected, focus_paths, recent_disk_paths(project_id, files), files)
    layer3 = _selected_file_blocks(files, ordered)

    # Prototype mode: UI plugins only — frontend-only platform, no backend wiring.
    prototype_layer = format_prototype_plugins_layer(locale=locale)

    # Always strip forge-write bodies — recent turns used to send 100k+ chars and break the stream.
    early = history[:-6]
    tail = history[-6:]
    recent: list[tuple[str, str]] = []
    for idx, (role, content) in enumerate(tail):
        is_final_user = role == "user" and idx == len(tail) - 1
        if is_final_user:
            # The final user turn carries inlined .md/.txt attachments and the
            # image markers. The old 4000-char cap silently amputated long
            # documents — and when the markers sat past the cut, the vision
            # images vanished with them. The 480k gateway guard still applies.
            recent.append((role, _final_user_turn(content)))
        else:
            recent.append((role, _sanitize_turn(role, content, limit=1500 if role == "assistant" else 4000)))

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": _gateway_safe_content(layer1, fallback="Forge system instructions."),
        },
        {
            "role": "system",
            "content": _gateway_safe_content(prototype_layer, fallback="Prototype mode: frontend UI only."),
        },
        {
            "role": "system",
            "content": _gateway_safe_content(layer2, fallback="Project conventions and file skeletons."),
        },
        {
            "role": "system",
            "content": _gateway_safe_content(layer3, fallback="No focused source files for this turn."),
        },
    ]
    if surgical_edit:
        messages.append({"role": "system", "content": SURGICAL_EDIT_HINT})

    compacted_summary: str | None = None
    if len(early) >= 4 and auth is not None and model:
        try:
            from app.services.orchestration.compaction import compact_conversation

            sanitized_early = [
                (role, _sanitize_turn(role, content, limit=800 if role == "assistant" else 1200))
                for role, content in early
            ]
            compacted_summary = await compact_conversation(
                turns=sanitized_early,
                auth=auth,
                model=model,
                locale=locale,  # type: ignore[arg-type]
            )
        except Exception:
            compacted_summary = None

    if compacted_summary:
        messages.append(
            {
                "role": "system",
                "content": _gateway_safe_content(
                    "Earlier conversation (structured summary):\n" + compacted_summary[:12_000],
                    fallback="Earlier conversation summary unavailable.",
                ),
            }
        )
    elif early:
        summary_bits = []
        for role, content in early[-8:]:
            bit = _sanitize_turn(role, content, limit=800 if role == "assistant" else 1200)
            summary_bits.append(f"{role}: {bit[:400]}")
        messages.append(
            {
                "role": "system",
                "content": _gateway_safe_content(
                    "Earlier conversation (compacted):\n" + "\n".join(summary_bits),
                    fallback="Earlier conversation compacted.",
                ),
            }
        )
    for idx, (role, content) in enumerate(recent):
        if role == "user" and idx == len(recent) - 1:
            if carried:
                content = with_carried_references(content, carried, locale)
            enriched = await enrich_user_message_with_vision(db, project_id, content)
            if isinstance(enriched, str):
                enriched = _gateway_safe_content(enriched, fallback=user_query or "Continue.")
            messages.append({"role": role, "content": enriched})
        else:
            safe = _gateway_safe_content(
                content,
                fallback="[assistant update applied]" if role == "assistant" else "Continue.",
            )
            messages.append({"role": role, "content": safe})
    return messages
