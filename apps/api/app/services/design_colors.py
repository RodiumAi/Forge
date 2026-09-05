"""Rewrite brand color tokens in DESIGN.md and src/index.css together."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.filesystem import read_file, write_file
from app.services.orchestration.context import DESIGN_PATH

CSS_PATH = "src/index.css"
HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
TOKEN_RE = re.compile(r"^[a-z][a-z0-9-]*$")
COLOR_FIND_RE = re.compile(r"--([a-z][a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{3,8})\b")


@dataclass
class PaletteEntry:
    name: str
    hex: str


def normalize_hex(raw: str) -> str | None:
    h = (raw or "").strip().lower()
    if not HEX_RE.match(h):
        return None
    body = h[1:]
    if len(body) == 3:
        body = "".join(ch * 2 for ch in body)
    elif len(body) == 8:
        body = body[:6]
    return f"#{body[:6]}"


def _token_aliases(name: str) -> list[str]:
    names = [name]
    if name.startswith("color-"):
        short = name[len("color-") :]
        if short:
            names.append(short)
    else:
        names.append(f"color-{name}")
    return [n for n in names if TOKEN_RE.match(n)]


def replace_token_hex(source: str, name: str, hex_value: str) -> str:
    normalized = normalize_hex(hex_value)
    if not normalized or not TOKEN_RE.match(name) or not source:
        return source
    next_text = source
    for token in _token_aliases(name):
        pattern = re.compile(rf"(--{re.escape(token)}\s*:\s*)(#[0-9a-fA-F]{{3,8}})\b", re.I)
        next_text = pattern.sub(rf"\g<1>{normalized}", next_text)
    return next_text


def parse_palette(text: str | None, *, limit: int = 16) -> list[PaletteEntry]:
    if not text:
        return []
    seen: set[str] = set()
    out: list[PaletteEntry] = []
    for match in COLOR_FIND_RE.finditer(text):
        name = match.group(1).lower()
        hex_value = normalize_hex(match.group(2))
        if not hex_value or name in seen:
            continue
        seen.add(name)
        out.append(PaletteEntry(name=name, hex=hex_value))
        if len(out) >= limit:
            break
    return out


def merge_palettes(md: list[PaletteEntry], css: list[PaletteEntry], *, limit: int = 16) -> list[PaletteEntry]:
    by_name: dict[str, str] = {e.name: e.hex for e in md}
    for e in css:
        by_name.setdefault(e.name, e.hex)
    for name in list(by_name):
        if name.startswith("color-"):
            short = name[len("color-") :]
            if short and short in by_name:
                del by_name[name]
    out = [PaletteEntry(name=n, hex=h) for n, h in by_name.items()]
    return out[:limit]


@dataclass
class ColorUpdateResult:
    markdown: str
    css_updated: bool
    palette: list[PaletteEntry]


def apply_brand_color(project_id: str, name: str, hex_value: str) -> ColorUpdateResult:
    """Patch DESIGN.md and src/index.css for one CSS variable name."""
    name = (name or "").strip().lower()
    normalized = normalize_hex(hex_value)
    if not TOKEN_RE.match(name):
        raise ValueError("invalid_token")
    if not normalized:
        raise ValueError("invalid_hex")

    try:
        markdown = read_file(project_id, DESIGN_PATH)
    except FileNotFoundError as exc:
        raise FileNotFoundError("design_missing") from exc

    css_text = ""
    try:
        css_text = read_file(project_id, CSS_PATH)
    except FileNotFoundError:
        css_text = ""

    aliases = _token_aliases(name)

    def _has_token(text: str) -> bool:
        lower = text.lower()
        return any(f"--{alias}" in lower for alias in aliases)

    if not _has_token(markdown) and not _has_token(css_text):
        raise LookupError("token_not_found")

    next_md = replace_token_hex(markdown, name, normalized)
    if next_md != markdown:
        write_file(project_id, DESIGN_PATH, next_md if next_md.endswith("\n") else next_md + "\n")
    else:
        next_md = markdown

    css_updated = False
    if css_text:
        next_css = replace_token_hex(css_text, name, normalized)
        if next_css != css_text:
            write_file(project_id, CSS_PATH, next_css)
            css_updated = True
            css_text = next_css

    palette = merge_palettes(parse_palette(next_md), parse_palette(css_text))
    return ColorUpdateResult(markdown=next_md, css_updated=css_updated, palette=palette)
