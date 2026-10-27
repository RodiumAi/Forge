# Design charter: Minimal sombre

## Template
- id: slides-minimal-dark
- name: Minimal dark (Minimal sombre)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #0A0A0A (slide background)
- `--surface`: #141414 (cards, panels and quote slides)
- `--fg`: #F2F2F2 (main text)
- `--muted`: #8F8F8F (secondary text, captions)
- `--accent`: #E8C468 (brand accent: bars, numbers, icons)
- `--accent-2`: #BDBDBD (second chart series)
- `--accent-contrast`: #0A0A0A (text on --accent)
- `--border`: #2A2A2A (hairlines, table borders)

## Typography
- Display font: Instrument Serif
- Body font: Instrument Sans
- Mono font: JetBrains Mono
- Display weight: 400
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 2 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: label, title, subtitle, meta
- section (s2): big section number, title and one line
- text (s3): heading, bullet or numbered list, side panel with icon and callout (or code)
- two-columns (s4): heading, two columns each with icon, subheading and paragraph
- image-text (s5): photo on the left half, kicker, heading, paragraph and list on the right
- quote (s6): large quote mark, quote, author and role
- key-numbers (s7): heading and three or four figure cards
- chart (s8): heading, editable chart on the left, takeaway on the right
- table (s9): heading and a full width table with a header row
- team (s10): heading and four members (initials avatar, name, role, one line)
- timeline (s11): heading and four milestones on a horizontal line
- thanks (s12): closing title, subtitle and two contact lines with icons

## Transitions
- Preset: Élégant (elegant): morph between slides (800 ms): the accent bar and the title share matchKeys (`accent-bar`, `slide-title`) and glide from slide to slide; titles use a mask reveal.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Photographies en noir et blanc, grands vides, horizons et textures, une seule forme dans le cadre.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: black and white architecture, minimal shadow light, minimal horizon sea, sand dune texture, monochrome stairs.
- `public/images/horizon.webp`: Portique torii au milieu d'un lac, en noir et blanc, by JordyMeow (https://pixabay.com/photos/tori-japanese-shrine-torii-1976609/)
- `public/images/dune.webp`: Crête d'une dune de sable en noir et blanc, by mokhaladmusavi (https://pixabay.com/photos/desert-sand-texture-pattern-shadow-7915031/)

## Tone
Quiet, thoughtful, essential. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
