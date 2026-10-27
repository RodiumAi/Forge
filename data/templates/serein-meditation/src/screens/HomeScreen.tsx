import "../styles/home.css";
import { Check, Clock, Play } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import BreathOrb from "../components/BreathOrb";
import SessionCard from "../components/SessionCard";
import { RITUAL, SESSIONS, TODAY_ID } from "../data";

export default function HomeScreen() {
  const today = SESSIONS.find((s) => s.id === TODAY_ID) ?? SESSIONS[0];
  const [ritual, setRitual] = useState(RITUAL);
  const done = ritual.filter((r) => r.done).length;
  const picks = SESSIONS.filter((s) => s.id !== TODAY_ID).slice(0, 4);

  function toggle(id: string) {
    setRitual((list) => list.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
  }

  return (
    <main className="app-main home-screen">
      <section className="breath" aria-label="Breathing exercise">
        <BreathOrb />
        <p className="breath-hint">Follow the orb for a minute, <em>then begin</em></p>
      </section>

      <section className="today">
        <img src={today.photo} alt="" />
        <div className="today-body">
          <p className="kicker">Today's session</p>
          <h2>{today.title}</h2>
          <p className="today-meta"><Clock size={14} strokeWidth={2} aria-hidden /> {today.minutes} min · {today.guide}</p>
        </div>
        <Link to={`/session/${today.id}`} className="today-play" aria-label={`Begin ${today.title}`}>
          <Play size={20} strokeWidth={2} fill="currentColor" aria-hidden />
        </Link>
      </section>

      <section className="card ritual">
        <div className="section-head">
          <h2>Your ritual</h2>
          <span className="ritual-count">{done} of {ritual.length}</span>
        </div>
        <div className="ritual-bar" aria-hidden><i style={{ width: `${(done / ritual.length) * 100}%` }} /></div>
        <ul>
          {ritual.map((r) => (
            <li key={r.id}>
              <button className={r.done ? "step done" : "step"} onClick={() => toggle(r.id)} aria-pressed={r.done}>
                <span className="tick">{r.done && <Check size={14} strokeWidth={3} aria-hidden />}</span>
                <span className="step-label">{r.label}</span>
                <span className="step-time">{r.time}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="section-head">
          <h2>Picked for <em>this week</em></h2>
          <Link to="/explore" className="link">Explore</Link>
        </div>
        <div className="rail">
          {picks.map((s) => <SessionCard key={s.id} s={s} />)}
        </div>
      </section>

      <blockquote className="note">
        <p>You do not have to finish the day to rest in it.</p>
        <cite>Nana Owusu, guide</cite>
      </blockquote>
    </main>
  );
}
