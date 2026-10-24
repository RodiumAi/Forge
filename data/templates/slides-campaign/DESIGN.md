# Design charter: Campagne marketing

## Template
- id: slides-campaign
- name: Marketing campaign (Campagne marketing)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #FFFDF5 (slide background)
- `--surface`: #FFF1C2 (cards, panels and quote slides)
- `--fg`: #1A1A1A (main text)
- `--muted`: #5E5A4E (secondary text, captions)
- `--accent`: #FF3D7F (brand accent: bars, numbers, icons)
- `--accent-2`: #3B82F6 (second chart series)
- `--accent-contrast`: #1A1A1A (text on --accent)
- `--border`: #EFE3B5 (hairlines, table borders)

## Typography
- Display font: Bricolage Grotesque
- Body font: Figtree
- Mono font: Space Mono
- Display weight: 700
- Scale on the 1920 x 1080 canvas: cover title 88 to 160 px, section title 88 px, slide heading 64 px,
  column heading 40 px, body 28 to 34 px, captions 22 to 24 px, labels 24 px uppercase with 3 px tracking.
- Line height: 1.05 to 1.1 for titles, 1.45 to 1.55 for body text.

## Spacing & radius
- Safe margins: 140 px left and right, content starts at y 100 (accent bar) and ends at y 960.
- Footer: deck name at x 140, page number right aligned at x 1660, both at y 1000, 20 px, `--muted`.
- Card and panel radius: 26 px. Gap between cards: 40 px.

## Layouts
One example slide per layout; reuse these positions when adding slides.
- title (s1): cover: photo on the left half, label, title, subtitle and meta on the right
- text (s2): heading, bullet or numbered list, side panel with icon and callout (or code)
- quote (s3): full --accent background, quote in --accent-contrast
- section (s4): centered section number, title and one line
- two-columns (s5): heading and two --surface cards, each with an icon badge, subheading and paragraph
- image-text (s6): kicker, heading, paragraph and list on the left, photo on the right half
- key-figures (s7): heading and figure cards, the first card filled with --accent
- chart (s8): heading, takeaway on the left, editable chart on the right
- timeline (s9): heading and four numbered milestone cards linked by chevrons
- table (s10): heading and a full width table with a header row
- team (s11): heading and four members (initials avatar, name, role, one line)
- thank-you (s12): closing title and subtitle centered, two contacts side by side

## Style
- Header accent: the kicker set in --accent-contrast inside an --accent pill.
- Background pattern on content slides: a soft --accent glow (opacity 0.12) in the top right corner (shapes, z 0).

## Transitions
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Foules en couleurs, affiches urbaines, téléphones et réseaux sociaux, énergie estivale sous un voile clair.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: colorful crowd festival, billboard city, megaphone, social media phone.
- `public/images/crowd.webp`: Foule en fête sous des nuages de poudre colorée, by skvarel (https://pixabay.com/photos/party-holi-happy-summer-people-4926252/)
- `public/images/billboard.webp`: Fête foraine en plein air au coucher du soleil, by 1139623 (https://pixabay.com/photos/carnival-festival-carousel-festive-2570021/)
- `public/images/megaphone.webp`: Personnages 3D avec un mégaphone, by kirill_makes_pics (https://pixabay.com/photos/businessman-man-afraid-angry-3036181/)
- `public/images/phone.webp`: Main tenant un téléphone sur un fil d'actualité, by Erik_Lucatero (https://pixabay.com/photos/technology-smartphone-telephone-3353701/)

## Tone
Playful, energetic, punchy. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
