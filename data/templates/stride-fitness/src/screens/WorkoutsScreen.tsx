import "../styles/workouts.css";
import { useState } from "react";
import WorkoutCard from "../components/WorkoutCard";
import { WORKOUTS, type Kind } from "../data";

const FILTERS: ("All" | Kind)[] = ["All", "Run", "Strength", "HIIT", "Mobility"];

export default function WorkoutsScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const list = WORKOUTS.filter((w) => filter === "All" || w.kind === filter);
  const [hero, ...rest] = list;

  return (
    <main className="app-main workouts-screen">
      <div className="chips" role="tablist" aria-label="Workout type">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "chip on" : "chip"} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <section className="plan-banner">
        <div>
          <p className="kicker">Your plan</p>
          <h2>10K in 8 weeks</h2>
          <p className="muted">Week 3 of 8 · 2 sessions left</p>
        </div>
        <div className="plan-meter" aria-label="Plan progress 3 of 8 weeks">
          {Array.from({ length: 8 }, (_, i) => <i key={i} className={i < 2 ? "done" : i === 2 ? "now" : ""} />)}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>{filter === "All" ? "All programs" : filter}</h2>
          <span className="muted">{list.length} programs</span>
        </div>
        {hero && <WorkoutCard w={hero} />}
        {rest.length > 0 && (
          <div className="grid">{rest.map((w) => <WorkoutCard key={w.id} w={w} compact />)}</div>
        )}
      </section>
    </main>
  );
}
