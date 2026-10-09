# lumen-architecture (Lumen Atelier)

Editorial architecture studio site: immense Georgia serif headlines, numbered sections, hairline
rules, an asymmetric project grid and a single amber accent. React + Vite + TypeScript; icons come
from `lucide-react`.

## Sections

1. Nav: sticky bar with logo, links and a mobile menu toggle
2. Hero: kicker, headline, lede, link and a full-bleed photo
3. Strip: practice facts separated by short rules
4. Work: asymmetric wide/narrow project grid (01)
5. Philosophy: photo, pull quote, text and principles list (02)
6. Services: four services on a hairline grid (03)
7. Studio: three principals (04)
8. Press: recognition list (05)
9. Contact: closing headline and email link
10. Footer: address and two link columns

## File structure

```
src/
  main.tsx            entry (createRoot)
  App.tsx             composes the sections inside <div className="home-screen">
  index.css           foundation: tokens, reset, .arrow utility, nav, shared section frame
                      (.section, .section-head, .section-num, .section-title, .section-sub), footer
  styles/home.css     section styles, every selector scoped under .home-screen
  components/         one file per section (Nav, Hero, Strip, Work, Philosophy, Services,
                      Studio, Press, Contact, Footer)
```

The CSS is mobile first: base rules are the single-column phone layout with the dropdown menu,
`@media (min-width: 721px)` shows the inline nav, `@media (min-width: 901px)` switches to the
asymmetric 12-column work grid and the multi-column sections.

## Adapting it

- Studio name and address: `Nav.tsx`, `Footer.tsx`, and the email in `Contact.tsx`.
- Projects (with `size: "wide"` or `"narrow"`), services, team and press are arrays at the top of
  their components. Keep wide and narrow cards alternating in pairs so each row fills 12 columns.
- Colors, fonts and `--gutter` live in `:root` in `index.css`.
- Run with `npm install`, `npm run dev` (http://localhost:5173) and `npm run build`.
