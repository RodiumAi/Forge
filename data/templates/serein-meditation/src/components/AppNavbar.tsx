import { Bell } from "lucide-react";
import { ME, TITLES, type Tab } from "../data";

type Props = { tab: Tab };

/** Today greets by name with an italic accent; other tabs show their title. */
export default function AppNavbar({ tab }: Props) {
  const home = tab === "home";
  return (
    <header className="app-navbar">
      {home ? (
        <div className="who">
          <p className="hello">Saturday, 25 October</p>
          <h1>Good morning, <em>{ME.first}</em></h1>
        </div>
      ) : (
        <h1 className="screen-title">{TITLES[tab]}</h1>
      )}
      <div className="nav-actions">
        <button className="nav-action" aria-label="Reminders">
          <Bell size={19} strokeWidth={1.8} aria-hidden />
          <span className="nav-dot" aria-hidden />
        </button>
        {home && <span className="pfp"><img src={ME.avatar} alt="" /></span>}
      </div>
    </header>
  );
}
