const STATS = [
  { value: "2.4B", label: "model calls / month" },
  { value: "380ms", label: "median latency" },
  { value: "1,900+", label: "teams in production" },
  { value: "99.99%", label: "uptime last 12 months" },
];

export default function Stats() {
  return (
    <section className="stats container">
      {STATS.map((s) => (
        <div key={s.label} className="stat glass">
          <span className="stat-value grad-text">{s.value}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </section>
  );
}
