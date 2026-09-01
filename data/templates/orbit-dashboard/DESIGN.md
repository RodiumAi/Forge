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
- Simulate the chart with CSS bars of varying heights; icons as characters/divs.

## Don't

- Don't copy text, data, images or CSS from the Orbit demo.
- Don't import external chart libraries, icon packs or fonts.
- Don't mix a second accent color into KPI cards.
