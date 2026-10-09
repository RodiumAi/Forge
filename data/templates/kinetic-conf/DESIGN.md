# Design charter

## Template
- id: kinetic-conf
- name: Kinetic 2027 Conference

## Colors
- --bg: #ffffff
- --fg: #111111
- --muted: #6b6b6b
- --accent: #ff5941

Secondary hard blocks: #0000ff (electric blue) and #00ff85 (signal green) used as full-bleed section backgrounds and tags only.

## Typography
- Font stack: "Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif (system fonts, no web fonts).
- Body: 1rem, line-height 1.5, antialiased.
- Marquee words: clamp(56px, 10vw, 128px), weight 900, line-height 1, letter-spacing -0.04em, uppercase; outline words use a 2px text stroke.
- Section h2: clamp(40px, 6vw, 72px), weight 900, line-height 1, uppercase. Block titles: clamp(32px, 5vw, 56px), weight 900, line-height 1.1.
- Big numbers: 56px stats, 52px ticket prices, weight 900, letter-spacing -0.04em.
- Body copy: 17px to 19px in --muted. UI labels, nav, buttons and tags: 12px to 14px, weight 700 to 900, uppercase, letter-spacing 0.05em to 0.08em.

## Spacing & radius
- Side padding: 16px on mobile, 32px from 641px. Content max-width 1200px.
- Section and block padding: 96px vertical. Hero: 48px top, 64px bottom.
- Gaps: 32px in speaker and ticket grids, 56px in the venue grid, 12px to 16px between tags and buttons.
- Borders: 2px solid #111 for rules and the accordion, 3px for photos and tickets.
- Radius: 0 everywhere.
- Breakpoints (mobile first): 641px (two columns, nav links) and 961px (three or four columns, two-column venue).

## Tone
Loud, kinetic, design-agency confident. Massive uppercase type, alternating outline/filled words, opposing marquee lines. Copy is short and punchy.

## Do / Don't
- Do keep the opposing marquee hero (two rows scrolling in opposite directions, outline + filled words alternating).
- Do use hard flat color blocks (#ff5941, #0000ff, #00ff85) on white — no gradients, no shadows.
- Do keep speaker photos duotone via CSS filter (grayscale + accent overlay).
- Don't soften the palette or add rounded corners beyond 0-4px.
- Don't add more than the three secondary block colors.

## Images
- Speakers: https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=70
- https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=70
- https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=70
- https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=70
- Venue: https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=70

Reuse these Unsplash URLs; do not hotlink other domains.
