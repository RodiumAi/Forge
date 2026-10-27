import "../styles/home.css";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useActivity } from "../components/Activity";
import Rings from "../components/Rings";
import WorkoutCard from "../components/WorkoutCard";
import { GOALS, NEXT_ID, WEEK, WORKOUTS } from "../data";

const LEGEND = [
  { key: "move", label: "Move", unit: "kcal", cls: "move" },
  { key: "exercise", label: "Exercise", unit: "min", cls: "exercise" },
  { key: "stand", label: "Stand", unit: "hrs", cls: "stand" },
] as const;

export default function HomeScreen() {
  const { today, runs } = useActivity();
  const next = WORKOUTS.find((w) => w.id === NEXT_ID) ?? WORKOUTS[0];
  const weekKm = WEEK.reduce((sum, d) => sum + d.km, 0);

  return (
    <main className="app-main home-screen">
      <section className="rings-card">
        <Rings value={today} goals={GOALS} size={156} />
        <ul className="legend">
          {LEGEND.map(({ key, label, unit, cls }) => (
            <li key={key} className={cls}>
              <span className="kicker">{label}</span>
              <p className="num">{today[key]}<small>/{GOALS[key]} {unit}</small></p>
            </li>
          ))}
        </ul>
      </section>

      <section className="week">
        <div className="week-head">
          <h2>This week</h2>
          <p className="num week-km">{weekKm.toFixed(1)}<small>km</small></p>
        </div>
        <ol className="days">
          {WEEK.map((d, i) => (
            <li key={d.d} className={`${d.km ? "ran" : ""}${i === 5 ? " today" : ""}`}>
              <span className="day-dot">{d.km ? Math.round(d.km) : ""}</span>
              <small>{d.d.slice(0, 1)}</small>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="section-head">
          <h2>Up next</h2>
          <Link to="/workouts" className="link">All programs</Link>
        </div>
        <WorkoutCard w={next} />
      </section>

      <section className="card recent">
        <div className="section-head">
          <h2>Recent runs</h2>
          <Link to="/stats" className="link">Stats <ArrowRight size={13} strokeWidth={2.4} aria-hidden /></Link>
        </div>
        <ul className="runs">
          {runs.slice(0, 3).map((r) => (
            <li key={r.id} className="run-row">
              <p className="num run-km">{r.km.toFixed(1)}<small>km</small></p>
              <span className="run-meta"><strong>{r.title}</strong><span>{r.when} · {r.time}</span></span>
              <span className="run-pace"><b>{r.pace}</b>/km</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
