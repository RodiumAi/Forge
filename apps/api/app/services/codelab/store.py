"""Read and write codelab.json and its steps the way the document routes do.

Every write is validated against the contract and goes through the atomic
``write_file``. An AI run or an import takes one history checkpoint before its
first write (``begin_run``), so it can be undone in one step.
"""

from __future__ import annotations

import contextlib
import json
import re
import unicodedata
from typing import Any

from app.contracts.forge_design import dump_document, validate_codelab
from app.services import history
from app.services.document_scaffold import CODELAB_PATH, DEFAULT_THEME
from app.services.filesystem import delete_file, read_file, write_file

MAX_STEP_CHARS = 200_000
_SLUG_RE = re.compile(r"[^a-z0-9]+")
_FILE_NUMBER_RE = re.compile(r"^steps/([0-9]{2,3})-")


def begin_run(project_id: str, label: str) -> None:
    """Checkpoint before an AI run or an import writes anything (best effort)."""
    with contextlib.suppress(Exception):  # history is optional
        history.snapshot(project_id, label)


def slugify(text: str, fallback: str = "etape", max_length: int = 40) -> str:
    """ASCII kebab-case for step files and ids ("Créer l'API" -> "creer-l-api")."""
    ascii_text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    slug = _SLUG_RE.sub("-", ascii_text.lower()).strip("-")[:max_length].strip("-")
    return slug or fallback


def default_codelab(title: str = "Codelab") -> dict[str, Any]:
    return {
        "version": 1,
        "title": (title or "Codelab").strip()[:200] or "Codelab",
        "summary": "",
        "level": "beginner",
        "durationMinutes": 0,
        "prerequisites": [],
        "learn": [],
        "theme": dict(DEFAULT_THEME),
        "steps": [],
        "downloads": [],
    }


def read_codelab(project_id: str) -> dict[str, Any]:
    data = json.loads(read_file(project_id, CODELAB_PATH))
    return dump_document(validate_codelab(data))


def read_codelab_or_default(project_id: str, title: str = "Codelab") -> dict[str, Any]:
    try:
        return read_codelab(project_id)
    except (FileNotFoundError, ValueError):
        return default_codelab(title)


def write_codelab(project_id: str, codelab: dict[str, Any]) -> dict[str, Any]:
    document = dump_document(validate_codelab(codelab))
    write_file(project_id, CODELAB_PATH, json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    return document


def step_file(codelab: dict[str, Any], step_id: str) -> str | None:
    for step in codelab.get("steps") or []:
        if step.get("id") == step_id:
            return step["file"]
    return None


def read_step(project_id: str, relative: str) -> str:
    try:
        return read_file(project_id, relative)
    except FileNotFoundError:
        return ""


def write_step(project_id: str, relative: str, markdown: str) -> str:
    text = (markdown or "")[:MAX_STEP_CHARS]
    if text and not text.endswith("\n"):
        text += "\n"
    write_file(project_id, relative, text)
    return text


def remove_step_file(project_id: str, relative: str) -> None:
    with contextlib.suppress(FileNotFoundError, OSError, ValueError):
        delete_file(project_id, relative)


def read_all_steps(project_id: str, codelab: dict[str, Any]) -> dict[str, str]:
    return {step["id"]: read_step(project_id, step["file"]) for step in codelab.get("steps") or []}


def step_filename(number: int, slug: str) -> str:
    """``steps/NN-slug.md`` (three digits past 99 steps)."""
    width = 2 if number < 100 else 3
    return f"steps/{number:0{width}d}-{slugify(slug)}.md"


def next_step_number(codelab: dict[str, Any]) -> int:
    highest = 0
    for step in codelab.get("steps") or []:
        match = _FILE_NUMBER_RE.match(step.get("file") or "")
        if match:
            highest = max(highest, int(match.group(1)))
    return highest + 1


def unique_step_id(wanted: str, taken: set[str]) -> str:
    base = slugify(wanted, "etape", 50)
    candidate = base
    n = 2
    while candidate in taken:
        candidate = f"{base[:58]}-{n}"
        n += 1
    return candidate


def total_minutes(codelab: dict[str, Any]) -> int:
    return min(6000, sum(int(step.get("minutes") or 0) for step in codelab.get("steps") or []))


def is_blank_codelab(project_id: str) -> bool:
    """True for a codelab nobody has written yet (the scaffold's single intro step)."""
    try:
        codelab = read_codelab(project_id)
    except (FileNotFoundError, ValueError):
        return True
    steps = codelab.get("steps") or []
    if len(steps) > 1:
        return False
    if not steps:
        return True
    body = read_step(project_id, steps[0]["file"])
    # The scaffold writes a heading, a welcome line and two empty sections.
    meaningful = [
        line
        for line in body.splitlines()
        if line.strip() and not line.lstrip().startswith("#") and not line.startswith("Welcome to")
    ]
    return not meaningful
