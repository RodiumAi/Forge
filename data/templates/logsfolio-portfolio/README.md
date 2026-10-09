# Developer Portfolio (Logsfolio)

A dark, single-page developer portfolio for a fictional engineer, Mira Solano. Near-black background, teal accent, code-flavored section headings and a resume that reads like a well-kept changelog.

## Sections

1. Nav: brand mark and anchor links to every section.
2. Hero: round avatar, greeting, short bio and two buttons.
3. Experience: role cards with company, period and bullet points.
4. Projects: three cards with a photo, tech tags, blurb and links.
5. Education: degree cards with school and detail.
6. Testimonials: two quotes with avatar and attribution.
7. Blogs: two post teasers.
8. Footer: a one-line sign-off.

## File structure

```
src/
  main.tsx              React entry (createRoot)
  App.tsx               composes the sections inside <div className="home-screen">
  index.css             foundation: tokens, reset, base type, .container, .section, text utilities, nav, buttons, footer
  styles/home.css       section styles, every selector scoped under .home-screen
  components/
    Nav.tsx  Hero.tsx  Experience.tsx  Projects.tsx  Education.tsx  Testimonials.tsx  Blogs.tsx  Footer.tsx
```

## Adapting it

- Change the palette in the `:root` tokens of `src/index.css`.
- Each component keeps its own data array at the top (`EXPERIENCE`, `PROJECTS`, `EDUCATION`, `TESTIMONIALS`, `BLOGS`, `NAV`); edit those to make the portfolio yours.
- Every `.section` gets the `// ` heading prefix from the foundation, so a new section only needs a component and its rules in `src/styles/home.css` under `.home-screen`.
- `lucide-react` is available for icons if you add social links or contact buttons.
- Styles are mobile-first: base rules are the phone layout and `@media (min-width: 761px)` adds the multi-column grids.
