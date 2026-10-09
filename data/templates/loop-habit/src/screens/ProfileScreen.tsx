import "../styles/profile.css";
import { ACHIEVEMENTS, AVATAR, PREFS } from "../data";
import HabitRow from "../components/HabitRow";

type Props = { totalDays: number; reminders: boolean; onReminders: () => void };

export default function ProfileScreen({ totalDays, reminders, onReminders }: Props) {
  return (
    <main className="app-main profile-screen">
      <div className="profile-head">
        <span className="pfp"><img src={AVATAR} alt="" /></span>
        <div>
          <h2 className="pname">Maya Okonkwo</h2>
          <p className="muted">Since March · {totalDays} streak days total</p>
        </div>
      </div>
      <section className="card">
        <div className="row" style={{ marginBottom: ".7rem" }}>
          <div><strong style={{ fontSize: ".95rem" }}>Reminders</strong><p className="muted" style={{ fontSize: ".8rem" }}>Gentle nudges · 8:00 & 20:00</p></div>
          <button className={reminders ? "toggle on" : "toggle"} aria-pressed={reminders} onClick={onReminders} />
        </div>
        {PREFS.map((p) => (
          <HabitRow key={p.title} Icon={p.Icon} title={p.title} sub={<span>{p.sub}</span>}>
            <span className="link">{p.action}</span>
          </HabitRow>
        ))}
      </section>
      <div className="section-head"><h2>Achievements</h2><span className="link">3 of 12</span></div>
      <section className="card list">
        {ACHIEVEMENTS.map((a) => (
          <HabitRow key={a.name} Icon={a.Icon} title={a.name} sub={<span>{a.sub}</span>} className={a.got ? undefined : "locked"}>
            <span className={a.got ? "badge" : "badge off"}>{a.got ? "Earned" : "Locked"}</span>
          </HabitRow>
        ))}
      </section>
    </main>
  );
}
