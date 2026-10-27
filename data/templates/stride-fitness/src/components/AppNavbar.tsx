import { Bell, Flame } from "lucide-react";
import { ME, TITLES, type Tab } from "../data";

type Props = { tab: Tab };

/** Uppercase condensed titles; Today adds the date kicker and the streak flame. */
export default function AppNavbar({ tab }: Props) {
  const home = tab === "home";
  return (
    <header className="app-navbar">
      <div className="who">
        {home && <span className="pfp"><img src={ME.avatar} alt="" /></span>}
        <div>
          <p className="hello">{home ? "Sat 25 Oct" : "Stride"}</p>
          <h1>{home ? `Hey, ${ME.first}` : TITLES[tab]}</h1>
        </div>
      </div>
      <div className="nav-actions">
        {home && <span className="streak"><Flame size={16} strokeWidth={2.2} aria-hidden /> 21</span>}
        <button className="nav-action" aria-label="Notifications">
          <Bell size={19} strokeWidth={2} aria-hidden />
          <span className="nav-dot" aria-hidden />
        </button>
      </div>
    </header>
  );
}
