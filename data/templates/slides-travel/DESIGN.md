# Design charter: Voyage

## Template
- id: slides-travel
- name: Travel journal (Voyage)
- kind: slides
- format: 16:9, 1920 x 1080

## Colors
- `--bg`: #F5F1E8 (slide background)
- `--surface`: #EAE2D2 (cards, panels and quote slides)
- `--fg`: #23302A (main text)
- `--muted`: #687466 (secondary text, captions)
- `--accent`: #D9822B (brand accent: bars, numbers, icons)
- `--accent-2`: #2F6F8F (second chart series)
- `--accent-contrast`: #23302A (text on --accent)
- `--border`: #D9CFBC (hairlines, table borders)

## Typography
- Display font: Young Serif
- Body font: Nunito Sans
- Mono font: Space Mono
- Display weight: 400
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
- Preset: Dynamique (dynamic): push to the left between slides (600 ms), titles rise, figures pop.
- The first slide fades in. Keep one transition type for the whole deck.

## Imagery
- Style: Lacs de montagne, ruelles ensoleillées, van et coucher de soleil, couleurs chaudes et naturelles.
- Source: Pixabay (free licence, author credited in each image element), converted to WebP under public/images.
- Pixabay search terms: mountain lake, beach sunset, old town street, road trip van.
- `public/images/lake.webp`: Lac de montagne turquoise et chalet, by TeeFarm (https://pixabay.com/photos/lake-mountains-hut-mountain-lake-1681485/)
- `public/images/beach.webp`: Plage au coucher du soleil, by Pok_Rie (https://pixabay.com/photos/sunset-beach-sand-rock-formations-1637376/)
- `public/images/street.webp`: Ruelle ensoleillée d'une vieille ville, by MarciMarc105 (https://pixabay.com/photos/palma-de-mallorca-alley-buildings-2900559/)
- `public/images/van.webp`: Camping-car garé sous les arbres d'automne, by Derekpics (https://pixabay.com/photos/camper-camper-van-forest-autumn-6728942/)

## Signature
- Kickers sit on a tilted strip of washi tape (--accent-2, translucent).
- Big soft sun and sea discs in the corners of content slides.
- Cover title set low on the photo; image slides use a tilted polaroid with a handwritten-like mono caption.

## Tone
Warm, curious, playful. One idea per slide, six lines at most, numbers put forward, short sentences.

## Do / Don't
- Do use theme tokens (`--fg`, `--accent`) for every color so a theme change restyles the deck.
- Do keep the accent bar above every heading; it carries the identity.
- Do credit every new image (source, author, page URL) in the element `credit`.
- Don't add a second accent family or more than two fonts plus the mono.
- Don't shrink body text under 22 px; split the slide instead.
- Contact details use the reserved `.example` domain: replace them with real ones.
