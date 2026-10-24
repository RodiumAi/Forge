"""Import Google Codelabs Markdown (claat) and export a codelab as Markdown.

claat format (https://github.com/googlecodelabs/tools/tree/main/claat):

    author: Jane Doe
    summary: Build an API
    id: build-an-api
    feedback link: https://example.com/issues
    duration: 45

    # Build an API

    ## Setup
    Duration: 0:05:00

    Text, ```console blocks, and info boxes:

    Positive
    : Good to know.

    Negative
    : Careful.

Each ``## `` heading is a step. The export writes the same shape (metadata
header, ``# Title``, ``## Step`` with a ``Duration:`` line), so a codelab
exported from Forge imports back, and the Forge extensions (``:::tip``,
tabs, tree blocks) travel as they are.
"""

from __future__ import annotations

import html
import math
import re
from dataclasses import dataclass, field
from typing import Any

from app.services.codelab.store import slugify, step_filename, unique_step_id

MAX_IMPORT_CHARS = 2_000_000
MAX_STEPS = 200

_META_RE = re.compile(r"^([A-Za-z][A-Za-z ]{0,30}):\s*(.*)$")
_DURATION_RE = re.compile(r"^\s*duration:\s*([0-9:.]+)\s*$", re.I)
_FENCE_RE = re.compile(r"^\s{0,3}(`{3,}|~{3,})(.*)$")
_ASIDE_RE = re.compile(
    r'<aside\s+class="?(positive|negative|special|warning)"?\s*>(.*?)</aside>', re.I | re.S
)
_BUTTON_RE = re.compile(r"<button[^>]*>\s*(\[[^\]]*\]\([^)]*\))\s*</button>", re.I)
_IMG_RE = re.compile(r'<img\b[^>]*?src="([^"]+)"[^>]*?(?:alt="([^"]*)")?[^>]*>', re.I)
_TAG_RE = re.compile(r"</?[A-Za-z][^>]*>")
_LEVELS = {"beginner", "intermediate", "advanced"}
_ASIDE_KINDS = {"positive": "tip", "negative": "warning", "warning": "warning", "special": "info"}


@dataclass
class ImportedStep:
    title: str
    minutes: int
    markdown: str


@dataclass
class ImportedCodelab:
    title: str
    summary: str = ""
    author: str | None = None
    duration: int | None = None
    feedback_url: str | None = None
    level: str = "beginner"
    steps: list[ImportedStep] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def parse_duration(text: str) -> int:
    """Minutes from "0:05:00", "05:00", "5" or "5.5" (rounded up, at least 1)."""
    raw = (text or "").strip()
    if not raw:
        return 0
    try:
        if ":" in raw:
            parts = [float(p or 0) for p in raw.split(":")]
            if len(parts) == 3:
                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
            elif len(parts) == 2:
                seconds = parts[0] * 60 + parts[1]
            else:
                return 0
            return max(1, math.ceil(seconds / 60)) if seconds > 0 else 0
        value = float(raw)
    except ValueError:
        return 0
    return max(1, math.ceil(value)) if value > 0 else 0


def _outside_fences(lines: list[str]):
    """Yield (index, line, in_fence) so conversions skip code."""
    fence: str | None = None
    for index, line in enumerate(lines):
        match = _FENCE_RE.match(line)
        if match and (fence is None or (match.group(1)[0] == fence[0] and len(match.group(1)) >= len(fence))):
            if fence is None:
                fence = match.group(1)
                yield index, line, True
                continue
            if not match.group(2).strip():
                fence = None
                yield index, line, True
                continue
        yield index, line, fence is not None


def _convert_body(body: str) -> str:
    """claat body to Forge extended Markdown (info boxes, consoles, HTML leftovers)."""
    text = _ASIDE_RE.sub(
        lambda m: f"\n:::{_ASIDE_KINDS[m.group(1).lower()]}\n{_TAG_RE.sub('', m.group(2)).strip()}\n:::\n",
        body,
    )
    text = _BUTTON_RE.sub(r"\1", text)
    text = _IMG_RE.sub(lambda m: f"![{m.group(2) or ''}]({m.group(1)})", text)
    lines = text.split("\n")
    out: list[str] = []
    skip_until = -1
    for index, line, in_fence in _outside_fences(lines):
        if index <= skip_until:
            continue
        if in_fence:
            match = _FENCE_RE.match(line)
            if match and match.group(2).strip().split(" ")[0].lower() == "console":
                line = line.replace("console", "terminal", 1)
            out.append(line)
            continue
        # "Positive" / "Negative" followed by ": text" lines: an info box.
        kind = {"positive": "tip", "negative": "warning"}.get(line.strip().lower())
        if kind and index + 1 < len(lines) and lines[index + 1].startswith(":"):
            content: list[str] = []
            j = index + 1
            while j < len(lines) and (lines[j].startswith(":") or (lines[j].startswith("  ") and content)):
                content.append(lines[j][1:].strip() if lines[j].startswith(":") else lines[j].strip())
                j += 1
            out += [f":::{kind}", *content, ":::"]
            skip_until = j - 1
            continue
        # Headings inside a step move up one level (the step title is the #).
        heading = re.match(r"^(#{3,6})\s+(.*)$", line)
        if heading:
            line = f"{heading.group(1)[1:]} {heading.group(2)}"
        out.append(html.unescape(_TAG_RE.sub("", line)) if "<" in line else line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()


def parse_claat(markdown: str) -> ImportedCodelab:
    """A claat (or Forge-exported) Markdown codelab, ready to be written."""
    text = (markdown or "")[:MAX_IMPORT_CHARS].replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    meta: dict[str, str] = {}
    index = 0
    while index < len(lines) and not lines[index].startswith("# "):
        match = _META_RE.match(lines[index].strip())
        if match:
            meta[match.group(1).strip().lower()] = match.group(2).strip()
        index += 1
    title = lines[index][2:].strip() if index < len(lines) else ""
    result = ImportedCodelab(title=title or meta.get("id", "").replace("-", " ").strip() or "Codelab")
    result.summary = meta.get("summary", "")[:2000]
    result.author = (meta.get("author") or meta.get("authors") or "").split(",")[0].strip()[:120] or None
    level = meta.get("level", "").lower()
    if level in _LEVELS:
        result.level = level
    duration = parse_duration(meta.get("duration", ""))
    result.duration = duration or None
    feedback = meta.get("feedback link") or meta.get("feedback")
    if feedback and feedback.startswith("https://"):
        result.feedback_url = feedback[:2000]

    # Steps: every top-level "## " outside code fences.
    starts: list[int] = []
    body_lines = lines[index + 1 :]
    for i, line, in_fence in _outside_fences(body_lines):
        if not in_fence and line.startswith("## "):
            starts.append(i)
    if not starts:
        intro = "\n".join(body_lines).strip()
        if intro:
            result.steps.append(ImportedStep(title=result.title, minutes=duration or 5, markdown=intro))
        return result
    preamble = "\n".join(body_lines[: starts[0]]).strip()
    if preamble and not result.summary:
        result.summary = preamble.split("\n\n")[0][:2000]
    for n, start in enumerate(starts[:MAX_STEPS]):
        end = starts[n + 1] if n + 1 < len(starts) else len(body_lines)
        chunk = body_lines[start + 1 : end]
        minutes = 0
        cleaned: list[str] = []
        for line in chunk:
            match = _DURATION_RE.match(line)
            if match and not minutes:
                minutes = parse_duration(match.group(1))
                continue
            cleaned.append(line)
        step_title = body_lines[start][3:].strip()[:200] or f"Étape {n + 1}"
        content = _convert_body("\n".join(cleaned))
        result.steps.append(
            ImportedStep(
                title=step_title, minutes=min(minutes, 600), markdown=f"# {step_title}\n\n{content}\n"
            )
        )
    if len(starts) > MAX_STEPS:
        result.warnings.append(f"Only the first {MAX_STEPS} steps were imported.")
    if re.search(r"!\[[^\]]*\]\((?!https?://)(?!public/)[^)]+\)", text):
        result.warnings.append("Relative images were kept as written: upload them to public/images/.")
    return result


def imported_document(
    imported: ImportedCodelab, previous: dict[str, Any] | None
) -> tuple[dict[str, Any], dict[str, str]]:
    """codelab.json and the step files (path to Markdown) for an import."""
    previous = previous or {}
    taken: set[str] = set()
    steps = []
    files: dict[str, str] = {}
    for number, step in enumerate(imported.steps, start=1):
        sid = unique_step_id(step.title, taken)
        taken.add(sid)
        path = step_filename(number, slugify(step.title))
        while path in files:
            path = step_filename(number, f"{slugify(step.title)}-{len(files)}")
        files[path] = step.markdown
        steps.append({"id": sid, "title": step.title, "file": path, "minutes": step.minutes or 5})
    minutes = sum(step["minutes"] for step in steps)
    document: dict[str, Any] = {
        "version": 1,
        "title": imported.title[:200] or "Codelab",
        "summary": imported.summary,
        "level": imported.level,
        "durationMinutes": min(6000, imported.duration or minutes),
        "prerequisites": previous.get("prerequisites") or [],
        "learn": previous.get("learn") or [],
        "steps": steps,
        "downloads": previous.get("downloads") or [],
    }
    if imported.author:
        document["author"] = {"name": imported.author}
    if previous.get("theme"):
        document["theme"] = previous["theme"]
    if previous.get("repoUrl"):
        document["repoUrl"] = previous["repoUrl"]
    return document, files


def _duration_text(minutes: int) -> str:
    return f"{minutes // 60}:{minutes % 60:02d}:00"


def _shift_headings(markdown: str) -> tuple[str, str | None]:
    """Step Markdown under its ``## `` title: drop the leading ``# `` (returned), push others one level down."""
    lines = markdown.replace("\r\n", "\n").split("\n")
    first_title: str | None = None
    out: list[str] = []
    for _index, line, in_fence in _outside_fences(lines):
        if not in_fence:
            heading = re.match(r"^(#{1,5})\s+(.*)$", line)
            if heading:
                if heading.group(1) == "#" and first_title is None and not any(o.strip() for o in out):
                    first_title = heading.group(2).strip()
                    continue
                line = f"#{heading.group(1)} {heading.group(2)}"
        out.append(line)
    return "\n".join(out).strip(), first_title


LEVEL_LABELS = {
    "fr": {"beginner": "Débutant", "intermediate": "Intermédiaire", "advanced": "Avancé"},
    "en": {"beginner": "Beginner", "intermediate": "Intermediate", "advanced": "Advanced"},
}


def export_markdown(
    codelab: dict[str, Any], steps: dict[str, str], *, feedback_url: str | None = None, locale: str = "fr"
) -> str:
    """One Markdown file, claat compatible, Forge extensions kept."""
    fr = locale != "en"
    header = [
        f"summary: {(codelab.get('summary') or '').replace(chr(10), ' ').strip()}",
        f"id: {slugify(codelab.get('title') or 'codelab', 'codelab', 60)}",
        f"duration: {codelab.get('durationMinutes') or 0}",
        f"level: {codelab.get('level') or 'beginner'}",
    ]
    author = (codelab.get("author") or {}).get("name")
    if author:
        header.insert(0, f"author: {author}")
    if feedback_url:
        header.append(f"feedback link: {feedback_url}")
    parts = ["\n".join(header), f"# {codelab.get('title') or 'Codelab'}"]
    intro: list[str] = []
    if codelab.get("prerequisites"):
        intro.append("Prérequis :" if fr else "Prerequisites:")
        intro += [f"- {item}" for item in codelab["prerequisites"]]
    if codelab.get("learn"):
        if intro:
            intro.append("")
        intro.append("Ce que vous apprendrez :" if fr else "What you will learn:")
        intro += [f"- {item}" for item in codelab["learn"]]
    if intro:
        parts.append("\n".join(intro))
    for step in codelab.get("steps") or []:
        body, heading = _shift_headings(steps.get(step["id"], ""))
        title = step.get("title") or heading or step["id"]
        parts.append(
            f"## {title}\nDuration: {_duration_text(int(step.get('minutes') or 0))}\n\n{body}".rstrip()
        )
    return "\n\n".join(parts).strip() + "\n"
