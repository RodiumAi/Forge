# terra-eco

Organic sustainability brand site for "Terra Collective": earthy greens and terracotta, blob-shaped
photos, inline SVG wave dividers between sections, impact counters, projects, certifications and a
signup call to action. React + Vite, no UI library; icons come from `lucide-react`.

## Sections

1. Nav: sticky topbar with brand, links and the main call to action
2. Hero: headline, actions and a blob-framed forest photo
3. Impact: four counters on a deep green band
4. Mission: three rules plus a photo and founder quote
5. Projects: alternating photo and text rows
6. Standards: four certification badges
7. Voices: three testimonials from the field
8. Join: email signup with a thank-you state
9. Footer: brand, three link columns and legal line

`Wave` is a small shared component (an organic SVG shape, not an icon) that `App.tsx` places
between sections.

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             composes the sections and waves inside <div className="home-screen">
  index.css           foundation: tokens, reset, typography, buttons, blobs, waves,
                      .section layout, nav, footer
  styles/home.css     section styles, every selector scoped under .home-screen
  components/         one file per section (Nav, Hero, Impact, Mission, Projects,
                      Standards, Voices, Join, Footer) plus Wave
```

The CSS is mobile first: base rules are the phone layout, `@media (min-width: 601px)` shows the
nav and widens paddings, `@media (min-width: 961px)` switches to the multi-column desktop grids.

## Adapting it

- Brand name: `Nav.tsx` and `Footer.tsx`.
- Counters, projects, badges and steps are arrays at the top of their components; icons are
  lucide components stored in the arrays.
- Wave colors are passed as `fill` props in `App.tsx`; keep them equal to the band they touch.
- Colors, blob radius and fonts live in `:root` in `index.css`.
- Run with `npm install`, `npm run dev` (http://localhost:5173) and `npm run build`.
