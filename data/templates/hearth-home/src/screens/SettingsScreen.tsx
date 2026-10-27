import "../styles/settings.css";
import { BellRing, ChevronRight, CircleHelp, Cpu, Leaf, LogOut, MapPin, Plane, Users, Workflow } from "lucide-react";
import { useState } from "react";
import { HOME, ME } from "../data";

const LINKS = [
  { label: "Members", meta: "Kofi, Ama, Yao", icon: Users },
  { label: "Automations", meta: "6 active", icon: Workflow },
  { label: "Hub and devices", meta: "Hearth Hub, 11 devices", icon: Cpu },
  { label: "Help center", meta: "Guides and support", icon: CircleHelp },
];

type Props = { onSignOut: () => void };

export default function SettingsScreen({ onSignOut }: Props) {
  const [away, setAway] = useState(false);
  const [saver, setSaver] = useState(true);
  const [alerts, setAlerts] = useState(true);

  const switches = [
    { label: "Away mode", meta: "Lights off, door locked, cameras on", icon: Plane, on: away, set: setAway },
    { label: "Energy saver", meta: "Prefer solar after 10:00", icon: Leaf, on: saver, set: setSaver },
    { label: "Alerts", meta: "Door, smoke and water", icon: BellRing, on: alerts, set: setAlerts },
  ];

  return (
    <main className="app-main settings-screen">
      <section className="me">
        <img src={ME.avatar} alt="" />
        <div>
          <h2>{ME.name}</h2>
          <p className="muted">{ME.role}</p>
        </div>
      </section>

      <section className="home-card">
        <span className="hc-icon"><MapPin size={20} strokeWidth={2} aria-hidden /></span>
        <div><strong>{HOME.name}</strong><span>Haie Vive, {HOME.city}</span></div>
        <button className="hc-btn">Edit</button>
      </section>

      <section className="card list">
        {switches.map(({ label, meta, icon: Icon, on, set }) => (
          <div key={label} className="row">
            <span className="row-icon"><Icon size={18} strokeWidth={2} aria-hidden /></span>
            <span className="row-text"><strong>{label}</strong><span>{meta}</span></span>
            <button className={on ? "toggle on" : "toggle"} onClick={() => set((v) => !v)} aria-pressed={on} aria-label={label} />
          </div>
        ))}
      </section>

      <section className="card list">
        {LINKS.map(({ label, meta, icon: Icon }) => (
          <button key={label} className="row">
            <span className="row-icon"><Icon size={18} strokeWidth={2} aria-hidden /></span>
            <span className="row-text"><strong>{label}</strong><span>{meta}</span></span>
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
        ))}
      </section>

      <button className="btn-ghost sign-out" onClick={onSignOut}><LogOut size={18} strokeWidth={2} aria-hidden /> Sign out</button>
    </main>
  );
}
