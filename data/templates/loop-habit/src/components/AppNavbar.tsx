import { Bell, Repeat } from "lucide-react";
import { SUBS, TITLES, type Tab } from "../data";

export default function AppNavbar({ tab }: { tab: Tab }) {
  return (
    <header className="app-navbar">
      <div className="who">
        <span className="mark" aria-hidden><Repeat size={20} strokeWidth={2} /></span>
        <div>
          <h1>{TITLES[tab]}</h1>
          <p className="sub">{SUBS[tab]}</p>
        </div>
      </div>
      <button className="nav-action" aria-label="Notifications"><Bell size={20} strokeWidth={1.8} aria-hidden /></button>
    </header>
  );
}
