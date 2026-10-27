# Forge redesign: components reference (phase 1 Foundation)

Phase 2 builds the pages on top of what is listed here. Everything lives in
`apps/web`. The validated mockup is `D:\next js\RodiumAi\_design\forge-redesign\`.
A live, dev-only gallery of every piece in both themes is at **`/dev/ui`**
(`app/dev/ui`, returns 404 in production).

## Ground rules

- New CSS is namespaced: classes `f-*`, custom properties `--f-*`. The old
  `globals.css` (`--bg`, `.btn`, `.home-*`) still loads and keeps working for
  pages not redesigned yet. Do not reuse old classes in new pages.
- Stylesheets (imported in `app/layout.tsx` after `globals.css`):
  `styles/forge/tokens.css`, `primitives.css`, `composer.css`, `cards.css`, `shell.css`.
- Theme: `ThemeProvider` sets `data-theme="light|dark"` on `<html>`. Tokens
  follow it. To force a theme on a block, add `.f-theme-dark` or
  `.f-theme-light` (used by the gallery). `.f-paper` gives the cream gallery band.
- Root scope: every redesigned page sits inside `AppShell` (it adds `.f-app`).
  Outside the shell wrap content in `.f-scope` to get the font, colour and box sizing.
- All copy goes through i18n. The shared strings are `uiXxx` keys in
  `lib/i18n/ui-strings.ts` (EN + FR), spread into `dictionaries.ts`.
- Flat orange `#EB6118` only, no gradient fills. Small orange text on light
  backgrounds uses `--f-accent-text` (resolves to `#C14A0C` in light).
- Motion respects `prefers-reduced-motion` (global block in `primitives.css`,
  and the deck autoplay and typewriter check it in JS).
- No long dash character anywhere.

## Tokens (`styles/forge/tokens.css`)

Brand: `--f-orange` #EB6118, `--f-orange-hover`, `--f-orange-soft` (tint
background), `--f-orange-ring` (focus ring), `--f-orange-text-light` #C14A0C,
`--f-midnight` #1C1F26, `--f-white`.

Theme (dark and light values): `--f-bg`, `--f-bg-deep`, `--f-side`,
`--f-surface`, `--f-surface-2`, `--f-surface-3`, `--f-line`, `--f-line-strong`,
`--f-text`, `--f-muted`, `--f-faint`, `--f-accent-text`, `--f-shadow`,
`--f-shadow-lg`, `--f-glow`, `--f-pop` (popover background), `--f-composer`,
`--f-composer-2` (composer is dark in both themes).

Status: `--f-ok`, `--f-warn`, `--f-danger`, `--f-info` and their readable text
variants `--f-ok-text`, `--f-warn-text`, `--f-danger-text`, `--f-info-text`.

Kinds: `--f-kind-web`, `--f-kind-mobile`, `--f-kind-slides`, `--f-kind-codelab`,
`--f-kind-design_system` (same values as `lib/kind-style.ts`).

Paper band: `--f-paper`, `--f-paper-2`, `--f-paper-ink`, `--f-paper-muted`, `--f-paper-line`.

Type: `--f-font` (Open Sauce Sans, self hosted via `next/font/local`), `--f-mono`,
sizes `--f-fs-xs | sm | (fs) | md | lg | h3 | h2 | h1 | display`, `--f-lh`,
`--f-tracking-tight`.

Shape and space: radii `--f-r-xs | sm | md | (r) | lg | xl | pill`, spacing
`--f-space-1..7`.

Layout: `--f-wrap`, `--f-gutter`, `--f-page-max` (1360px), `--f-side-w` (264px),
`--f-side-w-collapsed` (76px), `--f-topbar-h` (68px).

Motion: `--f-ease`, `--f-ease-out`, `--f-dur-fast`, `--f-dur`, `--f-dur-slow`,
`--f-dur-reveal`.

Layers: `--f-z-sticky`, `--f-z-side`, `--f-z-popover`, `--f-z-dialog`, `--f-z-toast`.

Utility classes worth knowing: `.f-sr-only`, `.f-eyebrow`, `.f-kbd`, `.f-skel`
(skeleton), `.f-toast`, `.f-spin`, `.f-card`, `.f-panel`, `.f-page-head`.

## Primitives (`components/ui`)

| Component | File | Props |
|---|---|---|
| `Glyph` | `glyph.tsx` | `name: GlyphName` (106 mockup icons, see `glyph-paths.ts`), `size?: "xs"\|"sm"\|"md"\|"lg"`, `label?` (else aria-hidden), `strokeWidth?`, `className?`, `style?` |
| `Button` | `Button.tsx` | `variant?: "primary"\|"ghost"\|"subtle"\|"dark"\|"danger"\|"link"`, `size?: "xs"\|"sm"\|"md"\|"lg"`, `icon?`, `iconEnd?`, `block?`, `loading?`; with `href` renders a `Link` (`external?` opens a new tab), else a `<button>` (native button props) |
| `IconButton` | `Button.tsx` | `icon`, `label` (required, aria-label), `size?: "sm"\|"md"\|"lg"`, `plain?`, `square?`, `href?`, `external?`; `aria-pressed` styles the toggled state |
| `Badge` | `Badge.tsx` | `tone?: "neutral"\|"pro"\|"free"\|"solid"\|"new"` (Pro, Free, Nouveau pills) |
| `Tag` | `Badge.tsx` | `tone?: "neutral"\|"ok"\|"warn"\|"danger"\|"info"\|"orange"`, `icon?` |
| `StatePill` | `Badge.tsx` | `state: "live"\|"gen"\|"draft"\|"err"` |
| `Chip` | `Badge.tsx` | `icon?` (suggestion chip) |
| `FilterChip` | `Badge.tsx` | `pressed`, `onClick`, `dot?` (colour), `count?` |
| `Kbd`, `Eyebrow` | `Badge.tsx` | children |
| `Card` | `Card.tsx` | `interactive?`, `flush?`, `dashed?`, `as?: "div"\|"section"\|"article"` |
| `CardHead` | `Card.tsx` | `title`, `action?` |
| `Panel` | `Card.tsx` | `title?`, `lead?`, `actions?` (settings style section) |
| `Avatar` | `Avatar.tsx` | `name`, `src?`, `size?: "xs"\|"sm"\|"md"\|"lg"`, `tone?: "self"\|"other"`; `initialsOf(label)` exported |
| `AvatarButton`, `AvatarStack` | `Avatar.tsx` | avatar props + button props / children |
| `Tabs` | `Tabs.tsx` | `items: {id,label,icon?,controls?,disabled?}[]`, `value`, `onChange`, `label`; roving tabindex, arrows, Home, End |
| `Segmented` | `Tabs.tsx` | same items, `value`, `onChange`, `label`, `size?: "md"\|"lg"`; `aria-pressed` buttons |
| `Popover` | `Popover.tsx` | `trigger` (one element, gets onClick and aria), `children` (node or `(close) => node`), `side?: "top"\|"bottom"`, `align?: "start"\|"end"`, `tone?: "surface"\|"dark"`, `role?: "menu"\|"listbox"\|"dialog"`, `label?`, `width?`, controlled `open?` + `onOpenChange?`. Closes on outside click and Escape (focus back to trigger), arrows, Home, End; opening focuses the selected row |
| `MenuItem` | `Popover.tsx` | `icon?` or `lead?`, `meta?`, `hint?`, `href?`, `external?`, `danger?`, `disabled?`, `selected?`, `role?: "menuitem"\|"option"\|"menuitemradio"` |
| `MenuLabel`, `MenuSeparator`, `MenuNote` | `Popover.tsx` | children |
| `Dialog` | `Dialog.tsx` | `open`, `onClose`, `title`, `hideTitle?`, `description?`, `footer?`, `size?: "md"\|"wide"`, `placement?: "center"\|"top"`, `hideClose?`, `closeLabel?`. Portal, focus trap, scroll lock, Escape, focus restore; `data-autofocus` on a child takes the first focus |
| `Sheet` | `Dialog.tsx` | `open`, `onClose`, `side?: "bottom"\|"left"\|"right"`, `title?` or `label?`, `closeLabel?` |
| `Input`, `Textarea`, `Select` | `Input.tsx` | native props (`inputSize?: "sm"\|"md"` on Input) |
| `Field` | `Input.tsx` | `label`, `hint?`, `error?`, one control child (ids and `aria-describedby`, `aria-invalid` wired for you) |
| `SearchInput` | `Input.tsx` | `label` (sr-only), native input props, `wrapClassName?` |
| `Switch` | `Switch.tsx` | `checked`, `onChange(next)`, `label?` or `labelledBy?`, `describedBy?`, `disabled?`, `size?: "sm"\|"md"` |
| `SwitchRow` | `Switch.tsx` | `title`, `description?`, `checked`, `onChange`, `disabled?` |
| `Tooltip` | `Tooltip.tsx` | `content`, `side?: "top"\|"bottom"\|"right"`, one child (gets `aria-describedby`); shows on hover and focus |
| `Meter` | `Meter.tsx` | `value` (0..1 remaining), `label`, `valueText?`, `legend?: [left, right]`, `size?: "md"\|"lg"`, `level?: "ok"\|"warn"\|"danger"`; `meterLevel(ratio)` picks a level |
| `StairsMeter` | `Meter.tsx` | stepped FRODI meter: `value` (0..1 remaining), `label`, `valueText?`, `steps?` (12), `size?: "sm"\|"md"\|"lg"`; `role="meter"` |
| `KindBadge` | `KindBadge.tsx` | `kind: ProjectKindId` (coloured dot + label) |
| `KindIcon` | `KindBadge.tsx` | `kind`, `size?: "sm"\|"md"\|"lg"`, `label?` |
| `Flag` | `Flag.tsx` | `iso2`, `width?` (inline SVG, 19 payment countries, neutral fallback) |
| `CountryPicker` | `CountryPicker.tsx` | `value` (iso2), `onChange(iso2, country)`, `countries?` (defaults to the payment countries API), `align?: "center"\|"start"\|"end"`. Searchable combobox, localized names, method counts; bottom sheet under 640px. It only reports the choice; storing it stays with the page |
| `cx` | `cx.ts` | class joiner |
| `useDismiss` | `use-dismiss.ts` | `(open, close, refs, restoreRef?)` outside click + Escape |

Helpers in `lib`:

- `lib/kind-style.ts`: `KIND_STYLES`, `kindStyle(kind)` gives `{ color, glyph, labelKey }`.
- `lib/payment-countries.ts`: `usePaymentCountries()`, `loadPaymentCountries()`
  (Next `/api/payment-countries` proxy, cached), `FALLBACK_PAYMENT_COUNTRIES`,
  `countryName(country, locale)` (Intl.DisplayNames).
- `lib/template-deck.ts`: `loadTemplateDeck(templateId)` gives
  `{ deck, slides, tokens, assetUrl }` from the new API route (below), cached.
- `lib/sign-out.ts`: `signOut()` (shared by the account menu).

## Composer (`components/composer`)

`Composer` (`Composer.tsx`, forwardRef `ComposerHandle { focus(); setText(text) }`):

| Prop | Meaning |
|---|---|
| `value`, `onChange`, `onSubmit` | prompt text; Enter submits, Shift Enter new line |
| `files?`, `onAddFiles?`, `onRemoveFile?` | attachments (the + button and file drop work when `onAddFiles` is set) |
| `tileId`, `onTileChange`, `enabledKinds` | starting type (`HomeTileId` from `components/home/home-kinds.ts`) |
| `deckFormat?`, `onDeckFormatChange?` | slides ratio chip (16:9, 4:3, 9:16...) |
| `designSystems?`, `designSystemId?`, `onDesignSystemChange?`, `showDesignSystems?`, `manageDesignSystemsHref?` | design system chip, options `{ id, name, scope?, preview? }` |
| `codeMode?`, `onCodeModeChange?` | the `<>` toggle (omitted when not given) |
| `hideModel?`, `upgradeHref?` | model chip (see ModelMenu) |
| `busy?`, `alerts?`, `suggestions?`, `hint?`, `hintRight?` | state and helper rows |
| `showKinds?`, `kindsDefaultOpen?` | "Choose a starting type" panel with the kind grid |
| `staticPlaceholder?` | disable the typewriter placeholder |
| `variant?: "hero"\|"compact"`, `className?` | size |

Pieces also exported: `ModelMenu({ disabled?, upgradeHref? })` (Auto by default,
models from `/auth/forge/models`, choice stored under the builder key
`CHAT_MODEL_KEY`; picking is gated by `entitlements.model_selection`, others see
a plan note and upgrade link; no call when signed out), `DesignSystemMenu`,
`DesignSystemSwatch`, `KindPict` (tile pictograms).

Wired today on `app/dashboard/page.tsx` (overview create flow). Usage:

```tsx
<Composer
  ref={composerRef}
  value={prompt}
  onChange={setPrompt}
  onSubmit={create}
  tileId={tile}
  onTileChange={selectTile}
  enabledKinds={enabledKinds}
  designSystems={designSystems}
  designSystemId={dsId}
  onDesignSystemChange={setDsId}
  manageDesignSystemsHref="/dashboard?tab=design-systems"
  busy={creating}
/>
```

## Template cards (`components/templates`)

- `TemplateCard` (`TemplateCard.tsx`): `template: GalleryTemplate`, `href?` or
  `onClick?`, `index?` (stagger), `subtitle?`, `useLabel?`, `busy?`, `disabled?`.
  Slides templates show the real deck: first slide at rest, autoplay on hover
  or focus (one card plays at a time, touch devices play the card centred in
  the viewport), dots, slide count, "Use" button. Other kinds show the
  template preview image.
- `DeckThumb` (`DeckThumb.tsx`): `templateId`, `playing`, `onIndex?`,
  `onCount?`, `onMissing?`. Loads only near the viewport, uses the deck
  player's `SlideView mode="thumbnail"`, advances every `DECK_AUTOPLAY_MS` (1100 ms).
- Grid: wrap cards in `.f-tgrid` (3, 2, 1 columns). On the cream band use `.f-paper`.

```tsx
<div className="f-tgrid">
  {templates.map((tpl, i) => (
    <TemplateCard key={tpl.id} template={tpl} index={i} onClick={() => useTemplate(tpl)} />
  ))}
</div>
```

## Shell (`components/shell`)

`AppShell` (`AppShell.tsx`): `children`, `active: AppNavId | null`, `title?`,
`actions?`, `chrome?: "app"|"bare"`, `fill?`, `defaultCollapsed?`, `storageKey?`
(default `SIDEBAR_KEY` = `forge_home_sidebar`, same key as before).

- Sidebar: logo, "New project" (`N` shortcut), nav groups from `nav.ts`,
  collapsible (remembered), `FrodiCard` at the bottom (plan, stepped meter,
  reset date, upgrade). No RODI anywhere in the shell.
- Topbar: title, Ctrl K / Cmd K search (`CommandPalette`: projects + pages),
  `actions`, FR/EN switch, theme toggle, GitHub link, account menu (profile,
  billing, settings, website, sign out).
- Under 900px: sidebar hidden, drawer button, bottom bar with a central
  Create button (goes to `/dashboard#create`, which focuses the composer).
- `chrome="bare"`: no chrome, full viewport (the builder).
- `fill`: main area without max width and padding.

`nav.ts`: `AppNavId` (`home | create | projects | templates | integrations |
team | billing | settings | profile | website`), `APP_ROUTES`, `APP_NAV`
(groups, `teamOnly` links shown on team plans), `GITHUB_URL`.
**Phase 2: update `APP_ROUTES` when pages move**; today projects and templates
are dashboard tabs.

`FrodiCard({ compact? })`, helpers `daysUntil(iso)`, `formatCount(n, locale)`.

Old shell compatibility: `components/HomeLayout.tsx` keeps `HomeLayout` /
`HomeShell` and their props and now renders `AppShell` (so every existing page
already sits in the new shell; `showTopbar={false}` maps to `chrome="bare"`).
Phase 2 pages should import `AppShell` directly.

```tsx
<AppShell active="billing" title={t("uiNavBilling")}>
  <div className="f-page-head"><h1>...</h1></div>
  ...
</AppShell>
```

## API addition

`GET /templates/{template_id}/deck` (FastAPI, `apps/api/app/routers/templates.py`):
returns `{ deck, slides, design }` for a slides kit (slides in deck order,
max 40), 404 for unknown ids, other kinds, or when the slides kind is off.
Cached 5 minutes. Tests: `apps/api/tests/test_template_deck_endpoint.py`.
Backward compatible (new route only).

## Behaviour notes for phase 2

- Picking a starting type no longer jumps to the template gallery; it only sets the kind.
- A new "Onboarding" tile exists in `home-kinds.ts` (mobile kind, gallery query `onboarding`).
- The overview composer has no code-mode toggle and no attach menu (not passed);
  both are props when a page wants them.
- No notifications bell (no backend for it).
- Wrap custom grid layouts with `minmax(0, 1fr)` columns; `.f-composer-root`
  and `.f-tcard` already set `min-width: 0`.
