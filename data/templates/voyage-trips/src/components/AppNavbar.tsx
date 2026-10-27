import { Bell, MapPin } from "lucide-react";
import { ME, TITLES, type Tab } from "../data";

type Props = { tab: Tab };

export default function AppNavbar({ tab }: Props) {
  const home = tab === "home";
  return (
    <header className="app-navbar">
      {home ? (
        <div className="where">
          <span className="where-label">Current location</span>
          <span className="where-city"><MapPin size={15} strokeWidth={2.4} aria-hidden /> {ME.city}</span>
        </div>
      ) : (
        <h1 className="screen-title">{TITLES[tab]}</h1>
      )}
      <div className="nav-actions">
        <button className="nav-action" aria-label="Notifications">
          <Bell size={19} strokeWidth={2} aria-hidden />
          <span className="nav-dot" aria-hidden />
        </button>
        <span className="pfp"><img src={ME.avatar} alt="" /></span>
      </div>
    </header>
  );
}
