import { Bike, Clock, Heart, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { fcfa, type Restaurant } from "../data";

type Props = { r: Restaurant; compact?: boolean };

/** Rounded photo card: big food photo, favourite heart, name, rating, time and fee. */
export default function RestaurantCard({ r, compact = false }: Props) {
  const [fav, setFav] = useState(r.id === "maquis-baobab");
  return (
    <article className={compact ? "r-card compact" : "r-card"}>
      <Link to={`/restaurant/${r.id}`} className="r-link">
        <span className="r-photo">
          <img src={r.photo} alt="" loading="lazy" />
          {r.fee === 0 && <span className="r-badge">Free delivery</span>}
        </span>
        <span className="r-body">
          <span className="r-top">
            <strong>{r.name}</strong>
            <span className="r-rate"><Star size={13} strokeWidth={0} fill="currentColor" aria-hidden />{r.rating}</span>
          </span>
          {!compact && <span className="r-tag">{r.tagline}</span>}
          <span className="r-meta">
            <span><Clock size={13} strokeWidth={2.2} aria-hidden />{r.eta}</span>
            <span><Bike size={13} strokeWidth={2.2} aria-hidden />{r.fee ? `${fcfa(r.fee)} FCFA` : "Free"}</span>
          </span>
        </span>
      </Link>
      <button className={fav ? "r-fav on" : "r-fav"} onClick={() => setFav((f) => !f)} aria-pressed={fav} aria-label={fav ? `Remove ${r.name} from favourites` : `Save ${r.name}`}>
        <Heart size={18} strokeWidth={2.2} fill={fav ? "currentColor" : "none"} aria-hidden />
      </button>
    </article>
  );
}
