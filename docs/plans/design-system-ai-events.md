# Design system AI: request fields and SSE events

Contract delivered by wave 2 agent H (`apps/api/app/services/design_system/`). The design system editor (`apps/web/components/design-system/`) builds on it. Same transport and conventions as the slides one (`docs/plans/deck-ai-events.md`).

## Request (backward compatible)

`POST /projects/{id}/chats/{chat_id}/messages` (and `.../messages/branch`) on a `design_system` project:

```json
{"content":"Une palette plus chaude","mode":"agent","model":null,
 "target":{"section":"colors"}}
```

- `target.section` (optional): `colors | typography | spacing | logo | iconography | imagery | voice | guidelines | components`. Present: targeted edit of that section only. Absent: a whole design system is generated (or regenerated from the current one).
- `spacing` covers spacing, radius, shadows and motion.
- Sources of a generation, read from the message itself:
  - a website: the first `http(s)` page URL in `content` (the site is read through the SSRF guard of `url_capture`; computed styles and one screenshot);
  - a logo: the first image attached to the message (usual attachment markers), else the raster logo already set in `design-system.json` (`logo.src`, not the generated wordmark SVG). An attached image is saved as `public/brand/logo.<ext>` and becomes `logo.src`.
- Routing: `design_system` messages go to this flow when `FORGE_KIND_DESIGN_SYSTEM_ENABLED` is on (the `kind_not_available` answer is gone for this kind). The 402 wallet check runs first, as for every message.

## Events

Usual events keep their meaning: `user_message`, `route`, `step`, `file_write`, `warning`, `error`, `done`.

`route.task_class`: `design_system.generate` or `design_system.edit.section`.

Step ids: `ds_capture` (reading the website), `ds_logo` (logo analysis), `ds_generate`, `ds_edit`, `done`.

### 1. Generation

user_message, route, then in order (each part only when it applies):

```json
{"type":"step","id":"ds_capture","status":"running"}
{"type":"design_system.findings","run_id":"<uuid>","source":"url","url":"https://acme.test",
 "background":"#ffffff","text":"#111827","accent":"#ea580c","palette":["#f9fafb"],
 "fonts":{"heading":"Space Grotesk","body":"Inter"},"radius":8,"spacing":16}
{"type":"step","id":"ds_capture","status":"done"}
{"type":"step","id":"ds_logo","status":"running"}
{"type":"file_write","path":"public/brand/logo.png"}
{"type":"step","id":"ds_logo","status":"done"}
{"type":"step","id":"ds_generate","status":"running"}
{"type":"file_write","path":"public/brand/logo.svg"}          // generated wordmark, only without a real logo
{"type":"file_write","path":"design-system.json"}
{"type":"file_write","path":"DESIGN.md"}
{"type":"design_system.document","run_id":"<uuid>","document":{...},"contrast":[...],"fixes":[...]}
{"type":"step","id":"ds_generate","status":"done"}
{"type":"design_system.done","run_id":"<uuid>","warnings":[],"repaired":false}
{"type":"done","summary":"...","steps":[...],"applied":[...],"effort_label":"..."}
```

- A website that cannot be read gives a `warning` (`violation.code: SITE_CAPTURE_FAILED`, neutral message, no reason given for refused hosts) and the generation goes on from the text.
- `document` is the complete `design-system.json` as written (contract `contracts/forge-design/design-system.schema.json`).
- `contrast`: one row per checked pair, `{"fg":"muted","bg":"surface","ratio":6.49,"level":"AA","required":4.5,"pass":true,"use":"Secondary text on cards"}`. Levels: `AAA`, `AA`, `AA-large`, `fail`.
- `fixes`: colours Forge changed to reach the required ratio, `{"token":"fg","on":"bg","from":"#777777","to":"#2b2b2b","ratio":4.62}`. When not empty, `design_system.done.warnings` holds `CONTRAST_REPAIRED: fg on bg, ...`.
- `repaired`: the model needed at least one repair round.

### 2. Targeted section edit

user_message, route, step `ds_edit` running, `file_write` design-system.json and DESIGN.md, `design_system.document` with `"section":"colors"`, step `ds_edit` done, `design_system.done` with `"section"`, `done`.

Only the keys of that section are read from the answer; every other section of the document (hand edits included) is kept byte for byte.

### Error codes

`target_not_found` (unknown section), `invalid_model_output` (no valid design system after two repairs), plus the usual gateway codes (`error_code_for`).

## What the model writes

Never W3C tokens: a compact spec (palette by role, three Google Fonts families from the curated list, type base and ratio, spacing unit, radii, shadow and motion presets, logo, iconography, imagery, voice, guidelines, components). Forge builds the tokens (`tokens.build_document`), checks and repairs the contrast pairs, maps unknown fonts to the curated list, then validates against the contract.

## Token layout written by Forge

| Group | Content | CSS variables |
|---|---|---|
| `color` | bg, surface, fg, muted, accent, accent-contrast, border, success, warning, danger, info (+ secondary). `$extensions.forge`: `role`, `contrast` | `--bg`, `--accent`... |
| `font` | display, body, mono (family + fallback stack) | `--font-display`... (`--font-sans` added for sites) |
| `weight`, `text`, `leading` | weights, modular scale xs to 5xl (`text.base.$extensions.forge`: base, ratio), line heights | `--text-xl`... |
| `type` | composite typography tokens (display, h1 to h3, body, small, caption, code) with aliases | none (no CSS value) |
| `space`, `radius`, `shadow`, `motion`, `ease` | scale xs to 3xl, none to full, sm to lg, fast/base/slow, standard curve | `--space-md`, `--shadow-md`, `--ease-standard`... |
| `icon` | library, style (`$extensions.forge.guidance`: do/don't), stroke, sizes | `--icon-stroke`... |

Logo misuse lines are stored in `logo.usage` with the prefix `Avoid: ` (the contract has no separate field).

## Related routes

- `GET /design-systems` (mine, shared with me, my teams'; default first), `GET /design-systems/{id}`
- `PUT /design-systems/{id}/default` `{"scope":"user"|"team","value":true}`
- `POST` / `DELETE /design-systems/{id}/share` (needs `design_system_sharing` on Forge Cloud)
- `GET|PUT|DELETE /projects/{id}/design-system-link`, `POST /projects/{id}/design-system-link/resync` `{"version":N}`
- `GET /projects/{id}/design-system/export/{tokens|css|tailwind|md|pdf}`
- `POST /projects/{id}/publish` on a design_system project publishes the brand guidelines page.
