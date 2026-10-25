import "../styles/profile.css";
import { Annoyed, BellRing, ChevronRight, CircleHelp, Flame, Frown, Heart, Laugh, LogOut, Meh, Smile, Sunrise, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useSaved } from "../components/Saved";
import { DONE_DAYS, ME, STATS, TODAY_DAY } from "../data";

const MOODS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "low", label: "Low", icon: Frown },
  { id: "tense", label: "Tense", icon: Annoyed },
  { id: "okay", label: "Okay", icon: Meh },
  { id: "good", label: "Good", icon: Smile },
  { id: "bright", label: "Bright", icon: Laugh },
];

// October 2026 starts on a Thursday: three empty cells in a Monday-first grid.
const LEAD = 3;
const DAYS = 31;

type Props = { onSignOut: () => void };

export default function ProfileScreen({ onSignOut }: Props) {
  const { saved } = useSaved();
  const [mood, setMood] = useState<string | null>(null);
  const [bedtime, setBedtime] = useState(true);
  const picked = MOODS.find((m) => m.id === mood);

  return (
    <main className="app-main profile-screen">
      <section className="me">
        <img src={ME.avatar} alt="" />
        <div>
          <h2>{ME.name}</h2>
          <p className="muted">{ME.since}</p>
        </div>
      </section>

      <section className="stats">
        {STATS.map((s) => (
          <div key={s.label}><strong>{s.value}</strong><span>{s.label}</span></div>
        ))}
      </section>

      <section className="card mood">
        <h2>How are you <em>arriving</em> today?</h2>
        <div className="moods" role="radiogroup" aria-label="Mood">
          {MOODS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="radio" aria-checked={mood === id} className={mood === id ? "on" : ""} onClick={() => setMood(id)}>
              <span><Icon size={24} strokeWidth={1.7} aria-hidden /></span>
              {label}
            </button>
          ))}
        </div>
        <p className="muted mood-note">
          {picked ? `Logged "${picked.label}" at 08:40. Thank you for checking in.` : "One tap, no judgement. It shapes tomorrow's picks."}
        </p>
      </section>

      <section className="card streak">
        <div className="section-head">
          <h2>October</h2>
          <span className="streak-pill"><Flame size={14} strokeWidth={2.2} aria-hidden /> 12 days</span>
        </div>
        <div className="cal-head" aria-hidden>{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="cal" aria-label={`${DONE_DAYS.length} days practiced in October`}>
          {Array.from({ length: LEAD }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: DAYS }, (_, i) => i + 1).map((d) => {
            const cls = d === TODAY_DAY ? "today" : DONE_DAYS.includes(d) ? "done" : d > TODAY_DAY ? "later" : "";
            return <span key={d} className={cls}>{d}</span>;
          })}
        </div>
      </section>

      <section className="card list">
        <div className="item">
          <span className="i-icon"><BellRing size={18} strokeWidth={1.9} aria-hidden /></span>
          <span className="i-label">Bedtime reminder <small>22:15</small></span>
          <button className={bedtime ? "toggle on" : "toggle"} onClick={() => setBedtime((v) => !v)} aria-pressed={bedtime} aria-label="Bedtime reminder" />
        </div>
        <button className="item">
          <span className="i-icon"><Heart size={18} strokeWidth={1.9} aria-hidden /></span>
          <span className="i-label">Saved sessions <small>{saved.length}</small></span>
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
        <button className="item">
          <span className="i-icon"><Sunrise size={18} strokeWidth={1.9} aria-hidden /></span>
          <span className="i-label">Morning check-in <small>07:30</small></span>
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
        <button className="item">
          <span className="i-icon"><CircleHelp size={18} strokeWidth={1.9} aria-hidden /></span>
          <span className="i-label">Help and feedback</span>
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
      </section>

      <button className="btn-ghost" onClick={onSignOut}><LogOut size={18} strokeWidth={2} aria-hidden /> Sign out</button>
    </main>
  );
}
