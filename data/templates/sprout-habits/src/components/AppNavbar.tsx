import { Bell, Flame } from "lucide-react";
import { ME, TITLES, type Tab } from "../data";
import { useHabits } from "./HabitsState";

type Props = { tab: Tab };

export default function AppNavbar({ tab }: Props) {
  const { habits } = useHabits();
  const home = tab === "home";
  const best = Math.max(...habits.map((h) => h.streak));

  return (
    <header className="app-navbar">
      {home ? (
        <div className="who">
          <span className="pfp"><img src={ME.avatar} alt="" /></span>
          <div>
            <p className="hello">Sunday, 25 October</p>
            <h1>Hi, {ME.first}</h1>
          </div>
        </div>
      ) : (
        <h1 className="screen-title">{TITLES[tab]}</h1>
      )}
      <div className="nav-actions">
        <span className="streak-pill" aria-label={`Best active streak ${best} days`}><Flame size={16} strokeWidth={2.2} aria-hidden /> {best}</span>
        <button className="nav-action" aria-label="Notifications">
          <Bell size={19} strokeWidth={2} aria-hidden />
          <span className="nav-dot" aria-hidden />
        </button>
      </div>
    </header>
  );
}
