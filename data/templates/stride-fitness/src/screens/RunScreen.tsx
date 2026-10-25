import "../styles/run.css";
import { Check, Flame, HeartPulse, Pause, Play, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActivity } from "../components/Activity";

type Phase = "ready" | "countdown" | "running" | "paused" | "done";

// Demo pace: 4:50 per km, a little wobble so the live pace feels real.
const SEC_PER_KM = 290;

function clock(sec: number, long = true) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return long ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Stack screen (no tab bar): live run with countdown, pause / resume, finish and a summary. */
export default function RunScreen() {
  const navigate = useNavigate();
  const { addRun } = useActivity();
  const [phase, setPhase] = useState<Phase>("ready");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const km = elapsed / SEC_PER_KM;
  const pace = elapsed ? SEC_PER_KM + Math.round(Math.sin(elapsed / 7) * 9) : 0;
  const kcal = Math.round(km * 62);
  const bpm = phase === "running" ? 148 + Math.round(Math.sin(elapsed / 5) * 6) : 112;

  useEffect(() => {
    if (phase === "countdown") {
      if (count === 0) { setPhase("running"); return; }
      const t = window.setTimeout(() => setCount((c) => c - 1), 800);
      return () => window.clearTimeout(t);
    }
    if (phase !== "running") return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase, count]);

  function close() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  function finish() {
    addRun(km, elapsed);
    setPhase("done");
  }

  if (phase === "done") {
    return (
      <div className="app-shell run-screen summary">
        <div className="done-mark"><Check size={40} strokeWidth={2.8} aria-hidden /></div>
        <p className="kicker">Run saved</p>
        <p className="num sum-km">{km.toFixed(2)}<small>km</small></p>
        <div className="sum-grid">
          <div><span className="kicker">Time</span><p className="num">{clock(elapsed, false)}</p></div>
          <div><span className="kicker">Avg pace</span><p className="num">{clock(SEC_PER_KM, false)}</p></div>
          <div><span className="kicker">Calories</span><p className="num">{kcal}</p></div>
          <div><span className="kicker">Avg heart</span><p className="num">146</p></div>
        </div>
        <p className="muted">Your Move ring just got {kcal} kcal closer. Nice work, Kwame.</p>
        <button className="btn-primary" onClick={() => navigate("/", { replace: true })}>Back to today</button>
      </div>
    );
  }

  const live = phase === "running" || phase === "paused";

  return (
    <div className={`app-shell run-screen ${phase}`}>
      <header className="run-bar">
        <button className="icon-btn" onClick={close} aria-label="Close"><X size={20} strokeWidth={2.2} aria-hidden /></button>
        <span className={`gps${live ? " on" : ""}`}><i aria-hidden /> {phase === "paused" ? "Paused" : live ? "GPS locked" : "Outdoor run"}</span>
        <span className="bar-space" aria-hidden />
      </header>

      <section className="clock">
        <p className="kicker">Time</p>
        <p className="num big-time">{clock(elapsed)}</p>
      </section>

      <section className="route" aria-hidden>
        <svg viewBox="0 0 320 150" preserveAspectRatio="none">
          <path className="route-bg" d="M12 120 C 60 120, 70 40, 120 52 S 170 130, 210 96 S 260 24, 308 30" pathLength={1} />
          {km > 0 && <path className="route-done" d="M12 120 C 60 120, 70 40, 120 52 S 170 130, 210 96 S 260 24, 308 30" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - Math.min(km / 5, 1)} />}
        </svg>
      </section>

      <section className="metrics">
        <div className="metric main"><p className="num">{km.toFixed(2)}</p><span>km</span></div>
        <div className="metric"><p className="num">{pace ? clock(pace, false) : "0:00"}</p><span>/km pace</span></div>
        <div className="metric"><p className="num"><Flame size={18} strokeWidth={2.4} aria-hidden />{kcal}</p><span>kcal</span></div>
        <div className="metric"><p className="num"><HeartPulse size={18} strokeWidth={2.4} aria-hidden />{bpm}</p><span>bpm</span></div>
      </section>

      <section className="run-controls">
        {phase === "ready" && (
          <button className="go" onClick={() => setPhase("countdown")} aria-label="Start run">GO</button>
        )}
        {phase === "countdown" && <div className="go counting" aria-live="assertive">{count || "GO"}</div>}
        {phase === "running" && (
          <button className="ctrl pause" onClick={() => setPhase("paused")} aria-label="Pause"><Pause size={34} strokeWidth={2} fill="currentColor" aria-hidden /></button>
        )}
        {phase === "paused" && (
          <>
            <button className="ctrl finish" onClick={finish} aria-label="Finish run"><Square size={26} strokeWidth={2} fill="currentColor" aria-hidden /></button>
            <button className="ctrl resume" onClick={() => setPhase("running")} aria-label="Resume"><Play size={34} strokeWidth={2} fill="currentColor" aria-hidden /></button>
          </>
        )}
      </section>
      <p className="hint">{phase === "paused" ? "Resume, or finish and save" : phase === "running" ? "Tap pause at the lights" : "Phone in pocket, eyes up"}</p>
    </div>
  );
}
