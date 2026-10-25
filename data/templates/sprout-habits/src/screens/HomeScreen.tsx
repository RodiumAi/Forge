import "../styles/home.css";
import { Flame, PartyPopper, Plus, Sprout } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import HabitCard from "../components/HabitCard";
import { useHabits } from "../components/HabitsState";
import ProgressRing from "../components/ProgressRing";
import { TODAY, WEEK } from "../data";

/** Today: week strip, day progress ring, habits sorted by time. */
export default function HomeScreen() {
  const { habits } = useHabits();
  const [day, setDay] = useState(TODAY);
  const done = habits.filter((h) => h.week[day]).length;
  const total = habits.length;
  const perfect = done === total && total > 0;
  const sorted = [...habits].sort((a, b) => a.time.localeCompare(b.time));
  const longest = habits.reduce((a, b) => (b.streak > a.streak ? b : a), habits[0]);

  return (
    <main className="app-main home-screen">
      <div className="week" role="tablist" aria-label="Day of the week">
        {WEEK.map((w, i) => {
          const full = habits.every((h) => h.week[i]);
          return (
            <button key={w.n} role="tab" aria-selected={day === i} className={[day === i && "on", i === TODAY && "today"].filter(Boolean).join(" ")} onClick={() => setDay(i)}>
              <small>{w.d.slice(0, 1)}</small>
              <strong>{w.n}</strong>
              <i className={full ? "full" : ""} aria-hidden />
            </button>
          );
        })}
      </div>

      <section className={perfect ? "progress perfect" : "progress"}>
        <div className="ring-box">
          <ProgressRing done={done} total={total} />
          <span className="ring-label">{perfect ? <PartyPopper size={30} strokeWidth={2} aria-hidden /> : <><b>{done}</b>/{total}</>}</span>
        </div>
        <div className="progress-text">
          <p className="p-kicker">{day === TODAY ? "Today" : `${WEEK[day].d} ${WEEK[day].n}`}</p>
          <h2>{perfect ? "Perfect day!" : `${done} of ${total} done`}</h2>
          <p>{perfect ? "Every habit checked. Your garden thanks you." : `${total - done} left, you are on a roll.`}</p>
          <span className="flame-chip"><Flame size={14} strokeWidth={2.4} aria-hidden /> {longest.name}, {longest.streak} days</span>
        </div>
        <Sprout className="leaf" size={120} strokeWidth={1.2} aria-hidden />
      </section>

      <section>
        <div className="section-head"><h2>{day === TODAY ? "Your habits" : "That day"}</h2><Link to="/habits" className="link">See all</Link></div>
        <ul className="habit-list">
          {sorted.map((h) => <HabitCard key={h.id} habit={h} day={day} />)}
        </ul>
        <Link to="/new-habit" className="add-row"><span><Plus size={18} strokeWidth={2.6} aria-hidden /></span> Plant a new habit</Link>
      </section>
    </main>
  );
}
