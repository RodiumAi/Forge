# Design charter

## Template
- id: forge-devtools
- name: Hexbin Devtools

## Colors
- --bg: #0d1117
- --fg: #e6edf3
- --muted: #8b949e
- --accent: #3fb950

Secondary accent: #bc8cff (violet) for gradients, keywords in code and highlights. Surfaces: #161b22, borders: #30363d.

## Typography
- Sans: `-apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif` (`--sans`), body line-height 1.6. Mono: `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace` (`--mono`) for the brand, code, terminal, tabs, badges and stats. No web fonts.
- Headings: h1 `clamp(38px, 6vw, 64px)` weight 800, tracking -0.03em, line-height 1.1; h2 `clamp(28px, 4vw, 40px)` weight 800, tracking -0.02em; CTA title `clamp(30px, 4.5vw, 46px)`; card titles 17px weight 700.
- Text: lede 18px, section subtitle 16px, compare rows 15px, card copy 14.5px, nav, buttons and footer links 14px.
- Mono sizes: terminal 13.5px with line-height 1.75 (11.5px below 641px), badges, tabs and table heads 13px, adapter labels and copy button 12px, stat numbers 32px, brand 19px weight 700.

## Spacing & radius
- Sections: max-width 1080px, 88px vertical padding, 32px side padding (16px below 641px); hero max-width 920px with 88px top and 96px bottom; CTA 96px. Breakpoints are mobile-first at 641px and 961px.
- Gaps: 56px from section heading to content and between the open source columns, feature cards 20px, adapters, stats and compare cells 16px, footer columns 40px.
- Padding: feature cards 28px 24px, adapters 26px 12px, stats 26px 22px, compare rows 16px 24px, buttons 9px 18px, terminal body 20px 22px 24px.
- Radius: buttons and copy button 6px, install box and CTA command 10px, cards, compare table and terminal 12px, badges 999px, inline code 4px.

## Tone
Technical, dry-witted, trustworthy. Monospace everywhere it matters. Copy reads like a good README, not a marketing deck.

## Do / Don't
- Do keep the terminal window hero with colored code spans and blinking cursor.
- Do use the green→violet gradient only on the headline and primary CTA.
- Do make feature-card borders glow (accent) on hover.
- Don't lighten the background or use pure white text.
- Don't use stock photography: this kit is 100% CSS plus lucide-react icons.

## Images
None. All visuals are lucide-react icons, terminal mockups and CSS. Do not add photos.
