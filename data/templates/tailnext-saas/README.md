# TailNext SaaS Landing

A clean, airy marketing landing page for a fictional release-communication SaaS called Pulsedeck. Light background, indigo accent, soft rounded cards and generous whitespace.

## Sections

1. Nav: brand, anchor links (hidden on mobile) and a primary call to action.
2. Hero: eyebrow, headline, lead, two buttons and a framed product photo.
3. Logos: a centered strip of partner name pills.
4. Gallery: three photos of the product in use.
5. Features: six cards with lucide icons in a three-column grid.
6. Pricing: three plans, the middle one highlighted with a "Most popular" badge.
7. Footer: brand blurb, contact and office details.

## File structure

```
src/
  main.tsx            React entry (createRoot)
  App.tsx             composes the sections inside <div className="home-screen">
  index.css           foundation: tokens, reset, base type, .container, nav, buttons, footer
  styles/home.css     section styles, every selector scoped under .home-screen
  components/
    Nav.tsx  Hero.tsx  Logos.tsx  Gallery.tsx  Features.tsx  Pricing.tsx  Footer.tsx
```

## Adapting it

- Change the brand colors in the `:root` tokens of `src/index.css`; every section reads them.
- Edit copy and data where it lives: the `features` array in `Features.tsx`, `plans` in `Pricing.tsx`, `partners` in `Logos.tsx`, `gallery` in `Gallery.tsx`.
- Icons come from `lucide-react`; swap one by importing another icon name.
- Styles are mobile-first: base rules are the phone layout and `@media (min-width: 761px)` adds the desktop grid.
- Add a new section as a component in `src/components/` and keep its rules in `src/styles/home.css` under `.home-screen`.
