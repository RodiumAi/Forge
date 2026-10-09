const kpis = [
  { label: "Monthly revenue", value: "$84,210", delta: "+12.4%", up: true },
  { label: "Active customers", value: "3,482", delta: "+5.1%", up: true },
  { label: "Open tickets", value: "127", delta: "-8.3%", up: false },
  { label: "Avg. response time", value: "2h 14m", delta: "-14.0%", up: false },
];

export default function KpiGrid() {
  return (
    <section className="kpi-grid">
      {kpis.map((k) => (
        <article key={k.label} className="kpi-card">
          <span className="kpi-label">{k.label}</span>
          <span className="kpi-value">{k.value}</span>
          <span className={k.up ? "kpi-delta up" : "kpi-delta down"}>{k.delta} vs last month</span>
        </article>
      ))}
    </section>
  );
}
