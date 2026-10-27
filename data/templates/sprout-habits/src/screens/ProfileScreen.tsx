import "../styles/profile.css";
import { Award, BellRing, ChevronRight, CircleHelp, Crown, Download, LogOut, Medal, Palmtree, Trophy, UserRound } from "lucide-react";
import { useState } from "react";
import { useHabits } from "../components/HabitsState";
import { FRIENDS, ME } from "../data";

const BADGES = [
  { label: "First week", icon: Medal, bg: "var(--butter)", ink: "#a37a00", got: true },
  { label: "30 days", icon: Trophy, bg: "var(--peach)", ink: "#c2582b", got: true },
  { label: "Early bird", icon: Award, bg: "var(--sky)", ink: "#3b67c4", got: true },
  { label: "100 days", icon: Crown, bg: "var(--lilac)", ink: "#7451c9", got: false },
];

const LINKS = [
  { label: "Account", icon: UserRound },
  { label: "Export my data", icon: Download },
  { label: "Help and feedback", icon: CircleHelp },
];

type Props = { onSignOut: () => void };

export default function ProfileScreen({ onSignOut }: Props) {
  const { habits } = useHabits();
  const [reminders, setReminders] = useState(true);
  const [weekend, setWeekend] = useState(false);
  const longest = Math.max(...habits.map((h) => h.best));

  return (
    <main className="app-main profile-screen">
      <section className="me">
        <img src={ME.avatar} alt="" />
        <h2>{ME.name}</h2>
        <p className="muted">{ME.since}</p>
        <div className="me-stats">
          <div><strong>{habits.length}</strong><span>Habits</span></div>
          <div><strong>47</strong><span>Perfect days</span></div>
          <div><strong>{longest}</strong><span>Longest streak</span></div>
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Badges</h2><span className="muted">3 of 12</span></div>
        <div className="badges">
          {BADGES.map(({ label, icon: Icon, bg, ink, got }) => (
            <div key={label} className={got ? "badge" : "badge locked"}>
              <span style={{ background: bg, color: ink }}><Icon size={24} strokeWidth={2} aria-hidden /></span>
              <small>{label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="buddies">
        <div className="avatars">{FRIENDS.map((f) => <img key={f.name} src={f.avatar} alt="" />)}</div>
        <div><strong>3 buddies cheering</strong><span>Ama checked all 5 habits today</span></div>
        <button className="nudge">Nudge</button>
      </section>

      <section className="card list">
        <div className="item">
          <span className="i-icon"><BellRing size={18} strokeWidth={2.1} aria-hidden /></span>
          <span className="i-label">Daily reminders</span>
          <button className={reminders ? "toggle on" : "toggle"} onClick={() => setReminders((v) => !v)} aria-pressed={reminders} aria-label="Daily reminders" />
        </div>
        <div className="item">
          <span className="i-icon"><Palmtree size={18} strokeWidth={2.1} aria-hidden /></span>
          <span className="i-label">Weekend rest mode</span>
          <button className={weekend ? "toggle on" : "toggle"} onClick={() => setWeekend((v) => !v)} aria-pressed={weekend} aria-label="Weekend rest mode" />
        </div>
        {LINKS.map(({ label, icon: Icon }) => (
          <button key={label} className="item">
            <span className="i-icon"><Icon size={18} strokeWidth={2.1} aria-hidden /></span>
            <span className="i-label">{label}</span>
            <ChevronRight size={18} strokeWidth={2.2} aria-hidden />
          </button>
        ))}
      </section>

      <button className="btn-ghost sign-out" onClick={onSignOut}><LogOut size={18} strokeWidth={2.1} aria-hidden /> Sign out</button>
    </main>
  );
}
