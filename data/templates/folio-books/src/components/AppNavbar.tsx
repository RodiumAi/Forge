import { Bell, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { ME, TITLES, type Tab } from "../data";

type Props = { tab: Tab };

export default function AppNavbar({ tab }: Props) {
  const home = tab === "home";
  return (
    <header className="app-navbar">
      {home ? (
        <div className="who">
          <p className="date">Saturday, 25 October</p>
          <h1>Good morning, <em>{ME.first}</em></h1>
        </div>
      ) : (
        <h1 className="screen-title">{TITLES[tab]}</h1>
      )}
      <div className="nav-actions">
        {tab !== "discover" && (
          <Link to="/discover" className="nav-action" aria-label="Search books"><Search size={19} strokeWidth={1.8} aria-hidden /></Link>
        )}
        <button className="nav-action" aria-label="Notifications">
          <Bell size={19} strokeWidth={1.8} aria-hidden />
          <span className="nav-dot" aria-hidden />
        </button>
      </div>
    </header>
  );
}
