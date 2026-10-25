import { Star } from "lucide-react";

/** Five gold stars, filled up to the rounded rating. */
export default function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} strokeWidth={1.8} className={n <= Math.round(value) ? "on" : ""} aria-hidden />
      ))}
    </span>
  );
}
