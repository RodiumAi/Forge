import { MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { euro, type Destination } from "../data";
import HeartButton from "./HeartButton";

type Props = { d: Destination; size?: "tall" | "grid" };

/** Full-bleed photo card: rating and heart on top, serif name over a gradient. */
export default function DestinationCard({ d, size = "tall" }: Props) {
  return (
    <div className={`dest-card ${size}`}>
      <Link to={`/destination/${d.id}`} className="dest-link">
        <img src={size === "tall" ? d.photo : d.thumb} alt="" loading="lazy" />
        <span className="dest-rating"><Star size={12} strokeWidth={2.4} fill="currentColor" aria-hidden /> {d.rating}</span>
        <span className="dest-text">
          <span className="dest-name">{d.name}</span>
          <span className="dest-meta"><MapPin size={13} strokeWidth={2.2} aria-hidden /> {d.country}<em>from {euro(d.price)}</em></span>
        </span>
      </Link>
      <HeartButton id={d.id} name={d.name} className="dest-heart" />
    </div>
  );
}
