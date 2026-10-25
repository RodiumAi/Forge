import { Check, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { ICONS, PALETTE, type Habit } from "../data";
import { useHabits } from "./HabitsState";

type Props = { habit: Habit; day: number };

/** Pastel habit card: icon, name and goal (opens the detail), streak and a round check. */
export default function HabitCard({ habit, day }: Props) {
  const { toggle } = useHabits();
  const Icon = ICONS[habit.icon];
  const done = habit.week[day];
  const tint = PALETTE[habit.tint];

  return (
    <li className={done ? "habit done" : "habit"} style={{ background: tint.bg }}>
      <Link to={`/habit/${habit.id}`} className="habit-link">
        <span className="habit-icon" style={{ color: tint.ink }}><Icon size={22} strokeWidth={2.1} aria-hidden /></span>
        <span className="habit-text">
          <strong>{habit.name}</strong>
          <span>{habit.goal}, {habit.time}</span>
        </span>
      </Link>
      <span className="habit-streak" style={{ color: tint.ink }}><Flame size={15} strokeWidth={2.4} aria-hidden />{habit.streak}</span>
      <button className="check" onClick={() => toggle(habit.id, day)} aria-pressed={done} aria-label={done ? `Undo ${habit.name}` : `Mark ${habit.name} done`}>
        <Check size={20} strokeWidth={3} aria-hidden />
      </button>
    </li>
  );
}
