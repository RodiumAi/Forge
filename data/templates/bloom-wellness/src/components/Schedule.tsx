import { useState } from "react";
import { Clock } from "lucide-react";
import { schedule } from "../data";

export default function Schedule() {
  const [activeDay, setActiveDay] = useState(0);

  return (
    <section className="schedule" id="schedule">
      <div className="sec-head">
        <p className="eyebrow">Weekly Classes</p>
        <h2>The studio calendar</h2>
      </div>
      <div className="sched-tabs">
        {schedule.map((s, i) => (
          <button
            key={s.day}
            className={`sched-tab ${i === activeDay ? "active" : ""}`}
            onClick={() => setActiveDay(i)}
          >
            {s.day.slice(0, 3)}
          </button>
        ))}
      </div>
      <div className="sched-card">
        <div className="sched-day">{schedule[activeDay].day}</div>
        <h3>{schedule[activeDay].cls}</h3>
        <p className="sched-time">
          <Clock size={16} aria-hidden="true" /> {schedule[activeDay].time}
        </p>
        <p className="sched-coach">with {schedule[activeDay].coach} · mats & blankets provided</p>
        <a href="#visit" className="btn-soft">Reserve a spot</a>
      </div>
    </section>
  );
}
