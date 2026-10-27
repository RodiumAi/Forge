import "../styles/profile.css";
import { AudioLines, Brain, ChevronRight, CircleHelp, Database, Globe, LogOut, Sparkles, Vibrate, Wand2 } from "lucide-react";
import { useState } from "react";
import { ME, PLAN, USAGE } from "../data";

const LINKS = [
  { label: "Personalization", hint: "Tone, name, about you", icon: Wand2 },
  { label: "Data controls", hint: "Export or delete chats", icon: Database },
  { label: "Language", hint: "English", icon: Globe },
  { label: "Help and feedback", hint: "", icon: CircleHelp },
];

type Props = { onSignOut: () => void };

export default function ProfileScreen({ onSignOut }: Props) {
  const [memory, setMemory] = useState(true);
  const [voice, setVoice] = useState(true);
  const [haptics, setHaptics] = useState(false);
  const toggles = [
    { label: "Memory", hint: "Nova remembers 14 facts about you", icon: Brain, on: memory, set: setMemory },
    { label: "Spoken replies", hint: "Read answers aloud in voice mode", icon: AudioLines, on: voice, set: setVoice },
    { label: "Haptics", hint: "A light tap when Nova answers", icon: Vibrate, on: haptics, set: setHaptics },
  ];

  return (
    <main className="app-main profile-screen">
      <section className="me">
        <img src={ME.avatar} alt="" />
        <div>
          <h2>{ME.name}</h2>
          <p className="muted">{ME.email}</p>
        </div>
      </section>

      <section className="plan">
        <span className="plan-glow" aria-hidden />
        <div className="plan-top">
          <span className="plan-badge"><Sparkles size={14} strokeWidth={2.2} aria-hidden /> {PLAN.name}</span>
          <span className="plan-price"><strong>{PLAN.price}</strong> {PLAN.currency} / month</span>
        </div>
        <p className="plan-note">Renews on {PLAN.renews}. Advanced model, voice mode and file uploads included.</p>
        <div className="meters">
          {USAGE.map((u) => (
            <div key={u.label} className="meter">
              <div className="m-row"><span>{u.label}</span><span><strong>{u.used}</strong> / {u.total} {u.unit}</span></div>
              <div className="m-bar" aria-hidden><i style={{ width: `${(u.used / u.total) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <button className="btn-ghost manage">Manage subscription</button>
      </section>

      <section className="card list">
        {toggles.map(({ label, hint, icon: Icon, on, set }) => (
          <div key={label} className="item">
            <span className="i-icon"><Icon size={18} strokeWidth={1.9} aria-hidden /></span>
            <span className="i-label">{label}<small>{hint}</small></span>
            <button className={on ? "toggle on" : "toggle"} onClick={() => set((v) => !v)} aria-pressed={on} aria-label={label} />
          </div>
        ))}
      </section>

      <section className="card list">
        {LINKS.map(({ label, hint, icon: Icon }) => (
          <button key={label} className="item">
            <span className="i-icon"><Icon size={18} strokeWidth={1.9} aria-hidden /></span>
            <span className="i-label">{label}{hint && <small>{hint}</small>}</span>
            <ChevronRight size={18} strokeWidth={1.9} aria-hidden />
          </button>
        ))}
      </section>

      <button className="btn-ghost sign-out" onClick={onSignOut}><LogOut size={18} strokeWidth={1.9} aria-hidden /> Sign out</button>
    </main>
  );
}
