import { Heart } from "lucide-react";
import { useFavorites } from "./Favorites";

type Props = { id: string; name: string; className?: string };

/** Round glass heart that saves or removes a destination. */
export default function HeartButton({ id, name, className = "" }: Props) {
  const { has, toggle } = useFavorites();
  const on = has(id);
  return (
    <button
      className={`heart-btn${on ? " on" : ""} ${className}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from saved` : `Save ${name}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
    >
      <Heart size={18} strokeWidth={2.2} fill={on ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
