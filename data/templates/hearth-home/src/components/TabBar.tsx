import { DoorClosed, House, Settings, Zap } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "rooms", label: "Rooms", icon: DoorClosed },
  { id: "energy", label: "Energy", icon: Zap },
  { id: "settings", label: "Settings", icon: Settings },
];

/** Docked glass bar, labels always visible; the active icon glows amber. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon }) => (
        <NavLink key={id} to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          <span className="tab-icon"><Icon size={21} strokeWidth={1.9} aria-hidden /></span>
          <span className="tab-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
