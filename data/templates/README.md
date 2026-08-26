# Template kits

Eight forkable Vite + React starters. Each mirrors the **layout, section rhythm
and palette** of a public ThemeWagon demo, with fully original copy, CSS and
visuals (no scraped assets — imagery is simulated with CSS gradients so the
repo stays light and previews load instantly in the Babel runner).

| id | Category | Palette | Demo layout reference |
|---|---|---|---|
| `astroship-startup` | Startup landing | White / indigo | astroship |
| `nexora-agency` | Agency (dark) | Navy / indigo | nexora |
| `gallery-photos` | Photo gallery | Warm paper / terracotta | gallery |
| `logsfolio-portfolio` | Developer portfolio (dark) | Ink / teal | logsfolio |
| `tailstore-shop` | E-commerce | White / amber | tailstore |
| `podux-podcast` | Podcast | Lavender / violet | podux |
| `tailnext-saas` | SaaS marketing | White / indigo | tailnext |
| `orbit-dashboard` | Admin dashboard | Slate / blue | orbit |

## Contract

Every kit contains exactly:

```
template.json      catalog metadata (id, i18n title/description, tags, palette, bootHint)
DESIGN.md          locked design charter the agent must respect
index.html         Vite entry
package.json       react + react-dom only (runs in the Babel runner, no install)
vite.config.ts
tsconfig.json / tsconfig.node.json
preview.html       self-contained ~2 KB card miniature (no JS)
src/main.tsx       createRoot bootstrap
src/App.tsx        single-file page, no external imports
src/index.css      plain CSS, :root palette variables, one mobile media query
```

Rules for `src/App.tsx`:
- one default-exported component, no imports beyond React JSX runtime;
- visuals are CSS-only (gradients, shapes, character glyphs — no image files);
- copy is original and brand-fictitious;
- must compile under Babel standalone (validated in CI-adjacent script
  `apps/api/runtime` transform).

Keyword routing for prompt → template lives in
`apps/api/app/services/templates.py` (`_TEMPLATE_KEYWORDS`). Update it when
adding or removing a kit.
