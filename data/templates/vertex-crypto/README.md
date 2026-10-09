# Vertex Crypto (vertex-crypto)

A dark fintech and crypto exchange landing page: glass cards with gradient
borders, pure CSS charts and sparklines, price tickers and a neon accent.
React 18 + TypeScript + plain CSS, icons from `lucide-react`.

## Sections

1. Backdrop: two fixed ambient glows.
2. Ticker bar: scrolling price chips with gains and losses.
3. Nav: brand mark, links (hidden on phones), log in and get started buttons.
4. Hero: pill, title, intro, CTAs, trust row and a trading panel with tabs (`useState`) and a CSS bar chart.
5. Stats: four key numbers.
6. Markets: four cards with price, change and CSS sparkline.
7. Features: six glass cards with icons.
8. Security: photo with a floating badge and four security points.
9. CTA: closing panel with two buttons and fine print.
10. Footer: brand, three link columns and base line.

## File structure

```
src/
  main.tsx            entry, createRoot
  App.tsx             composes the sections inside <div className="home-screen">
  data.ts             tickers, stats, features, chart bars and security points (with their lucide icons)
  components/         one file per section, plus BrandMark (the logo shape)
  index.css           foundation: tokens, reset, base type, container, glass card, nav, buttons, pill, section heads, footer
  styles/home.css     section styles and keyframes, every rule scoped under .home-screen
```

CSS is mobile first: base rules are the phone layout, wider layouts live in
`@media (min-width: 641px)` and `@media (min-width: 961px)` blocks.

## Adapting it

- Rename the exchange in `Nav.tsx`, `Footer.tsx` and the copy in each section.
- Edit tickers, stats, features and security claims in `src/data.ts`.
- Recolor through the `:root` tokens in `src/index.css` (keep them in sync with `DESIGN.md`).
- Add a section as a new component plus its rules in `styles/home.css` under `.home-screen`.
