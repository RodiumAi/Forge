import { Compass, Moon, Sun, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: "home", label: "Today", icon: Sun },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "sleep", label: "Sleep", icon: Moon },
  { id: "profile", label: "Profile", icon: UserRound },
];

/** Classic bottom bar: labels always visible, a small terracotta dot under the active tab. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon }) => (
        <NavLink key={id} to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          <Icon size={22} strokeWidth={1.8} aria-hidden />
          <span>{label}</span>
          <i className="tab-dot" aria-hidden />
        </NavLink>
      ))}
    </nav>
  );
}
