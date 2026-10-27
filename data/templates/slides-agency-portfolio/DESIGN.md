# Design charter: Portfolio d'agence

## Template
- id: slides-agency-portfolio
- name: Agency portfolio (Portfolio d'agence)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #111111 (slide background)
- `--surface`: #1C1C1C (cards, panels and quote slides)
- `--fg`: #F4F1EA (main text)
- `--muted`: #A39E93 (secondary text, captions)
- `--accent`: #F4D35E (brand accent: bars, numbers, icons)
- `--accent-2`: #EE6352 (second chart series)
- `--accent-contrast`: #111111 (text on --accent)
- `--border`: #2E2E2E (hairlines, table borders)

## Typography
- Display font: Archivo Black
- Body font: Instrument Sans
- Mono font: Space Mono
- Display weight: 400
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 0 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: photo on the left half, label, title, subtitle and meta on the right
- quote (s2): full --accent background, quote in --accent-contrast
- two-columns (s3): heading, two columns each with icon, subheading and paragraph
- section (s4): giant section number on the right, title and one line on the left
- image-text (s5): kicker, heading, paragraph and list on the left, photo on the right half
- key-numbers (s6): heading and three or four figures under accent rules, no cards
- chart (s7): heading, takeaway on the left, editable chart on the right
- table (s8): heading and a full width table with a header row
- text (s9): heading, bullet or numbered list, side panel with icon and callout (or code)
- team (s10): heading and four --surface cards (square initials avatar, name, role, one line)
- timeline (s11): heading and four milestones on a horizontal line
- thanks (s12): closing title and subtitle centered, two contacts side by side

## Style
- Header accent: an 80 x 8 accent bar above the kicker.
- Background pattern on content slides: a thin --border frame inset 40 px from the edges (shapes, z 0).
- Titles and headings are set in uppercase.

## Transitions
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Coulisses de studio : bureaux de création, murs d'affiches, éclairages photo, cadrages serrés.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: creative studio, graphic design desk, poster wall, photography studio lights.
- `public/images/studio.webp`: Pinceaux dans un pot sur fond de lumières, by ClickerHappy (https://pixabay.com/photos/brushes-painter-work-shop-bowl-3129361/)
- `public/images/desk.webp`: Bureau de création vu du dessus, by lukasbieri (https://pixabay.com/photos/laptop-mockup-graphics-tablet-2838921/)
- `public/images/posters.webp`: Mur d'affiches anciennes et colorées, by ha11ok (https://pixabay.com/photos/wall-painted-graffiti-devanagari-1108420/)
- `public/images/lights.webp`: Studio photo et ses projecteurs, by Pexels (https://pixabay.com/photos/photography-studio-photo-shoot-1850469/)

## Tone
Bold, confident, a little cheeky. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
