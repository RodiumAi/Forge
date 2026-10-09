# origami-3d (Foldspace 3D)

Product landing page for "Foldspace", a browser-native prototyping tool, built around real CSS 3D
constructions: a spinning preserve-3d cube, hinged fold panels and isometric cards. No WebGL, no
canvas, no JS animation. React + Vite + TypeScript; icons come from `lucide-react`.

## Sections

1. Nav: sticky bar with logo, links and two actions
2. Hero: headline, actions and the CSS cube
3. HowItWorks: three hinged fold panels that open on hover
4. Features: three isometric cards
5. Workflow: layered depth planes with a case study, plus four stats
6. Pricing: monthly/yearly toggle and three plans
7. Faq: accordion with one open item
8. CtaBand: gradient call to action
9. Footer: logo and three link columns

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             composes the sections inside <div className="home-screen">
  index.css           foundation: tokens, reset, buttons, nav, shared section frame
                      (.section, .section-head, .section-title, .eyebrow), footer
  styles/home.css     section styles, every selector scoped under .home-screen
  components/         one file per section (Nav, Hero, HowItWorks, Features, Workflow,
                      Pricing, Faq, CtaBand, Footer)
```

The CSS is mobile first: base rules are the single-column phone layout, `@media (min-width: 641px)`
shows the nav links and two-column stats and footer, `@media (min-width: 981px)` the desktop grids.

## Adapting it

- Product name: `Nav.tsx`, `Footer.tsx` and the hero copy.
- Fold steps, feature cards, stats, plans and FAQ entries are arrays at the top of their components.
- Cube face labels live in `Hero.tsx`; cube size is the 180px / 90px pair in `home.css`.
- Colors and the `--gutter` clamp live in `:root` in `index.css`.
- Run with `npm install`, `npm run dev` (http://localhost:5173) and `npm run build`.
