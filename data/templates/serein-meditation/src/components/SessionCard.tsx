import { Heart, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { Session } from "../data";
import { useSaved } from "./Saved";

/** Photo card for a session: category, title, guide and minutes, save toggle. */
export default function SessionCard({ s }: { s: Session }) {
  const { isSaved, toggle } = useSaved();
  const on = isSaved(s.id);
  return (
    <article className="session-card">
      <Link to={`/session/${s.id}`} className="sc-link">
        <img src={s.photo} alt="" />
        <span className="sc-shade" aria-hidden />
        <span className="sc-body">
          <small>{s.category} · {s.minutes} min</small>
          <strong>{s.title}</strong>
          <span>with {s.guide}</span>
        </span>
        <span className="sc-play" aria-hidden><Play size={16} strokeWidth={2} fill="currentColor" /></span>
      </Link>
      <button className={on ? "sc-save on" : "sc-save"} onClick={() => toggle(s.id)} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save session"}>
        <Heart size={17} strokeWidth={2} fill={on ? "currentColor" : "none"} aria-hidden />
      </button>
    </article>
  );
}
