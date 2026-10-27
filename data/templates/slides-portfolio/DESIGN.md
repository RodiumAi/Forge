# Design charter: Portfolio

## Template
- id: slides-portfolio
- name: Portfolio (Portfolio)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #F4EFE8 (slide background)
- `--surface`: #EAE1D4 (cards, panels and quote slides)
- `--fg`: #1C1A17 (main text)
- `--muted`: #675E55 (secondary text, captions)
- `--accent`: #A84B25 (brand accent: bars, numbers, icons)
- `--accent-2`: #5B6B4E (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #D6CAB9 (hairlines, table borders)

## Typography
- Display font: Playfair Display
- Body font: DM Sans
- Mono font: IBM Plex Mono
- Display weight: 600
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 4 px. Gap between cards: 40 px.

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
- Style: Intérieurs baignés de lumière naturelle, matières brutes, natures mortes, palette chaude et désaturée.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: interior design living room, ceramic vase still life, minimal architecture concrete, design studio desk, linen texture.
- `public/images/living-room.webp`: Séjour lumineux avec escalier en acier, by Life-Of-Pix (https://pixabay.com/photos/apartment-accommodation-flat-loft-406901/)
- `public/images/still-life.webp`: Bouquet de dahlias dans un pichet en faïence, by MsErinEast (https://pixabay.com/photos/dahlia-flowers-vase-blossom-4494586/)
- `public/images/concrete.webp`: Ouverture circulaire dans un mur de béton, by Broesis (https://pixabay.com/photos/concrete-architecture-hole-wall-2420845/)
- `public/images/studio.webp`: Bureau de designer vu du dessus, by TRDStudios (https://pixabay.com/photos/studio-design-coffee-x-pen-apple-4800295/)

## Tone
Refined, warm, understated. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
