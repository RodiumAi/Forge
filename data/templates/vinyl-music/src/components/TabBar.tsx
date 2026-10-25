import { House, Library, Search, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "search", label: "Search", icon: Search },
  { id: "library", label: "Library", icon: Library },
  { id: "profile", label: "Profile", icon: UserRound },
];

/** Dark translucent bar docked at the bottom, labels always visible; the active tab glows pink. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon }) => (
        <NavLink key={id} to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          <Icon size={22} strokeWidth={2} aria-hidden />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
