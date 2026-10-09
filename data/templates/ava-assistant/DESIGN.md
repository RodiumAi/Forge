# Design charter

## Template
- id: ava-assistant
- name: Ava
- kind: mobile app shell

## Platform
- Onboarding (first launch, localStorage) → top navbar → Chat → bottom tabs.
- Phone-first (~390px); keep app patterns on tablet.

## Colors
- --bg: #0a0a0f
- --fg: #f2f2f7
- --muted: #8b8b9a
- --accent: #8b5cf6

## Typography
- Family: "Segoe UI", system-ui, -apple-system, sans-serif (system stack, no web fonts).
- Onboarding title: 1.85rem, line-height 1.12, letter-spacing -.02em.
- Navbar title: 1.02rem / 700; section titles .95rem to .98rem.
- Chat bubbles: .92rem, line-height 1.45, pre-wrapped text; input .95rem.
- Body and muted text: .9rem, line-height 1.45; list rows .92rem / 650 with .78rem meta.
- Chips, pills and labels: .66rem to .82rem, weight 600 to 700; prompt categories uppercase with .05em tracking.

## Spacing & radius
- Shell: max-width 460px, centered; main padding 1.05rem 1.1rem plus room for the tab bar (3.9rem); 1rem gap between blocks.
- Chat thread padding 1rem with room for the composer (chips + input) fixed above the tab bar; .7rem between messages, bubbles max 84% wide.
- Safe areas: `env(safe-area-inset-top/bottom)` added to navbar, onboarding, composer and tab bar.
- Radius: 1.6rem onboarding art, 1.4rem input bar, 1.15rem cards and bubbles (.35rem on the tail corner), 1.1rem prompt cards, 1rem buttons, .85rem row icons, 999px chips, pills, avatars and send button.
- Touch targets: buttons min-height 3rem, send button 2.6rem, tabs min-height 2.9rem.

## Tone
smart, helpful, friendly.

## Do / Don't
- Do keep onboarding, top navbar, chat thread, and bottom navigation as the spine.
- Do keep assistant bubbles left (surface) and user bubbles right (accent), with suggestion chips and a sticky input bar that appends what you type.
- Do use `lucide-react` icons (no emoji or hand-drawn SVG icons).
- Don't turn this kit into a multi-section marketing landing page.
- Don't add a service worker.

## Images
- Optional assistant/atmosphere avatar: https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=200&q=70 (soft AI glow)

The chat UI is icon- and gradient-driven; photos are optional. Reuse this Unsplash URL only; do not hotlink other domains.
