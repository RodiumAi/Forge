# Bloom Studio (bloom-wellness)

A serene spa and wellness studio site: powder rose and sage gradients over
warm off-white, very rounded cards and soft shadows.
React 18 + TypeScript + plain CSS, icons from `lucide-react`.

## Sections

1. Nav: floating pill bar with logo, links and a mobile menu toggle (`useState`).
2. Hero: title, intro, two CTAs, trust badges and a floating photo with an opening-hours chip.
3. Treatments: six cards with icon tile, description, duration and price.
4. Schedule: day tabs (`useState`) and the selected class card.
5. Ritual: layered photos and four numbered steps.
6. Stories: three guest testimonials.
7. Plans: three memberships, the middle one featured.
8. Visit: photo and booking call to action.
9. Footer: brand, links and base line.

## File structure

```
src/
  main.tsx            entry, createRoot
  App.tsx             composes the sections inside <div className="home-screen">
  data.ts             treatments (with their lucide icons), schedule, ritual, testimonials, memberships
  components/         one file per section (Nav, Hero, Treatments, Schedule, Ritual, Stories, Plans, Visit, Footer)
  index.css           foundation: tokens, reset, base type, nav, buttons, section heads, footer
  styles/home.css     section styles and keyframes, every rule scoped under .home-screen
```

CSS is mobile first: base rules are the phone layout, the desktop layout lives in
`@media (min-width: 961px)` blocks.

## Adapting it

- Rename the studio in `Nav.tsx`, `Footer.tsx` and the copy in each section.
- Edit treatments, classes, steps, stories and plans in `src/data.ts`; pick treatment icons from lucide-react.
- Recolor through the `:root` tokens in `src/index.css` (keep them in sync with `DESIGN.md`).
- Add a section as a new component plus its rules in `styles/home.css` under `.home-screen`.
