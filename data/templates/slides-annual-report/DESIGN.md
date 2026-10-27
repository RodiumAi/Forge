# Design charter: Rapport annuel

## Template
- id: slides-annual-report
- name: Annual report (Rapport annuel)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #FBFAF7 (slide background)
- `--surface`: #F1EDE4 (cards, panels and quote slides)
- `--fg`: #1F1D1A (main text)
- `--muted`: #6A655C (secondary text, captions)
- `--accent`: #1E5B4F (brand accent: bars, numbers, icons)
- `--accent-2`: #C08A2E (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #DDD6C8 (hairlines, table borders)

## Typography
- Display font: Newsreader
- Body font: Public Sans
- Mono font: IBM Plex Mono
- Display weight: 500
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 6 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: photo background with a --bg veil, label, title, subtitle and meta centered
- quote (s2): centered quote, author and role on --surface
- section (s3): centered section number, title and one line
- key-figures (s4): heading and three or four figures under accent rules, no cards
- chart (s5): heading, takeaway on the left, editable chart on the right
- table (s6): heading and a full width table with a header row
- image-text (s7): rounded photo inset on the left, kicker, heading, paragraph and list on the right
- two-columns (s8): heading, two columns each with icon, subheading and paragraph
- team (s9): heading and four members (initials avatar, name, role, one line)
- timeline (s10): heading and four milestones on a horizontal line
- text (s11): heading, bullet or numbered list, side panel with icon and callout (or code)
- thank-you (s12): closing title and subtitle centered, two contacts side by side

## Style
- Header accent: a hairline across the slide top with a short --accent segment.
- Background pattern on content slides: a thin --border frame inset 40 px from the edges (shapes, z 0).
- A --border hairline sits above the footer (y 978).

## Transitions
- Preset: Élégant (elegant): morph between slides (800 ms): the accent bar and the title share matchKeys (`accent-bar`, `slide-title`) and glide from slide to slide; titles use a mask reveal.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Paysages agricoles vus du ciel, lumière du matin, ateliers et équipes de dos, sous un voile crème.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: aerial landscape fields, city sunrise, factory modern, people working together from behind.
- `public/images/fields.webp`: Champs cultivés vus du ciel, by nbthang (https://pixabay.com/photos/rice-fields-agriculture-7247360/)
- `public/images/sunrise.webp`: Lever de soleil sur une ville, by soultrain (https://pixabay.com/photos/sunset-nature-city-twilight-8170058/)
- `public/images/plant.webp`: Façade industrielle moderne en acier et verre, by andysgreen (https://pixabay.com/photos/london-industrial-building-uk-2220916/)
- `public/images/team.webp`: Silhouettes d'une équipe qui saute de joie, by Broesis (https://pixabay.com/photos/friendship-fun-backlighting-2366955/)

## Tone
Measured, transparent, institutional. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
