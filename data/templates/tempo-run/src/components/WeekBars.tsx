import { WEEK } from "../data";

/* Seven-day distance bars in CSS (Home "This week" + Stats "Weekly distance"). */
export default function WeekBars({ tall }: { tall?: boolean }) {
  return (
    <div className={tall ? "bars tall" : "bars"} aria-hidden>
      {WEEK.map((b, i) => (
        <div className="col" key={i}>
          <div className="bar" style={{ height: `${b.h}%` }} />
          <span className="bl">{b.d}</span>
        </div>
      ))}
    </div>
  );
}
