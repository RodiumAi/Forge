# Design charter: Étude de marché

## Template
- id: slides-market-research
- name: Market research (Étude de marché)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #F6F7F4 (slide background)
- `--surface`: #FFFFFF (cards, panels and quote slides)
- `--fg`: #1B1F1A (main text)
- `--muted`: #5F665C (secondary text, captions)
- `--accent`: #3B6E3F (brand accent: bars, numbers, icons)
- `--accent-2`: #D96C3B (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #DCE1D6 (hairlines, table borders)

## Typography
- Display font: Schibsted Grotesk
- Body font: Work Sans
- Mono font: IBM Plex Mono
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
- title (s1): cover: photo band across the top half, title block below it
- text (s2): heading, bullet or numbered list, side panel with icon and callout (or code)
- key-numbers (s3): heading and three or four figure cards
- chart (s4): heading, editable chart on the left, takeaway on the right
- section (s5): big section number, title and one line
- two-columns (s6): heading, two columns each with icon, subheading and paragraph
- image-text (s7): round photo with an accent ring on the left, text column on the right
- quote (s8): centered quote, author and role on --surface
- table (s9): heading and a full width table with a header row
- team (s10): heading and four members (initials avatar, name, role, one line)
- timeline (s11): heading and four milestones on a horizontal line
- thanks (s12): closing title and subtitle centered, two contacts side by side

## Style
- Header accent: an --accent dot before the kicker.
- Background pattern on content slides: thin vertical --border lines dividing the canvas in nine columns (shapes, z 0).
- A --border hairline sits above the footer (y 978).

## Transitions
- Preset: Sobre (sober): fade between slides (500 ms), lists and figures appear one after the other.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Commerces, étals et rayons photographiés sur le vif, couleurs naturelles, clients de dos.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: market stall shopping, people shopping street, data analysis laptop, supermarket aisle.
- `public/images/stall.webp`: Échange de fruits sur un étal de marché, by Pexels (https://pixabay.com/photos/apples-farmers-market-buy-buying-1841132/)
- `public/images/street.webp`: Rue commerçante animée, by wal_172619 (https://pixabay.com/photos/shopping-street-pedestrian-zone-7924559/)
- `public/images/aisle.webp`: Rayons de fruits et légumes vus d'en haut, by ElasticComputeFarm (https://pixabay.com/photos/supermarket-stalls-coolers-market-949913/)

## Tone
Factual, curious, evidence-based. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
