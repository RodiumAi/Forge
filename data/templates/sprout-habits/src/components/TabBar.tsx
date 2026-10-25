import { ChartColumn, ListChecks, Plus, Sun, UserRound } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: "home", label: "Today", icon: Sun },
  { id: "habits", label: "Habits", icon: ListChecks },
  { id: "stats", label: "Stats", icon: ChartColumn },
  { id: "profile", label: "Profile", icon: UserRound },
];

function TabLink({ id, label, icon: Icon }: (typeof TABS)[number]) {
  return (
    <NavLink to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
      <Icon size={21} strokeWidth={2} aria-hidden />
      <span>{label}</span>
    </NavLink>
  );
}

/** White rounded bar with a raised green "+" in the middle that opens /new-habit. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      <TabLink {...TABS[0]} />
      <TabLink {...TABS[1]} />
      <Link to="/new-habit" className="tab-add" aria-label="New habit"><Plus size={26} strokeWidth={2.6} aria-hidden /></Link>
      <TabLink {...TABS[2]} />
      <TabLink {...TABS[3]} />
    </nav>
  );
}
