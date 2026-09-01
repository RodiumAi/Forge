"""Per-project AI_RULES.md — standing conventions injected into every LLM turn."""

from __future__ import annotations

from app.services.filesystem import read_file, write_file

AI_RULES_PATH = "AI_RULES.md"
AI_RULES_MAX_CHARS = 8_000

DEFAULT_AI_RULES = """# AI_RULES

Standing conventions for this Forge project. Follow on every edit.

## Stack
- React 18 + Vite + TypeScript
- Plain CSS via `src/index.css` and CSS variables (no Tailwind unless user asks)
- Icons: `lucide-react` only (no emoji icons)
- Entry: `import { createRoot } from "react-dom/client"` in `src/main.tsx`

## Prototype mode (frontend-only)
- Mock data + localStorage for cart, wishlist, preferences
- Forms: full UI validation + success/error states — no real third-party API calls
- Never wire Resend / Firebase Admin / payment secrets / connector backends
- Deliver navigable end-to-end flows (empty states, responsive, 2–3 micro-interactions max)

## Design
- Obey `DESIGN.md` colors/typography/spacing/brand name when present (LOCKED)
- Never rewrite `DESIGN.md` or replace `public/logo.*` unless the user explicitly asks to change the brand
- Use the logo path from DESIGN.md (e.g. `/logo.png`) — do not invent a new mark
- Default accent: #F2620A on dark background (only when no DESIGN.md)
- Keep TSX class names in sync with `src/index.css` (same naming scheme; no parallel prefixes)
- One section = TSX + CSS in the same turn (never orphan components)

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
        read_file(project_id, AI_RULES_PATH)
    except FileNotFoundError:
        write_file(project_id, AI_RULES_PATH, DEFAULT_AI_RULES)
