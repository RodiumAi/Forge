"""Five-layer prompt builder (cache-friendly, deterministic order)."""

from __future__ import annotations

import re
from pathlib import Path

from app.prompts.system import SYSTEM_PROMPT, system_prompt_with_design
from app.services.filesystem import list_files, read_file

DESIGN_PATH = "DESIGN.md"
DESIGN_MAX_CHARS = 12_000
SELECTED_FILE_MAX_CHARS = 24_000
FORCED_PATHS = ("src/index.css", "src/App.tsx", "DESIGN.md")


def _skeleton_for_file(path: str, content: str) -> str:
    lines = content.splitlines()
    n = len(lines)
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
            if len(imports) >= 3:
                break
    head = "\n".join(exports) if exports else "\n".join(lines[:3])
    imp = (", ".join(imports) if imports else "—")
    return f"{path}  ({n} lines)\n  imports: {imp}\n  {head}"


def build_file_skeletons(files: dict[str, str], max_files: int = 60) -> str:
    parts = ["Project file tree (skeletons):\n"]
    for path in sorted(files.keys())[:max_files]:
        parts.append(_skeleton_for_file(path, files[path]))
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def select_files(query: str, files: dict[str, str], k: int = 4) -> list[str]:
    tokens = [t.lower() for t in re.findall(r"[a-zA-Z0-9_./-]{2,}", query or "") if len(t) > 1]
    scores: dict[str, float] = {p: 0.0 for p in files}
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

    ranked = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    picked: list[str] = []
    for path, score in ranked:
        if score <= 0 and len(picked) >= 1:
            continue
        if path not in picked:
            picked.append(path)
        if len(picked) >= k:
            break

    for forced in FORCED_PATHS:
        if forced in files and forced not in picked:
            picked.append(forced)
    return picked[: k + len(FORCED_PATHS)]


def _selected_file_blocks(files: dict[str, str], paths: list[str]) -> str:
    parts = ["Selected files (full):\n"]
    used = 0
    for path in paths:
        content = files.get(path)
        if content is None:
            continue
        chunk = f"\n--- {path} ---\n{content}\n"
        if used + len(chunk) > SELECTED_FILE_MAX_CHARS:
            parts.append(f"\n... truncated before {path}\n")
            break
        parts.append(chunk)
        used += len(chunk)
    return "".join(parts)


def load_design_md(project_id: str) -> str | None:
    try:
        raw = read_file(project_id, DESIGN_PATH)
    except FileNotFoundError:
        return None
    text = raw.strip()
    if not text:
        return None
    if len(text) > DESIGN_MAX_CHARS:
        return text[:DESIGN_MAX_CHARS] + "\n\n… (DESIGN.md truncated)\n"
    return text


def _sanitize_turn(role: str, content: str, *, limit: int) -> str:
    text = content or ""
    if role == "assistant":
        text = re.sub(r"<forge-write[\s\S]*?</forge-write>", "[file write omitted]", text)
        text = re.sub(r"<forge-delete[^>]*\/?>", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if not text:
            text = "[assistant update applied]"
    return text[:limit]


def build_llm_messages(
    *,
    project_id: str,
    history: list[tuple[str, str]],
    user_query: str,
) -> list[dict[str, str]]:
    """
    history: list of (role, content) including the latest user message.
    Layers 1–2 stable; 3 volatile; 4 compacted; 5 = last user turn already in history.
    """
    files = list_files(project_id)
    design = load_design_md(project_id)
    has_design = bool(design)

    layer1 = system_prompt_with_design(has_design)
    layer2_parts = []
    if design:
        layer2_parts.append("DESIGN.md (graphic charter — follow strictly):\n\n" + design)
    layer2_parts.append(build_file_skeletons(files))
    layer2 = "\n\n".join(layer2_parts)

    selected = select_files(user_query, files, k=4)
    layer3 = _selected_file_blocks(files, selected)

    # Always strip forge-write bodies — recent turns used to send 100k+ chars and break the stream.
    compact: list[tuple[str, str]] = []
    for role, content in history[:-6]:
        compact.append((role, _sanitize_turn(role, content, limit=800 if role == "assistant" else 1200)))
    recent = [
        (role, _sanitize_turn(role, content, limit=1500 if role == "assistant" else 4000))
        for role, content in history[-6:]
    ]

    messages: list[dict[str, str]] = [
        {"role": "system", "content": layer1},
        {"role": "system", "content": layer2},
        {"role": "system", "content": layer3},
    ]
    if compact:
        summary_bits = []
        for role, content in compact[-8:]:
            summary_bits.append(f"{role}: {content[:400]}")
        messages.append(
            {
                "role": "system",
                "content": "Earlier conversation (compacted):\n" + "\n".join(summary_bits),
            }
        )
    for role, content in recent:
        messages.append({"role": role, "content": content})
    return messages
