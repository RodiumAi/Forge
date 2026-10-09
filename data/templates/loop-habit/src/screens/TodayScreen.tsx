import "../styles/today.css";
import { useMemo } from "react";
import { Check } from "lucide-react";
import type { Habit } from "../data";
import HabitRow from "../components/HabitRow";
import ProgressRing from "../components/ProgressRing";
import StreakFlame from "../components/StreakFlame";

type Props = { habits: Habit[]; onToggle: (id: string) => void; onManage: () => void };

export default function TodayScreen({ habits, onToggle, onManage }: Props) {
  const doneCount = habits.filter((h) => h.done).length;
  const total = habits.length;
  const pct = Math.round((doneCount / total) * 100);
  const ring = useMemo(
    () => `conic-gradient(var(--accent) ${pct * 3.6}deg, color-mix(in srgb, var(--fg) 10%, transparent) 0)`,
    [pct]
  );

  return (
    <main className="app-main today-screen">
      <div className="progress">
        <ProgressRing background={ring}>
          <b>{doneCount}/{total}</b>
          <span>done</span>
        </ProgressRing>
        <div className="progress-copy">
          <p className="lbl">Today's loop</p>
          <p className="big">{pct}% complete</p>
          <span className="delta">{doneCount === total ? "Loop closed — nice work" : `${total - doneCount} habit${total - doneCount > 1 ? "s" : ""} to go`}</span>
        </div>
      </div>

      <div className="section-head"><h2>Your habits</h2><a href="#" onClick={(e) => { e.preventDefault(); onManage(); }}>Manage</a></div>
      <section className="card list">
        {habits.map((h) => (
          <HabitRow
            key={h.id}
            Icon={h.Icon}
            title={h.name}
            className={h.done ? "done" : undefined}
            sub={<span className="streak"><StreakFlame /> {h.streak} day{h.streak === 1 ? "" : "s"}</span>}
          >
            <button
              className={h.done ? "check on" : "check"}
              aria-pressed={h.done}
              aria-label={h.done ? `Mark ${h.name} not done` : `Mark ${h.name} done`}
              onClick={() => onToggle(h.id)}
            >
              {h.done && <Check size={16} strokeWidth={2.4} aria-hidden />}
            </button>
          </HabitRow>
        ))}
      </section>
    </main>
  );
}
