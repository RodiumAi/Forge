import "../styles/stats.css";
import { HEAT, HEAT_ROWS } from "../data";
import StreakFlame from "../components/StreakFlame";

export default function StatsScreen() {
  return (
    <main className="app-main stats-screen">
      <div className="stat-grid">
        <div className="card stat">
          <p className="lbl">Longest streak</p>
          <p className="big">41 <small>days</small></p>
          <span className="streak"><StreakFlame /> Meditate</span>
        </div>
        <div className="card stat">
          <p className="lbl">Completion</p>
          <p className="big">87<small>%</small></p>
          <span className="delta">this month</span>
        </div>
      </div>
      <section className="card">
        <div className="row"><h3>Consistency</h3><span className="pill">86 of 90 days</span></div>
        <div className="heatmap" aria-hidden>
          <div className="heat-days">
            {HEAT_ROWS.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="heat-grid">
            {HEAT.map((row, r) => (
              <div className="heat-row" key={r}>
                {row.map((v, c) => (
                  <span className="cell" key={c} style={{ opacity: v === 0 ? 1 : undefined, background: v === 0 ? "color-mix(in srgb, var(--fg) 7%, transparent)" : `color-mix(in srgb, var(--accent) ${v * 25}%, transparent)` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="legend">
          <span>Less</span>
          <i style={{ background: "color-mix(in srgb, var(--fg) 7%, transparent)" }} />
          <i style={{ background: "color-mix(in srgb, var(--accent) 25%, transparent)" }} />
          <i style={{ background: "color-mix(in srgb, var(--accent) 50%, transparent)" }} />
          <i style={{ background: "color-mix(in srgb, var(--accent) 75%, transparent)" }} />
          <i style={{ background: "color-mix(in srgb, var(--accent) 100%, transparent)" }} />
          <span>More</span>
        </div>
      </section>
    </main>
  );
}
