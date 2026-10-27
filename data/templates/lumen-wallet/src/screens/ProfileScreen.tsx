import "../styles/profile.css";
import { BellRing, ChevronRight, CircleHelp, Fingerprint, Gift, LogOut, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";
import { ME } from "../data";

const LINKS = [
  { label: "Personal details", icon: UserRound },
  { label: "Security & Face ID", icon: Fingerprint },
  { label: "Invite friends, get 2 000 FCFA", icon: Gift },
  { label: "Help center", icon: CircleHelp },
];

type Props = { onSignOut: () => void };

export default function ProfileScreen({ onSignOut }: Props) {
  const [alerts, setAlerts] = useState(true);

  return (
    <main className="app-main profile-screen">
      <section className="me">
        <img src={ME.avatar} alt="" />
        <div>
          <h2>{ME.name}</h2>
          <p className="muted">{ME.handle}</p>
        </div>
      </section>

      <section className="plan">
        <Sparkles size={20} strokeWidth={2} aria-hidden />
        <div><strong>Lumen Plus</strong><span>Free transfers abroad, 2% cashback</span></div>
        <button className="plan-btn">Manage</button>
      </section>

      <section className="card list">
        <div className="item">
          <span className="i-icon"><BellRing size={18} strokeWidth={2} aria-hidden /></span>
          <span className="i-label">Payment alerts</span>
          <button className={alerts ? "toggle on" : "toggle"} onClick={() => setAlerts((v) => !v)} aria-pressed={alerts} aria-label="Payment alerts" />
        </div>
        {LINKS.map(({ label, icon: Icon }) => (
          <button key={label} className="item">
            <span className="i-icon"><Icon size={18} strokeWidth={2} aria-hidden /></span>
            <span className="i-label">{label}</span>
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
        ))}
      </section>

      <button className="btn-ghost sign-out" onClick={onSignOut}><LogOut size={18} strokeWidth={2} aria-hidden /> Sign out</button>
    </main>
  );
}
