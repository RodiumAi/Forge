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
