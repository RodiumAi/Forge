import "../styles/habits.css";
import { ChevronRight, Flame } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useHabits } from "../components/HabitsState";
import { ICONS, PALETTE, WEEK } from "../data";

const FILTERS = ["All", "Morning", "Afternoon", "Evening"] as const;
type Filter = (typeof FILTERS)[number];

function partOfDay(time: string): Filter {
  const h = Number(time.slice(0, 2));
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

export default function HabitsScreen() {
  const { habits } = useHabits();
  const [filter, setFilter] = useState<Filter>("All");
  const list = habits.filter((h) => filter === "All" || partOfDay(h.time) === filter);
  const checks = habits.reduce((n, h) => n + h.week.filter(Boolean).length, 0);

  return (
    <main className="app-main habits-screen">
      <section className="summary">
        <div><strong>{habits.length}</strong><span>Habits</span></div>
        <div><strong>{checks}</strong><span>Checks this week</span></div>
        <div><strong>{Math.round((checks / (habits.length * 7)) * 100)}%</strong><span>On track</span></div>
      </section>

      <div className="filters" role="tablist" aria-label="Time of day">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "chip on" : "chip"} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <ul className="rows">
        {list.map((h) => {
          const Icon = ICONS[h.icon];
          const tint = PALETTE[h.tint];
          return (
            <li key={h.id}>
              <Link to={`/habit/${h.id}`} className="row">
                <div className="row-top">
                  <span className="r-icon" style={{ background: tint.bg, color: tint.ink }}><Icon size={20} strokeWidth={2.1} aria-hidden /></span>
                  <span className="r-text"><strong>{h.name}</strong><span>{h.frequency}, {h.time}</span></span>
                  <span className="r-streak"><Flame size={14} strokeWidth={2.4} aria-hidden />{h.streak}</span>
                  <ChevronRight size={18} strokeWidth={2.2} aria-hidden className="r-go" />
                </div>
                <div className="dots" aria-label={`${h.week.filter(Boolean).length} of 7 days this week`}>
                  {h.week.map((v, i) => (
                    <span key={WEEK[i].d} className="dot-col">
                      <i className={v ? "on" : ""} style={v ? { background: tint.ink } : { background: tint.bg }} />
                      <small>{WEEK[i].d.slice(0, 1)}</small>
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          );
        })}
        {list.length === 0 && <li className="empty muted">Nothing planned for this part of the day.</li>}
      </ul>
    </main>
  );
}
