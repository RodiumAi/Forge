import "../styles/workout.css";
import { ArrowLeft, Bookmark, Check, Clock, Flame, Gauge, Play } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useActivity } from "../components/Activity";
import { WORKOUTS } from "../data";

/** Stack screen (no tab bar): program detail, then a tap-through checklist and a finish state. */
export default function WorkoutScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addWorkout } = useActivity();
  const w = WORKOUTS.find((x) => x.id === id);
  const [saved, setSaved] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  if (!w) return <Navigate to="/workouts" replace />;
  const workout = w;

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/workouts", { replace: true });
  }

  function tick(i: number) {
    if (!started) return;
    setDone((list) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i]));
  }

  function finish() {
    addWorkout(workout.minutes, workout.kcal);
    setFinished(true);
  }

  if (finished) {
    return (
      <div className="app-shell workout-screen finished">
        <div className="done-mark"><Check size={42} strokeWidth={2.8} aria-hidden /></div>
        <p className="kicker">Workout complete</p>
        <h1>{workout.title}</h1>
        <div className="done-stats">
          <div><p className="num">{workout.minutes}</p><span>min</span></div>
          <div><p className="num">{workout.kcal}</p><span>kcal</span></div>
          <div><p className="num">{done.length}/{workout.exercises.length}</p><span>moves</span></div>
        </div>
        <button className="btn-primary" onClick={() => navigate("/", { replace: true })}>Close my rings</button>
      </div>
    );
  }

  const progress = done.length / workout.exercises.length;

  return (
    <div className="app-shell workout-screen">
      <section className="hero">
        <img src={workout.photo} alt="" />
        <span className="hero-shade" aria-hidden />
        <header className="hero-bar">
          <button className="glass-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2.2} aria-hidden /></button>
          <button className={saved ? "glass-btn on" : "glass-btn"} onClick={() => setSaved((v) => !v)} aria-pressed={saved} aria-label={saved ? "Remove bookmark" : "Bookmark workout"}>
            <Bookmark size={19} strokeWidth={2.2} fill={saved ? "currentColor" : "none"} aria-hidden />
          </button>
        </header>
        <div className="hero-text">
          <span className="hero-kind">{workout.kind}</span>
          <h1>{workout.title}</h1>
          <p>{workout.coach}</p>
        </div>
      </section>

      <section className="facts">
        <div><Clock size={17} strokeWidth={2.2} aria-hidden /><p className="num">{workout.minutes}</p><span>min</span></div>
        <div><Flame size={17} strokeWidth={2.2} aria-hidden /><p className="num">{workout.kcal}</p><span>kcal</span></div>
        <div><Gauge size={17} strokeWidth={2.2} aria-hidden /><p className="level">{workout.level}</p><span>level</span></div>
      </section>

      <section className="moves">
        <div className="section-head">
          <h2>{workout.exercises.length} moves</h2>
          {started && <span className="moves-count">{done.length} done</span>}
        </div>
        {started && <div className="moves-bar" aria-hidden><i style={{ width: `${progress * 100}%` }} /></div>}
        <ol>
          {workout.exercises.map((e, i) => (
            <li key={e.name}>
              <button className={done.includes(i) ? "move done" : "move"} onClick={() => tick(i)} disabled={!started} aria-pressed={done.includes(i)}>
                <span className="move-n">{done.includes(i) ? <Check size={16} strokeWidth={3} aria-hidden /> : String(i + 1).padStart(2, "0")}</span>
                <span className="move-text"><strong>{e.name}</strong><span>{e.detail}</span></span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div className="dock">
        {started ? (
          <button className="btn-primary" onClick={finish} disabled={done.length === 0}>Finish workout</button>
        ) : (
          <button className="btn-primary" onClick={() => setStarted(true)}><Play size={18} strokeWidth={2.4} fill="currentColor" aria-hidden /> Start workout</button>
        )}
      </div>
    </div>
  );
}
