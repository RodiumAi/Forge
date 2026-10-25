import { House, ReceiptText, Search, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "search", label: "Search", icon: Search },
  { id: "orders", label: "Orders", icon: ReceiptText },
  { id: "profile", label: "Profile", icon: UserRound },
];

/** White bar with a soft top shadow; the active tab gets a filled tomato pill behind its icon. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon }) => (
        <NavLink key={id} to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          <span className="tab-pill"><Icon size={21} strokeWidth={2} aria-hidden /></span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
