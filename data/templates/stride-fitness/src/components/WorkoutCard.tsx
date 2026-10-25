import { Clock, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import type { Workout } from "../data";

/** Program card: athlete photo, kind and level, condensed title, minutes and kcal. */
export default function WorkoutCard({ w, compact = false }: { w: Workout; compact?: boolean }) {
  return (
    <Link to={`/workout/${w.id}`} className={compact ? "workout-card compact" : "workout-card"}>
      <img src={w.photo} alt="" />
      <span className="wc-shade" aria-hidden />
      <span className="wc-tags"><b>{w.kind}</b><i>{w.level}</i></span>
      <span className="wc-body">
        <strong>{w.title}</strong>
        <span className="wc-meta">
          <span><Clock size={14} strokeWidth={2.2} aria-hidden /> {w.minutes} min</span>
          <span><Flame size={14} strokeWidth={2.2} aria-hidden /> {w.kcal} kcal</span>
        </span>
      </span>
    </Link>
  );
}
