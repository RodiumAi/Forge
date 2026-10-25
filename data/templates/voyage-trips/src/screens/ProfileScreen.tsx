import "../styles/profile.css";
import { BellRing, ChevronRight, CircleHelp, CreditCard, Globe, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useFavorites } from "../components/Favorites";
import { ME } from "../data";

const LINKS = [
  { label: "Payment methods", value: "Visa 4821", icon: CreditCard },
  { label: "Language & currency", value: "English, EUR", icon: Globe },
  { label: "Travel documents", value: "Passport", icon: ShieldCheck },
  { label: "Help & support", value: "", icon: CircleHelp },
];

type Props = { onSignOut: () => void };

export default function ProfileScreen({ onSignOut }: Props) {
  const { ids } = useFavorites();
  const [alerts, setAlerts] = useState(true);

  const stats = [
    { label: "Countries", value: 14 },
    { label: "Trips", value: 23 },
    { label: "Saved", value: ids.length },
  ];

  return (
    <main className="app-main profile-screen">
      <section className="me">
        <img src={ME.avatar} alt="" />
        <h2>{ME.name}</h2>
        <p className="muted">{ME.since}</p>
      </section>

      <section className="stats">
        {stats.map((s) => (
          <div key={s.label}><strong>{s.value}</strong><span>{s.label}</span></div>
        ))}
      </section>

      <section className="plus">
        <p className="kicker">Voyage Plus</p>
        <h3>Free cancellation on <em>every</em> stay</h3>
        <span className="bar" aria-hidden><i /></span>
        <p className="muted">2 more trips to unlock Gold and airport lounges.</p>
      </section>

      <section className="card list">
        <div className="item">
          <span className="i-icon"><BellRing size={18} strokeWidth={2} aria-hidden /></span>
          <span className="i-label">Price drop alerts</span>
          <button className={alerts ? "toggle on" : "toggle"} onClick={() => setAlerts((v) => !v)} aria-pressed={alerts} aria-label="Price drop alerts" />
        </div>
        {LINKS.map(({ label, value, icon: Icon }) => (
          <button key={label} className="item">
            <span className="i-icon"><Icon size={18} strokeWidth={2} aria-hidden /></span>
            <span className="i-label">{label}</span>
            {value && <span className="i-value">{value}</span>}
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
        ))}
      </section>

      <button className="btn-ghost sign-out" onClick={onSignOut}><LogOut size={18} strokeWidth={2} aria-hidden /> Sign out</button>
    </main>
  );
}
