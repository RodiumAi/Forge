# Forge redesign: implementation brief

Shared brief for every agent of the redesign. The user validated a static mockup and asked to implement it in Forge "from A to Z".

## Source of truth

- Mockup (validated): `D:\next js\RodiumAi\_design\forge-redesign\` (read only). Pages: `index.html` (landing), `template.html` (template detail), `dashboard.html`, `projects.html`, `app-templates.html`, `app-template.html`, `billing.html`, `team.html`, `settings.html`, `integrations.html`, `integration-detail.html`, `builder.html?kind=site|app|slides|codelab|design_system&state=empty|generating|done|error`. Styles: `styles.css` (landing), `app.css` (app). Scripts: `app.js`, `home.js`, `composer.js`, `pricing.js`, `app-shell.js`, `app-pages.js`, `builder.js`, `template.js`. Its `README.md` lists decisions and data sources. Serve it with `python -m http.server 4510` from that folder to look at it in a browser.
- Brand: `D:\next js\RodiumAi\rodiumai-brand\Forge\Forge-Brand-Guidelines.md` and its assets.
- Reproduce the mockup faithfully (layout, spacing, motion, copy FR and EN), using real data and real APIs instead of the mockup's fake data.

## Rules decided with the user

- No gradient fills on buttons, pills, avatars, badges, text: flat RodiumAi orange `#EB6118` (`#C14A0C` for small orange text on light). Only very subtle background glows and grid/dot patterns are allowed.
- Billing is monthly only. FRODI allowance renews weekly (monthly on Free).
- The RODI balance is shown only on the billing page, never in the sidebar or overview.
- Default model in the composer is Auto; model choice is a Pro and Scale feature.
- Free plan: live preview with a "By Forge" badge, no export. Exports from Starter.
- Country/currency picker with flags, from the real payment countries API.
- GitHub link: https://github.com/RodiumAi/Forge (nav icon, under the composer, footer).
- Integration cards are clickable and open a detail page.
- Nothing from the old design should remain once the redesign is done.

## Repo and branches

- Integration branch: `feat/forge-redesign` in worktree `D:\next js\_wt\forge-redesign` (based on `feat/forge-design`, which already holds Forge Design waves 0 to 2: deck player/editor, codelab, design system, exports, templates).
- Each agent works in its own worktree on its own branch created from `feat/forge-redesign`, commits locally, no push, no PR, no merge. The orchestrator integrates.
- Never touch `dev`, `main`, nor `D:\next js\RodiumAi\forge-web` (the user's checkout). forge-web deploys to production on merge to main.
- Web app: `apps/web` (Next.js 15, React 19, framer-motion, Tailwind or CSS as currently used: follow what exists). API: `apps/api` (FastAPI). Only change the API when a screen needs data that does not exist yet, keep it backward compatible, add tests, and report it.

## Code rules

- No long dash (U+2014) anywhere: code, comments, copy, commits. Brand is written "RodiumAi".
- Match neighbouring code style and comment density. All copy through the existing i18n system (FR and EN).
- Keep existing behaviour working: auth, billing, generation, SSE events, exports, publishing, the Forge Design editors. A redesign changes the look and layout, not the contracts. Keep `data-*` hooks used by exports and tests.
- Accessibility: keyboard, focus states, contrast, `prefers-reduced-motion`.
- Responsive: 375px, 768px, 1280px+, no horizontal scroll. Dark and light themes.
- Tests: `cd apps/web && npx tsc --noEmit && npx vitest run` (and `npx next lint` if configured); fix tests you break, update snapshots only for intentional visual changes. API: `cd apps/api && .venv/Scripts/python -m pytest -q` when touched (create the venv in your worktree if missing, or reuse `D:\next js\_wt\forge-design-w0\apps\api\.venv`).
- Verify in a browser: run your own dev server on a free port (`npx next dev -p <port>`, pick 3110 to 3190, never 3100 or 3012) against the local API at http://127.0.0.1:8100, compare with the mockup at 1280px and 375px, screenshots.
- Commits small and logical, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Final report: commits, files, choices and deviations from the mockup, tests, what you could not verify, questions.

## Ownership

| Phase | Agent | Scope |
|---|---|---|
| 1 | Foundation | design tokens (colours, type Open Sauce Sans, radii, shadows, motion), global CSS, theme (dark/light), shared UI primitives in `apps/web/components/ui/` (Button, IconButton, Pill/Badge, Card, Avatar, Tabs, Segmented, Menu/Popover, Dialog/Sheet, Input, Switch, Tooltip, CountryPicker, Meter, KindBadge, Icon set), the shared Composer component (prompt box with attach, design system chip, code toggle, model picker Auto by default, kind/template panel), the TemplateCard (with hover autoplay for decks) and the app shell (collapsible sidebar, topbar with search palette Ctrl K, mobile bottom bar and drawer). Documents them in `docs/plans/forge-redesign-components.md` with usage. |
| 2 | Landing | `/` landing, pricing section (6 plans, 3/2/1 per row, monthly), templates gallery, public template detail, FAQ, footer, nav, login/register/auth pages restyled |
| 2 | App pages | dashboard overview, projects, in-app templates and detail, billing (plan, FRODI meter, RODI, invoices, upgrade cards), team/seats, settings, integrations + integration detail |
| 2 | Builder | project workspace for site and mobile app (chat, plan, activity, preview with devices, code, history, publish, share, error and out-of-FRODI states) and the restyle of the slides, codelab and design system editors to the mockup |

Phase 2 agents consume phase 1 components and do not modify them without reporting; if a primitive is missing, add it next to the others and say so.
