# quantum-consult

Premium consulting firm site for "Quantum Partners": a midnight-blue swiss grid with hairline rules,
massive key figures, pure-CSS donut and bar charts, case studies, leadership and a contact form.
React + Vite, no UI library; icons come from `lucide-react`.

## Sections

1. Nav: sticky topbar with wordmark, links and a mobile menu toggle
2. Hero: headline, actions and three side facts
3. Figures: four key numbers
4. Practices: four numbered practice areas
5. Evidence: conic-gradient donut and animated bar rows
6. Cases: three case studies with images
7. Leadership: three partner portraits
8. Contact: confidential inquiry form with a thank-you state
9. Footer: wordmark, links and offices

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             composes the sections inside <div className="home-screen">
  index.css           foundation: tokens, reset, typography, nav, footer, buttons, section rule
  styles/home.css     section styles, every selector scoped under .home-screen
  components/         one file per section (Nav, Hero, Figures, Practices, Evidence,
                      Cases, Leadership, Contact, Footer)
```

The CSS is mobile first: base rules are the phone layout, `@media (min-width: 561px)` adds the
tablet grid and `@media (min-width: 1001px)` the desktop grid.

## Adapting it

- Firm name: the wordmark in `Nav.tsx` and `Footer.tsx`, the address in `Contact.tsx`.
- Numbers: `figures` in `Figures.tsx`, the hero facts in `Hero.tsx`.
- Practice areas, chart data, cases and leaders are plain arrays at the top of each component.
- Colors live in `:root` in `index.css`; the donut slices use `--c1` to `--c4`.
- Run with `npm install` then `npm run dev`.
