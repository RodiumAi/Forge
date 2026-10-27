import { ChartPie, CreditCard, House, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "cards", label: "Cards", icon: CreditCard },
  { id: "insights", label: "Insights", icon: ChartPie },
  { id: "profile", label: "Profile", icon: UserRound },
];

/** Floating pill tab bar; the active tab grows into a lime capsule with its label. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon }) => (
        <NavLink key={id} to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          <Icon size={20} strokeWidth={2} aria-hidden />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
