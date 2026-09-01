# Template kits

Forkable Vite + React starters used by the Forge template gallery. Each kit is a self-contained folder under `data/templates/<id>/`.

**Full contributor guide (structure, rules, validation):**

- 🇬🇧 [docs/TEMPLATES.md](../../docs/TEMPLATES.md)
- 🇫🇷 [docs/TEMPLATES.fr.md](../../docs/TEMPLATES.fr.md)

## Quick structure

```
data/templates/<id>/
├── template.json      # catalog metadata (i18n, palette, tags, bootHint)
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
    ├── App.tsx        # React only — no external imports
    └── index.css      # self-contained CSS, no @import
```

## Adding a kit (checklist)

1. Copy an existing kit folder and rename to a new `<id>` (regex: `^[a-z0-9][a-z0-9-]{1,62}$`).
2. Update `template.json`, `DESIGN.md`, `preview.html`, and `src/App.tsx`.
3. Register `<id>` in `EXPECTED_IDS` inside `apps/api/tests/test_templates.py`.
4. Update keyword routing in `apps/api/app/services/templates.py` if needed.
5. Run `cd apps/api && pytest tests/test_templates.py -q`.
6. Open a PR with **screenshots** of the gallery card and a forked preview.
