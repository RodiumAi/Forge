# Starter kits

Forkable starter kits of the Forge template gallery. Each kit is a
self-contained folder `data/templates/<id>/` with a `template.json` whose
`kind` says what it starts:

| `kind` | Kits | What it is |
|---|---|---|
| `web` | 24 | Vite + React website |
| `mobile` | 12 | Vite + React app prototype |
| `slides` | 36 | deck (`slides-*`), rendered by the Forge deck player |
| `codelab` | 8 | step-by-step tutorial (`codelab-*`), rendered by the Forge codelab player |
| `design_system` | 6 | tokens, brand files and guidelines (`design-system-*`) |

**Full contributor guide (layout per kind, rules, tests):**

- 🇬🇧 [docs/TEMPLATES.md](../../docs/TEMPLATES.md)
- 🇫🇷 [docs/TEMPLATES.fr.md](../../docs/TEMPLATES.fr.md)

## Quick structure

Every kit has `template.json` (kind, bilingual title, description and boot
hint, palette, tags, tone; optional `free`), `DESIGN.md`, `preview.html` (static
mockup, no `<script>`) and `preview.png` (the gallery card, rendered by
`apps/api/scripts/render_template_previews.py`). Then, per kind:

```
web, mobile     index.html, package.json, vite.config.ts, tsconfig*.json, README.md,
                src/ (main.tsx, App.tsx, index.css, components/ or screens/, styles/),
                public/ (mobile kits: manifest.webmanifest, icon.svg)
slides          deck.json, slides/*.json, notes/*.md, public/images/*.webp
codelab         codelab.json, steps/*.md, files/
design_system   design-system.json, public/brand/ (built by apps/api/scripts/design_system_kits/build_kits.py)
```

Slides format and rules: [docs/templates/slides-style-guide.md](../../docs/templates/slides-style-guide.md).

## Adding a kit (checklist)

1. Copy an existing kit of the same kind and rename the folder to a new `<id>`
   (regex `^[a-z0-9][a-z0-9-]{1,62}$`; slides, codelab and design system ids
   start with `slides-`, `codelab-`, `design-system-`).
2. Update `template.json` (keep the right `kind`), `DESIGN.md`, `preview.html`
   and the content files.
3. Register `<id>` in `apps/api/tests/test_templates.py` (the set of its kind,
   or the web ids in `EXPECTED_IDS`).
4. Run the tests of the kind from `apps/api`, for example
   `pytest tests/test_templates.py tests/test_template_slides.py -q`.
5. Render `preview.png` with `python scripts/render_template_previews.py <id>`
   (from `apps/api`).
6. Open a PR with **screenshots** of the gallery card and of the forked project.
