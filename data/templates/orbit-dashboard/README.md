# Orbit Admin Dashboard

A structured, data-dense admin dashboard for a fictional operations workspace, Vantage Ops. Dark navy sidebar, light workspace, blue accent and fictional data only.

## Sections

1. Sidebar: brand, navigation with lucide icons (collapses to an icon rail on mobile), version footer.
2. Topbar: search field, notification bell and the signed-in user avatar.
3. Page header: title and subtitle.
4. KPI grid: four metric cards with month-over-month deltas.
5. Revenue chart: a pure CSS bar chart, one bar per month.
6. Recent orders: a table with customer avatars and status pills.

## File structure

```
src/
  main.tsx              React entry (createRoot)
  App.tsx               composes the shell inside <div className="home-screen">
  index.css             foundation: tokens, reset, base type, shell, sidebar, topbar, panels, table, status pills
  styles/home.css       overview styles (KPIs, chart, order cells), scoped under .home-screen
  components/
    Sidebar.tsx  Topbar.tsx  PageHeader.tsx  KpiGrid.tsx  RevenueChart.tsx  OrdersTable.tsx
```

## Adapting it

- Change the palette in the `:root` tokens of `src/index.css`.
- Edit the data arrays where they live: `navItems` in `Sidebar.tsx`, `kpis` in `KpiGrid.tsx`, `bars` in `RevenueChart.tsx`, `orders` in `OrdersTable.tsx`.
- Sidebar icons are `lucide-react` components; swap one by importing another icon.
- `.panel`, `.data-table` and `.status` live in the foundation, so a new screen (Orders, Customers) can reuse them with its own `src/styles/<page>.css` scoped under its screen class.
- Styles are mobile-first: base rules are the phone layout and `@media (min-width: 761px)` widens the sidebar and grids.
