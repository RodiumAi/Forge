# Template Kit Contributor Guide

> 🇫🇷 Version française : [TEMPLATES.fr.md](./TEMPLATES.fr.md)

Forge ships a gallery of forkable starter kits under `data/templates/`. This guide explains the exact contract a kit must fulfil — every rule below is enforced by `apps/api/tests/test_templates.py`.

## What is a kit?

A kit is a folder `data/templates/<id>/` where `<id>` matches the regex:

```
^[a-z0-9][a-z0-9-]{1,62}$
```

Lowercase letters, digits and hyphens, 2–63 chars, starting with a letter or digit. Example: `aurora-ai`.

## Required files (12)

```
data/templates/<id>/
├── template.json        # catalog metadata (see below)
├── DESIGN.md            # design charter (see below)
├── index.html
├── package.json         # "name" must equal <id>
├── preview.html         # static gallery thumbnail
├── README.md
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    └── index.css
```

### `template.json`

Bilingual metadata plus a strict palette. All four colors must be 6-digit hex (`#rrggbb`):

```json
{
  "id": "aurora-ai",
  "title": { "en": "Aurora AI", "fr": "Aurora AI" },
  "description": { "en": "…", "fr": "…" },
  "tags": ["ai", "saas", "landing", "dark"],
  "preview": "preview.html",
  "bootHint": { "en": "Adapt aurora-ai: …", "fr": "Adapte aurora-ai : …" },
  "accent": "#7c3aed",
  "bg": "#050208",
  "fg": "#f4f1fa",
  "muted": "#8b84a3",
  "tone": "visionary, sleek, quietly confident"
}
```

- `title`, `description`, `bootHint`: both `en` and `fr` must be non-empty.
- `accent`, `bg`, `fg`, `muted`: hex `#rrggbb` only (no shorthand, no `rgb()`).
- `preview` points to `"preview.html"`.
- `tone` is a short free-text mood line reused by the AI when adapting the kit.

### `DESIGN.md`

The design charter the AI follows when forking the kit. Required sections:

```markdown
# Design charter

## Template
- id: <id>
- name: <Name>

## Colors
- --bg: #050208
- --fg: #f4f1fa
- --muted: #8b84a3
- --accent: #7c3aed

## Tone
One or two sentences describing voice and copy style.

## Do / Don't
- Do keep the signature visual elements…
- Don't break the identity (theme, accent family)…

## Images
- Purpose: https://images.unsplash.com/photo-…?auto=format&fit=crop&w=1200&q=70 (short caption)
```

The `## Colors` section must list the same four variables as `template.json`.

## Hard rules (locked by pytest)

1. **`src/App.tsx` may only import from `"react"`.** Kits run in the zero-install Babel runner: no router, no UI library, no icon packs. Every `from "…"` specifier other than `react` fails the suite.
2. **`preview.html` must be script-free.** No `<script>` tag, in any casing.
3. **`preview.html` may only reference one external origin:** `https://images.unsplash.com/`. Any other `http(s)://` URL fails the suite.
4. **`src/index.css` is self-contained.** No `@import` — no Google Fonts, no external CSS. Use system font stacks and pure CSS animations.

## `preview.html` — the gallery thumbnail

`preview.html` is a standalone static mini-mockup of the kit's hero, rendered at roughly **480×300** as the card thumbnail in the template gallery. Inline all styles, keep it lightweight, reuse the kit's palette, and reproduce the hero's signature look (gradients, layout, one image at most).

## Local validation checklist

1. **Register the id.** Add your `<id>` to `EXPECTED_IDS` in `apps/api/tests/test_templates.py`.
2. **Run the template suite:**

   ```sh
   cd apps/api && pytest tests/test_templates.py -q
   ```

3. **Verify the Babel transform.** Kits must compile with the same transform used by the preview runner. Quick check with a 6-line Node script:

   ```js
   // check.mjs — run from apps/api: node check.mjs
   import { readFileSync } from "node:fs";
   import { transform } from "./runtime/transform.mjs";
   const src = readFileSync("../../data/templates/<id>/src/App.tsx", "utf8");
   const out = transform(src, "src/App.tsx");
   if (out.error) { console.error(out.error); process.exit(1); }
   console.log("OK,", out.imports.map((i) => i.specifier));
   ```

4. **Test visually.** Start the app, open the **Templates** tab in the UI, check the thumbnail, then fork the kit and confirm the live preview renders without errors.

## Design tips

- **Take a strong stance.** Kits with a clear identity (brutalist, glassmorphism, editorial mono…) adapt better than generic ones.
- **Realistic content.** Real-sounding product names, pricing tiers, testimonials — no lorem ipsum.
- **Relevant Unsplash photos.** Pick images that match the kit's universe; document each URL in `DESIGN.md § Images`.
- **Responsive.** The kit must hold up from mobile to desktop.
- **Pure CSS animations.** Subtle keyframe motion (drifting gradients, fades, tilts) — no JS animation libraries.
