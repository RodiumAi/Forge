import { Clock, Star } from "lucide-react";
import type { Recipe } from "../data";

function Stars({ n }: { n: number }) {
  return (
    <span className="rating"><Star size={14} strokeWidth={1.6} fill="currentColor" aria-hidden /> {n.toFixed(1)}</span>
  );
}

/* Thumbnail + name, meta, cook time and rating. Used by Home and Search. */
export default function RecipeRow({ r, tag }: { r: Recipe; tag?: string }) {
  return (
    <div className="recipe">
      <span className="thumb" aria-hidden><img src={r.img} alt="" /></span>
      <span className="meta">
        <strong>{r.name}</strong>
        <span className="sub">{r.meta}</span>
        <span className="stats">
          <span className="stat"><Clock size={16} strokeWidth={1.8} aria-hidden /> {r.min} min</span>
          <Stars n={r.rating} />
          {tag && <span className="cook-again">{tag}</span>}
        </span>
      </span>
    </div>
  );
}
