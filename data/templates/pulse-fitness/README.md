# pulse-fitness (Pulse Club)

Energetic fitness club site: electric lime on near-black, condensed heavy italic caps, diagonal
clip-path section edges, huge stat numbers and animated progress bars. React + Vite + TypeScript;
icons come from `lucide-react`.

## Sections

1. Nav: sticky bar with logo, links, join button and a mobile menu toggle
2. Hero: full-bleed gym photo with the stacked headline
3. StatsBand: four big numbers between lime rules
4. Programs: diagonal lime band with three program cards
5. Results: animated skewed progress bars
6. Coaches: diagonal carbon band with three coach cards
7. Plans: three memberships, the middle one featured
8. Schedule: sample weekly timetable
9. FinalCta: lime closing call to action
10. Footer: address and two link columns

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             composes the sections inside <div className="home-screen">
  index.css           foundation: tokens, reset, utilities (.lime, .stroke), buttons, nav,
                      section frame, diagonal bands (.diag), footer
  styles/home.css     section styles, every selector scoped under .home-screen
  components/         one file per section (Nav, Hero, StatsBand, Programs, Results,
                      Coaches, Plans, Schedule, FinalCta, Footer)
```

The CSS is mobile first: base rules are the phone layout with the dropdown menu,
`@media (min-width: 701px)` shows the inline nav and two-column stats, and
`@media (min-width: 961px)` the three-column grids and four-column stats.

## Adapting it

- Club name and address: `Nav.tsx`, `Footer.tsx` and the hero kicker.
- Programs, stats, results, coaches, plans and schedule are arrays at the top of their components.
- Colors, the condensed font stack and `--gutter` live in `:root` in `index.css`.
- Run with `npm install`, `npm run dev` (http://localhost:5173) and `npm run build`.
