# Maison Vernet (atelier-mode)

An editorial luxury fashion storefront: ivory and ink with a single gold
accent, thin serif headlines and full-bleed photography.
React 18 + TypeScript + plain CSS, icons from `lucide-react`.

## Sections

1. Announcement strip.
2. Topbar: menu toggle on small screens (`useState`), nav, centered brand, search and cart links.
3. Hero: full-bleed editorial photo with season kicker, title and ghost button.
4. Marquee: looping serif band.
5. Lookbook: offset four-look grid on desktop, stacked on phones.
6. Shop: minimal product cards with hover reveal and prices.
7. Heritage: photo and dated maison timeline.
8. Services: three numbered service cards.
9. Journal: three atelier notes.
10. Newsletter: underlined email form with a thank-you state.
11. Footer: brand, three columns and the base line.

## File structure

```
src/
  main.tsx            entry, createRoot
  App.tsx             composes the sections inside <div className="home-screen">
  data.ts             lookbook, products, heritage dates and journal notes
  components/         one file per section (Announce, Topbar, Hero, Marquee, Lookbook, Shop, Heritage, Services, Journal, Newsletter, Footer)
  index.css           foundation: tokens, reset, base type, announcement, topbar, buttons, section heads, footer
  styles/home.css     section styles and keyframes, every rule scoped under .home-screen
```

CSS is mobile first: base rules are the phone layout, wider layouts live in
`@media (min-width: 561px)` and `@media (min-width: 961px)` blocks.

## Adapting it

- Rename the maison in `Topbar.tsx`, `Footer.tsx` and the copy in each section.
- Edit looks, products, dates and notes in `src/data.ts`.
- Recolor through the `:root` tokens in `src/index.css` (keep them in sync with `DESIGN.md`).
- Add a section as a new component plus its rules in `styles/home.css` under `.home-screen`.
