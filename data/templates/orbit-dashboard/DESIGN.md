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

## Do

- Keep the layout: dark sidebar (nav items) → topbar (search + avatar) → KPI card row → chart panel → data table.
- Use fictional data only (invented names, numbers, statuses).
- Simulate the chart with CSS bars of varying heights; icons as characters/divs.

## Don't

- Don't copy text, data, images or CSS from the Orbit demo.
- Don't import external chart libraries, icon packs or fonts.
- Don't mix a second accent color into KPI cards.
