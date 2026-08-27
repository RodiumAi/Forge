# Template

- id: `logsfolio-portfolio`
- name: Developer Portfolio

## Colors

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#0d1117` | near-black background |
| `--fg` | `#e6edf3` | primary text |
| `--muted` | `#8b949e` | dates, meta, secondary copy |
| `--accent` | `#5eead4` | teal highlight, links, tags |
| `--soft` | `#161b22` | cards, panels, chips |

## Tone

Dark, technical, confident. Monospaced-feeling accents, tag pills for tech
stacks, timeline-style experience entries. Reads like a well-kept changelog.

## Images

| URL | Role |
| --- | --- |
| https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=70 | Hero avatar — round portrait of Mira Solano |
| https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=70 | Project thumb — Driftlog (code editor screen) |
| https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=70 | Project thumb — Quorum Board (programming screen) |
| https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=70 | Project thumb — Pinch Metrics (MacBook with code) |
| https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=70 | Testimonial avatar — Devon Aker |
| https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=70 | Testimonial avatar — Priya Ranganathan |

Reuse these Unsplash URLs; do not hotlink other domains.

## Section order

Nav → Hero intro → Work Experience → Projects → Education → Testimonials → Blogs → Footer.

## Do

- Anchor navigation to in-page sections.
- Use tag chips for tech stacks on project cards.
- Keep testimonial quotes short with name + role attribution.
- Use the Unsplash images above for thumbnails and avatars, with CSS gradient fallbacks behind them.
- Lazy-load thumbnails and testimonial avatars (the hero avatar loads eagerly).

## Don't

- No external images beyond the listed Unsplash URLs; no icon fonts or libraries.
- No light theme, no pastel palette.
- No walls of text — bullets and short paragraphs.
- Never copy text, slogans, images or CSS from any third-party demo.
