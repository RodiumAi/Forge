import { Compass, House, LibraryBig, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "library", label: "Library", icon: LibraryBig },
  { id: "profile", label: "Profile", icon: UserRound },
];

/** Paper tab bar with a hairline top border; the active tab gets a burgundy
 *  icon, label and a short ribbon mark above it, like a bookmark. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon }) => (
        <NavLink key={id} to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          <Icon size={21} strokeWidth={1.8} aria-hidden />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
