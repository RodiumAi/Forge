# Design charter: Cours

## Template
- id: slides-course-lesson
- name: Lesson (Cours)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #FFF8EE (slide background)
- `--surface`: #FBEBD4 (cards, panels and quote slides)
- `--fg`: #2B2118 (main text)
- `--muted`: #6E5E4E (secondary text, captions)
- `--accent`: #2F7D4F (brand accent: bars, numbers, icons)
- `--accent-2`: #E8833A (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #EAD3B4 (hairlines, table borders)

## Typography
- Display font: Fraunces
- Body font: Nunito Sans
- Mono font: JetBrains Mono
- Display weight: 600
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 20 px. Gap between cards: 40 px.

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
- Preset: Sobre (sober): fade between slides (500 ms), lists and figures appear one after the other.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Nature en lumière naturelle, verts profonds et tons chauds, gros plans nets, sans texte incrusté.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: green leaf macro, forest sunlight trees, seedling plant soil, classroom notebook, microscope laboratory.
- `public/images/leaf.webp`: Gros plan d'une feuille verte rétroéclairée, by Schwoaze (https://pixabay.com/photos/leaves-leaf-walnut-leaf-spring-3420078/)
- `public/images/forest.webp`: Rayons de soleil dans une forêt, by ArtTower (https://pixabay.com/photos/forest-trees-sunlight-woods-56930/)
- `public/images/seedling.webp`: Jeune pousse sortant de la terre, by Nature_Design (https://pixabay.com/photos/investment-concept-business-finance-5241253/)

## Tone
Warm, clear, encouraging. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
