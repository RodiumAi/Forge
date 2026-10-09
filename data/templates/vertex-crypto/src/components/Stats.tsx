import { STATS } from "../data";

export default function Stats() {
  return (
    <section className="stats container">
      {STATS.map((s) => (
        <div key={s.label} className="stat gcard">
          <span className="stat-value neon-text">{s.value}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </section>
  );
}
