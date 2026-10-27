import "../styles/profile.css";
import { BellRing, ChevronRight, CircleHelp, Download, Gift, LogOut, Pencil, Type } from "lucide-react";
import { useState } from "react";
import { GOAL, ME, MONTHS, STATS } from "../data";

const LINKS = [
  { label: "Reading preferences", icon: Type },
  { label: "Gift a book", icon: Gift },
  { label: "Help and feedback", icon: CircleHelp },
];

type Props = { onSignOut: () => void };

export default function ProfileScreen({ onSignOut }: Props) {
  const [reminder, setReminder] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const share = GOAL.read / GOAL.target;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const peak = Math.max(...MONTHS.map((m) => m.v));

  return (
    <main className="app-main profile-screen">
      <section className="me">
        <img src={ME.avatar} alt="" />
        <div>
          <h2>{ME.name}</h2>
          <p className="muted">{ME.since}</p>
        </div>
        <button className="icon-btn" aria-label="Edit profile"><Pencil size={17} strokeWidth={1.9} aria-hidden /></button>
      </section>

      <section className="goal">
        <div className="ring">
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r={r} className="track" />
            <circle cx="60" cy="60" r={r} className="arc" strokeDasharray={circ} strokeDashoffset={circ * (1 - share)} />
          </svg>
          <span className="ring-num"><strong>{GOAL.read}</strong><small>of {GOAL.target}</small></span>
        </div>
        <div className="goal-text">
          <p className="kicker">{GOAL.year} reading goal</p>
          <h3>{GOAL.target - GOAL.read} books to go</h3>
          <p className="muted">About one every ten days keeps you on pace for December.</p>
        </div>
        <div className="months" aria-label="Books finished per month">
          {MONTHS.map((m, i) => (
            <span key={i} className={i === 9 ? "now" : ""}>
              <i style={{ height: `${(m.v / peak) * 100}%` }} />
              <small>{m.m}</small>
            </span>
          ))}
        </div>
      </section>

      <section className="stats">
        {STATS.map((s) => (
          <div key={s.label} className="stat">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </section>

      <section className="card list">
        <div className="item">
          <span className="i-icon"><BellRing size={18} strokeWidth={1.9} aria-hidden /></span>
          <span className="i-label">Evening reminder<small>Every day at 21:30</small></span>
          <button className={reminder ? "toggle on" : "toggle"} onClick={() => setReminder((v) => !v)} aria-pressed={reminder} aria-label="Evening reminder" />
        </div>
        <div className="item">
          <span className="i-icon"><Download size={18} strokeWidth={1.9} aria-hidden /></span>
          <span className="i-label">Download on Wi-Fi only<small>Audiobooks and samples</small></span>
          <button className={wifiOnly ? "toggle on" : "toggle"} onClick={() => setWifiOnly((v) => !v)} aria-pressed={wifiOnly} aria-label="Download on Wi-Fi only" />
        </div>
        {LINKS.map(({ label, icon: Icon }) => (
          <button key={label} className="item">
            <span className="i-icon"><Icon size={18} strokeWidth={1.9} aria-hidden /></span>
            <span className="i-label">{label}</span>
            <ChevronRight size={18} strokeWidth={1.9} aria-hidden />
          </button>
        ))}
      </section>

      <button className="btn-ghost sign-out" onClick={onSignOut}><LogOut size={18} strokeWidth={1.9} aria-hidden /> Sign out</button>
    </main>
  );
}
