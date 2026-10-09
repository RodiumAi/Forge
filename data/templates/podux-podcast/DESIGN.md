# Template

- id: `podux-podcast`
- name: Podux Podcast

## Colors

- Background: `#f7f6fc` (soft lavender-white)
- Foreground: `#181330` (deep ink violet)
- Muted: `#6f6a86`
- Accent: `#7c5cff` (electric violet, play buttons and CTAs)
- Soft: `#ece9f8` (cards, chips)

## Typography

- Font stack: `"Segoe UI", system-ui, sans-serif` for everything, body line-height 1.55.
- Hero title: 1.8rem on mobile, 2.5rem from 761px, line-height 1.15, max 24ch.
- Section titles (h2): 1.6rem. Episode and host names (h3): 1rem.
- Logo: 1.15rem, weight 800. Buttons and links: 0.9rem to 0.95rem, weight 600.
- Small print: chips 0.8rem / 700, duration chips 0.75rem / 600, footer 0.85rem.

## Spacing & radius

- Page gutter: `6vw` left and right on every band.
- Sections: `2rem 6vw 3rem`; hero `2rem 6vw` on mobile, `3.5rem 6vw 4rem` from 761px.
- Gaps: 0.6rem to 1.4rem inside rows and grids, 3rem between hero copy and art.
- Radius: 999px for buttons, chips and inputs; 20px for the hero panel and subscribe strip;
  16px host cards; 14px episode rows; 10px episode covers; 50% for play buttons and avatars.
- Single breakpoint: mobile first, desktop layout from `min-width: 761px`.

## Tone

Modern, friendly, tech-savvy. A developer-culture podcast voice: casual but
precise, short episode titles, durations displayed as chips.

## Do

- Light page with violet accent; dark ink footer.
- Hero: eyebrow chip ("New season"), big show title, listener count, dual CTA, studio-mic photo panel with centered play badge.
- Episode list: numbered rows with cover square (photo covers alternate with gradient covers), title, duration chip, circular play button toggled via useState.
- Hosts section with round photo avatars (gradient circle kept as network fallback).
- Section order: header, hero, episode list, hosts, subscribe strip, footer.

## Images

Reuse these Unsplash URLs; do not hotlink other domains.

- `https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=1200&q=70` — hero visual panel (studio microphone).
- `https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=70` — episode covers 1 and 5 (microphone).
- `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=70` — episode cover 3 (headphones). Episodes 2, 4, 6 keep gradient covers.
- `https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=70` — host avatar, Mara Delacroix.
- `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=70` — host avatar, Theo Andersen.
- `https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=70` — host avatar, Iris Okafor.

## Don't

- No dark theme toggle logic; single light theme.
- No lorem ipsum; write real fictional copy.
