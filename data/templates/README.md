# Template kits

Forkable Vite + React starters used by the Forge template gallery. Each kit is a self-contained folder under `data/templates/<id>/`.

**Full contributor guide (structure, rules, validation):**

- 🇬🇧 [docs/TEMPLATES.md](../../docs/TEMPLATES.md)
- 🇫🇷 [docs/TEMPLATES.fr.md](../../docs/TEMPLATES.fr.md)

## Quick structure

```
data/templates/<id>/
├── template.json      # catalog metadata (kind web|mobile, i18n, palette, tags, bootHint)
├── DESIGN.md          # design charter the AI must follow when forking
├── preview.html       # static gallery thumbnail (~480×300, no <script>)
├── index.html
├── package.json       # "name" must equal <id>
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── README.md
└── src/
    ├── main.tsx
    ├── App.tsx        # routes (react-router-dom); imports: react, react-router-dom, lucide-react, local files
    └── index.css      # foundation CSS; only @import: the Google Fonts line, first
```

## Slides kits

Presentation kits (`kind: "slides"`, folders `slides-<name>/`) are documents, not Vite apps: `template.json`, `DESIGN.md`, `deck.json`, `slides/*.json`, `notes/*.md`, `public/images/*.webp`, `preview.html`. See [docs/templates/slides-style-guide.md](../../docs/templates/slides-style-guide.md); register ids in `EXPECTED_SLIDES_IDS` and run `pytest tests/test_templates.py tests/test_template_slides.py -q`.

## Adding a kit (checklist)

1. Copy an existing kit folder and rename to a new `<id>` (regex: `^[a-z0-9][a-z0-9-]{1,62}$`).
2. Update `template.json` (include `"kind": "web"` or `"mobile"`), `DESIGN.md`, `preview.html`, and `src/App.tsx`.
3. Register `<id>` in `EXPECTED_IDS` inside `apps/api/tests/test_templates.py`.
4. Run `cd apps/api && pytest tests/test_templates.py -q`.
5. Open a PR with **screenshots** of the gallery card and a forked preview.
