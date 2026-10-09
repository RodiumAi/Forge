const STATS = [
  { n: "48", label: "Talks & workshops" },
  { n: "2,400", label: "Attendees" },
  { n: "3", label: "Stages" },
  { n: "32", label: "Countries represented" },
];

export default function Stats() {
  return (
    <section className="stats">
      {STATS.map((s) => (
        <div className="stat" key={s.label}>
          <div className="stat-n">{s.n}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </section>
  );
}
