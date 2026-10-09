# Design charter

## Template
- id: pulse-fitness
- name: Pulse Club

## Colors
- --bg: #0a0a0a
- --fg: #f5f5f5
- --muted: #8a8a8a
- --accent: #ccff00

Supporting tokens: --carbon #131313 (bands, cards, bar tracks), --line rgba(245,245,245,0.12),
bar gradient from #9acc00 to the accent.

## Typography
- Condensed display: "Arial Narrow", "Helvetica Neue Condensed", Impact, "Segoe UI", Arial, sans-serif,
  weight 800 to 900, italic, uppercase (headlines, numbers, buttons, nav).
- Body sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, 16px, line-height 1.6.
- Hero title: clamp(58px, 11vw, 140px), line-height 0.88.
- Section titles: clamp(40px, 6.5vw, 84px), line-height 0.92. Final CTA: clamp(42px, 7.5vw, 100px).
- Stat numbers clamp(38px, 6vw, 72px); plan price 56px; bar percentages 30px.
- Labels: 11 to 14px uppercase with letter-spacing 0.06em to 0.3em.

## Spacing & radius
- Horizontal gutter: --gutter clamp(20px, 6vw, 88px). Section padding clamp(64px, 9vw, 130px).
- Diagonal bands add 4vw to top and bottom padding to make room for the clip-path slant.
- Grid gaps: 22 to 26px for cards; plan cards 34px 28px padding.
- Radius: none anywhere. Buttons and tags are skewed -8deg, bar tracks -16deg.
- Breakpoints (mobile first): 701px and 961px.

## Tone
Loud, energetic, no-excuses. Short imperative headlines in condensed heavy italic caps. Copy talks like a coach at 6am.

## Do / Don't
- Do keep the diagonal clip-path: polygon section edges — the page should feel like it's leaning forward.
- Do use enormous condensed italic uppercase type for numbers and headlines.
- Do keep the animated progress bars and huge stat numbers.
- Don't soften the palette: electric lime #ccff00 on near-black only, white for body text.
- Don't use rounded, friendly shapes; corners are sharp, angles diagonal.

## Images
- Hero: https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=70 (dark gym interior)
- Program — Strength: https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=70 (barbell training)
- Program — Conditioning: https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=70 (athlete on assault course)
- Program — Boxing: https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=70 (boxing training)
- Coach 1: https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=1200&q=70
- Coach 2: https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=1200&q=70
- Coach 3: https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?auto=format&fit=crop&w=1200&q=70

Reuse these Unsplash URLs; do not hotlink other domains.
