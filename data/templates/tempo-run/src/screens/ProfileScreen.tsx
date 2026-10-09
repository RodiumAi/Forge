import "../styles/profile.css";
import { CircleHelp, Flag, Music } from "lucide-react";
import { DEVICES } from "../data";
import ListRow from "../components/ListRow";

type Props = { autoPause: boolean; onAutoPause: () => void };

export default function ProfileScreen({ autoPause, onAutoPause }: Props) {
  return (
    <main className="app-main profile-screen">
      <section className="card goal-card">
        <div className="row"><h3>Weekly goal</h3><span className="pill">32.1 / 40 km</span></div>
        <div className="meter" aria-hidden><span style={{ width: "80%" }} /></div>
        <p className="muted" style={{ fontSize: ".8rem", marginTop: ".55rem" }}>7.9 km to go — one more easy session closes it.</p>
      </section>

      <div className="section-head"><h2>Connected devices</h2></div>
      <section className="card">
        {DEVICES.map((d) => (
          <ListRow key={d.title} badge={<d.Icon size={18} strokeWidth={2} />} title={d.title} sub={d.sub}>
            {d.paired ? <span className="dot-ok" aria-hidden /> : <span className="link">Pair</span>}
          </ListRow>
        ))}
      </section>

      <div className="section-head"><h2>Settings</h2></div>
      <section className="card">
        <ListRow badge={<Flag size={18} strokeWidth={2} />} title="Units" sub="Kilometres · metric">
          <span className="link">Edit</span>
        </ListRow>
        <div className="row" style={{ padding: ".7rem 0", borderBottom: "1px solid var(--line)" }}>
          <div><strong style={{ fontSize: ".92rem" }}>Auto-pause</strong><p className="muted" style={{ fontSize: ".8rem" }}>Pause the timer when you stop</p></div>
          <button className={autoPause ? "toggle on" : "toggle"} aria-pressed={autoPause} onClick={onAutoPause} />
        </div>
        <ListRow badge={<Music size={18} strokeWidth={2} />} title="Split cues" sub="Voice every 1 km">
          <span className="link">Manage</span>
        </ListRow>
        <ListRow badge={<CircleHelp size={18} strokeWidth={2} />} title="Help & support" sub="Guides and contact">
          <span className="link">Open</span>
        </ListRow>
      </section>
    </main>
  );
}
