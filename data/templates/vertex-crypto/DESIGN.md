# Design charter

## Template
- id: vertex-crypto
- name: Vertex Crypto

## Colors
- --bg: #05070f
- --fg: #eef2ff
- --muted: #7c85a3
- --accent: #00e5a0

Secondary hues: #3b82f6 (blue) and #f43f5e (red, losses only) inside charts and gradient borders.
Glass card fill: `--card-bg: rgba(255, 255, 255, 0.035)`.

## Typography
- Sans (`--font`): -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif. Body line-height 1.6, antialiased.
- Mono (`--mono`): ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace for prices, tickers, stats and chart labels.
- Hero title: clamp(2.3rem, 4.5vw, 3.7rem), weight 800, line-height 1.06, letter-spacing -0.03em.
- Section titles: clamp(1.7rem, 3.2vw, 2.4rem), letter-spacing -0.02em; CTA clamp(1.7rem, 3.4vw, 2.6rem); security clamp(1.6rem, 3vw, 2.3rem).
- Numbers: stat values 1.9rem / 800 mono, pair price 1.6rem (1.3rem on phones), market price 1.2rem.
- Body copy 0.9rem to 1.05rem in `--muted`; labels and fine print 0.72rem to 0.82rem.
- Brand: 1.05rem, weight 800, letter-spacing 0.12em, next to the green "V" mark (`BrandMark.tsx`).

## Spacing & radius
- Container: `width: min(1160px, 92%)`, centered.
- Sections: 48px to 64px vertical padding; hero `88px 0 64px` (56px top below 961px); CTA `56px 0 96px`.
- Gaps: 18px to 22px in card grids, 56px between hero and security columns.
- Radius: `--radius: 16px` for glass cards, 10px for buttons, tabs and the chart, 999px for pills.
- Breakpoints: mobile first, `min-width: 641px` (nav links, 2-column grids) and `min-width: 961px` (hero split, 4-column grids).

## Tone
Precise, trustworthy, technical, ambitious. Real numbers everywhere; no vague hype.

## Do / Don't
- Do keep glass cards with gradient borders (padding-box/border-box double background trick).
- Do keep all charts in pure CSS (bars, sparklines built with linear-gradients and flex columns).
- Do keep price tickers with green gains / red losses and realistic magnitudes.
- Don't use canvas, chart libraries, or images for data viz.
- Don't brighten the background; the near-black #05070f canvas carries the neon accent.

## Images
- Security visual: https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=70 (security lock)
- App on device: https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=1200&q=70 (trading charts on screens)

Reuse these Unsplash URLs; do not hotlink other domains.
