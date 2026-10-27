import { Bell, Settings } from "lucide-react";
import { ME, TITLES, type Tab } from "../data";

type Props = { tab: Tab };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function AppNavbar({ tab }: Props) {
  const home = tab === "home";
  return (
    <header className="app-navbar">
      {home ? (
        <div className="who">
          <span className="pfp"><img src={ME.avatar} alt="" /></span>
          <div>
            <p className="hello">{greeting()}</p>
            <h1>{ME.first}</h1>
          </div>
        </div>
      ) : (
        <h1 className="screen-title">{TITLES[tab]}</h1>
      )}
      <div className="nav-actions">
        <button className="nav-action" aria-label="What's new">
          <Bell size={19} strokeWidth={2} aria-hidden />
          <span className="nav-dot" aria-hidden />
        </button>
        {!home && <button className="nav-action" aria-label="Settings"><Settings size={19} strokeWidth={2} aria-hidden /></button>}
      </div>
    </header>
  );
}
