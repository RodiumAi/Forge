import "../styles/sleep.css";
import { Heart, MoonStar, Play } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useSaved } from "../components/Saved";
import { SOUNDS, STORIES, TONIGHT } from "../data";

const TIMERS = [15, 30, 45, 60];

export default function SleepScreen() {
  const { isSaved, toggle } = useSaved();
  const [sounds, setSounds] = useState<string[]>(["rain"]);
  const [timer, setTimer] = useState(30);

  function toggleSound(id: string) {
    setSounds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  return (
    <main className="app-main sleep-screen">
      <section className="night">
        <div className="night-head">
          <p className="night-kicker"><MoonStar size={15} strokeWidth={2} aria-hidden /> Tonight</p>
          <span className="night-time">Lights out 22:30</span>
        </div>

        <Link to={`/session/${TONIGHT.id}`} className="tonight">
          <img src={TONIGHT.photo} alt="" />
          <span className="tonight-shade" aria-hidden />
          <span className="tonight-body">
            <small>Sleep story · {TONIGHT.minutes} min</small>
            <strong>{TONIGHT.title}</strong>
            <span>Read by {TONIGHT.narrator}</span>
          </span>
          <span className="tonight-play" aria-hidden><Play size={20} strokeWidth={2} fill="currentColor" /></span>
        </Link>

        <div>
          <p className="night-label">Soundscape</p>
          <div className="sounds">
            {SOUNDS.map(({ id, label, icon: Icon }) => (
              <button key={id} className={sounds.includes(id) ? "sound on" : "sound"} onClick={() => toggleSound(id)} aria-pressed={sounds.includes(id)}>
                <Icon size={20} strokeWidth={1.8} aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="night-label">Fade out after</p>
          <div className="timers" role="radiogroup" aria-label="Sleep timer">
            {TIMERS.map((t) => (
              <button key={t} role="radio" aria-checked={timer === t} className={timer === t ? "on" : ""} onClick={() => setTimer(t)}>{t} min</button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Sleep <em>stories</em></h2>
          <span className="muted">{STORIES.length} new</span>
        </div>
        <ul className="stories">
          {STORIES.map((s) => (
            <li key={s.id} className="row">
              <Link to={`/session/${s.id}`} className="story-link">
                <img src={s.photo} alt="" />
                <span className="row-meta">
                  <strong>{s.title}</strong>
                  <span>{s.narrator} · {s.minutes} min</span>
                </span>
              </Link>
              <button className={isSaved(s.id) ? "heart on" : "heart"} onClick={() => toggle(s.id)} aria-pressed={isSaved(s.id)} aria-label={isSaved(s.id) ? "Remove from saved" : "Save story"}>
                <Heart size={18} strokeWidth={2} fill={isSaved(s.id) ? "currentColor" : "none"} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
