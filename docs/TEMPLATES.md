# Template Kit Contributor Guide

> 🇫🇷 Version française : [TEMPLATES.fr.md](./TEMPLATES.fr.md)

Forge ships a gallery of forkable starter kits under `data/templates/`. This guide explains the exact contract a kit must fulfil — every rule below is enforced by `apps/api/tests/test_templates.py`.

## What is a kit?

A kit is a folder `data/templates/<id>/` where `<id>` matches the regex:

```
^[a-z0-9][a-z0-9-]{1,62}$
```

Lowercase letters, digits and hyphens, 2–63 chars, starting with a letter or digit. Example: `aurora-ai`.

## Required files

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
├── public/              # optional: images, manifest.webmanifest (mobile kits)
└── src/
    ├── main.tsx         # named createRoot (see rules)
    ├── App.tsx          # composition only
    ├── index.css        # foundation: tokens, reset, type, shell, shared utilities
    ├── components/      # one file per section / shared part
    ├── screens/         # mobile kits: one file per screen
    └── styles/          # page or screen stylesheets, scoped (home.css...)
```

A kit is the first code the agent edits after a fork, so it follows the same rules the agent is held to.

### `template.json`

Bilingual metadata plus a strict palette. All four colors must be 6-digit hex (`#rrggbb`):

```json
{
  "kind": "web",
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

- `kind`: required — `"web"` (marketing / multi-page site) or `"mobile"` (app-shell prototype). The gallery filters by kind; forking sets `project.platform` from this field.
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

## Typography
- Display: system-ui stack, 700, clamp(2.4rem, 6vw, 4.2rem)
- Body: system-ui stack, 400, 1rem / 1.6

## Spacing & radius
- Section padding: clamp(4rem, 10vw, 7rem); radius 14px

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

`apps/api/app/services/template_contract.py` is the contract as code; `test_templates.py` runs it on every kit.

1. **`src/main.tsx` uses `import { createRoot } from "react-dom/client"`** (never the default `ReactDOM` import).
2. **Imports:** `react`, `react-dom/client` (main.tsx), `react-router-dom` (pages and app screens are routes), `lucide-react` and local files only.
3. **Icons are `lucide-react` icons** (names that exist in 0.468.0). No emoji or dingbat glyphs used as icons, no hand-drawn icon SVGs.
4. **Split files:** sections (web) or screens (mobile) live in `src/components/` / `src/screens/`; `App.tsx` only composes them.
5. **CSS ownership:** `src/index.css` is the foundation (tokens, reset, base typography, layout shell, nav/footer or app shell, buttons and shared parts). Section or screen rules live in `src/styles/<page>.css`, imported by the file that uses them and scoped under a root class (`.home-screen .hero`).
6. **Mobile-first:** no `@media (max-width: …)`; base rules are the phone layout, wider layouts use `min-width`.
7. **One `@import` at most:** the Google Fonts line named in `DESIGN.md`, as the very first line of `src/index.css`. No other `@import` anywhere.
8. **`package.json`:** `lucide-react` in dependencies; devDependencies pinned to the export toolchain (`vite ^5.4.21`, `@vitejs/plugin-react ^4.3.4`, `typescript ^5.6.3`, `@types/react ^18.3.12`, `@types/react-dom ^18.3.1`).
9. **`DESIGN.md`** has `## Colors` (the 4 template.json variables), `## Typography` and `## Tone`.
10. **`preview.html` is script-free** and only references `https://images.unsplash.com/` and Google Fonts.
11. A manifest lives at `public/manifest.webmanifest`, never at the kit root.

## `preview.html`: the gallery thumbnail

`preview.html` is a standalone static mini-mockup rendered at **480×270** (16:9) as the card thumbnail in the template gallery. Inline all styles, keep it lightweight and reuse the kit's palette and fonts. Web kits reproduce the hero's signature look (gradients, layout, one image at most). Mobile kits show two or three phone mockups of real screens on a backdrop in the kit palette; never name a class `phone` (a legacy gallery rule targets `.phone {` and crops it).

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

## Slides kits (`kind: "slides"`)

Presentation kits are documents rendered by the Forge deck player, not React code. Their folder is `data/templates/slides-<name>/` and holds `template.json` (`"kind": "slides"`, plus `category`, `fonts`, `transitionPreset` and a `layouts` map), `DESIGN.md`, `deck.json`, `slides/*.json`, `notes/*.md`, `public/images/*.webp` and a static `preview.html`. No `package.json` or `src/`.

The loader lists a slides kit once `deck.json` and `slides/` exist; forking validates every document against `contracts/forge-design/`, titles the deck after the project and skips the React steps. `apps/api/tests/test_template_slides.py` checks the contract, the 12 required layouts, image credits, theme tokens, curated fonts, the 3 MB budget and the fork. Register new ids in `EXPECTED_SLIDES_IDS` (`apps/api/tests/test_templates.py`).

Full format, layouts, presets and the 36 planned templates: [templates/slides-style-guide.md](./templates/slides-style-guide.md). Licensed sources: [templates/slides-sources.md](./templates/slides-sources.md).
