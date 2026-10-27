# Starter Kit Contributor Guide

> 🇫🇷 Version française : [TEMPLATES.fr.md](./TEMPLATES.fr.md)

Forge ships a gallery of forkable starter kits under `data/templates/`. This
guide is the authoring contract for each project kind. The loader is
`apps/api/app/services/templates.py`; the rules below are enforced by the
template tests in `apps/api/tests/`.

## The catalogue

`data/templates/` holds 86 kits:

| Kind (`template.json` `kind`) | Kits | Id prefix | Contract tests |
|---|---|---|---|
| `web` (site) | 24 | none | `test_templates.py` |
| `mobile` (app) | 12 | none | `test_templates.py` |
| `slides` | 36 | `slides-` | `test_templates.py`, `test_template_slides.py` |
| `codelab` | 8 | `codelab-` | `test_templates.py`, `test_template_codelab.py` |
| `design_system` | 6 | `design-system-` | `test_templates.py`, `test_template_design_systems.py` |

`test_template_gating.py` checks the plan gating fields. Slides, codelab and
design system kits only show in the public catalogue when their kind is
switched on (`FORGE_KIND_SLIDES_ENABLED`, `FORGE_KIND_CODELAB_ENABLED`,
`FORGE_KIND_DESIGN_SYSTEM_ENABLED`, all off by default).

## Rules for every kind

### Folder and id

A kit is a folder `data/templates/<id>/` where `<id>` matches:

```
^[a-z0-9][a-z0-9-]{1,62}$
```

Lowercase letters, digits and hyphens, 2 to 63 characters, starting with a
letter or a digit. Folders whose name starts with `_` are ignored.

The loader lists a kit only when `template.json` parses and the minimal files of
its kind exist:

| Kind | Minimal files |
|---|---|
| `web`, `mobile` | `package.json`, `src/App.tsx` |
| `slides` | `deck.json`, a `slides/` folder |
| `codelab` | `codelab.json`, a `steps/` folder |
| `design_system` | `design-system.json` |

A missing or unknown `kind` is read as `web`.

### `template.json`

Catalogue metadata, bilingual, with a strict palette. Fields common to every
kind:

| Field | Rule |
|---|---|
| `kind` | `web`, `mobile`, `slides`, `codelab` or `design_system` (tested) |
| `id` | the folder name |
| `title` | `{ "en": "…", "fr": "…" }`, both non-empty (tested) |
| `description` | `{ "en": "…", "fr": "…" }`, both non-empty (tested) |
| `accent`, `bg`, `fg`, `muted` | `#rrggbb` only, no shorthand, no `rgb()` (tested) |
| `bootHint` | `{ "en": "…", "fr": "…" }`: what to adapt first after a fork |
| `tags` | list of short strings, used by the gallery search |
| `preview` | `"preview.html"` |
| `tone` | a short free-text mood line, reused by the AI when adapting the kit |
| `fonts` | `{ "display", "body", "mono" }`: every slides, codelab, design system and mobile kit sets it |
| `free` | optional; `true` makes the kit usable on the Free plan (see gating) |

Every kit in the repository sets all the fields above except `free`. Kind
specific fields are listed in each section below.

### Gallery images

- `preview.html` is a static mini mockup: **no `<script>`**, inline styles,
  and no remote URL other than `https://images.unsplash.com/` and Google Fonts
  (slides kits: no remote URL at all).
- `preview.png` is the gallery card: the top 480 x 270 of `preview.html`,
  rendered at 2x by `apps/api/scripts/render_template_previews.py`
  (`python scripts/render_template_previews.py <id>` from `apps/api`, needs
  Playwright). Commit it next to `preview.html`. Design system kits are
  skipped there: `apps/api/scripts/design_system_kits/build_kits.py` draws
  their card.

### What a fork does

`fork_template` copies the kit into the new project, then:

- drops `template.json` and `preview.png`, and writes `.forge/template.json`
  (id, kind, tone, boot hint) so the agent knows where the project came from;
- replaces long dashes in the copied text files;
- per kind: sites and apps get the project name in `package.json` and
  `index.html` and a default favicon; slides, codelab and design system
  documents are validated against `contracts/forge-design/` and titled after
  the project (a generic name such as "New project" keeps the deck title);
- takes a first history checkpoint.

### Plan gating (Forge Cloud only)

`apps/api/app/services/template_gating.py`. Open-source and BYOK installs are
unrestricted. On Forge Cloud, a kit with `"free": true` can start a project on
the Free plan, every other kit starts at Starter, and design system kits follow
the design system rule (Builder). Previews and kit details stay public.
`test_template_gating.py` expects exactly two free kits per kind (web, mobile,
slides, codelab) and none for design systems: change that test if you change
the split.

## Sites and apps (`kind: "web"` and `"mobile"`)

### Required files

```
data/templates/<id>/
├── template.json        # catalogue metadata
├── DESIGN.md            # design charter
├── index.html
├── package.json         # name, dependencies, pinned toolchain
├── preview.html         # static gallery mockup
├── preview.png          # gallery card
├── README.md
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── public/              # optional: images; mobile kits: manifest.webmanifest, icon.svg
└── src/
    ├── main.tsx         # named createRoot (see rules)
    ├── App.tsx          # composition only
    ├── index.css        # foundation: tokens, reset, type, shell, shared utilities
    ├── components/      # one file per section / shared part
    ├── screens/         # mobile kits: one file per screen (<Name>Screen.tsx)
    └── styles/          # page or screen stylesheets, scoped (home.css...)
```

A kit is the first code the agent edits after a fork, so it follows the same
rules the agent is held to. Example `template.json`:

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

Forking sets `project.platform` from `kind`.

### `DESIGN.md`

The design charter the AI follows when it adapts the kit:

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

`## Colors` lists the same four variables as `template.json`.

### Hard rules

`apps/api/app/services/template_contract.py` is the contract as code;
`test_templates.py` runs it on every site and app kit.

1. **`src/main.tsx` uses `import { createRoot } from "react-dom/client"`** (never the default `ReactDOM` import).
2. **Imports:** `react`, `react-dom/client`, `react-router-dom` (pages and app screens are routes), `lucide-react` and local files only.
3. **Icons are `lucide-react` icons** whose names exist in `apps/api/runtime/lucide_exports.json`. No emoji or dingbat glyphs used as icons.
4. **Split files:** at least three source files outside `src/` root (sections in `src/components/`, screens in `src/screens/`); `App.tsx` only composes them.
5. **CSS ownership:** `src/index.css` is the foundation (tokens, reset, base typography, layout shell, nav/footer or app shell, buttons and shared parts). Section or screen rules live in `src/styles/<page>.css`, imported by the file that uses them and scoped under a root class (`.home-screen .hero`). Every stylesheet in `src/styles/` must be imported.
6. **Mobile-first:** no `@media (max-width: …)`; base rules are the phone layout, wider layouts use `min-width`.
7. **One `@import` at most:** the Google Fonts line named in `DESIGN.md`, as the very first line of `src/index.css`. No other `@import` anywhere.
8. **`package.json`:** `lucide-react` in dependencies; devDependencies pinned to the export toolchain (`vite ^5.4.21`, `@vitejs/plugin-react ^4.3.4`, `typescript ^5.6.3`, `@types/react ^18.3.12`, `@types/react-dom ^18.3.1`).
9. **`DESIGN.md`** has `## Colors`, `## Typography` and `## Tone`.
10. **`README.md`** exists.
11. A manifest lives at `public/manifest.webmanifest`, never at the kit root.

### `preview.html` for sites and apps

Web kits reproduce the hero's signature look (gradients, layout, one image at
most). Mobile kits show two or three phone mockups of real screens on a backdrop
in the kit palette; never name a class `phone` (a legacy gallery rule targets
`.phone {` and crops it).

### Design tips

- **Take a strong stance.** Kits with a clear identity (brutalist, glassmorphism, editorial mono…) adapt better than generic ones.
- **Realistic content.** Real-sounding product names, pricing tiers, testimonials; no lorem ipsum.
- **Relevant Unsplash photos.** Pick images that match the kit's universe; document each URL in `DESIGN.md § Images`.
- **Responsive.** The kit must hold up from mobile to desktop.
- **Pure CSS animations.** Subtle keyframe motion (drifting gradients, fades, tilts); no JS animation libraries.

## Slides (`kind: "slides"`)

Presentation kits are documents rendered by the Forge deck player, not React
code. No `package.json`, no `src/`.

```
data/templates/slides-<name>/
├── template.json      # + category, fonts, transitionPreset, layouts
├── DESIGN.md          # theme tokens, font lines, layouts, transitions, imagery, tone
├── deck.json          # contracts/forge-design/deck.schema.json
├── slides/s1.json …   # one file per slide, slide.schema.json
├── notes/s1.md …      # one speaker notes file per slide
├── public/images/     # WebP images
├── preview.html       # static, no remote URL (inline data: images allowed)
└── preview.png
```

Extra `template.json` fields:

| Field | Rule |
|---|---|
| `category` | one of `business`, `marketing`, `education`, `tech`, `creative`, `minimal` |
| `fonts` | `display`, `body`, `mono`, each from the curated `GOOGLE_FONTS` list of `apps/api/app/services/brand_charter.py` |
| `transitionPreset` | `sober`, `dynamic` or `elegant` |
| `layouts` | maps each of the 12 required layouts to its example slide id: `{ "title": "s1", "section": "s2", … }` |

What `test_template_slides.py` checks:

- id starts with `slides-`; `template.json`, `DESIGN.md`, `deck.json` and
  `preview.html` exist; no `package.json`;
- `deck.json` and every slide validate against the contract; 8 to 12 slides;
  slide files and `deck.json` list the same ids; each slide has
  `notes/<id>.md`;
- the 12 layouts of `SLIDES_LAYOUTS` (`title`, `section`, `text`,
  `two-columns`, `image-text`, `quote`, `key-numbers`, `chart`, `table`, `team`,
  `timeline`, `thanks`) are all used, and `layouts` maps each one to a slide
  of that layout;
- images are `public/images/*.webp`, exist, and carry a `credit` with `source`
  and `author` (background images too); icons are lucide names;
- `DESIGN.md` defines at least `--bg`, `--surface`, `--fg`, `--muted`,
  `--accent` and `--border` as `` - `--token`: #rrggbb `` lines, slides use no
  other token, and it has `Display font:`, `Body font:` and `Mono font:` lines
  from the curated list;
- the whole kit weighs under 3 MB, `preview.html` has no script and no remote
  URL, and no `.json`, `.md` or `.html` file contains a long dash.

Layout geometry, theme tokens, transition presets, the 36 kits and the
imagery and writing rules: [templates/slides-style-guide.md](./templates/slides-style-guide.md).
Licensed sources: [templates/slides-sources.md](./templates/slides-sources.md).
The scripts that built the slides kits are in `apps/api/scripts/slides_kits/`.

## Codelabs (`kind: "codelab"`)

Codelab kits are documents rendered by the Forge codelab player. No
`package.json`.

```
data/templates/codelab-<name>/
├── template.json      # + category, fonts
├── DESIGN.md          # theme tokens and font lines
├── codelab.json       # contracts/forge-design/codelab.schema.json
├── steps/01-intro.md …  # one extended Markdown file per step
├── files/starter/ …   # downloadable files (typically starter and solution)
├── files/solution/ …
├── preview.html
└── preview.png
```

Extra `template.json` fields: `category` (the kits use `backend`, `frontend`,
`mobile`, `data`, `devops`, `education`, `ai`) and `fonts`.

`codelab.json` carries `version`, `title`, `summary`, `level` (`beginner`,
`intermediate`, `advanced`), `durationMinutes`, `prerequisites`, `learn`,
`author`, `theme` (`{ "designSystem": "local", "tokens": "DESIGN.md" }` in the
kits), `steps` (`id`, `title`, `file`, `minutes`) and `downloads` (`id`,
`label`, `path`, `zip`). See `codelab-rest-api` for a complete example.

What `test_template_codelab.py` checks:

- id starts with `codelab-`; `template.json`, `DESIGN.md`, `codelab.json` and
  `preview.html` exist; no `package.json`;
- `codelab.json` validates against the contract; 5 to 12 steps; the step files
  listed are exactly the `steps/*.md` files; `durationMinutes` is the sum of the
  step minutes; `summary`, `learn` and `prerequisites` are not empty;
- every declared download exists (a `zip: true` download is a non-empty
  folder); files under `files/` have normalized paths and no blocked extension
  (the codelab upload policy of `app/services/codelab/files.py`);
- every step starts with `# `, has balanced code fences, uses only the known
  `:::` containers (`tabs`, `info`, `note`, `tip`, `success`, `warning`,
  `caution`, `danger`, `error`) and closes them, points ```` ```download ````
  blocks and `download="…"` links at declared downloads or existing files, and
  has no raw HTML outside code;
- the kit weighs at most 512 KB (`preview.png` excluded) with no long dash;
  `title.fr` and `description.fr` are set;
- `DESIGN.md` names `--bg`, `--fg`, `--accent`, `--surface`, `--border` and
  `--muted` and has a `Mono font:` line.

A kit whose `codelab.json` lists a step file that does not exist fails the
fork. The example content of the kits is in French.

## Design systems (`kind: "design_system"`)

```
data/templates/design-system-<name>/
├── template.json        # + fonts
├── design-system.json   # contracts/forge-design/design-system.schema.json
├── DESIGN.md            # generated from design-system.json
├── public/brand/        # logo.svg, logo-dark.svg, icon.svg
├── preview.html         # the brand guidelines page, assets inlined
└── preview.png          # the gallery card
```

Do not write these kits by hand: `apps/api/scripts/design_system_kits/build_kits.py`
(run from `apps/api`) builds every file from a compact spec through the same
code as the AI (`tokens.build_document`), so a kit is always a valid,
contrast-checked design system. The brand marks come from
`scripts/design_system_kits/brands/<id>/`.

What `test_template_design_systems.py` checks: `design-system.json` validates,
every contrast pair passes, the logo file it names exists, `preview.html` and
`DESIGN.md` exist, and no `.json`, `.md`, `.html` or `.svg` file contains a long
dash. On fork, the design system takes the project name, a generated wordmark
logo (`public/brand/logo.svg`) is redrawn with that name, `DESIGN.md` is
regenerated and `preview.html` is dropped.

## Testing a new kit locally

Set up the API as described in [CONTRIBUTING.md](../CONTRIBUTING.md) (virtual
environment, `npm ci` in `apps/api/runtime` and `apps/api/runtime/deck`,
`TEMPLATES_ROOT` when running outside Docker). Then:

1. **Register the id** in `apps/api/tests/test_templates.py`: the set of its
   kind (`EXPECTED_SLIDES_IDS`, `EXPECTED_CODELAB_IDS`,
   `EXPECTED_DESIGN_SYSTEM_IDS`, `EXPECTED_MOBILE_IDS`) or the web ids inside
   `EXPECTED_IDS`. `test_all_kits_are_listed` fails until you do, and also when
   your kit is skipped by the loader.
2. **Run the suites of your kind:**

   ```sh
   cd apps/api
   pytest tests/test_templates.py tests/test_template_gating.py -q
   pytest tests/test_template_slides.py -q          # slides
   pytest tests/test_template_codelab.py -q         # codelabs
   pytest tests/test_template_design_systems.py -q  # design systems
   ```

3. **Sites and apps: check the Babel transform.** Kits must compile with the
   same transform as the preview runner:

   ```js
   // check.mjs, run from apps/api: node check.mjs
   import { readFileSync } from "node:fs";
   import { transform } from "./runtime/transform.mjs";
   const src = readFileSync("../../data/templates/<id>/src/App.tsx", "utf8");
   const out = transform(src, "src/App.tsx");
   if (out.error) { console.error(out.error); process.exit(1); }
   console.log("OK,", out.imports.map((i) => i.specifier));
   ```

4. **Render the gallery card** with `python scripts/render_template_previews.py <id>`
   (from `apps/api`; design systems: `build_kits.py`).
5. **Test visually.** Start the stack, turn on the flag of your kind if it is a
   document kind, open the template gallery (`/templates`), check the card,
   fork the kit and confirm the editor or the live preview opens without
   errors.
