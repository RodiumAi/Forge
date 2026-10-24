# Design charter: Proposition commerciale

## Template
- id: slides-sales-proposal
- name: Sales proposal (Proposition commerciale)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #FFFFFF (slide background)
- `--surface`: #F3F6FB (cards, panels and quote slides)
- `--fg`: #0F172A (main text)
- `--muted`: #5A6578 (secondary text, captions)
- `--accent`: #0F766E (brand accent: bars, numbers, icons)
- `--accent-2`: #F97316 (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #E2E8F0 (hairlines, table borders)

## Typography
- Display font: Outfit
- Body font: Inter
- Mono font: JetBrains Mono
- Display weight: 600
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 18 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: text on the left, rounded photo inset on a --surface backdrop on the right
- text (s2): heading, bullet or numbered list, side panel with icon and callout (or code)
- two-columns (s3): heading and two --surface cards, each with an icon badge, subheading and paragraph
- section (s4): big section number, title and one line
- image-text (s5): photo on the left half, kicker, heading, paragraph and list on the right
- timeline (s6): heading and four milestones on a horizontal line
- key-figures (s7): heading and three or four figure cards
- chart (s8): heading, editable chart on the left, takeaway on the right
- table (s9): heading and a full width table with a header row
- team (s10): heading and four --surface cards (square initials avatar, name, role, one line)
- quote (s11): large quote mark, quote, author and role
- thank-you (s12): closing title, subtitle and two contact lines with icons

## Style
- Header accent: the kicker set in --accent-contrast inside an --accent pill.
- Background pattern on content slides: a --surface band behind the header (y 0 to 336) (shapes, z 0).
- A --border hairline sits above the footer (y 978).

## Transitions
- Preset: Sobre (sober): fade between slides (500 ms), lists and figures appear one after the other.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Scènes de travail réelles et lumineuses : réunions, signatures, ateliers, sans visage face caméra.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: handshake meeting, contract signing desk, team workshop sticky notes, customer service.
- `public/images/meeting.webp`: Poignée de main au-dessus d'une table de réunion, by geralt (https://pixabay.com/photos/shaking-hands-handshake-hands-3091906/)
- `public/images/workshop.webp`: Mains posant des notes adhésives sur une table, by Nappiness (https://pixabay.com/photos/brainstorming-business-professional-441010/)

## Tone
Client-centred, precise, reassuring. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
