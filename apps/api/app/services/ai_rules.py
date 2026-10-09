"""Per-project AI_RULES.md, standing conventions injected into every LLM turn."""

from __future__ import annotations

import hashlib
import re

from app.services.filesystem import read_file, write_file

AI_RULES_PATH = "AI_RULES.md"
AI_RULES_MAX_CHARS = 8_000

DEFAULT_AI_RULES = """# AI_RULES

Standing conventions for this Forge project. Follow on every edit.

## Stack
- React 18 + TypeScript, rendered by Forge's Babel/ESM runtime (no bundler at runtime;
  the ZIP export is a Vite project)
- Plain CSS with design tokens (no Tailwind unless the user asks)
- Icons: `lucide-react` only (no emoji or glyph icons)
- Entry: `import { createRoot } from "react-dom/client"` in `src/main.tsx`
- Edit existing files with `<forge-edit>` SEARCH/REPLACE blocks; `<forge-write>` for new
  files and full rewrites

## Frontend-only
- Mock data + localStorage for cart, wishlist, preferences
- Visitor forms: validate, then `submitForm()` from `@forge/forms` with success/error states
- Never wire Resend / Firebase Admin / payment secrets / connector backends
- Deliver navigable end-to-end flows: empty states, responsive, purposeful motion that
  respects prefers-reduced-motion

## Design
- Obey `DESIGN.md` colors, fonts, spacing, imagery and brand name when present (LOCKED)
- Never rewrite `DESIGN.md` or replace `public/logo.*` unless the user explicitly asks to change the brand
- Use the logo path from DESIGN.md (e.g. `/logo.png`), do not invent a new mark
- Web fonts: the DESIGN.md `@import` is the first line of `src/index.css`
- `src/index.css` = foundation only (tokens, reset, type scale, shell, utilities), written
  once; page styles in `src/styles/<page>.css`, imported by the page
- Scope page rules under a unique root (`.search-screen .x`), all CSS loads globally
- Keep TSX classNames in sync with that page CSS + foundation (no parallel prefixes, no orphans)
- One section = TSX + CSS in the same turn (never orphan components)
- Images: only files under `public/` (listed in context) with real width/height

## Pages
- Multi-page: react-router-dom, one page per file in `src/pages/`, a `path="*"` NotFound page
- Per-page title/description with react-helmet-async

## Scroll
- Never set `overflow: hidden` on `html`/`body` in live CSS (preview.html shells are not live)
- Keep vertical scroll working; watch `100vh` + fixed headers

## Shared state contract
- One Context Provider is the source of truth for app state
- Establish the Provider API once; later edits may add keys but must not rename them
- Every key used via `useX()` must exist on the Provider `value` (add aliases if needed)
- Never leave context values undefined when consumers call `.filter` / `.map`

## Completeness
- No TODO stubs; ship working UI for every started feature
- Prefer editing existing files over creating duplicates
- App must mount without runtime throws after each task

## Security
- No private API keys or service accounts in client code
- Prefer mock handlers over inventing backends
"""

# Normalized hashes of earlier defaults. A project still carrying one of them
# verbatim never customized its rules, so it is upgraded to the current text
# (the old ones contradicted the system prompt: "Vite", append-only CSS...).
_LEGACY_DEFAULT_HASHES = frozenset(
    {
        "9915cc29a66aa9812231b8f142b62ad98b380d6432e86559759d10fc512b0884",
        "e12a6507ab121b0451232d11196674eba722b5bc68d8746cc565546288a6b737",
    }
)


def _rules_hash(text: str) -> str:
    return hashlib.sha256(re.sub(r"\s+", " ", text).strip().encode("utf-8")).hexdigest()


def load_ai_rules_md(project_id: str) -> str | None:
    try:
        raw = read_file(project_id, AI_RULES_PATH)
    except FileNotFoundError:
        return None
    text = raw.strip()
    if not text:
        return None
    if len(text) > AI_RULES_MAX_CHARS:
        return text[:AI_RULES_MAX_CHARS] + "\n\n… (AI_RULES.md truncated)\n"
    return text


def ensure_ai_rules_md(project_id: str) -> None:
    try:
        current = read_file(project_id, AI_RULES_PATH)
    except FileNotFoundError:
        write_file(project_id, AI_RULES_PATH, DEFAULT_AI_RULES)
        return
    if _rules_hash(current) in _LEGACY_DEFAULT_HASHES:
        write_file(project_id, AI_RULES_PATH, DEFAULT_AI_RULES)
