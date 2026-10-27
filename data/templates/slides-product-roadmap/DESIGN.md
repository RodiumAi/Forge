# Design charter: Roadmap produit

## Template
- id: slides-product-roadmap
- name: Product roadmap (Roadmap produit)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #0F1115 (slide background)
- `--surface`: #181B22 (cards, panels and quote slides)
- `--fg`: #ECEEF2 (main text)
- `--muted`: #9198A5 (secondary text, captions)
- `--accent`: #7C5CFF (brand accent: bars, numbers, icons)
- `--accent-2`: #2DD4BF (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #262A33 (hairlines, table borders)

## Typography
- Display font: Space Grotesk
- Body font: Inter
- Mono font: JetBrains Mono
- Display weight: 700
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 12 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: photo on the left half, label, title, subtitle and meta on the right
- text (s2): heading, bullet or numbered list, side panel with icon and callout (or code)
- section (s3): big section number, title and one line
- two-columns (s4): heading and two --surface cards, each with an icon badge, subheading and paragraph
- image-text (s5): rounded photo inset on the left, kicker, heading, paragraph and list on the right
- timeline (s6): heading and four numbered milestone cards linked by chevrons
- table (s7): heading and a full width table with a header row
- key-numbers (s8): heading and three or four figure cards
- chart (s9): heading, editable chart on the left, takeaway on the right
- quote (s10): large quote mark, quote, author and role
- team (s11): heading and four members (initials avatar, name, role, one line)
- thanks (s12): closing title, subtitle and two contact lines with icons

## Style
- Header accent: a hairline across the slide top with a short --accent segment.
- Background pattern on content slides: thin vertical --border lines dividing the canvas in nine columns (shapes, z 0).

## Transitions
- Preset: Sobre (sober): fade between slides (500 ms), lists and figures appear one after the other.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Routes, chemins et bornes, tableaux de notes adhésives : la progression, sous un voile nuit.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: road through mountains, milestones path, sticky notes board, sunrise horizon.
- `public/images/road.webp`: Route en lacets dans une vallée de montagne, by mariya_m (https://pixabay.com/photos/mallorca-winding-road-mountains-6957128/)
- `public/images/milestone.webp`: Borne kilométrique en pierre dans l'herbe, by WikimediaImages (https://pixabay.com/photos/kilometer-stone-distance-mark-sign-837828/)
- `public/images/notes.webp`: Mur couvert de notes adhésives colorées, by Pexels (https://pixabay.com/photos/sticky-notes-note-notice-board-1284667/)
- `public/images/sunrise.webp`: Lever de soleil sur une rivière sinueuse, by cowins (https://pixabay.com/photos/prairie-river-stream-curved-sunset-679014/)

## Tone
Clear, pragmatic, outcome-focused. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
