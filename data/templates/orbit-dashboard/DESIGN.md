# Template

- id: `orbit-dashboard`
- name: Orbit Admin Dashboard

## Colors

| Token | Value | Role |
|---|---|---|
| --bg | #f1f5f9 | workspace background |
| --fg | #0f172a | headings / values |
| --muted | #64748b | labels, secondary text |
| --accent | #2563eb | active nav, chart bars, links |
| --soft | #ffffff | cards, panels, sidebar contrast base |

Sidebar uses a dark navy (#0f172a / #1e293b) against the light workspace.

## Typography

- Font stack: `"Segoe UI", system-ui, sans-serif` (no web fonts), body line-height 1.5; order ids use `Consolas, monospace`.
- Scale: page title 1.5rem, KPI value 1.5rem bold, brand 1.05rem bold, panel h2 1.05rem.
- Text: sidebar links and page subtitle 0.92rem, search and table 0.9rem, panel link 0.85rem (weight 600), KPI label and delta 0.8rem, table headers, status pills and sidebar footer 0.75rem, chart labels 0.7rem (0.55rem on mobile).
- Labels: KPI labels uppercase with 0.04em tracking, table headers uppercase with 0.05em tracking.

## Spacing & radius

- Shell: 230px dark sidebar (60px icon rail below 761px, mobile-first), topbar 12px 24px, content padding 24px (16px on mobile), content max-width 1100px.
- Gaps: KPI grid 16px, panels 20px apart, chart columns 10px, sidebar links 4px.
- Padding: panels 20px, KPI cards 16px 18px, table cells 11px 12px, sidebar links 10px 12px.
- Radius: KPI cards and panels 12px, links and search 8px, tags 6px, chart bars 5px top, avatars and status pills fully round.

## Tone

Structured, data-dense, trustworthy. Compact spacing, clear card grid, tabular data, restrained accent use.

## Images

| URL | Role |
|---|---|
| https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=70 | Topbar user avatar (round) |
| https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=70 | Table avatar, Recent orders customer column |
| https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=70 | Table avatar, Recent orders customer column |
| https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=70 | Table avatar, Recent orders customer column |

Reuse these Unsplash URLs; do not hotlink other domains. Photos are limited to avatars: the dashboard visuals (CSS bar chart, table data) stay data-driven.

## Do

- Keep the layout: dark sidebar (nav items) → topbar (search + avatar) → KPI card row → chart panel → data table.
- Use fictional data only (invented names, numbers, statuses).
- Simulate the chart with CSS bars of varying heights; icons from lucide-react (18px, stroke 1.7).

## Don't

- Don't copy text, data, images or CSS from the Orbit demo.
- Don't import external chart libraries or fonts; lucide-react is the only icon set.
- Don't mix a second accent color into KPI cards.
