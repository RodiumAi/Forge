import "../styles/habits.css";
import { Plus } from "lucide-react";
import type { Habit } from "../data";
import HabitRow from "../components/HabitRow";
import StreakFlame from "../components/StreakFlame";

export default function HabitsScreen({ habits }: { habits: Habit[] }) {
  return (
    <main className="app-main habits-screen">
      <button className="add">
        <span className="ic"><Plus size={20} strokeWidth={1.9} aria-hidden /></span>
        <span className="meta"><strong>Add a habit</strong><span>Name it, set a schedule, pick a cue</span></span>
      </button>
      <section className="card list">
        {habits.map((h) => (
          <HabitRow key={h.id} Icon={h.Icon} title={h.name} sub={<span>{h.schedule}</span>}>
            <span className="streak-pill"><StreakFlame /> {h.streak}</span>
          </HabitRow>
        ))}
      </section>
    </main>
  );
}
