import { Bell } from "lucide-react";
import { AVATAR, SUBS, TITLES, type Tab } from "../data";

export default function AppNavbar({ tab }: { tab: Tab }) {
  return (
    <header className="app-navbar">
      <div className="who">
        <span className="pfp"><img src={AVATAR} alt="" /></span>
        <div>
          <h1>{TITLES[tab]}</h1>
          <p className="sub">{SUBS[tab]}</p>
        </div>
      </div>
      <button className="nav-action" aria-label="Notifications"><Bell size={20} strokeWidth={1.8} aria-hidden /></button>
    </header>
  );
}
