import "../styles/new-habit.css";
import { Check, Sprout, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHabits } from "../components/HabitsState";
import { FREQUENCIES, ICONS, PALETTE, type Frequency, type Tint } from "../data";

const TIMES = ["06:30", "07:00", "12:30", "18:00", "21:30"];
const SUGGESTIONS = ["Journal 5 minutes", "No phone after 22:00", "Call my mum", "10 000 steps"];

/** Stack screen (no tab bar): name, icon, colour, frequency and reminder, then a success state. */
export default function NewHabitScreen() {
  const navigate = useNavigate();
  const { add } = useHabits();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("journal");
  const [tint, setTint] = useState<Tint>("lilac");
  const [frequency, setFrequency] = useState<Frequency>("Every day");
  const [time, setTime] = useState("07:00");
  const [created, setCreated] = useState(false);
  const Icon = ICONS[icon];

  function close() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  function create() {
    add({ name: name.trim(), icon, tint, frequency, time });
    setCreated(true);
  }

  if (created) {
    return (
      <div className="app-shell new-habit-screen done">
        <div className="done-art" style={{ background: PALETTE[tint].bg, color: PALETTE[tint].ink }}>
          <Icon size={44} strokeWidth={2} aria-hidden />
          <span className="done-check"><Check size={20} strokeWidth={3.2} aria-hidden /></span>
        </div>
        <h2>Habit planted</h2>
        <p className="muted">"{name.trim()}" starts today, {frequency.toLowerCase()} at {time}. First check is the hardest, you have got this.</p>
        <div className="done-actions">
          <button className="btn-primary" onClick={() => navigate("/", { replace: true })}><Sprout size={18} strokeWidth={2.2} aria-hidden /> See today</button>
          <button className="btn-ghost" onClick={() => { setName(""); setCreated(false); }}>Add another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell new-habit-screen">
      <header className="nh-bar">
        <button className="icon-btn" onClick={close} aria-label="Close"><X size={20} strokeWidth={2.2} aria-hidden /></button>
        <h1>New habit</h1>
        <span className="bar-space" aria-hidden />
      </header>

      <div className="preview" style={{ background: PALETTE[tint].bg }}>
        <span className="pv-icon" style={{ color: PALETTE[tint].ink }}><Icon size={26} strokeWidth={2.1} aria-hidden /></span>
        <span className="pv-text"><strong>{name.trim() || "Your new habit"}</strong><span>{frequency}, {time}</span></span>
        <span className="pv-check" aria-hidden />
      </div>

      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, journal 5 minutes" maxLength={40} />
      </label>
      <div className="suggest">
        {SUGGESTIONS.map((s) => <button key={s} className="sg" onClick={() => setName(s)}>{s}</button>)}
      </div>

      <section>
        <h2 className="label">Icon</h2>
        <div className="icons" role="radiogroup" aria-label="Icon">
          {Object.entries(ICONS).map(([key, I]) => (
            <button key={key} role="radio" aria-checked={icon === key} aria-label={key} className={icon === key ? "on" : ""} onClick={() => setIcon(key)}>
              <I size={22} strokeWidth={2} aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label">Colour</h2>
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {(Object.keys(PALETTE) as Tint[]).map((t) => (
            <button key={t} role="radio" aria-checked={tint === t} aria-label={t} className={tint === t ? "on" : ""} style={{ background: PALETTE[t].bg, color: PALETTE[t].ink }} onClick={() => setTint(t)}>
              {tint === t && <Check size={18} strokeWidth={3} aria-hidden />}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label">How often</h2>
        <div className="chips" role="radiogroup" aria-label="Frequency">
          {FREQUENCIES.map((f) => (
            <button key={f} role="radio" aria-checked={frequency === f} className={frequency === f ? "chip on" : "chip"} onClick={() => setFrequency(f)}>{f}</button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label">Remind me at</h2>
        <div className="chips" role="radiogroup" aria-label="Reminder time">
          {TIMES.map((t) => (
            <button key={t} role="radio" aria-checked={time === t} className={time === t ? "chip on" : "chip"} onClick={() => setTime(t)}>{t}</button>
          ))}
        </div>
      </section>

      <button className="btn-primary create" disabled={!name.trim()} onClick={create}>Create habit</button>
    </div>
  );
}
