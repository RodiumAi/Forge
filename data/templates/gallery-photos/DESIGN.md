# Template

- id: `gallery-photos`
- name: Photo Gallery

## Colors

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#faf8f5` | warm paper background |
| `--fg` | `#22201d` | near-black ink |
| `--muted` | `#8a8378` | captions, meta |
| `--accent` | `#c77b3f` | terracotta highlight, CTAs |
| `--soft` | `#efe9e0` | cards, chips, dividers |

## Typography

- Font stack: "Segoe UI", system-ui, sans-serif (system fonts, no web fonts).
- Body: 16px, line-height 1.6.
- Intro h1: clamp(28px, 5vw, 44px), weight 600. CTA h2: clamp(22px, 4vw, 32px), weight 600.
- Brand: 14px, weight 600, uppercase, letter-spacing 0.12em.
- Kicker: 12px uppercase, letter-spacing 0.2em, in --accent.
- UI text: 14px nav links and CTA button, 13px chips, captions and footer, 12px tile category.

## Spacing & radius

- Container: max-width 1100px with 24px side padding.
- Intro padding: 40px 0 20px on mobile, 64px 0 32px from 761px.
- Grid: 2 columns with 110px rows on mobile, 3 columns with 130px rows from 761px; gap 14px; tiles span 2 rows (tall tiles 3).
- CTA band: padding 56px 24px, 56px bottom margin.
- Radius: 10px tiles, 16px CTA band, 999px chips, nav links and buttons.

## Tone

Airy, warm, editorial. Lots of whitespace, thin dividers, quiet typography.
Tiles show real Unsplash photos (object-fit cover) over a gradient fallback.

## Images

All tiles use `https://images.unsplash.com/{ID}?auto=format&fit=crop&w=800&q=70`.

| URL | Role |
| --- | --- |
| https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=70 | Nature tile — "Fog Over the Pines" |
| https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=70 | Nature tile — "Forest Path" |
| https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=70 | Nature tile — "Alpine Ridge" |
| https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=800&q=70 | Urban tile — "Crosswalk at Dusk" |
| https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&q=70 | Urban tile — "Neon Alley" |
| https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=70 | Urban tile — "Rooftop Lines" |
| https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=70 | Architecture tile — "Concrete Curves" |
| https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=800&q=70 | Architecture tile — "Glass Atrium" |
| https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=70 | Travel tile — "Island Shore" |
| https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=800&q=70 | Travel tile — "Balloons at Dawn" |
| https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=800&q=70 | Studio tile — "Desk Setup" |
| https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=70 | Studio tile — "Studio Keys" |

Reuse these Unsplash URLs; do not hotlink other domains.

## Do

- Keep the masonry grid dense but breathable (small gaps).
- Use category filter buttons above the grid.
- End with a large centered call-to-action band before the footer.
- Keep copy short: captions, one-line intro, one CTA.
- Lazy-load every tile image except the first visible one.

## Don't

- No dark mode, no neon colors.
- No heavy shadows or borders; rely on tone-on-tone contrast.
- Never copy text, slogans, images or CSS from any third-party demo.
