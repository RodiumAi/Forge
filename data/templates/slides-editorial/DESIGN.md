# Design charter: Éditorial

## Template
- id: slides-editorial
- name: Editorial (Éditorial)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #F7F3EC (slide background)
- `--surface`: #EFE8DC (cards, panels and quote slides)
- `--fg`: #141414 (main text)
- `--muted`: #5C574F (secondary text, captions)
- `--accent`: #B3261E (brand accent: bars, numbers, icons)
- `--accent-2`: #141414 (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #DDD4C4 (hairlines, table borders)

## Typography
- Display font: EB Garamond
- Body font: Newsreader
- Mono font: IBM Plex Mono
- Display weight: 500
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 0 px. Gap between cards: 40 px.

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
- Preset: Élégant (elegant): morph between slides (800 ms): the accent bar and the title share matchKeys (`accent-bar`, `slide-title`) and glide from slide to slide; titles use a mask reveal.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Bibliothèques, plumes et papier journal, tons chauds et sépia, sans visage reconnaissable.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: newspaper texture, reading room, ink pen paper, black and white portrait from behind.
- `public/images/library.webp`: Salle de lecture boisée avec bibliothèques, by wal_172619 (https://pixabay.com/photos/library-setup-books-read-stately-5219747/)
- `public/images/pen.webp`: Plume posée sur une feuille dans la lumière du soir, by tehzeebkazmi (https://pixabay.com/photos/fountain-pen-write-calligraphy-6200263/)
- `public/images/newspaper.webp`: Pages de journal anciennes en gros plan, by Pezibear (https://pixabay.com/photos/newspaper-daily-newspaper-newsprint-671630/)

## Signature
- Newspaper rules above each heading: a thick ink rule and a hairline, kicker in red.
- Faint column lines split content slides into four columns, like a magazine grid.
- Captioned photo with a rule; the cover puts the photo on the left; big outlined section numbers.

## Tone
Literate, measured, curious. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
