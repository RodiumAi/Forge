import "../styles/profile.css";
import { ChevronRight, Flame, LogOut, Medal, Mountain, Volume2, Watch, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ME } from "../data";

const BADGES: { label: string; icon: LucideIcon; earned: boolean }[] = [
  { label: "First half", icon: Medal, earned: true },
  { label: "21-day streak", icon: Flame, earned: true },
  { label: "Sub-23 5K", icon: Zap, earned: true },
  { label: "Hill climber", icon: Mountain, earned: false },
];

const TOTALS = [
  { value: "1 486", label: "km this year" },
  { value: "214", label: "runs" },
  { value: "21", label: "day streak" },
];

type Props = { onSignOut: () => void };

export default function ProfileScreen({ onSignOut }: Props) {
  const [units, setUnits] = useState<"km" | "mi">("km");
  const [cues, setCues] = useState(true);
  const [autoPause, setAutoPause] = useState(false);

  return (
    <main className="app-main profile-screen">
      <section className="me">
        <img src={ME.avatar} alt="" />
        <div>
          <h2>{ME.name}</h2>
          <p className="muted">{ME.club}</p>
          <span className="level">{ME.level}</span>
        </div>
      </section>

      <section className="totals">
        {TOTALS.map((t) => (
          <div key={t.label}><p className="num">{t.value}</p><span>{t.label}</span></div>
        ))}
      </section>

      <section>
        <div className="section-head"><h2>Badges</h2><span className="muted">3 of 24</span></div>
        <div className="badges">
          {BADGES.map(({ label, icon: Icon, earned }) => (
            <div key={label} className={earned ? "badge earned" : "badge"}>
              <span><Icon size={24} strokeWidth={2} aria-hidden /></span>
              <small>{label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card list">
        <div className="item">
          <span className="i-label">Units</span>
          <div className="units" role="radiogroup" aria-label="Units">
            {(["km", "mi"] as const).map((u) => (
              <button key={u} role="radio" aria-checked={units === u} className={units === u ? "on" : ""} onClick={() => setUnits(u)}>{u}</button>
            ))}
          </div>
        </div>
        <div className="item">
          <span className="i-icon"><Volume2 size={18} strokeWidth={2} aria-hidden /></span>
          <span className="i-label">Audio cues every km</span>
          <button className={cues ? "toggle on" : "toggle"} onClick={() => setCues((v) => !v)} aria-pressed={cues} aria-label="Audio cues" />
        </div>
        <div className="item">
          <span className="i-icon"><Zap size={18} strokeWidth={2} aria-hidden /></span>
          <span className="i-label">Auto-pause at lights</span>
          <button className={autoPause ? "toggle on" : "toggle"} onClick={() => setAutoPause((v) => !v)} aria-pressed={autoPause} aria-label="Auto-pause" />
        </div>
        <button className="item">
          <span className="i-icon"><Watch size={18} strokeWidth={2} aria-hidden /></span>
          <span className="i-label">Forerunner 265 <small>Synced 2 min ago</small></span>
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
      </section>

      <button className="btn-ghost sign-out" onClick={onSignOut}><LogOut size={18} strokeWidth={2} aria-hidden /> Sign out</button>
    </main>
  );
}
