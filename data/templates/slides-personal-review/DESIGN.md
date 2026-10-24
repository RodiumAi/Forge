# Design charter: Bilan personnel

## Template
- id: slides-personal-review
- name: Year in review (Bilan personnel)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #1B1626 (slide background)
- `--surface`: #261F35 (cards, panels and quote slides)
- `--fg`: #F3EEFA (main text)
- `--muted`: #A79CBB (secondary text, captions)
- `--accent`: #F7A072 (brand accent: bars, numbers, icons)
- `--accent-2`: #9F86C0 (second chart series)
- `--accent-contrast`: #1B1626 (text on --accent)
- `--border`: #352C47 (hairlines, table borders)

## Typography
- Display font: Bricolage Grotesque
- Body font: Figtree
- Mono font: Space Mono
- Display weight: 800
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 28 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: label, title, subtitle, meta
- section (s2): big section number, title and one line
- text (s3): heading, bullet or numbered list, side panel with icon and callout (or code)
- two-columns (s4): heading, two columns each with icon, subheading and paragraph
- image-text (s5): photo on the left half, kicker, heading, paragraph and list on the right
- quote (s6): large quote mark, quote, author and role
- key-figures (s7): heading and three or four figure cards
- chart (s8): heading, editable chart on the left, takeaway on the right
- table (s9): heading and a full width table with a header row
- team (s10): heading and four members (initials avatar, name, role, one line)
- timeline (s11): heading and four milestones on a horizontal line
- thank-you (s12): closing title, subtitle and two contact lines with icons

## Transitions
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Feux d'artifice, carnets et lever de soleil en montagne, nuit violette et touches pêche.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: fireworks night, journal notebook, sunrise mountain, calendar desk.
- `public/images/fireworks.webp`: Feux d'artifice au-dessus d'une ville, by nck_gsl (https://pixabay.com/photos/new-years-eve-fireworks-city-sky-1953253/)
- `public/images/journal.webp`: Carnet ouvert et stylo plume, by Pexels (https://pixabay.com/photos/fountain-pen-note-notebook-page-1851096/)
- `public/images/sunrise.webp`: Lever de soleil sur des sommets enneigés, by yoshitaka2 (https://pixabay.com/photos/mountain-sunrise-snow-landscape-7866362/)

## Signature
- Confetti dots and a lilac halo in the top right corner of content slides.
- Kickers in a peach pill; centered cover with the year in huge type, centered quote and closing.
- Rounded inset photo; soft tinted initials for the people of the year.

## Tone
Warm, honest, celebratory. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
