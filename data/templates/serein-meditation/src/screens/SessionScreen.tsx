import "../styles/session.css";
import { ArrowLeft, Check, Heart, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useSaved } from "../components/Saved";
import { findSession } from "../data";

const R = 118;
const C = 2 * Math.PI * R;

function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Stack screen (no tab bar): ambient photo, progress ring, play/pause, then a calm completion state. */
export default function SessionScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const session = findSession(id);
  const { isSaved, toggle } = useSaved();
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const total = (session?.minutes ?? 1) * 60;
  const done = elapsed >= total;

  useEffect(() => {
    if (!playing || done) return;
    const t = window.setInterval(() => setElapsed((e) => Math.min(e + 1, total)), 1000);
    return () => window.clearInterval(t);
  }, [playing, done, total]);

  if (!session) return <Navigate to="/" replace />;

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  function skip(by: number) {
    setElapsed((e) => Math.max(0, Math.min(total, e + by)));
  }

  const saved = isSaved(session.id);

  return (
    <div className={`app-shell session-screen${done ? " done" : ""}`}>
      <img className="ambient" src={session.photo} alt="" />
      <span className="veil" aria-hidden />

      <header className="session-bar">
        <button className="glass-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2} aria-hidden /></button>
        <span className="session-cat">{session.category}</span>
        <button className={saved ? "glass-btn on" : "glass-btn"} onClick={() => toggle(session.id)} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save session"}>
          <Heart size={19} strokeWidth={2} fill={saved ? "currentColor" : "none"} aria-hidden />
        </button>
      </header>

      {done ? (
        <section className="complete">
          <div className="complete-mark"><Check size={38} strokeWidth={2.4} aria-hidden /></div>
          <p className="kicker">Session complete</p>
          <h1>Well <em>breathed</em>, Aïcha</h1>
          <p className="complete-meta">+{session.minutes} minutes today · 13 day streak</p>
          <div className="complete-actions">
            <button className="btn-primary" onClick={() => navigate("/", { replace: true })}>Back to today</button>
            <button className="btn-ghost" onClick={() => { setElapsed(0); setPlaying(true); }}>Play again</button>
          </div>
        </section>
      ) : (
        <>
          <section className="dial">
            <svg viewBox="0 0 280 280" aria-hidden>
              <defs>
                <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f8d9c0" />
                  <stop offset="100%" stopColor="#e07a5f" />
                </linearGradient>
              </defs>
              <circle className="track" cx="140" cy="140" r={R} />
              <circle className="progress" cx="140" cy="140" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - elapsed / total)} />
            </svg>
            <div className={playing ? "dial-core breathing" : "dial-core"}>
              <span className="time">{clock(elapsed)}</span>
              <span className="of">of {clock(total)}</span>
            </div>
          </section>

          <section className="session-info">
            <h1>{session.title}</h1>
            <p>with {session.guide} · {session.minutes} min</p>
            <p className="blurb">{session.blurb}</p>
          </section>

          <section className="controls">
            <button className="glass-btn lg" onClick={() => skip(-15)} aria-label="Back 15 seconds"><RotateCcw size={22} strokeWidth={1.9} aria-hidden /></button>
            <button className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={30} strokeWidth={2} fill="currentColor" aria-hidden /> : <Play size={30} strokeWidth={2} fill="currentColor" aria-hidden />}
            </button>
            <button className="glass-btn lg" onClick={() => skip(15)} aria-label="Forward 15 seconds"><RotateCw size={22} strokeWidth={1.9} aria-hidden /></button>
          </section>
        </>
      )}
    </div>
  );
}
