const stats = [
  { value: "4,200", label: "active members" },
  { value: "310", label: "classes per week" },
  { value: "97%", label: "12-month retention" },
  { value: "24/7", label: "doors never close" },
];

export default function StatsBand() {
  return (
    <section className="stats-band">
      {stats.map((s) => (
        <div className="stat" key={s.label}>
          <span className="stat-value">{s.value}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </section>
  );
}
