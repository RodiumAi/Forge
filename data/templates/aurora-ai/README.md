# Aurora AI

Premium dark landing page for an AI SaaS product (React + Vite). Deep black canvas, drifting aurora gradients, glassmorphism cards and a 3D-tilted dashboard mockup.

## Sections

Nav (sticky, burger menu on mobile), Hero with tilted mockup and floating status cards, Logos, Stats, Features grid, Showcase (image + key points), Pricing with a monthly/yearly toggle, Testimonials, final CTA panel, Footer.

## File structure

```
src/
  main.tsx              entry point (createRoot)
  App.tsx               composes the sections inside <div className="home-screen">
  index.css             foundation: tokens, reset, base type, .container, aurora background,
                        .glass, nav, buttons, .pill, .section-head, footer
  styles/home.css       section styles, every selector scoped under .home-screen
  components/
    AuroraBackground.tsx  Brand.tsx  Nav.tsx  Hero.tsx  Logos.tsx  Stats.tsx
    Features.tsx  Showcase.tsx  Pricing.tsx  Testimonials.tsx  Cta.tsx  Footer.tsx
```

Icons come from `lucide-react`. CSS is mobile first: base rules are the phone layout, wider layouts live in `@media (min-width: 641px)` and `@media (min-width: 961px)`.

## Adapting it

- Product name and logo: `components/Brand.tsx`.
- Copy and data: each section keeps its own data array at the top of its component (features, tiers, testimonials, stats, logos).
- Colors: change the tokens in `:root` in `src/index.css` (see `DESIGN.md`).
- New section: add `components/MySection.tsx`, render it in `App.tsx`, style it in `styles/home.css` under `.home-screen`.

## Scripts

- `npm install`
- `npm run dev` (http://localhost:5173)
- `npm run build`
