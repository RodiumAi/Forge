import { CircleUserRound, Compass, Heart, Plane } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: "home", label: "Explore", icon: Compass },
  { id: "saved", label: "Saved", icon: Heart },
  { id: "trips", label: "Trips", icon: Plane },
  { id: "profile", label: "Profile", icon: CircleUserRound },
];

/** Frosted glass bar docked at the bottom, icons only; the active icon sits in a blue circle. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon }) => (
        <NavLink key={id} to={PATHS[id]} end aria-label={label} className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          <span className="tab-dot"><Icon size={21} strokeWidth={2} aria-hidden /></span>
        </NavLink>
      ))}
    </nav>
  );
}
