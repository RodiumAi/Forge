# Design charter: Atelier

## Template
- id: slides-workshop
- name: Workshop (Atelier)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #F4F1FF (slide background)
- `--surface`: #E7E0FF (cards, panels and quote slides)
- `--fg`: #1F1937 (main text)
- `--muted`: #625A80 (secondary text, captions)
- `--accent`: #6D28D9 (brand accent: bars, numbers, icons)
- `--accent-2`: #F59E0B (second chart series)
- `--accent-contrast`: #FFFFFF (text on --accent)
- `--border`: #D7CCF7 (hairlines, table borders)

## Typography
- Display font: Lexend
- Body font: Lexend
- Mono font: JetBrains Mono
- Display weight: 600
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 24 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: label, title, subtitle, meta
- text (s2): heading, bullet or numbered list, side panel with icon and callout (or code)
- two-columns (s3): heading and two --surface cards, each with an icon badge, subheading and paragraph
- timeline (s4): heading and four numbered milestone cards linked by chevrons
- section (s5): centered section number, title and one line
- image-text (s6): rounded photo inset on the left, kicker, heading, paragraph and list on the right
- key-numbers (s7): heading and three or four figure cards
- chart (s8): heading, takeaway on the left, editable chart on the right
- quote (s9): large quote mark, quote, author and role
- table (s10): heading and a full width table with a header row
- team (s11): heading and four --surface cards (square initials avatar, name, role, one line)
- thanks (s12): closing title and subtitle centered, two contacts side by side

## Style
- Header accent: the kicker set in --accent-contrast inside an --accent pill.
- Background pattern on content slides: a 7 x 4 grid of small --border dots in the top right corner (shapes, z 0).
- The side panel of text slides is filled with --accent, icon and callout in --accent-contrast.

## Transitions
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Tables d'atelier vues du dessus, mains, notes adhésives et feutres, ambiance de travail lumineuse.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: workshop sticky notes, hands brainstorming, whiteboard markers, coffee break table.
- `public/images/table.webp`: Mains posées sur des feuilles de travail pendant un atelier, by kaboompics (https://pixabay.com/photos/work-working-group-groupware-hands-791218/)
- `public/images/hands.webp`: Participants penchés sur une grande feuille, by ulrichw (https://pixabay.com/photos/idea-brainstorming-teamwork-meeting-2654148/)
- `public/images/marker.webp`: Feutre pour tableau blanc sur fond gris, by manseok_Kim (https://pixabay.com/photos/pen-vod-maca-board-marker-1080215/)

## Tone
Inviting, energetic, practical. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
