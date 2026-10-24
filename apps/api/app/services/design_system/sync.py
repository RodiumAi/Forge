"""Dress a project with a design system, and propose updates when it moves on.

``plan`` lists what applying the design system would change in a project
(files and the variables whose value differs); ``apply`` writes it. Nothing is
ever applied silently: the attach route applies once on the user's request,
and a newer version is only proposed until the user confirms the resync.

* Sites and apps (React kinds): DESIGN.md is regenerated, and ``src/index.css``
  gets the new values of the variables it declares (colours through
  ``design_colors``, the others in place), the missing colour and font
  variables added to its first ``:root`` block, and the Google Fonts import
  updated.
* Decks and codelabs: DESIGN.md is regenerated (the players read their theme
  from it) and ``theme.designSystem`` points at the design system.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.contracts.forge_design import dump_document, validate_codelab, validate_deck
from app.kinds import get_kind
from app.services.design_colors import CSS_PATH, normalize_hex, replace_token_hex
from app.services.design_system.render import design_md
from app.services.design_system.tokens import css_variables, font_families, google_fonts_url
from app.services.document_scaffold import CODELAB_PATH, DECK_PATH, DESIGN_MD_PATH
from app.services.filesystem import read_file, write_file

_VAR_RE = re.compile(r"(--[A-Za-z0-9-]{1,64})\s*:\s*([^;\n]+)")
_IMPORT_RE = re.compile(r"@import\s+url\(\s*[\"']?https://fonts\.googleapis\.com/[^)\"']*[\"']?\s*\)\s*;?")
_ROOT_RE = re.compile(r":root\s*\{")


def _read(project_id: str, relative: str) -> str | None:
    try:
        return read_file(project_id, relative)
    except (FileNotFoundError, OSError, ValueError):
        return None


def _declared(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for name, value in _VAR_RE.findall(text or ""):
        out.setdefault(name, value.strip().rstrip("`").strip())
    return out


def _diff(before: dict[str, str], after: dict[str, str], names: list[str]) -> list[dict[str, str | None]]:
    rows: list[dict[str, str | None]] = []
    for name in names:
        old, new = before.get(name), after.get(name)
        if new is not None and (old or "").strip().lower() != new.strip().lower():
            rows.append({"name": name, "from": old, "to": new})
    return rows


def _engine(kind_id: str) -> str:
    kind = get_kind(kind_id)
    return kind.engine if kind is not None else "react"


def _site_css(css: str, variables: dict[str, str], document: dict[str, Any]) -> str:
    """index.css with the design system's values for the variables it declares."""
    out = css
    declared = _declared(css)
    for name, value in variables.items():
        if name not in declared:
            continue
        if normalize_hex(value) and normalize_hex(declared[name]):
            out = replace_token_hex(out, name[2:], value)
        else:
            pattern = re.compile(rf"({re.escape(name)}\s*:\s*)([^;\n]+)")
            out = pattern.sub(lambda m, v=value: m.group(1) + v, out, count=1)
    missing = [
        name
        for name in variables
        if name not in declared and (normalize_hex(variables[name]) or name.startswith("--font-"))
    ]
    match = _ROOT_RE.search(out)
    if missing and match:
        block = "".join(f"\n  {name}: {variables[name]};" for name in missing)
        out = out[: match.end()] + block + out[match.end() :]
    url = google_fonts_url(font_families(document))
    if url:
        line = f'@import url("{url}");'
        out = _IMPORT_RE.sub(line, out, count=1) if _IMPORT_RE.search(out) else line + "\n" + out
    return out


def plan(project_id: str, kind_id: str, document: dict[str, Any], source_id: str) -> list[dict[str, Any]]:
    """What ``apply`` would write, file by file, with the variables that change."""
    variables = css_variables(document)
    names = list(variables)
    changes: list[dict[str, Any]] = []
    new_md = design_md(document)
    current_md = _read(project_id, DESIGN_MD_PATH)
    if current_md != new_md:
        changes.append(
            {
                "path": DESIGN_MD_PATH,
                "action": "write",
                "tokens": _diff(_declared(current_md or ""), variables, names),
            }
        )
    if _engine(kind_id) == "react":
        css = _read(project_id, CSS_PATH)
        if css is not None:
            new_css = _site_css(css, variables, document)
            if new_css != css:
                changes.append(
                    {
                        "path": CSS_PATH,
                        "action": "write",
                        "tokens": _diff(_declared(css), _declared(new_css), names),
                    }
                )
    else:
        for relative in (DECK_PATH, CODELAB_PATH):
            raw = _read(project_id, relative)
            if raw is None:
                continue
            try:
                theme = (json.loads(raw) or {}).get("theme") or {}
            except ValueError:
                continue
            if isinstance(theme, dict) and theme.get("designSystem") != source_id:
                changes.append({"path": relative, "action": "write", "tokens": []})
    return changes


def apply(project_id: str, kind_id: str, document: dict[str, Any], source_id: str) -> list[str]:
    """Write the design system into the project; returns the paths written."""
    written: list[str] = []
    new_md = design_md(document)
    if _read(project_id, DESIGN_MD_PATH) != new_md:
        write_file(project_id, DESIGN_MD_PATH, new_md)
        written.append(DESIGN_MD_PATH)
    if _engine(kind_id) == "react":
        css = _read(project_id, CSS_PATH)
        if css is not None:
            new_css = _site_css(css, css_variables(document), document)
            if new_css != css:
                write_file(project_id, CSS_PATH, new_css)
                written.append(CSS_PATH)
        return written
    for relative, validate in ((DECK_PATH, validate_deck), (CODELAB_PATH, validate_codelab)):
        raw = _read(project_id, relative)
        if raw is None:
            continue
        try:
            data = json.loads(raw)
        except ValueError:
            continue
        theme = data.get("theme") if isinstance(data, dict) else None
        if not isinstance(theme, dict) or theme.get("designSystem") == source_id:
            continue
        theme["designSystem"] = source_id
        write_file(
            project_id,
            relative,
            json.dumps(dump_document(validate(data)), ensure_ascii=False, indent=2) + "\n",
        )
        written.append(relative)
    return written
