import { Compass, House, MessagesSquare, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "chats", label: "Chats", icon: MessagesSquare },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "profile", label: "Profile", icon: UserRound },
];

/** Dark bar with labels; the active tab lights up aqua over a small glowing pill. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon }) => (
        <NavLink key={id} to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          <span className="tab-pill"><Icon size={20} strokeWidth={1.9} aria-hidden /></span>
          <span className="tab-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
