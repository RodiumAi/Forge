import "../styles/habit.css";
import { ArrowLeft, Bell, CalendarDays, Check, Flame, Repeat, Trophy } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useHabits } from "../components/HabitsState";
import { ICONS, PALETTE, TODAY, WEEK } from "../data";

/** 5 past weeks of history, stable per habit (seeded from its streak). */
function history(seed: number) {
  return Array.from({ length: 35 }, (_, i) => ((i * 7 + seed * 3) % 10) > 2);
}

/** Stack screen (no tab bar): one habit, its streak, week, history and notes. */
export default function HabitScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { habits, toggle, setNote } = useHabits();
  const habit = habits.find((h) => h.id === id);
  if (!habit) return <Navigate to="/habits" replace />;

  const Icon = ICONS[habit.icon];
  const tint = PALETTE[habit.tint];
  const doneToday = habit.week[TODAY];
  const past = history(habit.streak + habit.best);

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/habits", { replace: true });
  }

  return (
    <div className="app-shell habit-screen" style={{ background: `linear-gradient(180deg, ${tint.bg} 0 21rem, var(--bg) 21rem)` }}>
      <header className="habit-bar">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2.2} aria-hidden /></button>
        <span className="hb-title">Habit</span>
        <span className="bar-space" aria-hidden />
      </header>

      <div className="habit-hero">
        {habit.photo ? <img src={habit.photo} alt="" /> : <div className="ph" style={{ background: tint.ink }} />}
        <span className="badge" style={{ color: tint.ink }}><Icon size={28} strokeWidth={2.1} aria-hidden /></span>
      </div>

      <div className="habit-body">
        <section className="title">
          <h1>{habit.name}</h1>
          <div className="meta">
            <span><CalendarDays size={14} strokeWidth={2.2} aria-hidden /> {habit.goal}</span>
            <span><Repeat size={14} strokeWidth={2.2} aria-hidden /> {habit.frequency}</span>
            <span><Bell size={14} strokeWidth={2.2} aria-hidden /> {habit.time}</span>
          </div>
        </section>

        <section className="streaks">
          <div className="flame">
            <span><Flame size={30} strokeWidth={2.2} aria-hidden /></span>
            <strong>{habit.streak}</strong>
            <small>day streak</small>
          </div>
          <div className="best">
            <Trophy size={18} strokeWidth={2.2} aria-hidden />
            <strong>{habit.best} days</strong>
            <small>Best streak</small>
          </div>
        </section>

        <button className={doneToday ? "mark done" : "mark"} onClick={() => toggle(habit.id)} aria-pressed={doneToday}>
          <span className="m-check"><Check size={20} strokeWidth={3} aria-hidden /></span>
          {doneToday ? "Done for today" : "Mark today as done"}
        </button>

        <section className="card">
          <div className="section-head"><h2>This week</h2><span className="muted">{habit.week.filter(Boolean).length} of 7</span></div>
          <div className="days">
            {habit.week.map((v, i) => (
              <button key={WEEK[i].d} className={v ? "on" : ""} style={v ? { background: tint.ink, borderColor: tint.ink } : undefined} onClick={() => toggle(habit.id, i)} aria-pressed={v} aria-label={`${WEEK[i].d} ${WEEK[i].n}`}>
                <small>{WEEK[i].d.slice(0, 1)}</small>
                <strong>{WEEK[i].n}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="section-head"><h2>History</h2><span className="muted">Last 5 weeks</span></div>
          <div className="history" aria-label={`${past.filter(Boolean).length} of 35 days done`}>
            {past.map((v, i) => <i key={i} style={{ background: v ? tint.ink : tint.bg, opacity: v ? 1 : .8 }} />)}
          </div>
        </section>

        <section className="card notes">
          <div className="section-head"><h2>Notes</h2></div>
          <textarea value={habit.note} onChange={(e) => setNote(habit.id, e.target.value)} rows={3} placeholder="What helps you keep this one?" aria-label="Notes" />
        </section>
      </div>
    </div>
  );
}
