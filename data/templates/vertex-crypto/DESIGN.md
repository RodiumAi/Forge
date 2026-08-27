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
