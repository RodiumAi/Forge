# forge-devtools

A dark developer-tool landing page for a fictional bundle forensics CLI, Hexbin. GitHub-dark palette, green and violet accents, monospace where it matters and a terminal window as the hero visual.

## Sections

1. Nav: brand mark, anchor links (hidden below 641px), star count and install button.
2. Hero: release badge, gradient headline, install box with npm, pnpm and brew tabs plus a copy button, and an animated terminal mockup.
3. Features: six cards with lucide icons and glow borders on hover.
4. Compare: a before and after table.
5. Integrations: six adapter tiles.
6. Open source: license pitch, two buttons and GitHub stats.
7. Testimonials: three quotes reusing the feature card style.
8. CTA: closing line and a one-command snippet.
9. Footer: brand, three link columns and a bottom bar.

## File structure

```
src/
  main.tsx              React entry (createRoot)
  App.tsx               composes the sections inside <div className="home-screen">
  index.css             foundation: tokens, reset, base type, page shell, topbar, buttons, section headings, utilities, footer
  styles/home.css       section styles, every selector scoped under .home-screen
  components/
    Nav.tsx  Hero.tsx  InstallBox.tsx  Terminal.tsx  Features.tsx  Compare.tsx
    Integrations.tsx  OpenSource.tsx  Testimonials.tsx  Cta.tsx  Footer.tsx
```

## Adapting it

- Change the palette in the `:root` tokens of `src/index.css` (`--accent` green, `--violet` secondary).
- Edit content where it lives: `FEATURES` in `Features.tsx`, `COMPARE` in `Compare.tsx`, `INTEGRATIONS` in `Integrations.tsx`, `GH_STATS` in `OpenSource.tsx`, `TERMINAL_LINES` in `Terminal.tsx` (each part has a color key, or an icon).
- The install tabs and copy state live in `InstallBox.tsx`.
- Icons come from `lucide-react`; swap one by importing another icon name.
- Styles are mobile-first: base rules are the phone layout, `@media (min-width: 641px)` and `@media (min-width: 961px)` add the wider grids.
- Run it with `npm install`, then `npm run dev` (http://localhost:5173) or `npm run build`.
